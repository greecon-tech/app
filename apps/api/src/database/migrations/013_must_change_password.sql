-- A password someone else chose, and shared with the account's owner, is a temporary one: the project
-- manager who sets an account up knows it. Whoever signs in with one must choose their own before
-- they can do anything else.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
