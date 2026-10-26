-- Greecon's own team is told at once when a customer's box goes silent (docs/18-reality-audit.md). Those messages
-- are kept in the same plan and log as every other message, so they are retried, held through the quiet hours and
-- shown under Who is told like the rest; they have a kind of their own, so the log says what they are and nothing
-- that counts a customer's alert messages counts them.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('alert', 'escalation', 'acknowledged', 'resolved', 'digest', 'test', 'box_silent'));
