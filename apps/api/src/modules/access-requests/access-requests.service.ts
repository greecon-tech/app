import { HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AccessRequest, AccessRequestStatus, RequestedSiteType } from "@greecon/shared";
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
export type AccessRequestNotifier = (request: AccessRequest) => Promise<void>;

/** The same address asking again within a day is the same request. */
const DUPLICATE_WINDOW_MS = 24 * 3_600_000;
/** More than this many new requests in an hour from everyone together is a flood, not interest. */
const FLOOD_LIMIT_PER_HOUR = 40;

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

const tidy = (value: string): string => value.replace(/\s+/g, " ").trim();

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);
  private readonly memory: AccessRequest[] = [];

  constructor(
    private readonly db: DatabaseService,
    @Optional() @Inject(ACCESS_REQUEST_NOTIFIER) private readonly notify?: AccessRequestNotifier
  ) {}

  /** Takes a request from the public form. Always answers the same way, so the form tells a
   * script nothing about what it did. */
  async receive(input: NewAccessRequest, nowMs: number = Date.now()): Promise<{ received: true }> {
    // A person never fills the hidden field.
    if (input.website && input.website.trim() !== "") return { received: true };

    const email = input.email.trim().toLowerCase();
    if (await this.recentFrom(email, nowMs)) return { received: true };
    if ((await this.countSince(nowMs - 3_600_000)) >= FLOOD_LIMIT_PER_HOUR) {
      throw new HttpException("Too many requests right now. Please try again later or write to info@greecon.earth.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const now = new Date(nowMs).toISOString();
    const request: AccessRequest = {
      id: randomUUID(),
      name: tidy(input.name),
      company: tidy(input.company),
      email,
      phone: input.phone ? tidy(input.phone) : undefined,
      siteType: input.siteType,
      message: input.message ? input.message.trim() : undefined,
      status: "new",
      createdAtUtc: now,
      updatedAtUtc: now
    };

    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO access_requests (id, name, company, email, phone, site_type, message, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$8)`,
        [request.id, request.name, request.company, request.email, request.phone ?? null, request.siteType, request.message ?? null, now]
      );
    } else {
      this.memory.unshift(request);
    }

    // Greecon hearing about it is a courtesy on top of the inbox: if it fails, the request is still there.
    void this.notify?.(request).catch((error: unknown) => {
      this.logger.warn(`Could not tell Greecon about request ${request.id}: ${error instanceof Error ? error.message : String(error)}`);
    });
    return { received: true };
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
