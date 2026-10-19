import { Logger } from "@nestjs/common";
import { AccessRequest, requestedSiteTypeLabels } from "@greecon/shared";
import { Channels } from "./channels";
import { accessRequestEmail } from "./messages";

/** Tells Greecon's own team, by email, when someone asks to be set up, so that a request is answered the same
 * day instead of sitting in the inbox until someone looks. The inbox stays the record; this is a courtesy on
 * top of it. Absent when email is not set up or nobody is named in SALES_NOTIFY_EMAIL. */
export function createAccessRequestNotifier(channels: Channels, env: NodeJS.ProcessEnv): ((request: AccessRequest) => Promise<void>) | undefined {
  const recipients = (env.SALES_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address !== "");
  const email = channels.email;
  if (!email || recipients.length === 0) return undefined;

  const logger = new Logger("AccessRequestNotifier");
  const webUrl = env.PUBLIC_WEB_URL?.replace(/\/+$/, "");
  return async (request) => {
    const message = accessRequestEmail(
      { name: request.name, company: request.company, email: request.email, phone: request.phone, siteTypeLabel: requestedSiteTypeLabels[request.siteType] ?? request.siteType, message: request.message },
      webUrl ? `${webUrl}/platform` : undefined
    );
    for (const to of recipients) {
      const result = await email.send({ to, subject: message.subject ?? "New request for access", body: message.body, idempotencyKey: `access-request:${request.id}:${to}` });
      if (!result.ok) logger.warn(`Could not tell ${to} about request ${request.id}: ${result.error}`);
    }
  };
}
