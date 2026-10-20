/** "20 seconds", "2 minutes", "3 hours", "2 days": the largest whole unit, for messages people read.
 * One wording for an age everywhere: in an alert, a refused command and on a screen. */
export function describeAge(ageSeconds: number): string {
  const plural = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"}`;
  if (ageSeconds < 60) return plural(Math.round(ageSeconds), "second");
  if (ageSeconds < 3600) return plural(Math.floor(ageSeconds / 60), "minute");
  if (ageSeconds < 86400) return plural(Math.floor(ageSeconds / 3600), "hour");
  return plural(Math.floor(ageSeconds / 86400), "day");
}
