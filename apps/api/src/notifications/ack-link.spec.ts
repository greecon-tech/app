import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { ACK_LINK_LIFETIME_MS, ackLinkKey, ackToken, openAckToken, sentTo } from "./ack-link";

// The token in the "I have seen this" link: short enough for a text message, and good for one alert of one account, for one
// person, for a limited time, and for nothing else.

const SECRET = "x".repeat(48);
const KEY = ackLinkKey(SECRET) as Buffer;
const ALERT = "9d2f6c1e-4b7a-4c3e-9f10-2a6b8c4d5e01";
const TENANT = "5b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const BESA = "c1a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8";
const ARBEN = "c2a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8";
const NOW = Date.parse("2026-10-19T12:00:00Z");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** The alerts the platform holds, found by the start of their id, as PlatformService.alertsForLink does. */
const holding = (...alerts: Array<{ alertId: string; tenantId: string }>) => (idStartHex: string) => alerts.filter((alert) => alert.alertId.replace(/-/g, "").startsWith(idStartHex));
const theAlert = holding({ alertId: ALERT, tenantId: TENANT });
const token = (overrides: { alertId?: string; tenantId?: string; contactId?: string } = {}, expiresAtMs = NOW + ACK_LINK_LIFETIME_MS) =>
  ackToken(KEY, { alertId: ALERT, tenantId: TENANT, contactId: BESA, ...overrides }, expiresAtMs) as string;

describe("the token in an alert message's link", () => {
  it("is 36 characters of the URL-safe alphabet, so the whole link fits in a text message", () => {
    expect(token()).toMatch(/^[A-Za-z0-9_-]{36}$/);
  });

  it("opens to its alert, its account and the person it was sent to", () => {
    const opened = openAckToken(KEY, token(), NOW, theAlert);
    expect(opened).toMatchObject({ alertId: ALERT, tenantId: TENANT });
    expect(sentTo(KEY, opened!, BESA)).toBe(true);
    expect(sentTo(KEY, opened!, ARBEN)).toBe(false);
  });

  it("is refused when any one character is changed", () => {
    const good = token();
    for (let at = 0; at < good.length; at += 1) {
      for (const replacement of [ALPHABET[(ALPHABET.indexOf(good[at] as string) + 1) % 64], ALPHABET[(ALPHABET.indexOf(good[at] as string) + 33) % 64]]) {
        const altered = `${good.slice(0, at)}${replacement}${good.slice(at + 1)}`;
        expect(openAckToken(KEY, altered, NOW, theAlert), `character ${at}`).toBeUndefined();
      }
    }
  });

  it("is refused when any one bit of what it carries is changed: the alert, the time, the person or the signature", () => {
    const bytes = Buffer.from(token(), "base64url");
    for (let bit = 0; bit < bytes.length * 8; bit += 1) {
      const altered = Buffer.from(bytes);
      altered[bit >> 3] = (altered[bit >> 3] as number) ^ (1 << (bit & 7));
      expect(openAckToken(KEY, altered.toString("base64url"), NOW, theAlert), `bit ${bit}`).toBeUndefined();
    }
  });

  it("works until its time, and not a millisecond after", () => {
    const sentAt = NOW;
    const good = token({}, sentAt + ACK_LINK_LIFETIME_MS);
    expect(openAckToken(KEY, good, sentAt + ACK_LINK_LIFETIME_MS, theAlert)).toBeDefined();
    expect(openAckToken(KEY, good, sentAt + ACK_LINK_LIFETIME_MS + 1, theAlert)).toBeUndefined();
    expect(ACK_LINK_LIFETIME_MS).toBe(72 * 3_600_000);
  });

  it("opens nothing for another alert, even one whose id begins the same way, or for the same alert in another account", () => {
    const twin = `${ALERT.slice(0, 19)}aaaa-aaaaaaaaaaaa`;
    expect(twin.replace(/-/g, "").slice(0, 16)).toBe(ALERT.replace(/-/g, "").slice(0, 16));
    expect(openAckToken(KEY, token(), NOW, holding({ alertId: twin, tenantId: TENANT }))).toBeUndefined();
    expect(openAckToken(KEY, token(), NOW, holding({ alertId: twin, tenantId: TENANT }, { alertId: ALERT, tenantId: TENANT }))).toMatchObject({ alertId: ALERT });
    expect(openAckToken(KEY, token(), NOW, holding({ alertId: ALERT, tenantId: "6b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" }))).toBeUndefined();
    expect(openAckToken(KEY, token(), NOW, holding())).toBeUndefined();
  });

  it("cannot be made without the key, which is derived from the session secret under its own label and is never the secret", () => {
    expect(KEY.equals(Buffer.from(SECRET))).toBe(false);
    expect(KEY).toHaveLength(32);
    expect(openAckToken(ackLinkKey("y".repeat(48)) as Buffer, token(), NOW, theAlert)).toBeUndefined();
    // Signed with the secret itself, a token is worthless.
    const withRawSecret = ackToken(Buffer.from(SECRET), { alertId: ALERT, tenantId: TENANT, contactId: BESA }, NOW + ACK_LINK_LIFETIME_MS) as string;
    expect(openAckToken(KEY, withRawSecret, NOW, theAlert)).toBeUndefined();
    expect(createHmac("sha256", SECRET).update("x").digest().equals(createHmac("sha256", KEY).update("x").digest())).toBe(false);
    expect(ackLinkKey(undefined)).toBeUndefined();
    expect(ackLinkKey("")).toBeUndefined();
  });

  it("names nobody when it was not sent to a person on the list, and cannot be changed to name someone", () => {
    const opened = openAckToken(KEY, token({ contactId: undefined }), NOW, theAlert);
    expect(opened).toBeDefined();
    expect(sentTo(KEY, opened!, BESA)).toBe(false);
  });

  it("refuses anything that is not one", () => {
    const good = token();
    for (const bad of ["", "x", good.slice(1), `${good}A`, `${good.slice(0, 35)}=`, `${good.slice(0, 35)}+`, `${good.slice(0, 35)}/`, `${good.slice(0, 35)}é`, " ".repeat(36), "../../../etc/passwd/aaaaaaaaaaaaaaaaaaaaa"]) {
      expect(openAckToken(KEY, bad, NOW, theAlert), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it("is not made for an alert whose id is not one the platform makes", () => {
    expect(ackToken(KEY, { alertId: "a-1", tenantId: TENANT }, NOW)).toBeUndefined();
  });
});
