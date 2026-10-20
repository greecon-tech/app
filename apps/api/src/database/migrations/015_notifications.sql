-- Telling people (docs/21-communication-system.md, section 3).
--
--   notification_contacts   the short, ordered list of people an account wants told, with the email and
--                           phone that reach them. They need no login: the pump technician is a contact.
--   notification_settings   the account's clock, its quiet hours and its daily message.
--   notifications           both the plan and the log. A message is a row from the moment it is planned
--                           ("send the SMS at 14:15 unless it is acknowledged") until it is sent, failed
--                           or found unnecessary, so a restart loses no step of an escalation and every
--                           message that was or was not sent can be shown with its reason.

CREATE TABLE IF NOT EXISTS notification_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notification_contacts_tenant_idx ON notification_contacts (tenant_id, position);

CREATE TABLE IF NOT EXISTS notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Europe/Tirane',
  quiet_from text NOT NULL DEFAULT '22:00',
  quiet_to text NOT NULL DEFAULT '07:00',
  digest_enabled boolean NOT NULL DEFAULT true,
  digest_at text NOT NULL DEFAULT '07:30',
  last_test_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Soft references: a message is planned the moment an alert changes in memory, possibly before the
  -- alert's own row is written, and a person removed from the list must not erase what was sent to them.
  alert_id uuid,
  contact_id uuid,
  contact_name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  -- The address or number it went to (or tried to), set when it is sent.
  destination text,
  kind text NOT NULL CHECK (kind IN ('alert', 'escalation', 'acknowledged', 'resolved', 'digest', 'test')),
  priority text CHECK (priority IN ('act_now', 'check_today', 'fyi')),
  subject text,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('planned', 'sending', 'sent', 'failed', 'skipped')),
  due_at timestamptz NOT NULL,
  -- When the alert change this message answers happened: a "resolved" message is only sent if that is
  -- still how things stand.
  event_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  provider_id text,
  error text,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications (due_at) WHERE status = 'planned';
CREATE INDEX IF NOT EXISTS notifications_tenant_created_idx ON notifications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_alert_idx ON notifications (alert_id, priority);
