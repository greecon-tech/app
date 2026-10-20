-- Equipment is described once, in the platform, and the box at the site is told what to read
-- (docs/18-reality-audit.md: nobody should edit files on a box in a plant room).
--
--   devices.connection   where the box reaches the device on the site's network: {kind, host, port, unitId}
--   points.source        which register holds the reading and how it becomes a number
--   edge_gateways.*      what the box says about itself in its heartbeat
--   gateway_enrolments   a one-time code that lets a freshly installed box fetch its own credential,
--                        so nobody types or copies a 64-character secret
--   site_setup           which template a site was made from, and the steps a person confirmed by hand

ALTER TABLE devices ADD COLUMN IF NOT EXISTS connection jsonb;
ALTER TABLE points ADD COLUMN IF NOT EXISTS source jsonb;

ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS enrolled_at timestamptz;
ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS config_version text;
ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS buffer_depth integer;
ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS oldest_buffered_age_seconds integer;
ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS clock_skew_seconds integer;
ALTER TABLE edge_gateways ADD COLUMN IF NOT EXISTS driver_status jsonb;

-- Only the hash of a code is kept, as with the gateway credential itself. A code is used once:
-- used_at is set by the same statement that finds it, so two boxes cannot both use it.
CREATE TABLE IF NOT EXISTS gateway_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_id uuid NOT NULL REFERENCES edge_gateways(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS gateway_enrolments_gateway_idx ON gateway_enrolments (gateway_id);

CREATE TABLE IF NOT EXISTS site_setup (
  site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key text,
  confirmations jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
