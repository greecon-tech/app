import { DatabaseService } from "../database/database.service";
import { EnergyLedger, MemoryBucketStore } from "./energy-ledger";
import { PostgresBucketStore } from "./postgres-bucket-store";

/** Totals go to PostgreSQL when there is one, and stay in memory when there is not (the demo and
 * the tests). */
export function createEnergyLedger(db: DatabaseService): EnergyLedger {
  return new EnergyLedger(db.isConfigured() ? new PostgresBucketStore(db) : new MemoryBucketStore());
}
