-- Fills out the demo tenant with enough history and variety to actually look like a running
-- site instead of a handful of rows from one minute at setup time. 002_seed_demo.sql gave every
-- reading point exactly one sample, a few minutes apart — fine for proving the pipeline works,
-- but Analytics' 24h/7d/30d charts (apps/web/src/app/analytics/page.tsx) had nothing to draw.
--
-- Re-runnable: migrate.ts replays every migration file on every run (no migrations-applied
-- table), so this deletes its own previously-inserted rows (tagged source = 'demo-seed-history')
-- before reinserting rather than accumulating duplicates.

DELETE FROM telemetry_readings WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND source = 'demo-seed-history';

DROP TABLE IF EXISTS demo_time_series;
CREATE TEMP TABLE demo_time_series AS
SELECT
  ts,
  (extract(hour from ts) + extract(minute from ts) / 60.0) AS hod,
  (extract(epoch from ts) / 86400.0) AS days,
  -- Diurnal solar curve: zero before 6am and after 6pm, peaking near midday.
  GREATEST(0, 24 * sin(pi() * ((extract(hour from ts) + extract(minute from ts) / 60.0) - 6) / 12.0)) AS solar_kw,
  -- Site consumption: fairly flat with a slight evening rise, not tied to solar.
  11 + 3 * sin(2 * pi() * ((extract(hour from ts) + extract(minute from ts) / 60.0) - 19) / 24.0) AS consumption_kw,
  -- Pump runs two hours out of every six — flow/pressure below key off this.
  (extract(hour from ts)::int % 6) < 2 AS pump_on
FROM generate_series(now() - interval '30 days', now(), interval '1 hour') AS ts;

-- energy.solar.power.kw
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '55555555-5555-4555-8555-555555555501',
  'energy.solar.power.kw', ROUND((solar_kw + (random() - 0.5) * 1.5)::numeric, 2), 'kW', 'OK', 'demo-seed-history'
FROM demo_time_series;

-- energy.battery.soc.percent — charges through the day, drifts down overnight, plus a slow multi-day cycle.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444402', '55555555-5555-4555-8555-555555555502',
  'energy.battery.soc.percent',
  LEAST(97, GREATEST(18, ROUND((55 + 22 * sin(2 * pi() * (hod - 9) / 24.0) + 5 * sin(2 * pi() * days / 4.0) + (random() - 0.5) * 2)::numeric, 1))),
  '%',
  CASE WHEN 55 + 22 * sin(2 * pi() * (hod - 9) / 24.0) < 25 THEN 'WARN' ELSE 'OK' END,
  'demo-seed-history'
FROM demo_time_series;

-- water.tank.level.percent — drains over a 4-day cycle, then jumps back up on refill.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444403', '55555555-5555-4555-8555-555555555503',
  'water.tank.level.percent',
  LEAST(93, GREATEST(14, ROUND((90 - (mod(days, 4.0) / 4.0) * 70 + (random() - 0.5) * 2)::numeric, 1))) AS level,
  '%',
  CASE
    WHEN 90 - (mod(days, 4.0) / 4.0) * 70 < 15 THEN 'BAD'
    WHEN 90 - (mod(days, 4.0) / 4.0) * 70 < 35 THEN 'WARN'
    ELSE 'OK'
  END,
  'demo-seed-history'
FROM demo_time_series;

-- water.flow.lpm — on during pump-active hours, a near-zero idle trickle otherwise.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444404', '55555555-5555-4555-8555-555555555504',
  'water.flow.lpm',
  ROUND((CASE WHEN pump_on THEN 11 + (random() - 0.5) * 3 ELSE 0.15 + random() * 0.1 END)::numeric, 2),
  'lpm', 'OK', 'demo-seed-history'
FROM demo_time_series;

-- water.pressure.bar — tracks the same pump on/off state as flow.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444404', '55555555-5555-4555-8555-555555555505',
  'water.pressure.bar',
  ROUND((CASE WHEN pump_on THEN 2.6 + (random() - 0.5) * 0.6 ELSE 0.2 + random() * 0.1 END)::numeric, 2),
  'bar', 'OK', 'demo-seed-history'
FROM demo_time_series;

-- agri.soil.moisture.percent — drains over a 2-day cycle between irrigation runs.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444405', '55555555-5555-4555-8555-555555555506',
  'agri.soil.moisture.percent',
  LEAST(46, GREATEST(14, ROUND((42 - (mod(days, 2.0) / 2.0) * 24 + (random() - 0.5) * 2)::numeric, 1))),
  '%',
  CASE WHEN 42 - (mod(days, 2.0) / 2.0) * 24 < 28 THEN 'WARN' ELSE 'OK' END,
  'demo-seed-history'
FROM demo_time_series;

-- agri.air.temperature.c — diurnal, with a slow week-long drift.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333307', '44444444-4444-4444-8444-444444444406', '55555555-5555-4555-8555-555555555507',
  'agri.air.temperature.c',
  ROUND((19 + 9 * sin(pi() * (hod - 6) / 12.0) + 2 * sin(2 * pi() * days / 7.0) + (random() - 0.5) * 1.2)::numeric, 1),
  'C', 'OK', 'demo-seed-history'
FROM demo_time_series;

-- agri.humidity.percent — inverse of the temperature curve.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333307', '44444444-4444-4444-8444-444444444406', '55555555-5555-4555-8555-555555555508',
  'agri.humidity.percent',
  LEAST(85, GREATEST(38, ROUND((75 - 30 * sin(pi() * (hod - 6) / 12.0) + (random() - 0.5) * 3)::numeric, 1))),
  '%', 'OK', 'demo-seed-history'
FROM demo_time_series;

-- energy.grid.import.kw / grid.export.kw / consumption.kw — derived from the same solar/consumption curves.
INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333308', '44444444-4444-4444-8444-444444444407', '55555555-5555-4555-8555-555555555510',
  'energy.grid.import.kw', ROUND((GREATEST(0, consumption_kw - solar_kw) + random() * 0.8)::numeric, 2), 'kW', 'OK', 'demo-seed-history'
FROM demo_time_series;

INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333308', '44444444-4444-4444-8444-444444444407', '55555555-5555-4555-8555-555555555511',
  'energy.grid.export.kw', ROUND((GREATEST(0, solar_kw - consumption_kw) + random() * 0.8)::numeric, 2), 'kW', 'OK', 'demo-seed-history'
FROM demo_time_series;

INSERT INTO telemetry_readings (timestamp_utc, tenant_id, site_id, asset_id, device_id, point_id, canonical_name, value_numeric, unit, quality, source)
SELECT ts, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333308', '44444444-4444-4444-8444-444444444407', '55555555-5555-4555-8555-555555555512',
  'energy.consumption.kw', ROUND((consumption_kw + (random() - 0.5) * 1.0)::numeric, 2), 'kW', 'OK', 'demo-seed-history'
FROM demo_time_series;

DROP TABLE IF EXISTS demo_time_series;

-- A little more variety on alerts/incidents/maintenance/reports than the single open example each
-- from 002_seed_demo.sql, so those pages show a realistic mix rather than one row apiece.

INSERT INTO alerts (id, tenant_id, site_id, asset_id, category, severity, status, title, suggested_action, acknowledged_at, resolved_at)
VALUES
  ('99999999-9999-4999-8999-999999999903', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333302', 'resource_threshold', 'critical', 'open', 'Battery state of charge critically low overnight', 'Review overnight load against battery capacity; consider reducing non-essential consumption after sunset.', NULL, NULL),
  ('99999999-9999-4999-8999-999999999904', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333308', 'resource_threshold', 'warning', 'resolved', 'Grid import exceeded expected range', 'Investigated and traced to a cloudy afternoon reducing solar output; no fault found.', now() - interval '6 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, tenant_id, site_id, alert_id, status, severity, title, investigation_notes)
VALUES
  ('abababab-abab-4aba-8aba-ababababab02', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', '99999999-9999-4999-8999-999999999904', 'resolved', 'warning', 'Grid import spike review', 'Confirmed weather-related, not an equipment fault. Closed.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO maintenance_tasks (id, tenant_id, site_id, asset_id, incident_id, title, notes, due_at, completed_at, completion_log, status)
VALUES
  ('cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcd02', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333302', NULL, 'Quarterly battery terminal inspection', 'Routine inspection, no corrosion or loose connections found.', now() - interval '3 days', now() - interval '2 days', 'Completed on schedule. No follow-up required.', 'complete')
ON CONFLICT (id) DO NOTHING;

-- Demo tenant has exactly one real user row by this point (006_split_demo_and_real_tenant.sql
-- removed the other four seeded logins and moved Eridon's own account to the real tenant) — look
-- it up by email rather than hardcoding its id, since this migration runs after that split on any
-- fresh database and must not assume which id survived.
DO $$
DECLARE
  demo_user_id uuid;
BEGIN
  SELECT id INTO demo_user_id FROM users WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND email = 'demo@greecon.earth';

  IF demo_user_id IS NOT NULL THEN
    INSERT INTO report_exports (id, tenant_id, site_id, requested_by, report_type, parameters, export_status, storage_uri, created_at, completed_at)
    VALUES ('fefefefe-fefe-4fef-8fef-fefefefefe01', '11111111-1111-4111-8111-111111111111', NULL, demo_user_id, 'operational', '{}', 'completed', 'demo://reports/operational-summary.pdf', now() - interval '2 days', now() - interval '2 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO audit_events (id, tenant_id, user_id, event_type, site_id, asset_id, entity_type, entity_id, after_metadata, reason)
    VALUES
      ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', '11111111-1111-4111-8111-111111111111', demo_user_id, 'incident.status_changed', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333308', 'incident', 'abababab-abab-4aba-8aba-ababababab02', '{"status":"resolved"}', 'Confirmed weather-related grid import spike, closed investigation.'),
      ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '11111111-1111-4111-8111-111111111111', demo_user_id, 'maintenance.completed', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333302', 'maintenance_task', 'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcd02', '{"status":"completed"}', 'Quarterly battery terminal inspection completed on schedule.')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
