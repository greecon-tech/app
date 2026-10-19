import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../../common/platform-admin.guard";
import { RequestWithPrincipal } from "../../common/principal";
import { PlatformService } from "../../platform/platform.service";
import { AuthService } from "../auth/auth.service";
import { CreateTenantDto } from "./create-tenant.dto";
import { UpdateTenantStatusDto } from "./update-tenant-status.dto";

// Manages Greecon's clients (tenants) themselves — separate from the per-tenant Admin page
// (/admin, apps/web/src/app/admin), which manages users/sites within one client's own account.
// Every route here requires isPlatformAdmin, not a tenant-scoped role (see platform-admin.guard.ts).
@Controller("platform-admin")
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platform: PlatformService,
    private readonly auth: AuthService
  ) {}

  @Get("tenants")
  listTenants(
    @Query("q") search: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Req() request: RequestWithPrincipal
  ) {
    return this.platform.listAllTenants(request.principal, {
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
  }

  @Post("tenants")
  createTenant(@Body() body: CreateTenantDto, @Req() request: RequestWithPrincipal) {
    return this.platform.createTenant(body, request.principal);
  }

  // Greecon's project manager opens a customer's account to set it up. The customer's audit trail records
  // that they did, and everything done in it afterwards is under their own name.
  @Post("tenants/:tenantId/support-session")
  async startSupportSession(@Param("tenantId") tenantId: string, @Req() request: RequestWithPrincipal) {
    const { tenant, staffName } = await this.platform.beginSupportSession(tenantId, request.principal);
    return this.auth.issueSupportSession({ tenantId: tenant.id, customer: tenant.name, staffUserId: request.principal.userId, staffName, staffEmail: request.principal.email });
  }

  @Patch("tenants/:tenantId/status")
  updateTenantStatus(@Param("tenantId") tenantId: string, @Body() body: UpdateTenantStatusDto, @Req() request: RequestWithPrincipal) {
    return this.platform.updateTenantStatus(tenantId, body.status, request.principal);
  }
}
