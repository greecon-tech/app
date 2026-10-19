import { Controller, Get, Req } from "@nestjs/common";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { RequestWithPrincipal } from "../../common/principal";
import { PlatformService } from "../../platform/platform.service";

@Controller("value")
export class ValueController {
  constructor(private readonly platform: PlatformService) {}

  // This month's value at every site of the account that measures any energy or water.
  @Get("summary")
  @RequirePermissions("point:read")
  summary(@Req() request: RequestWithPrincipal) {
    return this.platform.valueSummary(request.principal);
  }
}
