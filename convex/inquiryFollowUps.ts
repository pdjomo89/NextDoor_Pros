import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { canReplyFree } from './inquiryUnlocks';

// ──────────────────────────────────────────────────────────────────────────
// Unanswered-inquiry follow-ups.
//
// A customer who messages a pro and hears nothing back is the worst experience
// this marketplace can produce: they did nothing wrong, paid nothing, and are
// simply waiting. This chases it from the customer's side, in every market:
//
//   +1 day   nudge the pro by email: someone is waiting on you
//   +2 days  auto-decline: close the thread and tell the customer to try
//            another pro, so they aren't waiting on someone who never will
//
// The clock is `conversations.awaitingReplySince`, set when a customer's
// message lands on a thread the pro has never answered and cleared the moment
// they do (convex/messaging.ts). Silence is silence whatever the reason — a
// Cameroonian pro who won't pay the reply fee, one who paid and then went
// quiet, and a Canadian pro whose membership already covers replying are all
// chased identically. Only the nudge's wording differs: a pro still behind the
// paywall is told to unlock, everyone else is just told to reply.
//
// Declining is terminal: convex/messaging.sendMessage refuses to send, and
// convex/inquiryUnlocks.createPendingInquiryUnlock refuses to take the pro's
// money for a lead that has moved on.
// ──────────────────────────────────────────────────────────────────────────

/** Hours a pro has to answer before we email them a reminder. */
export const INQUIRY_NUDGE_HOURS = 24;
/** Days a pro has to answer before the inquiry is auto-declined. */
export const INQUIRY_DECLINE_DAYS = 2;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type DueInquiry = {
  conversationId: Id<'conversations'>;
  action: 'nudge' | 'decline';
  /** Still behind the reply fee — changes what the nudge asks them to do. */
  locked: boolean;
  proEmail?: string;
  customerEmail?: string;
  guestToken?: string;
};

/**
 * Threads waiting on a pro that have crossed a deadline. Bounded scan over the
 * awaiting index — a thread leaves it as soon as the pro replies or it is
 * declined, so this stays small.
 */
export const dueForFollowUp = internalQuery({
  args: {},
  handler: async (ctx): Promise<DueInquiry[]> => {
    const now = Date.now();
    const nudgeCutoff = now - INQUIRY_NUDGE_HOURS * HOUR_MS;
    const declineCutoff = now - INQUIRY_DECLINE_DAYS * DAY_MS;

    // Lower-bounded on purpose: rows with no `awaitingReplySince` sort before
    // every number in the index, so an open-ended `lte` would fill the page
    // with threads that aren't waiting on anyone and starve the real ones.
    const waiting = await ctx.db
      .query('conversations')
      .withIndex('by_awaitingReplySince', (q) =>
        q.gt('awaitingReplySince', 0).lte('awaitingReplySince', nudgeCutoff),
      )
      .take(200);

    const due: DueInquiry[] = [];
    for (const convo of waiting) {
      const since = convo.awaitingReplySince;
      if (since === undefined) continue; // defensive; the range excludes these
      if (convo.status === 'declined') continue;

      // Past the decline deadline → close it. Otherwise it is past the nudge
      // deadline (the index range guarantees that) → chase once.
      const alreadyNudged = convo.nudgedAt !== undefined;
      if (since > declineCutoff && alreadyNudged) continue;
      const action: 'nudge' | 'decline' =
        since <= declineCutoff ? 'decline' : 'nudge';

      // Customer inquiries only. Job threads sit in the POSTER's inbox and
      // never start this clock; the guard keeps it that way if that changes.
      if (!convo.contractorId) continue;

      const pro: Doc<'users'> | null = await ctx.db.get(convo.contractorOwnerId);
      due.push({
        conversationId: convo._id,
        action,
        locked: !(await canReplyFree(ctx, convo.contractorOwnerId, convo)),
        proEmail: (pro as { email?: string } | null)?.email,
        customerEmail: convo.customerEmail,
        guestToken: convo.guestToken,
      });
    }
    return due;
  },
});

/** Record that the pro was nudged, so they are only chased once. */
export const markNudged = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const convo = await ctx.db.get(conversationId);
    if (!convo || convo.nudgedAt !== undefined) return;
    await ctx.db.patch(conversationId, { nudgedAt: Date.now() });
  },
});

/**
 * Close an unanswered inquiry. Clears the awaiting clock so the thread leaves
 * the follow-up index, and leaves `declinedAt` as the audit trail.
 */
export const markDeclined = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const convo = await ctx.db.get(conversationId);
    if (!convo || convo.status === 'declined') return;
    await ctx.db.patch(conversationId, {
      status: 'declined',
      declinedAt: Date.now(),
      awaitingReplySince: undefined,
    });
  },
});

export const runInquiryFollowUps = internalAction({
  args: {},
  handler: async (ctx): Promise<{ nudged: number; declined: number }> => {
    const due: DueInquiry[] = await ctx.runQuery(
      internal.inquiryFollowUps.dueForFollowUp,
      {},
    );

    const siteUrl = (
      process.env.SITE_URL ?? 'https://nextdoor-pros.vercel.app'
    ).replace(/\/$/, '');

    let nudged = 0;
    let declined = 0;
    for (const item of due) {
      try {
        if (item.action === 'nudge') {
          if (item.proEmail) {
            await ctx.runAction(internal.messaging.notifyByEmail, {
              toEmail: item.proEmail,
              link: `${siteUrl}/en/messages?c=${item.conversationId}`,
              subject: 'A customer is waiting for your reply',
              intro:
                `A customer messaged you on NextDoor Pros and is still waiting. ` +
                (item.locked
                  ? 'Unlock the conversation to reply'
                  : 'Open the conversation and reply') +
                ` — if you don't, it closes in ${INQUIRY_DECLINE_DAYS} days ` +
                `and they'll be asked to contact another pro.`,
            });
          }
          await ctx.runMutation(internal.inquiryFollowUps.markNudged, {
            conversationId: item.conversationId,
          });
          nudged += 1;
        } else {
          await ctx.runMutation(internal.inquiryFollowUps.markDeclined, {
            conversationId: item.conversationId,
          });
          if (item.customerEmail && item.guestToken) {
            await ctx.runAction(internal.messaging.notifyByEmail, {
              toEmail: item.customerEmail,
              link: `${siteUrl}/en/services`,
              subject: "Your request didn't get a reply",
              intro:
                `The pro you messaged on NextDoor Pros didn't reply within ` +
                `${INQUIRY_DECLINE_DAYS} days, so we've closed that request. ` +
                `Nothing was charged to you. Plenty of other pros are available — ` +
                `browse them below and send your request again.`,
            });
          }
          declined += 1;
        }
      } catch {
        // Leave it waiting; the next run retries.
      }
    }
    return { nudged, declined };
  },
});
