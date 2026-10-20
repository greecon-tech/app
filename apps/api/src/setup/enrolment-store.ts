import { randomUUID } from "crypto";
import { DatabaseService } from "../database/database.service";

// Where issued enrolment codes are kept. Only a code's hash is stored. Using a code is one atomic
// step ("claim"), so two boxes presenting the same code cannot both get a credential.

export interface EnrolmentRecord {
  id: string;
  tenantId: string;
  gatewayId: string;
  codeHash: string;
  createdBy?: string;
  createdAtMs: number;
  expiresAtMs: number;
  usedAtMs?: number;
}

export type NewEnrolment = Omit<EnrolmentRecord, "id" | "usedAtMs">;

export interface EnrolmentStore {
  /** Saves the code, and removes the gateway's other unused codes: only the newest one works. */
  issue(record: NewEnrolment): Promise<EnrolmentRecord>;
  /** Whether the code is good right now, without using it. */
  peek(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined>;
  /** Uses the code. The record if it was unused and in date, otherwise undefined. */
  claim(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined>;
  /** Puts a claimed code back, because the step that needed it failed before the box got anything. */
  release(id: string): Promise<void>;
  /** Removes a gateway's unused codes (the gateway was deleted, or its box replaced). */
  revokeUnused(gatewayId: string): Promise<void>;
}

export class MemoryEnrolmentStore implements EnrolmentStore {
  private readonly records: EnrolmentRecord[] = [];

  async issue(record: NewEnrolment): Promise<EnrolmentRecord> {
    await this.revokeUnused(record.gatewayId);
    const saved: EnrolmentRecord = { ...record, id: randomUUID() };
    this.records.push(saved);
    return { ...saved };
  }

  async peek(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined> {
    const found = this.records.find((record) => record.codeHash === codeHash && record.usedAtMs === undefined && record.expiresAtMs > nowMs);
    return found ? { ...found } : undefined;
  }

  async claim(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined> {
    const found = this.records.find((record) => record.codeHash === codeHash && record.usedAtMs === undefined && record.expiresAtMs > nowMs);
    if (!found) return undefined;
    found.usedAtMs = nowMs;
    return { ...found };
  }

  async release(id: string): Promise<void> {
    const found = this.records.find((record) => record.id === id);
    if (found) delete found.usedAtMs;
  }

  async revokeUnused(gatewayId: string): Promise<void> {
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index] as EnrolmentRecord;
      if (record.gatewayId === gatewayId && record.usedAtMs === undefined) this.records.splice(index, 1);
    }
  }
}

interface EnrolmentRow {
  id: string;
  tenant_id: string;
  gateway_id: string;
  code_hash: string;
  created_by: string | null;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

function mapRow(row: EnrolmentRow): EnrolmentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    gatewayId: row.gateway_id,
    codeHash: row.code_hash,
    createdBy: row.created_by ?? undefined,
    createdAtMs: row.created_at.getTime(),
    expiresAtMs: row.expires_at.getTime(),
    usedAtMs: row.used_at?.getTime()
  };
}

const COLUMNS = "id, tenant_id, gateway_id, code_hash, created_by, created_at, expires_at, used_at";

export class PostgresEnrolmentStore implements EnrolmentStore {
  constructor(private readonly db: DatabaseService) {}

  async issue(record: NewEnrolment): Promise<EnrolmentRecord> {
    // One statement: the old unused codes go and the new one arrives together, or neither happens.
    const result = await this.db.query<EnrolmentRow>(
      `WITH removed AS (DELETE FROM gateway_enrolments WHERE gateway_id = $2 AND used_at IS NULL)
       INSERT INTO gateway_enrolments (tenant_id, gateway_id, code_hash, created_by, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [record.tenantId, record.gatewayId, record.codeHash, record.createdBy ?? null, new Date(record.createdAtMs), new Date(record.expiresAtMs)]
    );
    return mapRow(result.rows[0] as EnrolmentRow);
  }

  async peek(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined> {
    const result = await this.db.query<EnrolmentRow>(
      `SELECT ${COLUMNS} FROM gateway_enrolments WHERE code_hash = $1 AND used_at IS NULL AND expires_at > $2`,
      [codeHash, new Date(nowMs)]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async claim(codeHash: string, nowMs: number): Promise<EnrolmentRecord | undefined> {
    const result = await this.db.query<EnrolmentRow>(
      `UPDATE gateway_enrolments SET used_at = $2 WHERE code_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING ${COLUMNS}`,
      [codeHash, new Date(nowMs)]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async release(id: string): Promise<void> {
    await this.db.query("UPDATE gateway_enrolments SET used_at = NULL WHERE id = $1", [id]);
  }

  async revokeUnused(gatewayId: string): Promise<void> {
    await this.db.query("DELETE FROM gateway_enrolments WHERE gateway_id = $1 AND used_at IS NULL", [gatewayId]);
  }
}

/** Codes go to PostgreSQL when there is one, and stay in memory when there is not (the demo and the tests). */
export function createEnrolmentStore(db: DatabaseService): EnrolmentStore {
  return db.isConfigured() ? new PostgresEnrolmentStore(db) : new MemoryEnrolmentStore();
}
