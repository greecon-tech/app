import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { RequestWithPrincipal } from "../../common/principal";
import { PlatformService } from "../../platform/platform.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SaveContactsDto, SaveSettingsDto } from "./notifications.dto";

/** Who is told when something needs a person: for the account's owners and administrators, and for Greecon staff
 * setting an account up. The people's addresses and numbers are the account's own data, so every route here is
 * the account's alone: nothing takes an account from the request, only from who is asking. */
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly platform: PlatformService
  ) {}

  @Get("status")
  @RequirePermissions("settings:manage")
  status(@Req() request: RequestWithPrincipal) {
    return this.notifications.status(request.principal.tenantId);
  }

  @Get("contacts")
  @RequirePermissions("settings:manage")
  contacts(@Req() request: RequestWithPrincipal) {
    return this.notifications.contacts(request.principal.tenantId);
  }

  @Put("contacts")
  @RequirePermissions("settings:manage")
  async saveContacts(@Body() body: SaveContactsDto, @Req() request: RequestWithPrincipal) {
    const saved = await this.notifications.saveContacts(request.principal.tenantId, body.contacts);
    await this.platform.recordNotificationSettingsChange(request.principal, "notifications.contacts_changed", `The list of people to tell was changed: ${saved.length === 0 ? "nobody" : saved.map((contact) => contact.name).join(", ")}.`);
    return saved;
  }

  @Get("settings")
  @RequirePermissions("settings:manage")
  settings(@Req() request: RequestWithPrincipal) {
    return this.notifications.settings(request.principal.tenantId);
  }

  @Put("settings")
  @RequirePermissions("settings:manage")
  async saveSettings(@Body() body: SaveSettingsDto, @Req() request: RequestWithPrincipal) {
    const saved = await this.notifications.saveSettings(request.principal.tenantId, body);
    await this.platform.recordNotificationSettingsChange(
      request.principal,
      "notifications.settings_changed",
      `Quiet hours ${saved.quietFrom}-${saved.quietTo}, morning message ${saved.digestEnabled ? `at ${saved.digestAt}` : "off"}, clock ${saved.timezone}.`
    );
    return saved;
  }

  @Post("contacts/:contactId/test")
  @RequirePermissions("settings:manage")
  test(@Param("contactId", new ParseUUIDPipe()) contactId: string, @Req() request: RequestWithPrincipal) {
    return this.notifications.sendTest(request.principal.tenantId, contactId);
  }

  @Get("log")
  @RequirePermissions("settings:manage")
  log(@Query("limit") limit: string | undefined, @Req() request: RequestWithPrincipal) {
    return this.notifications.log(request.principal.tenantId, Number(limit) || 50);
  }
}
