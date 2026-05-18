import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { internalAction, mutation, query } from './_generated/server';
import { internal } from './_generated/api';

const MAX_BODY_LEN = 2000;

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

/**
 * Customer opens (or re-opens) a thread with a pro. Idempotent — re-uses the
 * existing conversation for the (customer, contractor) pair.
 */
export const startConversation = mutation({
  args: {
    contractorId: v.id('contractors'),
    jobId: v.optional(v.id('jobs')),
  },
  handler: async (ctx, { contractorId, jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const contractor = await ctx.db.get(contractorId);
    if (!contractor) throw new Error('NOT_FOUND');
    if (contractor.ownerId === userId) throw new Error('CANNOT_MESSAGE_SELF');

    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_pair', (q) =>
        q.eq('customerId', userId).eq('contractorId', contractorId),
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('conversations', {
      customerId: userId,
      contractorId,
      contractorOwnerId: contractor.ownerId,
      jobId,
      lastMessageAt: Date.now(),
      lastMessagePreview: '',
      lastSenderRole: 'customer',
      customerUnread: 0,
      contractorUnread: 0,
      status: 'active',
    });
  },
});

/** Post a message into a conversation. The body is redacted before storage. */
export const sendMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    body: v.string(),
  },
  handler: async (ctx, { conversationId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error('NOT_FOUND');

    const isCustomer = convo.customerId === userId;
    const isContractor = convo.contractorOwnerId === userId;
    if (!isCustomer && !isContractor) throw new Error('FORBIDDEN');
    const senderRole = isCustomer ? 'customer' : 'contractor';

    const trimmed = body.trim().slice(0, MAX_BODY_LEN);
    if (!trimmed) throw new Error('EMPTY');
    const { text, flagged } = redactContactInfo(trimmed);

    await ctx.db.insert('messages', {
      conversationId,
      senderId: userId,
      senderRole,
      body: text,
      flagged,
    });

    // The recipient's unread count *before* this message — used to decide
    // whether to fire an email (only on the first message of a streak).
    const recipientWasUnread = isCustomer
      ? convo.contractorUnread
      : convo.customerUnread;

    await ctx.db.patch(conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: senderRole,
      customerUnread: isCustomer ? convo.customerUnread : convo.customerUnread + 1,
      contractorUnread: isCustomer
        ? convo.contractorUnread + 1
        : convo.contractorUnread,
    });

    if (recipientWasUnread === 0) {
      const recipientUserId = isCustomer
        ? convo.contractorOwnerId
        : convo.customerId;
      const recipient = await ctx.db.get(recipientUserId);
      const email = (recipient as { email?: string } | null)?.email;
      if (email) {
        await ctx.scheduler.runAfter(0, internal.messaging.notifyByEmail, {
          toEmail: email,
        });
      }
    }
    return { flagged };
  },
});

/** Mark a conversation read for the calling side. */
export const markRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const convo = await ctx.db.get(conversationId);
    if (!convo) return null;

    if (convo.customerId === userId && convo.customerUnread !== 0) {
      await ctx.db.patch(conversationId, { customerUnread: 0 });
    } else if (
      convo.contractorOwnerId === userId &&
      convo.contractorUnread !== 0
    ) {
      await ctx.db.patch(conversationId, { contractorUnread: 0 });
    }
    return null;
  },
});

/** Every conversation the signed-in user is part of, newest activity first. */
export const listMyConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const asCustomer = await ctx.db
      .query('conversations')
      .withIndex('by_customer', (q) => q.eq('customerId', userId))
      .order('desc')
      .take(100);
    const asContractor = await ctx.db
      .query('conversations')
      .withIndex('by_contractorOwner', (q) => q.eq('contractorOwnerId', userId))
      .order('desc')
      .take(100);

    const out: Array<{
      _id: string;
      contractorId: string;
      role: 'customer' | 'contractor';
      otherName: string;
      lastMessageAt: number;
      lastMessagePreview: string;
      unread: number;
    }> = [];

    for (const c of [...asCustomer, ...asContractor]) {
      const role: 'customer' | 'contractor' =
        c.customerId === userId ? 'customer' : 'contractor';

      let otherName = 'NextDoor Pros user';
      if (role === 'customer') {
        const contractor = await ctx.db.get(c.contractorId);
        otherName = contractor?.businessName ?? 'Pro';
      } else {
        const customer = await ctx.db.get(c.customerId);
        const name = (customer as { name?: string } | null)?.name ?? null;
        const email = (customer as { email?: string } | null)?.email ?? null;
        otherName = name ?? (email ? email.split('@')[0] : 'Customer');
      }

      out.push({
        _id: c._id,
        contractorId: c.contractorId,
        role,
        otherName,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        unread: role === 'customer' ? c.customerUnread : c.contractorUnread,
      });
    }
    out.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return out;
  },
});

/** Messages in one conversation (oldest first). Returns null if not allowed. */
export const listMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const convo = await ctx.db.get(conversationId);
    if (!convo) return null;
    if (convo.customerId !== userId && convo.contractorOwnerId !== userId) {
      return null;
    }

    const rows = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .take(200);
    rows.reverse();

    return {
      myRole: convo.customerId === userId ? 'customer' : 'contractor',
      messages: rows.map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        senderRole: m.senderRole,
        body: m.body,
        flagged: m.flagged,
        mine: m.senderId === userId,
      })),
    };
  },
});

/** Total unread messages across all of the signed-in user's conversations. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const asCustomer = await ctx.db
      .query('conversations')
      .withIndex('by_customer', (q) => q.eq('customerId', userId))
      .take(100);
    const asContractor = await ctx.db
      .query('conversations')
      .withIndex('by_contractorOwner', (q) => q.eq('contractorOwnerId', userId))
      .take(100);

    let n = 0;
    for (const c of asCustomer) n += c.customerUnread;
    for (const c of asContractor) n += c.contractorUnread;
    return n;
  },
});

/**
 * Best-effort "you have a new message" email via Resend. Deliberately omits
 * the message body — the recipient must log in to read it, which keeps the
 * conversation on-platform. No-ops when RESEND_API_KEY is unset.
 */
export const notifyByEmail = internalAction({
  args: { toEmail: v.string() },
  handler: async (_ctx, { toEmail }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const from =
      process.env.CONTACT_FROM_EMAIL ??
      'NextDoor Pros <onboarding@resend.dev>';
    const site =
      process.env.SITE_URL?.replace(/\/$/, '') ??
      'https://nextdoor-pros.vercel.app';

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
          subject: 'You have a new message on NextDoor Pros',
          text: [
            'You have a new message on NextDoor Pros.',
            '',
            `Log in to read and reply: ${site}/en/messages`,
            '',
            'For your safety, please keep all conversations and payments on the platform.',
          ].join('\n'),
        }),
      });
    } catch {
      // Best-effort — a failed notification must not break sendMessage.
    }
  },
});
