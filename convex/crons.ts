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

export default crons;
