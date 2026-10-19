import { Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { BucketDelta, BucketStore, BucketTotal } from "./energy-ledger";
import { CanonicalPointName } from "@greecon/shared";

const FOREIGN_KEY_VIOLATION = "23503";

export class PostgresBucketStore implements BucketStore {
  private readonly logger = new Logger(PostgresBucketStore.name);

  constructor(private readonly db: DatabaseService) {}

  async add(deltas: BucketDelta[]): Promise<void> {
    if (deltas.length === 0) return;
    try {
      await this.insert(deltas);
    } catch (error) {
      if ((error as { code?: string }).code !== FOREIGN_KEY_VIOLATION) throw error;
      // A point was deleted while its counts were waiting to be saved. Save the rest one at a time
      // and let go of those, so one deleted point cannot keep every other site's counts from saving.
      for (const delta of deltas) {
        try {
          await this.insert([delta]);
        } catch (single) {
          if ((single as { code?: string }).code !== FOREIGN_KEY_VIOLATION) throw single;
          this.logger.warn(`Dropped counts for a point that no longer exists (${delta.pointId}).`);
        }
      }
    }
  }

  private async insert(deltas: BucketDelta[]): Promise<void> {
    await this.db.query(
      `INSERT INTO energy_buckets (point_id, hour_start, tenant_id, site_id, canonical_name, amount, covered_seconds)
       SELECT * FROM unnest($1::uuid[], $2::timestamptz[], $3::uuid[], $4::uuid[], $5::text[], $6::double precision[], $7::double precision[])
       ON CONFLICT (point_id, hour_start) DO UPDATE SET
         amount = energy_buckets.amount + EXCLUDED.amount,
         covered_seconds = energy_buckets.covered_seconds + EXCLUDED.covered_seconds`,
      [
        deltas.map((delta) => delta.pointId),
        deltas.map((delta) => new Date(delta.hourStartMs).toISOString()),
        deltas.map((delta) => delta.tenantId),
        deltas.map((delta) => delta.siteId),
        deltas.map((delta) => delta.canonicalName),
        deltas.map((delta) => delta.amount),
        deltas.map((delta) => delta.coveredSeconds)
      ]
    );
  }

  async has(siteId: string): Promise<boolean> {
    const result = await this.db.query("SELECT 1 FROM energy_buckets WHERE site_id = $1 LIMIT 1", [siteId]);
    return (result.rowCount ?? 0) > 0;
  }

  async totals(siteId: string, fromMs: number, toMs: number): Promise<BucketTotal[]> {
    const fromHour = Math.floor(fromMs / 3_600_000) * 3_600_000;
    const result = await this.db.query<{ point_id: string; canonical_name: string; amount: number; covered_seconds: number; first_hour: Date }>(
      `SELECT point_id, canonical_name, sum(amount) AS amount, sum(covered_seconds) AS covered_seconds, min(hour_start) AS first_hour
       FROM energy_buckets
       WHERE site_id = $1 AND hour_start >= $2 AND hour_start <= $3
       GROUP BY point_id, canonical_name`,
      [siteId, new Date(fromHour).toISOString(), new Date(toMs).toISOString()]
    );
    return result.rows.map((row) => ({
      pointId: row.point_id,
      canonicalName: row.canonical_name as CanonicalPointName,
      amount: Number(row.amount),
      coveredSeconds: Number(row.covered_seconds),
      firstHourMs: row.first_hour.getTime()
    }));
  }
}
