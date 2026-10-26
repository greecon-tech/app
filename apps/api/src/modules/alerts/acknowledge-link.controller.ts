import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AcknowledgeLinkView } from "@greecon/shared";
import { AcknowledgeLinkService } from "./acknowledge-link.service";

/**
 * The "I have seen this" link in an alert message: <PUBLIC_WEB_URL>/ack/<token>, opened on a phone by a person who may have
 * no login. Public (no session), and good for the one alert of the one account its signed token names, for 72 hours after
 * the message was sent (notifications/ack-link.ts). The token is 36 characters of A-Z a-z 0-9 - _.
 *
 *   GET  /public/acknowledge/:token   Changes nothing, ever: mail and text scanners open links.
 *        200 { "valid": true, "alert": { "title": "Tank level is critical", "siteName": "Hotel Adriatik",
 *                                         "priority": "Act now", "raisedAtUtc": "2026-10-19T12:05:00.000Z", "state": "open" } }
 *            priority is the word a person reads: "Act now", "Check today" or "For your information".
 *            state is "open", "acknowledged" (by anyone, in Greecon or with a link) or "cleared" (the readings cleared it).
 *        200 { "valid": false }   for a token that is malformed, altered, expired, for an alert that is no longer there or for a
 *                                  suspended account: one answer for all, so that nothing can be learned from it.
 *
 *   POST /public/acknowledge/:token   (no body) Acknowledges the alert exactly as Acknowledge in Greecon does: the same stop to
 *        the messages, the same note to the others who were told, a line in the account's audit trail ("Link in an alert
 *        message", with the name and address of the person it was sent to).
 *        200 with the same shape, the state as it now is: "acknowledged"; or "cleared", unchanged and not an error, for an
 *            alert that had cleared. The same call again changes nothing and answers the same.
 *        200 { "valid": false }   as above.
 *
 *   Each answers 429 past 30 calls a minute from one address (looking and pressing are counted apart). Call them from the
 *   web server with the visitor's address passed on (lib/visitor.ts, as the request-access form does), and without the
 *   session header: a session that has ended is refused before the link is looked at. The types are AcknowledgeLinkView
 *   in packages/shared.
 */
@Controller("public/acknowledge")
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AcknowledgeLinkController {
  constructor(private readonly links: AcknowledgeLinkService) {}

  @Get(":token")
  view(@Param("token") token: string): AcknowledgeLinkView {
    return this.links.view(token);
  }

  @Post(":token")
  @HttpCode(200)
  acknowledge(@Param("token") token: string): Promise<AcknowledgeLinkView> {
    return this.links.acknowledge(token);
  }
}
