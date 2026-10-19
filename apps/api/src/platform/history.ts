// How a chart's worth of history is asked for. A box that reads every ten seconds leaves a reading a
// minute per point in the database (see RAW_HISTORY_EVERY_MS), so a week of a hotel's ten points is
// over a hundred thousand rows. A chart can show a few hundred. Asking for "the first twenty thousand"
// would show the oldest days of the window and silently leave out the newest, so a long window is
// averaged into buckets that cover all of it instead.

const NICE_BUCKET_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

/** About this many points across a chart. */
const TARGET_BUCKETS = 288;

/** A window this short is shown reading by reading. */
export const RAW_HISTORY_MAX_HOURS = 6;

/** The width in minutes of the buckets for a window of this many hours, or 0 for the readings themselves. */
export function historyBucketMinutes(hours: number): number {
  if (hours <= RAW_HISTORY_MAX_HOURS) return 0;
  const wanted = (hours * 60) / TARGET_BUCKETS;
  return NICE_BUCKET_MINUTES.find((minutes) => minutes >= wanted) ?? 1440;
}
