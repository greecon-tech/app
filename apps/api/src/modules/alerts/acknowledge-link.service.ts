import { Inject, Injectable, Optional } from "@nestjs/common";
import { AcknowledgeLinkView } from "@greecon/shared";
import { NotificationConfig } from "../../notifications/config";
import { OpenedAckToken, openAckToken, sentTo } from "../../notifications/ack-link";
import { NOTIFICATION_OPTIONS, NotificationOptions } from "../../notifications/notifications.service";
import { PlatformService } from "../../platform/platform.service";

/** What the "I have seen this" link in an alert message can do: show its one alert, and acknowledge it. Everything rests on
 * the signed token (notifications/ack-link.ts); nothing is taken from who is calling. */
@Injectable()
export class AcknowledgeLinkService {
  constructor(
    private readonly platform: PlatformService,
    private readonly config: NotificationConfig,
    @Optional() @Inject(NOTIFICATION_OPTIONS) private readonly options: NotificationOptions = {}
  ) {}

  /** The alert behind a link, as it stands. Never changes anything: mail and text scanners open links. */
  view(token: string, nowMs: number = Date.now()): AcknowledgeLinkView {
    const link = this.open(token, nowMs);
    const alert = link ? this.platform.alertLinkView(link.tenantId, link.alertId) : undefined;
    return alert ? { valid: true, alert } : { valid: false };
  }

  /** Acknowledges the alert behind a link, for the person it was sent to. */
  async acknowledge(token: string, nowMs: number = Date.now()): Promise<AcknowledgeLinkView> {
    const link = this.open(token, nowMs);
    const alert = link ? await this.platform.acknowledgeAlertByLink(link.tenantId, link.alertId, this.recipientOf(link)) : undefined;
    return alert ? { valid: true, alert } : { valid: false };
  }

  private open(token: string, nowMs: number): OpenedAckToken | undefined {
    const key = this.options.ackLinkKey;
    return key ? openAckToken(key, token, nowMs, (idStart) => this.platform.alertsForLink(idStart)) : undefined;
  }

  /** The person on the account's list the link was sent to, if they are still on it. */
  private recipientOf(link: OpenedAckToken): { name: string; email?: string } | undefined {
    const key = this.options.ackLinkKey;
    const contact = key ? this.config.contacts(link.tenantId).find((candidate) => sentTo(key, link, candidate.id)) : undefined;
    return contact ? { name: contact.name, ...(contact.email ? { email: contact.email } : {}) } : undefined;
  }
}
