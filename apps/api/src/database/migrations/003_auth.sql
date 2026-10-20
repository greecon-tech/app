-- Real per-user authentication (docs/13-pilot-readiness.md, "no real authentication"). Previously
-- every request's identity came from a self-asserted x-user-role header with no login at all.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- Demo credentials for four of the five seeded users (002_seed_demo.sql). 006 removes these four
-- again. The fifth, the founder's own account, is deliberately not listed: it is the platform
-- administrator, and an earlier version of this file gave it the published demo password on every
-- run of the old migration runner. Its password is set from BOOTSTRAP_ADMIN_PASSWORD or in the app
-- (docs/guides/pm/01-company-setup.md), never in source control.
UPDATE users
SET password_hash = '$2b$10$uaQDHxzYiU.u7qZl/lCbCui7Fq8kbjFuqnKI5Htzx3MxLYEuxJ3IG'
WHERE email IN (
  'operator@greecon.earth',
  'auditor@greecon.earth',
  'admin@greecon.earth',
  'viewer@greecon.earth'
);
