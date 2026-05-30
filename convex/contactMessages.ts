import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';

const MAX_MESSAGE_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_TO = 'hello@mynextdoorpros.com';
const DEFAULT_FROM = 'NextDoor Pros <onboarding@resend.dev>';

/**
 * Public: store a Contact-page message and schedule an email notification.
 * Returns `{ ok: true }` once the row is written — email delivery happens
 * asynchronously in `sendEmail` and updates the row's `status`.
 */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    citySlug: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    locale: v.optional(v.string()),
    // Honeypot: if a bot fills this hidden field, silently no-op.
    honeypot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.honeypot && args.honeypot.trim() !== '') {
      return { ok: true as const };
    }

    const name = args.name.trim().slice(0, 200);
    const email = args.email.trim().slice(0, 320);
    const subject = args.subject.trim().slice(0, 300);
    const message = args.message.trim().slice(0, MAX_MESSAGE_LEN);

    if (!name || !email || !subject || !message) {
      throw new Error('MISSING_FIELDS');
    }
    if (!EMAIL_RE.test(email)) {
      throw new Error('INVALID_EMAIL');
    }

    const id = await ctx.db.insert('contactMessages', {
      name,
      email,
      subject,
      message,
      citySlug: args.citySlug,
      locale: args.locale,
      status: 'queued',
    });

    await ctx.scheduler.runAfter(0, internal.contactMessages.sendEmail, { id });

    return { ok: true as const };
  },
});

export const getById = internalQuery({
  args: { id: v.id('contactMessages') },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const markStatus = internalMutation({
  args: {
    id: v.id('contactMessages'),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, errorMessage }) => {
    await ctx.db.patch(id, { status, errorMessage });
  },
});

/**
 * Best-effort email delivery via Resend (https://resend.com).
 * Required env vars on the Convex deployment:
 *   RESEND_API_KEY       — Resend API key
 *   CONTACT_TO_EMAIL     — destination inbox (defaults to hello@mynextdoorpros.com)
 *   CONTACT_FROM_EMAIL   — verified "From" address (defaults to onboarding@resend.dev for testing)
 *
 * Without RESEND_API_KEY the message is still saved (status = 'skipped').
 */
export const sendEmail = internalAction({
  args: { id: v.id('contactMessages') },
  handler: async (ctx, { id }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO;
    const from = process.env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM;

    if (!apiKey) {
      await ctx.runMutation(internal.contactMessages.markStatus, {
        id,
        status: 'skipped',
      });
      return;
    }

    const doc: Doc<'contactMessages'> | null = await ctx.runQuery(
      internal.contactMessages.getById,
      { id },
    );
    if (!doc) return;

    const lines = [
      'New message from the NextDoor Pros Contact page.',
      '',
      `Name:    ${doc.name}`,
      `Email:   ${doc.email}`,
      doc.citySlug ? `City:    ${doc.citySlug}` : null,
      doc.locale ? `Locale:  ${doc.locale}` : null,
      '',
      `Subject: ${doc.subject}`,
      '',
      doc.message,
    ].filter((l) => l !== null);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: doc.email,
          subject: `[NextDoor Pros] ${doc.subject}`,
          text: lines.join('\n'),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend ${res.status}: ${detail.slice(0, 400)}`);
      }
      await ctx.runMutation(internal.contactMessages.markStatus, {
        id,
        status: 'sent',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.contactMessages.markStatus, {
        id,
        status: 'failed',
        errorMessage: msg.slice(0, 1000),
      });
    }
  },
});
