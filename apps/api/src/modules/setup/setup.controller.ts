import { Body, Controller, Delete, Get, Param, Post, Put, Req } from "@nestjs/common";
import { publicApiUrl } from "../../common/public-url";
import { RequestWithPrincipal } from "../../common/principal";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { SetupService } from "../../setup/setup.service";
import { ConfirmSetupStepDto, CreateDeviceFromProfileDto, CreateSiteFromTemplateDto, FindEquipmentDto, ProvisionGatewayDto } from "./setup.dto";

type Request = RequestWithPrincipal & { protocol: string; get(name: string): string | undefined };

/** Setting a site up: for the project manager (working in the customer's account) and the customer's own administrators. */
@Controller()
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Post("sites/from-template")
  @RequirePermissions("site:manage")
  createFromTemplate(@Body() body: CreateSiteFromTemplateDto, @Req() request: RequestWithPrincipal) {
    return this.setup.createSiteFromTemplate(body, request.principal);
  }

  @Get("sites/:siteId/setup")
  @RequirePermissions("site:read")
  view(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.setup.setupView(siteId, request.principal);
  }

  @Put("sites/:siteId/setup/steps/:stepKey")
  @RequirePermissions("site:manage")
  confirm(@Param("siteId") siteId: string, @Param("stepKey") stepKey: string, @Body() body: ConfirmSetupStepDto, @Req() request: RequestWithPrincipal) {
    return this.setup.confirmStep(siteId, stepKey, body.note, request.principal);
  }

  @Delete("sites/:siteId/setup/steps/:stepKey")
  @RequirePermissions("site:manage")
  reopen(@Param("siteId") siteId: string, @Param("stepKey") stepKey: string, @Req() request: RequestWithPrincipal) {
    return this.setup.reopenStep(siteId, stepKey, request.principal);
  }

  // "Find equipment": the box looks at the site's network, and the addresses of what it finds are filled in. Asking changes nothing by itself.
  @Post("sites/:siteId/discovery")
  @RequirePermissions("device:manage")
  findEquipment(@Param("siteId") siteId: string, @Body() body: FindEquipmentDto, @Req() request: RequestWithPrincipal) {
    return this.setup.requestDiscovery(siteId, body, request.principal);
  }

  @Get("sites/:siteId/discovery")
  @RequirePermissions("site:read")
  equipmentFound(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.setup.discoveryView(siteId, request.principal);
  }

  @Post("sites/:siteId/discovery/apply")
  @RequirePermissions("device:manage")
  useAddresses(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.setup.applyDiscovery(siteId, request.principal);
  }

  // The range printed on each transmitter's label: Greecon works out the register and the scale from it. Checked in words in the service.
  @Put("devices/:deviceId/ranges")
  @RequirePermissions("device:manage")
  ranges(@Param("deviceId") deviceId: string, @Body() body: Record<string, unknown>, @Req() request: RequestWithPrincipal) {
    return this.setup.setRanges(deviceId, body, request.principal);
  }

  // Lists the account's people, which only those who may manage users may see: the same two roles that manage sites.
  @Get("sites/:siteId/handover")
  @RequirePermissions("site:manage")
  handover(@Param("siteId") siteId: string, @Req() request: RequestWithPrincipal) {
    return this.setup.handover(siteId, request.principal);
  }

  @Post("devices/from-profile")
  @RequirePermissions("device:manage")
  fromProfile(@Body() body: CreateDeviceFromProfileDto, @Req() request: RequestWithPrincipal) {
    return this.setup.createDeviceFromProfile(body, request.principal);
  }

  // The install command is returned once, here, and never kept: only the hash of its code is stored.
  @Post("gateways/provision")
  @RequirePermissions("device:manage")
  provision(@Body() body: ProvisionGatewayDto, @Req() request: Request) {
    return this.setup.provisionBox(body, request.principal, publicApiUrl(process.env, request));
  }

  @Post("gateways/:gatewayId/enrolment")
  @RequirePermissions("device:manage")
  newCode(@Param("gatewayId") gatewayId: string, @Req() request: Request) {
    return this.setup.issueEnrolment(gatewayId, request.principal, publicApiUrl(process.env, request));
  }
}
