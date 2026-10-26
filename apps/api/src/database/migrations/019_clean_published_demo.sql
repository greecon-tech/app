-- The published demo holds the three sites the guides describe (002_seed_demo.sql). An earlier version of the platform let a site
-- be added to it by hand, before the demo became read-only; such a site, with no box and no reading, reads "Unknown" to every
-- prospect and makes the demo say "3 of 4 sites reporting". A site in the demo account that is not one of the three, that no
-- box has been enrolled for and that has never had a reading is removed; what belongs to a site goes with it (the schema
-- cascades, and audit entries keep their text and lose only the link). Nothing of any other account is touched, and running
-- this again finds nothing to do.
DELETE FROM sites s
WHERE s.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND s.id NOT IN ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222203')
  AND NOT EXISTS (SELECT 1 FROM edge_gateways g WHERE g.site_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM telemetry_readings t WHERE t.site_id = s.id);
