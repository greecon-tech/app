-- The platform no longer decides "surplus available" from a built-in 1.5 kW: a site states the
-- smallest surplus worth acting on. The demo tenant's solar point keeps behaving as it did, but now
-- says so explicitly, as a demo placeholder rather than advice. (The soil-moisture point already
-- carries its own irrigate_below.)
UPDATE points
SET threshold_config = threshold_config || '{"surplus_min_kw": 1.5}'::jsonb
WHERE id = '55555555-5555-4555-8555-555555555501'
  AND NOT (threshold_config ? 'surplus_min_kw');
