-- What a site's energy and water are worth, from its own readings and its own prices.
--
-- energy_buckets: hourly totals per point, added up from the power and flow readings as they arrive
-- (kWh for power points, litres for flow). Any period can then be summed in one small query however
-- long the raw history is. Totals are added to, never replaced, so a restart in the middle of an
-- hour loses nothing that was already saved.
CREATE TABLE IF NOT EXISTS energy_buckets (
  point_id uuid NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  hour_start timestamptz NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  amount double precision NOT NULL DEFAULT 0,
  covered_seconds double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (point_id, hour_start)
);

CREATE INDEX IF NOT EXISTS energy_buckets_site_hour_idx ON energy_buckets (site_id, hour_start);

-- site_profiles: what the site pays and what it used to use. Nothing here has a default price: a
-- price is the site's own, taken from its own bill, and without one the platform shows quantities
-- and says what is needed to show money.
CREATE TABLE IF NOT EXISTS site_profiles (
  site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Europe/Tirane',
  currency text NOT NULL DEFAULT 'EUR',
  import_price_per_kwh numeric(10, 4),
  export_price_per_kwh numeric(10, 4),
  water_price_per_m3 numeric(10, 4),
  baseline_monthly_import_kwh numeric(12, 2),
  baseline_monthly_water_m3 numeric(12, 2),
  baseline_note text,
  -- A site that cannot send energy to the grid has zero export, so an export that is not measured
  -- is zero rather than unknown.
  zero_export boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
