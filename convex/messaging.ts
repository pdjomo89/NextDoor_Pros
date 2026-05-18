import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internalAction, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const MAX_BODY_LEN = 2000;
const MAX_NAME_LEN = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl(): string {
  return (
    process.env.SITE_URL?.replace(/\/$/, '') ??
    'https://nextdoor-pros.vercel.app'
  );
}

/** A long, unguessable secret used as the guest's private-link key. */
function newGuestToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '')
  );
}

/**
 * Strip phone numbers, emails and links out of message text so customers and
 * pros cannot trade off-platform contact details. Over-redaction is the safe
 * direction here — when in doubt, mask it.
 *
 * Exported for unit testing.
 */
export function redactContactInfo(input: string): { text: string; flagged: boolean } {
  let flagged = false;
  const mask = '[removed]';

  const patterns: RegExp[] = [
    // Email addresses.
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
    // Explicit URLs.
    /\b(?:https?:\/\/|www\.)\S+/gi,
    // Bare domains (wa.me, instagram.com, gmail.com, ...).
    /\b[a-z0-9-]+\.(?:com|net|org|ca|io|me|co|app|info|biz|xyz|link)\b\S*/gi,
    // Phone numbers: 7+ digits, optionally split by spaces, dashes, dots,
    // parentheses or a leading +.
    /(?:\+?\d[\s().-]*){6,}\d/g,
  ];

  let text = input;
  for (const re of patterns) {
    text = text.replace(re, () => {
      flagged = true;
      return mask;
    });
  }
  return { text, flagged };
}

// ──────────────────────────────────────────────────────────────────────────
// Guest customer side — no account required.
// ──────────────────────────────────────────────────────────────────────────

/**
 * A guest customer contacts a pro: email + a first message. Returns a secret
 * `guestToken` that authorizes access to the thread via a private link.
 * Re-uses an existing thread when the same email contacts the same pro.
 */
export const startGuestConversation = mutation({
  args: {
    contractorId: v.id('contractors'),
    email: v.string(),
    name: v.optional(v.string()),
    body: v.string(),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { contractorId, email, name, body, locale }) => {
    const contractor = await ctx.db.get(contractorId);
    if (!contractor) throw new Error('NOT_FOUND');

    const cleanEmail = email.trim().toLowerCase().slice(0, 320);
    if (!EMAIL_RE.test(cleanEmail)) throw new Error('INVALID_EMAIL');

    const cleanName = name?.trim().slice(0, MAX_NAME_LEN) || undefined;
    const trimmed = body.trim().slice(0, MAX_BODY_LEN);
    if (!trimmed) throw new Error('EMPTY');
    const { text, flagged } = redactContactInfo(trimmed);

    const loc = locale === 'fr' ? 'fr' : 'en';
    const now = Date.now();

    // Re-use a prior thread between this email and this pro.
    let convo = await ctx.db
      .query('conversations')
      .withIndex('by_contractor_email', (q) =>
        q.eq('contractorId', contractorId).eq('customerEmail', cleanEmail),
      )
      .first();

    let guestToken: string;
    let conversationId: Id<'conversations'>;
    let isNew = false;

    if (convo && convo.guestToken) {
      guestToken = convo.guestToken;
      conversationId = convo._id;
    } else {
      isNew = true;
      guestToken = newGuestToken();
      conversationId = await ctx.db.insert('conversations', {
        contractorId,
        contractorOwnerId: contractor.ownerId,
        customerEmail: cleanEmail,
        customerName: cleanName,
        guestToken,
        lastMessageAt: now,
        lastMessagePreview: '',
        lastSenderRole: 'customer',
        customerUnread: 0,
        contractorUnread: 0,
        status: 'active',
      });
      convo = await ctx.db.get(conversationId);
    }

    const contractorWasUnread = convo?.contractorUnread ?? 0;

    await ctx.db.insert('messages', {
      conversationId,
      senderRole: 'customer',
      body: text,
      flagged,
    });

    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: 'customer',
      contractorUnread: contractorWasUnread + 1,
      ...(cleanName && !convo?.customerName ? { customerName: cleanName } : {}),
    });

    // Notify the pro (only on the first message of an unread streak).
    if (contractorWasUnread === 0) {
      const pro = await ctx.db.get(contractor.ownerId);
      const proEmail = (pro as { email?: string } | null)?.email;
      if (proEmail) {
        await ctx.scheduler.runAfter(0, internal.messaging.notifyByEmail, {
          toEmail: proEmail,
          link: `${siteUrl()}/en/messages`,
          intro: 'You have a new message from a customer on NextDoor Pros.',
        });
      }
    }

    // On a brand-new thread, email the customer their private link.
    if (isNew) {
      await ctx.scheduler.runAfter(0, internal.messaging.notifyByEmail, {
        toEmail: cleanEmail,
        link: `${siteUrl()}/${loc}/messages/guest?t=${guestToken}`,
        intro:
          'Thanks for your message — the pro has been notified. Use the link below any time to see their reply and continue the conversation.',
      });
    }

    return { guestToken, conversationId };
  },
});

/** Guest sends a follow-up message, authorized by their secret token. */
export const sendGuestMessage = mutation({
  args: { token: v.string(), body: v.string() },
  handler: async (ctx, { token, body }) => {
    const convo = await ctx.db
      .query('conversations')
      .withIndex('by_guestToken', (q) => q.eq('guestToken', token))
      .first();
    if (!convo) throw new Error('NOT_FOUND');

    const trimmed = body.trim().slice(0, MAX_BODY_LEN);
    if (!trimmed) throw new Error('EMPTY');
    const { text, flagged } = redactContactInfo(trimmed);

    await ctx.db.insert('messages', {
      conversationId: convo._id,
      senderRole: 'customer',
      body: text,
      flagged,
    });
    await ctx.db.patch(convo._id, {
      lastMessageAt: Date.now(),
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: 'customer',
      contractorUnread: convo.contractorUnread + 1,
    });

    if (convo.contractorUnread === 0) {
      const pro = await ctx.db.get(convo.contractorOwnerId);
      const proEmail = (pro as { email?: string } | null)?.email;
      if (proEmail) {
        await ctx.scheduler.runAfter(0, internal.messaging.notifyByEmail, {
          toEmail: proEmail,
          link: `${siteUrl()}/en/messages`,
          intro: 'You have a new message from a customer on NextDoor Pros.',
        });
      }
    }
    return { flagged };
  },
});

/** Guest reads their thread via the private token. Returns null if invalid. */
export const getGuestConversation = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const convo = await ctx.db
      .query('conversations')
      .withIndex('by_guestToken', (q) => q.eq('guestToken', token))
      .first();
    if (!convo) return null;

    const contractor = await ctx.db.get(convo.contractorId);
    const rows = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', convo._id))
      .order('desc')
      .take(200);
    rows.reverse();

    return {
      contractorName: contractor?.businessName ?? 'Pro',
      customerName: convo.customerName ?? null,
      unread: convo.customerUnread,
      messages: rows.map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        senderRole: m.senderRole,
        body: m.body,
        flagged: m.flagged,
        mine: m.senderRole === 'customer',
      })),
    };
  },
});

/** Guest clears their unread badge. */
export const markGuestRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const convo = await ctx.db
      .query('conversations')
      .withIndex('by_guestToken', (q) => q.eq('guestToken', token))
      .first();
    if (convo && convo.customerUnread !== 0) {
      await ctx.db.patch(convo._id, { customerUnread: 0 });
    }
    return null;
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Pro side — signed-in users only.
// ──────────────────────────────────────────────────────────────────────────

/** Pro replies in their thread. Customer is notified via their private link. */
export const sendMessage = mutation({
  args: { conversationId: v.id('conversations'), body: v.string() },
  handler: async (ctx, { conversationId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error('NOT_FOUND');
    if (convo.contractorOwnerId !== userId) throw new Error('FORBIDDEN');

    const trimmed = body.trim().slice(0, MAX_BODY_LEN);
    if (!trimmed) throw new Error('EMPTY');
    const { text, flagged } = redactContactInfo(trimmed);

    await ctx.db.insert('messages', {
      conversationId,
      senderId: userId,
      senderRole: 'contractor',
      body: text,
      flagged,
    });
    await ctx.db.patch(conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: 'contractor',
      customerUnread: convo.customerUnread + 1,
    });

    // Email the customer their private link on the first reply of a streak.
    if (convo.customerUnread === 0 && convo.customerEmail && convo.guestToken) {
      await ctx.scheduler.runAfter(0, internal.messaging.notifyByEmail, {
        toEmail: convo.customerEmail,
        link: `${siteUrl()}/en/messages/guest?t=${convo.guestToken}`,
        intro: 'The pro replied to your message on NextDoor Pros.',
      });
    }
    return { flagged };
  },
});

/** Pro clears the unread badge on one of their threads. */
export const markRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const convo = await ctx.db.get(conversationId);
    if (!convo) return null;
    if (convo.contractorOwnerId === userId && convo.contractorUnread !== 0) {
      await ctx.db.patch(conversationId, { contractorUnread: 0 });
    }
    return null;
  },
});

/** The signed-in pro's inbox, newest activity first. */
export const listMyConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query('conversations')
      .withIndex('by_contractorOwner', (q) => q.eq('contractorOwnerId', userId))
      .order('desc')
      .take(100);

    return rows.map((c) => ({
      _id: c._id,
      contractorId: c.contractorId,
      role: 'contractor' as const,
      // The customer's email is never exposed to the pro.
      otherName: c.customerName ?? 'Customer',
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unread: c.contractorUnread,
    }));
  },
});

/** Messages in one of the pro's threads. Returns null if not theirs. */
export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const convo = await ctx.db.get(conversationId);
    if (!convo || convo.contractorOwnerId !== userId) return null;

    const rows = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(200);
    rows.reverse();

    return {
      myRole: 'contractor' as const,
      messages: rows.map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        senderRole: m.senderRole,
        body: m.body,
        flagged: m.flagged,
        mine: m.senderRole === 'contractor',
      })),
    };
  },
});

/** Total unread messages across the signed-in pro's threads. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const rows = await ctx.db
      .query('conversations')
      .withIndex('by_contractorOwner', (q) => q.eq('contractorOwnerId', userId))
      .take(100);
    return rows.reduce((n, c) => n + c.contractorUnread, 0);
  },
});

/**
 * Best-effort "you have a new message" email via Resend. Deliberately omits
 * the message body — the recipient must open the link to read it, which keeps
 * the conversation on-platform. No-ops when RESEND_API_KEY is unset.
 */
export const notifyByEmail = internalAction({
  args: { toEmail: v.string(), link: v.string(), intro: v.string() },
  handler: async (_ctx, { toEmail, link, intro }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const from =
      process.env.CONTACT_FROM_EMAIL ??
      'NextDoor Pros <onboarding@resend.dev>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [toEmail],
          subject: 'New message on NextDoor Pros',
          text: [
            intro,
            '',
            `Open the conversation: ${link}`,
            '',
            'For your safety, please keep all conversations and payments on NextDoor Pros.',
          ].join('\n'),
        }),
      });
    } catch {
      // Best-effort — a failed notification must not break the message send.
    }
  },
});
