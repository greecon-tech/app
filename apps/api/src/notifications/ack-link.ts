import { createHmac, hkdfSync, timingSafeEqual } from "crypto";

// The "I have seen this" link in an alert message (packages/shared/src/acknowledge-link.ts). It carries a short token,
// signed with a key of its own, so nothing is stored for it:
//
//   the first 8 bytes of the alert's id | when it stops working, in seconds | 3 bytes naming the person | a 12-byte signature
//
// 27 bytes, 36 characters of the URL-safe alphabet: short enough for a text message. The signature (96 bits) covers the
// alert's whole id, its account, the time and the person, so a token cannot be made up, guessed, moved to another alert or
// account, used after its time, or changed to name someone else. The key is derived from JWT_SECRET under a label of its
// own, never the secret itself; changing JWT_SECRET ends every link, as it ends every session.

/** How long a link keeps working after its message is sent: a weekend, not for ever. */
export const ACK_LINK_LIFETIME_MS = 72 * 3_600_000;

const ID_BYTES = 8;
const TIME_BYTES = 4;
const WHO_BYTES = 3;
const MAC_BYTES = 12;
const TOKEN_BYTES = ID_BYTES + TIME_BYTES + WHO_BYTES + MAC_BYTES;
/** 27 bytes are exactly 36 characters, with no padding and no spare bits: one token, one way to write it. */
const TOKEN_LENGTH = (TOKEN_BYTES / 3) * 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The key that signs the links, derived from the session secret under a label of its own; none without a secret. */
export function ackLinkKey(secret: string | undefined): Buffer | undefined {
  if (!secret) return undefined;
  return Buffer.from(hkdfSync("sha256", secret, "greecon", "alert acknowledge link, version 1", 32));
}

export interface AckLinkSubject {
  alertId: string;
  tenantId: string;
  /** The person on the list the message goes to, when it goes to one. */
  contactId?: string;
}

/** Who a link was sent to, in 3 bytes: enough to tell apart the ten people an account may have on its list. */
function whoTag(key: Buffer, contactId: string | undefined): Buffer {
  return createHmac("sha256", key).update(`who|${contactId ?? ""}`).digest().subarray(0, WHO_BYTES);
}

function signature(key: Buffer, alertId: string, tenantId: string, expiresAtS: number, who: Buffer): Buffer {
  return createHmac("sha256", key)
    .update(`ack|${alertId.toLowerCase()}|${tenantId.toLowerCase()}|${expiresAtS}|${who.toString("hex")}`)
    .digest()
    .subarray(0, MAC_BYTES);
}

/** The token for a link that works until `expiresAtMs`; undefined for an alert whose id is not a UUID (every real one is). */
export function ackToken(key: Buffer, subject: AckLinkSubject, expiresAtMs: number): string | undefined {
  if (!UUID.test(subject.alertId)) return undefined;
  const expiresAtS = Math.floor(expiresAtMs / 1000);
  const who = whoTag(key, subject.contactId);
  const bytes = Buffer.alloc(TOKEN_BYTES);
  Buffer.from(subject.alertId.replace(/-/g, ""), "hex").copy(bytes, 0, 0, ID_BYTES);
  bytes.writeUInt32BE(expiresAtS, ID_BYTES);
  who.copy(bytes, ID_BYTES + TIME_BYTES);
  signature(key, subject.alertId, subject.tenantId, expiresAtS, who).copy(bytes, ID_BYTES + TIME_BYTES + WHO_BYTES);
  return bytes.toString("base64url");
}

/** What a token that checks out says: which alert, in which account, and the tag of the person it was sent to. */
export interface OpenedAckToken {
  alertId: string;
  tenantId: string;
  who: Buffer;
}

/** Opens a token, or says nothing (undefined) whatever the reason: malformed, altered, expired, or naming no alert there
 * is. `alertsStartingWith` gives the alerts, of every account, whose id begins with the 16 hex digits the token carries;
 * the signature then decides which one, if any, it is for. The time is looked at only after the signature, so an expired
 * link takes as long to refuse as an altered one. */
export function openAckToken(
  key: Buffer,
  token: string,
  nowMs: number,
  alertsStartingWith: (idStartHex: string) => ReadonlyArray<{ alertId: string; tenantId: string }>
): OpenedAckToken | undefined {
  if (token.length !== TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) return undefined;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== TOKEN_BYTES) return undefined;
  const expiresAtS = bytes.readUInt32BE(ID_BYTES);
  const who = bytes.subarray(ID_BYTES + TIME_BYTES, ID_BYTES + TIME_BYTES + WHO_BYTES);
  const mac = bytes.subarray(ID_BYTES + TIME_BYTES + WHO_BYTES);
  const found = alertsStartingWith(bytes.subarray(0, ID_BYTES).toString("hex")).find((candidate) =>
    timingSafeEqual(signature(key, candidate.alertId, candidate.tenantId, expiresAtS, who), mac)
  );
  if (!found || nowMs > expiresAtS * 1000) return undefined;
  return { alertId: found.alertId, tenantId: found.tenantId, who: Buffer.from(who) };
}

/** Whether an opened link was sent to this person on the list. */
export function sentTo(key: Buffer, opened: OpenedAckToken, contactId: string): boolean {
  return timingSafeEqual(whoTag(key, contactId), opened.who);
}
