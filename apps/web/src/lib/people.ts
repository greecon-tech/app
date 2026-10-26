import type { NotificationKind, NotificationStatus } from "@greecon/shared";

// Words for the Who is told screens.

export const KIND_WORDS: Record<NotificationKind, string> = {
  alert: "Alert",
  escalation: "Passed on, not acknowledged",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  digest: "Morning message",
  test: "Test",
  box_silent: "A customer's box went silent"
};

export const SEND_STATUS_WORDS: Record<NotificationStatus, string> = {
  sent: "Sent",
  failed: "Not sent",
  planned: "Waiting",
  skipped: "Not needed"
};
