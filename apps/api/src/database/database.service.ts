import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool, QueryResult, QueryResultRow } from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool | undefined;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      this.pool = new Pool({ connectionString });
      // A database that restarts (maintenance, a failover) ends the connections it had open. The pool
      // reports that as an error event on behalf of its idle connections, and an error event with no
      // listener takes the whole process down. The pool replaces the connection by itself; all that is
      // needed here is to say it happened.
      this.pool.on("error", (error) => {
        this.logger.warn(`A database connection was lost and will be replaced: ${error.message}`);
      });
    }
  }

  isConfigured(): boolean {
    return this.pool !== undefined;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error("DATABASE_URL is not configured.");
    }

    return this.pool.query<T>(text, params);
  }

  async health(): Promise<"configured" | "connected" | "unconfigured" | "error"> {
    if (!this.pool) return "unconfigured";
    try {
      await this.pool.query("SELECT 1");
      return "connected";
    } catch (error) {
      this.logger.warn(`Database health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return "error";
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
