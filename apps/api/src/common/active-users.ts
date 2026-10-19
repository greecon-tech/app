import type { DatabaseService } from "../database/database.service";

// A session is a signed token that stays good for hours, so by itself it cannot say that the person has
// since been turned off, or has chosen a new password. On each request the API therefore asks whether the
// account is still active and whether the token was issued after the last time sessions were cut off.
// The answer is remembered for a few seconds, so a busy page does not ask the database each time; turning
// someone off, or resetting a password, forgets it at once, so that takes effect on their next click.

export const ACTIVE_CHECK_SECONDS = 15;
const MAX_REMEMBERED = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Confirmed {
  until: number;
  /** Whole seconds; a token issued earlier than this is no longer good. */
  cutOffSeconds: number;
}

const confirmed = new Map<string, Confirmed>();

/** Called when the person is turned off or their password changes, so the next request asks again. */
export function forgetUser(userId: string): void {
  confirmed.delete(userId);
}

export function forgetAllUsers(): void {
  confirmed.clear();
}

/** Whether a session issued at `issuedAtSeconds` (the token's own `iat`) still counts as this person's. */
export async function sessionIsStillGood(db: Pick<DatabaseService, "query">, userId: string, issuedAtSeconds: number | undefined, nowMs: number = Date.now()): Promise<boolean> {
  // Every real account has a UUID. Anything else cannot be one, whoever signed the token.
  if (!UUID.test(userId)) return false;

  const known = confirmed.get(userId);
  if (known && known.until > nowMs) return issuedAfter(issuedAtSeconds, known.cutOffSeconds);

  const { rows } = await db.query<{ status: string; cut_off: string | null }>("SELECT status, sessions_valid_after::text AS cut_off FROM users WHERE id = $1", [userId]);
  const row = rows[0];
  if (row?.status !== "active") {
    confirmed.delete(userId);
    return false;
  }

  const cutOffMs = row.cut_off ? Date.parse(row.cut_off) : 0;
  const cutOffSeconds = Number.isFinite(cutOffMs) ? Math.floor(cutOffMs / 1000) : 0;
  if (confirmed.size >= MAX_REMEMBERED) {
    for (const [key, value] of confirmed) if (value.until <= nowMs) confirmed.delete(key);
    if (confirmed.size >= MAX_REMEMBERED) confirmed.clear();
  }
  confirmed.set(userId, { until: nowMs + ACTIVE_CHECK_SECONDS * 1000, cutOffSeconds });
  return issuedAfter(issuedAtSeconds, cutOffSeconds);
}

/** A token issued in the same second as the cut-off is kept: a person who signs in the moment after a
 * reset must not be turned away, and the second is the finest a token's `iat` can say. */
function issuedAfter(issuedAtSeconds: number | undefined, cutOffSeconds: number): boolean {
  if (cutOffSeconds === 0) return true;
  return typeof issuedAtSeconds === "number" && issuedAtSeconds >= cutOffSeconds;
}
