import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PlatformService } from "../../platform/platform.service";
import { LOGIN_ACCOUNT_THROTTLE } from "../../common/client-throttler";
import { RequestWithPrincipal } from "../../common/principal";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./change-password.dto";
import { LoginDto } from "./login.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly platform: PlatformService,
    private readonly auth: AuthService
  ) {}

  // Deliberately not behind @RequirePermissions — there is no principal to check permissions
  // against until this succeeds. Rate-limited far tighter than the global default: 8 attempts per
  // minute PER ACCOUNT (not per caller IP — every login arrives from the web service, so an IP key
  // would be one shared limit for all customers) is enough for a genuine user who mistypes a
  // password, not enough to guess one (docs/15-master-roadmap.md, Phase 0). A per-source flood
  // ceiling across many accounts lives in common/client-throttler.ts.
  @Throttle({ default: LOGIN_ACCOUNT_THROTTLE })
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get("session")
  session(@Req() request: RequestWithPrincipal) {
    return this.platform.session(request.principal);
  }

  // No @RequirePermissions — every role can change their own password; this operates on the
  // caller's own userId from their verified session, never a target the caller chooses.
  @Post("change-password")
  async changePassword(@Body() body: ChangePasswordDto, @Req() request: RequestWithPrincipal): Promise<{ success: true }> {
    await this.auth.changePassword(request.principal.userId, body.currentPassword, body.newPassword);
    return { success: true };
  }
}
