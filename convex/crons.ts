import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Release job escrows the pro marked done more than ESCROW_AUTO_RELEASE_DAYS ago
// that the employer never confirmed — protects pros from unresponsive employers.
crons.interval(
  'auto-release job escrows',
  { hours: 6 },
  internal.jobEscrow.autoReleaseDueEscrows,
  {},
);

// Chase pros sitting on an unanswered customer inquiry, in every market: a
// reminder after INQUIRY_NUDGE_HOURS, then auto-decline after
// INQUIRY_DECLINE_DAYS so the customer isn't left waiting indefinitely.
crons.interval(
  'follow up on unanswered inquiries',
  { hours: 1 },
  internal.inquiryFollowUps.runInquiryFollowUps,
  {},
);

export default crons;
