import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { INGEST_THROTTLE } from "../../common/client-throttler";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { RequestWithPrincipal } from "../../common/principal";
import { PlatformService } from "../../platform/platform.service";
import { TelemetryBatchDto, TelemetryMessageDto } from "./telemetry-reading.dto";

@Controller("telemetry")
export class TelemetryController {
  constructor(private readonly platform: PlatformService) {}

  @Throttle({ default: INGEST_THROTTLE })
  @Post("ingest")
  @RequirePermissions("telemetry:ingest")
  ingest(@Body() body: TelemetryMessageDto, @Req() request: RequestWithPrincipal) {
    return this.platform.ingestTelemetry(body, request.principal);
  }

  // What a box sends: everything one round of reading produced, or a backlog after an outage. Each
  // message is judged on its own, and the reply says which were taken, in the order they were sent.
  @Throttle({ default: INGEST_THROTTLE })
  @Post("ingest-batch")
  @RequirePermissions("telemetry:ingest")
  async ingestBatch(@Body() body: TelemetryBatchDto, @Req() request: RequestWithPrincipal) {
    return { results: await this.platform.ingestTelemetryBatch(body.messages, request.principal) };
  }

  @Get("latest")
  @RequirePermissions("point:read")
  latest(@Query("siteId") siteId: string | undefined, @Req() request: RequestWithPrincipal) {
    return this.platform.latestTelemetry(request.principal, siteId);
  }

  // Time-range query for real charts (Analytics page) — see PlatformService.telemetryHistory for
  // why this reads Postgres directly instead of the in-memory latest-only snapshot.
  @Get("history")
  @RequirePermissions("point:read")
  history(@Query("siteId") siteId: string | undefined, @Query("hours") hoursParam: string | undefined, @Req() request: RequestWithPrincipal) {
    const hours = Math.min(Math.max(Number(hoursParam) || 24, 1), 24 * 90);
    return this.platform.telemetryHistory(request.principal, siteId, hours);
  }
}
