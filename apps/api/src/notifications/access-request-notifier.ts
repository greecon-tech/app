import { Logger } from "@nestjs/common";
import { AccessRequest, requestedSiteTypeLabels } from "@greecon/shared";
import { configuredPublicWebUrl } from "../common/public-url";
import { AccessRequestNotifier, SALES_EMAILS_PER_HOUR } from "../modules/access-requests/access-requests.service";
import { Channels } from "./channels";
import { Message, accessRequestEmail, accessRequestFloodEmail } from "./messages";

/** Tells Greecon's own team, by email, when someone asks to be set up, so that a request is answered the same
 * day instead of sitting in the inbox until someone looks. The inbox stays the record; this is a courtesy on
 * top of it. In a flood of requests it says so once, instead of once for each (AccessRequestsService). Absent
 * when email is not set up or nobody is named in SALES_NOTIFY_EMAIL. */
export function createAccessRequestNotifier(channels: Channels, env: NodeJS.ProcessEnv): AccessRequestNotifier | undefined {
  const recipients = (env.SALES_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address !== "");
  const email = channels.email;
  if (!email || recipients.length === 0) return undefined;

  const logger = new Logger("AccessRequestNotifier");
  const webUrl = configuredPublicWebUrl(env);
  const link = webUrl ? `${webUrl}/platform` : undefined;
  const tellEveryone = async (message: Message, key: string, what: string): Promise<void> => {
    for (const to of recipients) {
      const result = await email.send({ to, subject: message.subject ?? "Greecon", body: message.body, idempotencyKey: `${key}:${to}` });
      if (!result.ok) logger.warn(`Could not tell ${to} about ${what}: ${result.error}`);
    }
  };
  const aboutOne = async (request: AccessRequest): Promise<void> => {
    const message = accessRequestEmail(
      { name: request.name, company: request.company, email: request.email, phone: request.phone, siteTypeLabel: requestedSiteTypeLabels[request.siteType] ?? request.siteType, message: request.message },
      link
    );
    await tellEveryone(message, `access-request:${request.id}`, `request ${request.id}`);
  };
  const flood = (requestsInTheLastHour: number): Promise<void> =>
    tellEveryone(accessRequestFloodEmail(requestsInTheLastHour, SALES_EMAILS_PER_HOUR, link), `access-request-flood:${Date.now()}`, "a flood of requests");
  return Object.assign(aboutOne, { flood });
}
