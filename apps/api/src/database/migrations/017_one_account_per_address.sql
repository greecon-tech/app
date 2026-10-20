-- One account to an email address, enforced by the database and not only by the check in the service: two
-- requests made at the same moment could each find the address free. Sign-in looks the account up by the
-- address alone (lower-cased), so the address must be unique across every customer, not within one.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
