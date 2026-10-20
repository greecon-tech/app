import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { RequestWithPrincipal } from "../../common/principal";
import { PlatformService } from "../../platform/platform.service";
import { CreateSiteDto } from "./create-site.dto";
import { PeriodKey } from "../../value/periods";
import { UpdateSiteDto } from "./update-site.dto";
import { UpdateSiteProfileDto } from "./update-site-profile.dto";

@Controller("sites")
export class SitesController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  @RequirePermissions("site:read")
  list(@Req() request: RequestWithPrincipal) {
    return this.platform.listSites(request.principal);
  }

  @Get(":siteId")
  @RequirePermissions("site:read")
  detail(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.platform.siteDetail(siteId, request.principal);
  }

  // What the site's own readings are worth over a period, at the prices the site has entered.
  @Get(":siteId/value")
  @RequirePermissions("point:read")
  value(@Param("siteId") siteId: string, @Query("period") period: string | undefined, @Req() request: RequestWithPrincipal) {
    return this.platform.siteValue(siteId, (period ?? "month") as PeriodKey, request.principal);
  }

  @Get(":siteId/profile")
  @RequirePermissions("site:read")
  profile(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.platform.siteProfile(siteId, request.principal);
  }

  @Put(":siteId/profile")
  @RequirePermissions("site:manage")
  updateProfile(@Param("siteId") siteId: string, @Body() body: UpdateSiteProfileDto, @Req() request: RequestWithPrincipal) {
    return this.platform.updateSiteProfile(siteId, body, request.principal);
  }

  @Post()
  @RequirePermissions("site:manage")
  create(@Body() body: CreateSiteDto, @Req() request: RequestWithPrincipal) {
    return this.platform.createSite(body, request.principal);
  }

  @Patch(":siteId")
  @RequirePermissions("site:manage")
  update(@Param("siteId") siteId: string, @Body() body: UpdateSiteDto, @Req() request: RequestWithPrincipal) {
    return this.platform.updateSite(siteId, body, request.principal);
  }

  @Delete(":siteId")
  @RequirePermissions("site:manage")
  remove(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.platform.deleteSite(siteId, request.principal);
  }
}
