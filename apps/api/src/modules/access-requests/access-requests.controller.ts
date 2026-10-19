import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AccessRequestStatus, accessRequestStatuses } from "@greecon/shared";
import { PlatformAdminGuard } from "../../common/platform-admin.guard";
import { RequestWithPrincipal } from "../../common/principal";
import { AccessRequestsService } from "./access-requests.service";
import { CreateAccessRequestDto } from "./create-access-request.dto";
import { UpdateAccessRequestDto } from "./update-access-request.dto";

/** The public form on the sign-in page. No session by definition, so it is limited hard: it cannot
 * tell callers apart behind the web service, so the limit is for the whole platform and generous for
 * real interest (a few a day) and hopeless for a flood. */
@Controller("public/access-requests")
export class PublicAccessRequestsController {
  constructor(private readonly requests: AccessRequestsService) {}

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post()
  receive(@Body() body: CreateAccessRequestDto) {
    return this.requests.receive(body);
  }
}

/** Greecon's inbox of requests. Only platform administrators. */
@Controller("platform-admin/access-requests")
@UseGuards(PlatformAdminGuard)
export class AccessRequestsAdminController {
  constructor(private readonly requests: AccessRequestsService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.requests.list(accessRequestStatuses.includes(status as AccessRequestStatus) ? (status as AccessRequestStatus) : undefined);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.requests.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateAccessRequestDto, @Req() request: RequestWithPrincipal) {
    return this.requests.update(id, body, request.principal.userId);
  }
}
