import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Release held bookings whose hold window has lapsed after the pro marked the
// work delivered (see PAYOUT_HOLD_DAYS, default 1 day). Runs hourly so funds
// are released promptly once the window passes.
crons.interval(
  'auto-release held payments',
  { hours: 1 },
  internal.payments.autoReleaseDue,
  {},
);

export default crons;
