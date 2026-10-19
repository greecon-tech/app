import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CHECK_SECONDS, forgetAllUsers, forgetUser, sessionIsStillGood } from "./active-users";

const USER = "11111111-aaaa-4aaa-8aaa-111111111111";
const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const seconds = (ms: number) => Math.floor(ms / 1000);

function database(row: { status: string; cut_off: string | null } | undefined) {
  const query = vi.fn().mockResolvedValue({ rows: row ? [row] : [] });
  return { db: { query } as never, query };
}

describe("whether a session still counts as the person's", () => {
  beforeEach(() => forgetAllUsers());

  it("accepts a session for an active account that has never had its sessions cut off", async () => {
    const { db } = database({ status: "active", cut_off: null });
    expect(await sessionIsStillGood(db, USER, seconds(NOW) - 3600, NOW)).toBe(true);
  });

  it("turns away a session for an account that is turned off, or has gone", async () => {
    expect(await sessionIsStillGood(database({ status: "disabled", cut_off: null }).db, USER, seconds(NOW), NOW)).toBe(false);
    forgetAllUsers();
    expect(await sessionIsStillGood(database(undefined).db, USER, seconds(NOW), NOW)).toBe(false);
  });

  it("turns away a session issued before the last cut-off, and keeps one issued after it", async () => {
    const cutOff = new Date(NOW - 600_000).toISOString();
    const { db } = database({ status: "active", cut_off: cutOff });
    expect(await sessionIsStillGood(db, USER, seconds(NOW) - 3600, NOW)).toBe(false);
    expect(await sessionIsStillGood(db, USER, seconds(NOW) - 60, NOW)).toBe(true);
  });

  it("keeps a session issued in the very second of the cut-off, so a person signing in just after a reset is not turned away", async () => {
    const { db } = database({ status: "active", cut_off: new Date(NOW + 400).toISOString() });
    expect(await sessionIsStillGood(db, USER, seconds(NOW), NOW + 500)).toBe(true);
  });

  it("turns away a token that says nothing about when it was issued, once there has been a cut-off", async () => {
    const { db } = database({ status: "active", cut_off: new Date(NOW - 1000).toISOString() });
    expect(await sessionIsStillGood(db, USER, undefined, NOW)).toBe(false);
  });

  it("does not ask the database on every request, but does again after a few seconds", async () => {
    const { db, query } = database({ status: "active", cut_off: null });
    await sessionIsStillGood(db, USER, seconds(NOW), NOW);
    await sessionIsStillGood(db, USER, seconds(NOW), NOW + 1000);
    await sessionIsStillGood(db, USER, seconds(NOW), NOW + (ACTIVE_CHECK_SECONDS - 1) * 1000);
    expect(query).toHaveBeenCalledTimes(1);
    await sessionIsStillGood(db, USER, seconds(NOW), NOW + (ACTIVE_CHECK_SECONDS + 1) * 1000);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("asks again at once when the person is forgotten, which is how turning someone off takes effect on their next click", async () => {
    let status = "active";
    const query = vi.fn().mockImplementation(async () => ({ rows: [{ status, cut_off: null }] }));
    const db = { query } as never;
    expect(await sessionIsStillGood(db, USER, seconds(NOW), NOW)).toBe(true);
    status = "disabled";
    expect(await sessionIsStillGood(db, USER, seconds(NOW), NOW + 1000)).toBe(true); // still within the few seconds remembered
    forgetUser(USER);
    expect(await sessionIsStillGood(db, USER, seconds(NOW), NOW + 2000)).toBe(false);
  });

  it("never lets a turned-off account be remembered as active", async () => {
    const { db, query } = database({ status: "disabled", cut_off: null });
    await sessionIsStillGood(db, USER, seconds(NOW), NOW);
    await sessionIsStillGood(db, USER, seconds(NOW), NOW + 1000);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuses an identifier that cannot be an account without asking the database", async () => {
    const { db, query } = database({ status: "active", cut_off: null });
    expect(await sessionIsStillGood(db, "user-1", seconds(NOW), NOW)).toBe(false);
    expect(await sessionIsStillGood(db, "edge-device", seconds(NOW), NOW)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
