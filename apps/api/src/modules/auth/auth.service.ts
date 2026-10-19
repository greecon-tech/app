import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DEMO_TENANT_ID, UserRole, userRoles } from "@greecon/shared";
import { DatabaseService } from "../../database/database.service";
import { forgetUser } from "../../common/active-users";
import { problemWithNewPassword } from "../../common/password-policy";
import { JwtClaims, jwtSecret } from "../../common/principal";

interface UserCredentialRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: string;
  is_platform_admin: boolean;
  must_change_password: boolean;
  tenant_status: string;
}

/** What Greecon staff are given to set a customer's account up: a session in that account, as an
 * administrator, that cannot be used for anything in Greecon's own console, and that ends by itself. */
export const SUPPORT_SESSION_HOURS = 4;

export interface SupportSession {
  token: string;
  user: LoginResult["user"] & { support: true };
  customer: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: UserRole;
    isPlatformAdmin: boolean;
    /** True while the password is a temporary one: the session can only be used to choose a new one. */
    mustChangePassword: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  /** The session for a staff member working inside one customer's account. It carries the staff member's
   * own identity, so that everything done is recorded under their name; it is for the customer's account
   * only (not a platform administrator's, so Greecon's console is closed to it); and it is short. */
  issueSupportSession(input: { tenantId: string; customer: string; staffUserId: string; staffName: string; staffEmail: string }): SupportSession {
    const secret = jwtSecret();
    if (!secret) throw new UnauthorizedException("JWT_SECRET is not configured on this deployment.");
    const claims: JwtClaims = { sub: input.staffUserId, tenantId: input.tenantId, role: "admin", email: input.staffEmail, isPlatformAdmin: false, support: true };
    return {
      token: jwt.sign(claims, secret, { expiresIn: `${SUPPORT_SESSION_HOURS}h` }),
      user: { id: input.staffUserId, tenantId: input.tenantId, email: input.staffEmail, name: input.staffName, role: "admin", isPlatformAdmin: false, mustChangePassword: false, support: true },
      customer: input.customer,
      expiresInSeconds: SUPPORT_SESSION_HOURS * 3600
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    // Real login needs a real, persisted user + password hash to check — there's no in-memory
    // fallback here the way most other domains have one, because the whole point is that a
    // header can no longer just assert an identity (see docs/07-security-and-rbac.md).
    if (!this.db.isConfigured()) {
      throw new UnauthorizedException("This deployment has no database configured — there is nothing to log in against.");
    }

    const secret = jwtSecret();
    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET is not configured on this deployment.");
    }

    const result = await this.db.query<UserCredentialRow>(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.password_hash, u.is_platform_admin, u.must_change_password, m.role, t.status AS tenant_status
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = u.tenant_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE lower(u.email) = lower($1) AND u.status = 'active'
       LIMIT 1`,
      [email]
    );

    const row = result.rows[0];
    // Compare against a dummy hash even on a missing user so a login attempt against a
    // nonexistent email takes about as long as one against a real email with a wrong password —
    // a cheap, standard defense against using response time to enumerate valid accounts.
    const hash = row?.password_hash ?? "$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal";
    const valid = await bcrypt.compare(password, hash);

    if (!row || !row.password_hash || !valid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPlatformAdmin = row.is_platform_admin === true;
    // A suspended client's users must not even get a fresh token — TenantStatusGuard (see
    // apps/api/src/common/tenant-status.guard.ts) also rejects an already-issued one on every
    // subsequent request, but rejecting here too means the failure is immediate and obvious
    // rather than "logs in fine, then every page fails." Platform admins are exempt: their own
    // account lives in Greecon's own tenant, which suspension never targets.
    if (!isPlatformAdmin && row.tenant_status !== "active") {
      throw new UnauthorizedException("This account's client has been suspended. Contact Greecon support.");
    }

    const role: UserRole = userRoles.includes(row.role as UserRole) ? (row.role as UserRole) : "viewer";
    const claims: JwtClaims = {
      sub: row.id,
      tenantId: row.tenant_id,
      role,
      email: row.email,
      isPlatformAdmin,
      ...(row.must_change_password === true ? { mcp: true } : {})
    };

    const token = jwt.sign(claims, secret, { expiresIn: "12h" });

    return {
      token,
      user: {
        id: row.id,
        tenantId: row.tenant_id,
        email: row.email,
        name: row.name,
        role,
        isPlatformAdmin,
        mustChangePassword: row.must_change_password === true
      }
    };
  }

  // Self-service — any logged-in user changes their own password, no admin/console step needed.
  // Requiring the current password (rather than just trusting the session) means a browser left
  // open and logged in can't be used to silently lock the real owner out by changing it to
  // something only the attacker knows.
  // The demo tenant's logins are shared across everyone looking at the live demo — anyone
  // changing one would lock out every other visitor using the same published credentials. Blocked
  // here, not only hidden in the UI (apps/web/src/app/settings/page.tsx), since the API is what
  // actually enforces this (docs/07-security-and-rbac.md: "the frontend hides unauthorized
  // actions, but the API enforces").
  async changePassword(userId: string, tenantId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (tenantId === DEMO_TENANT_ID) {
      throw new ForbiddenException("Demo account passwords can't be changed — they're shared by everyone viewing the live demo.");
    }

    if (!this.db.isConfigured()) {
      throw new UnauthorizedException("This deployment has no database configured — there is nothing to update.");
    }

    const result = await this.db.query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
    const row = result.rows[0];
    const valid = row?.password_hash ? await bcrypt.compare(currentPassword, row.password_hash) : false;
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const problem = problemWithNewPassword(newPassword, currentPassword);
    if (problem) throw new BadRequestException(problem);

    const newHash = await bcrypt.hash(newPassword, 10);
    // Every session opened before now, on this password or the old one, ends: the person signs in again.
    await this.db.query("UPDATE users SET password_hash = $1, must_change_password = false, sessions_valid_after = now() WHERE id = $2", [newHash, userId]);
    forgetUser(userId);
  }
}
