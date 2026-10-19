import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RequestWithPrincipal } from "../../common/principal";
import { publicApiUrl } from "../../common/public-url";
import { SetupService } from "../../setup/setup.service";
import { EnrolDto } from "./edge.dto";

type Request = RequestWithPrincipal & { protocol: string; get(name: string): string | undefined };

/** What a box at a site says to the platform. The first two need no credential (a box that has none
 * yet asks for one with its code); the rest need the box's own. */
@Controller("edge")
export class EdgeController {
  constructor(private readonly setup: SetupService) {}

  // Open to anyone, so limited hard: a code is 60 bits and used once, and ten tries a minute from one
  // address is all a person at a box could need.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("enrol")
  enrol(@Body() body: EnrolDto, @Req() request: Request) {
    return this.setup.enrol(body.code, publicApiUrl(process.env, request));
  }

  @Get("config")
  config(@Req() request: RequestWithPrincipal) {
    return this.setup.edgeConfig(request.principal);
  }

  // Not validated by a DTO class: it is checked field by field in the service, in words.
  @Post("heartbeat")
  heartbeat(@Body() body: Record<string, unknown>, @Req() request: RequestWithPrincipal) {
    return this.setup.heartbeat(request.principal, body);
  }
}
