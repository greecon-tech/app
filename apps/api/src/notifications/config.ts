import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationContact, NotificationContactInput, NotificationSettings } from "@greecon/shared";
import { DatabaseService } from "../database/database.service";

// Who an account wants told, and when they must not be woken. Small and read on every alert, so it is
// held in memory and written through to the database, the way the rest of the platform's configuration
// is: reading it never waits on the network, and a restart reads it back.

interface ContactRow {
  id: string;
  tenant_id: string;
  position: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface SettingsRow {
  tenant_id: string;
  timezone: string;
  quiet_from: string;
  quiet_to: string;
  digest_enabled: boolean;
  digest_at: string;
  last_test_at: Date | null;
}

@Injectable()
export class NotificationConfig implements OnModuleInit {
  private readonly logger = new Logger(NotificationConfig.name);
  private readonly contactsByTenant = new Map<string, NotificationContact[]>();
  private readonly settingsByTenant = new Map<string, NotificationSettings>();
  private readonly lastTestByTenant = new Map<string, number>();

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    if (!this.db.isConfigured()) return;
    try {
      const contacts = await this.db.query<ContactRow>("SELECT id, tenant_id, position, name, email, phone FROM notification_contacts ORDER BY tenant_id, position");
      for (const row of contacts.rows) {
        const list = this.contactsByTenant.get(row.tenant_id) ?? [];
        list.push({ id: row.id, name: row.name, ...(row.email ? { email: row.email } : {}), ...(row.phone ? { phone: row.phone } : {}) });
        this.contactsByTenant.set(row.tenant_id, list);
      }
      const settings = await this.db.query<SettingsRow>("SELECT tenant_id, timezone, quiet_from, quiet_to, digest_enabled, digest_at, last_test_at FROM notification_settings");
      for (const row of settings.rows) {
        this.settingsByTenant.set(row.tenant_id, { timezone: row.timezone, quietFrom: row.quiet_from, quietTo: row.quiet_to, digestEnabled: row.digest_enabled, digestAt: row.digest_at });
        if (row.last_test_at) this.lastTestByTenant.set(row.tenant_id, row.last_test_at.getTime());
      }
    } catch (error) {
      // Without the list nobody can be told, which the status page will say; the platform itself must still start.
      this.logger.error(`Could not read who is to be told: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The people to tell, in the order to tell them. */
  contacts(tenantId: string): NotificationContact[] {
    return (this.contactsByTenant.get(tenantId) ?? []).map((contact) => ({ ...contact }));
  }

  settings(tenantId: string): NotificationSettings {
    return { ...(this.settingsByTenant.get(tenantId) ?? DEFAULT_NOTIFICATION_SETTINGS) };
  }

  lastTestAtMs(tenantId: string): number | undefined {
    return this.lastTestByTenant.get(tenantId);
  }

  /** Accounts that have anyone to tell. */
  tenantsWithContacts(): string[] {
    return [...this.contactsByTenant.entries()].filter(([, list]) => list.length > 0).map(([tenantId]) => tenantId);
  }

  /** Replaces the whole list. A person who comes with the id of someone already on this account's list keeps
   * that id (and so their place in what was sent); anyone else is new. The input must already be checked. */
  async setContacts(tenantId: string, input: readonly NotificationContactInput[]): Promise<NotificationContact[]> {
    const known = new Set((this.contactsByTenant.get(tenantId) ?? []).map((contact) => contact.id));
    const used = new Set<string>();
    const contacts: NotificationContact[] = input.map((entry) => {
      const keep = entry.id !== undefined && known.has(entry.id) && !used.has(entry.id);
      const id = keep ? (entry.id as string) : randomUUID();
      used.add(id);
      return { id, name: entry.name, ...(entry.email ? { email: entry.email } : {}), ...(entry.phone ? { phone: entry.phone } : {}) };
    });

    if (this.db.isConfigured()) {
      const rows = contacts.map((contact, position) => ({ id: contact.id, position, name: contact.name, email: contact.email ?? null, phone: contact.phone ?? null }));
      // One statement: the people removed go and the people on the list arrive together, or neither happens.
      await this.db.query(
        `WITH incoming AS (
           SELECT (e->>'id')::uuid AS id, (e->>'position')::int AS position, e->>'name' AS name, e->>'email' AS email, e->>'phone' AS phone
           FROM jsonb_array_elements($2::jsonb) AS e
         ), removed AS (
           DELETE FROM notification_contacts WHERE tenant_id = $1 AND id NOT IN (SELECT id FROM incoming)
         )
         INSERT INTO notification_contacts (id, tenant_id, position, name, email, phone, created_at, updated_at)
         SELECT id, $1, position, name, email, phone, now(), now() FROM incoming
         ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = now()
         WHERE notification_contacts.tenant_id = $1`,
        [tenantId, JSON.stringify(rows)]
      );
    }
    this.contactsByTenant.set(tenantId, contacts);
    return contacts.map((contact) => ({ ...contact }));
  }

  async setSettings(tenantId: string, settings: NotificationSettings): Promise<NotificationSettings> {
    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO notification_settings (tenant_id, timezone, quiet_from, quiet_to, digest_enabled, digest_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
         ON CONFLICT (tenant_id) DO UPDATE SET timezone = $2, quiet_from = $3, quiet_to = $4, digest_enabled = $5, digest_at = $6, updated_at = now()`,
        [tenantId, settings.timezone, settings.quietFrom, settings.quietTo, settings.digestEnabled, settings.digestAt]
      );
    }
    this.settingsByTenant.set(tenantId, { ...settings });
    return { ...settings };
  }

  /** A test message was accepted by the provider. */
  async recordTest(tenantId: string, atMs: number): Promise<void> {
    if (this.db.isConfigured()) {
      await this.db.query(
        `INSERT INTO notification_settings (tenant_id, last_test_at) VALUES ($1,$2)
         ON CONFLICT (tenant_id) DO UPDATE SET last_test_at = $2, updated_at = now()`,
        [tenantId, new Date(atMs)]
      );
    }
    this.lastTestByTenant.set(tenantId, atMs);
  }
}
