import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ACCESS_REQUEST_LIMITS, AccessRequest, AccessRequestStatus, RequestedSiteType } from "@greecon/shared";
import { oneLine, severalLines, webAddressesIn } from "../../common/plain-text";
import { DatabaseService } from "../../database/database.service";

export interface NewAccessRequest {
  name: string;
  company: string;
  email: string;
  phone?: string;
  siteType: RequestedSiteType;
  message?: string;
  website?: string;
}

/** Told about each new request, so Greecon hears of it. Provided by the notifications module when
 * messaging is set up; absent otherwise, and requests are then simply waiting in the inbox. */
export const ACCESS_REQUEST_NOTIFIER = "ACCESS_REQUEST_NOTIFIER";
export type AccessRequestNotifier = ((request: AccessRequest) => Promise<void>) & {
  /** That requests are arriving faster than real interest does: said once a day at most, instead of once for each. */
  flood?: (requestsInTheLastDay: number) => Promise<void>;
};

const HOUR_MS = 3_600_000;
/** The same address asking again within a day is the same request, answered as a new one is and not kept twice. (At most
 * one a day: stricter than three, and what was already built and promised.) */
const DUPLICATE_WINDOW_MS = 24 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;
/** The most requests Greecon's team is emailed about in any 24 hours, from everyone together. The email provider's allowance for a
 * day (a hundred on its free plan) is shared with the alert messages, which matter more, so a form filled in by machine must never
 * be able to use it up. A request past it is still kept, and shows in the inbox: a real prospect is never lost in a flood. The
 * sales address is told once a day that this is happening instead of about each one. */
export const SALES_EMAILS_PER_DAY = 10;
/** Past this many in an hour, from everyone together, a request is turned away with an address to write to instead: a flood
 * must not be able to fill the database. Far above any real interest, and above the flood the sales address is told of. */
export const KEPT_PER_HOUR_AT_MOST = 300;
/** The most web addresses a request's words may carry: a prospect may give a website or two, a spammer gives a list. */
const MOST_WEB_ADDRESSES = 2;

interface AccessRequestRow {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  site_type: string;
  message: string | null;
  status: string;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: AccessRequestRow): AccessRequest {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone ?? undefined,
    siteType: row.site_type as RequestedSiteType,
    message: row.message ?? undefined,
    status: row.status as AccessRequestStatus,
    note: row.note ?? undefined,
    createdAtUtc: row.created_at.toISOString(),
    updatedAtUtc: row.updated_at.toISOString()
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A web address in an email address: a scheme, or a "www." where a name should be. (Not a domain alone: every address has one.) */
const LINK_IN_ADDRESS = /:\/\/|(^|[^a-z0-9])www\./i;
/** An email address as people write it: plain letters, digits and the few marks addresses use, one @, a domain. It is put into
 * the sales team's email as it is (a mail program may make a link of it, and that is the link the reader wants), so nothing
 * else may ride in it: no quoted words before the @, no spaces. */
const PLAIN_EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
/** A telephone number keeps its digits and the marks numbers are written with, and nothing else. */
function dialable(text: string): string {
  const kept = text.replace(/[^0-9+()./ -]/g, "").replace(/\s+/g, " ").trim();
  return kept.replace(/\D/g, "").length >= 5 ? kept : "";
}

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);
  private readonly memory: AccessRequest[] = [];
  /** When the sales address was last told that requests are arriving in a flood. Kept in memory: after a restart in the
   * middle of a flood, it is told once more. */
  private floodToldAtMs: number | undefined;
  /** When Greecon's team was last emailed about a request, for the last day. Taken here, with nothing awaited in between, so that
   * requests that arrive at the same moment cannot each take the last place. */
  private readonly emailedAtMs: number[] = [];

  constructor(
    private readonly db: DatabaseService,
    @Optional() @Inject(ACCESS_REQUEST_NOTIFIER) private readonly notify?: AccessRequestNotifier
  ) {}

  /** Takes a request from the public form. Always answers the same way, so the form tells a
   * script nothing about what it did. */
  async receive(input: NewAccessRequest, nowMs: number = Date.now()): Promise<{ received: true }> {
    // A person never fills the hidden field: what fills it is answered as a person is, and nothing is kept or sent.
    if (input.website && input.website.trim() !== "") return { received: true };

    const request = this.tidied(input, nowMs);
    if (await this.recentFrom(request.email, nowMs)) return { received: true };
    const [keptThisHour, keptToday] = await Promise.all([this.countSince(nowMs - HOUR_MS), this.countSince(nowMs - DAY_MS)]);
    if (keptThisHour >= KEPT_PER_HOUR_AT_MOST) {
      throw new HttpException("Too many requests right now. Please try again later or write to info@greecon.earth.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const now = request.createdAtUtc;

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO access_requests (id, name, company, email, phone, site_type, message, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$8)`,
        [request.id, request.name, request.company, request.email, request.phone ?? null, request.siteType, request.message ?? null, now]
      );
    } else {
      this.memory.unshift(request);
    }

    this.tellGreecon(request, keptToday + 1, nowMs);
    return { received: true };
  }

  /** The request as it is kept: every field without control or invisible characters, trimmed, and on one line, except the
   * words, which keep their line breaks. Refused, in words the form can show, when it has nothing in a field it needs, when the
   * name or the email address carries a web address, or when the words carry more than two. */
  private tidied(input: NewAccessRequest, nowMs: number): AccessRequest {
    const name = oneLine(input.name, ACCESS_REQUEST_LIMITS.name);
    const company = oneLine(input.company, ACCESS_REQUEST_LIMITS.company);
    const email = oneLine(input.email, ACCESS_REQUEST_LIMITS.email).toLowerCase();
    const phone = input.phone ? dialable(oneLine(input.phone, ACCESS_REQUEST_LIMITS.phone)) : "";
    const message = input.message ? severalLines(input.message, ACCESS_REQUEST_LIMITS.message) : "";
    if (!name || !company || !email) throw new BadRequestException("Please give your name, your company and an email address.");
    if (webAddressesIn(name) > 0 || LINK_IN_ADDRESS.test(email)) throw new BadRequestException("Please write your name and your email address without a web address in them.");
    if (!PLAIN_EMAIL.test(email)) throw new BadRequestException("Please give an email address such as name@company.com, with nothing else in it.");
    if (webAddressesIn(message) > MOST_WEB_ADDRESSES) throw new BadRequestException(`Please give at most ${MOST_WEB_ADDRESSES} web addresses in your message.`);
    const now = new Date(nowMs).toISOString();
    return {
      id: randomUUID(),
      name,
      company,
      email,
      ...(phone ? { phone } : {}),
      siteType: input.siteType,
      ...(message ? { message } : {}),
      status: "new",
      createdAtUtc: now,
      updatedAtUtc: now
    };
  }

  /** Greecon hearing of a request is a courtesy on top of the inbox: if telling fails, the request is still there. The first
   * SALES_EMAILS_PER_DAY requests of a day are told one by one; past that the sales address is told once, that requests are
   * arriving in a flood, and not about each, until a day has passed since it was told. `keptToday` counts this request. */
  private tellGreecon(request: AccessRequest, keptToday: number, nowMs: number): void {
    const warn = (what: string) => (error: unknown) => this.logger.warn(`Could not tell Greecon ${what}: ${error instanceof Error ? error.message : String(error)}`);
    while (this.emailedAtMs.length > 0 && nowMs - (this.emailedAtMs[0] as number) >= DAY_MS) this.emailedAtMs.shift();
    // Both counts must allow it: the kept requests in the database (they outlast a restart) and the places taken in this process
    // (exact when requests arrive together).
    if (keptToday <= SALES_EMAILS_PER_DAY && this.emailedAtMs.length < SALES_EMAILS_PER_DAY) {
      this.emailedAtMs.push(nowMs);
      void this.notify?.(request).catch(warn(`about request ${request.id}`));
      return;
    }
    if (this.floodToldAtMs !== undefined && nowMs - this.floodToldAtMs < DAY_MS) return;
    this.floodToldAtMs = nowMs;
    void this.notify?.flood?.(keptToday).catch(warn("that requests are arriving in a flood"));
  }

  async list(status?: AccessRequestStatus): Promise<AccessRequest[]> {
    if (!this.db.isConfigured()) return this.memory.filter((request) => !status || request.status === status);
    const result = await this.db.query<AccessRequestRow>(
      `SELECT * FROM access_requests WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 500`,
      [status ?? null]
    );
    return result.rows.map(mapRow);
  }

  async get(id: string): Promise<AccessRequest | undefined> {
    if (!this.db.isConfigured()) return this.memory.find((request) => request.id === id);
    const result = await this.db.query<AccessRequestRow>("SELECT * FROM access_requests WHERE id = $1", [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async update(id: string, patch: { status?: AccessRequestStatus; note?: string }, handledBy: string): Promise<AccessRequest> {
    const existing = await this.get(id);
    if (!existing) throw new NotFoundException("Request not found.");
    const next: AccessRequest = {
      ...existing,
      status: patch.status ?? existing.status,
      note: patch.note !== undefined ? patch.note.trim() || undefined : existing.note,
      updatedAtUtc: new Date().toISOString()
    };

    if (this.db.isConfigured()) {
      // handled_by is a real user; the demo and header-trusted identities are not rows in users (and
      // are not even uuids), so they are recorded as nobody rather than failing the update.
      const known = UUID.test(handledBy) ? await this.db.query("SELECT 1 FROM users WHERE id = $1", [handledBy]) : { rowCount: 0 };
      await this.db.query("UPDATE access_requests SET status = $2, note = $3, handled_by = $4, updated_at = $5 WHERE id = $1", [
        id,
        next.status,
        next.note ?? null,
        (known.rowCount ?? 0) > 0 ? handledBy : null,
        next.updatedAtUtc
      ]);
    } else {
      const index = this.memory.findIndex((request) => request.id === id);
      this.memory[index] = next;
    }
    return next;
  }

  private async recentFrom(email: string, nowMs: number): Promise<boolean> {
    const since = nowMs - DUPLICATE_WINDOW_MS;
    if (!this.db.isConfigured()) return this.memory.some((request) => request.email === email && Date.parse(request.createdAtUtc) >= since);
    const result = await this.db.query("SELECT 1 FROM access_requests WHERE lower(email) = $1 AND created_at >= $2 LIMIT 1", [email, new Date(since).toISOString()]);
    return (result.rowCount ?? 0) > 0;
  }

  private async countSince(sinceMs: number): Promise<number> {
    if (!this.db.isConfigured()) return this.memory.filter((request) => Date.parse(request.createdAtUtc) >= sinceMs).length;
    const result = await this.db.query<{ n: string }>("SELECT count(*) AS n FROM access_requests WHERE created_at >= $1", [new Date(sinceMs).toISOString()]);
    return Number(result.rows[0]?.n ?? 0);
  }
}
