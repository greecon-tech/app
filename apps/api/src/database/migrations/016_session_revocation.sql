-- A session is a signed token that stays good for hours, so it cannot say that the person has since been
-- turned off or has chosen a new password. This is the moment before which no session counts as theirs:
-- turning a person off and resetting or changing a password set it, and the API checks it on each request
-- (apps/api/src/common/active-users.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamptz;
