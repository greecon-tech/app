import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./modules/audit/audit.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CommandsModule } from "./modules/commands/commands.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DerivedStatesModule } from "./modules/derived-states/derived-states.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { EdgeSyncModule } from "./modules/edge-sync/edge-sync.module";
import { GatewaysModule } from "./modules/gateways/gateways.module";
import { HealthModule } from "./modules/health/health.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { PlatformAdminModule } from "./modules/platform-admin/platform-admin.module";
import { PointsModule } from "./modules/points/points.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RulesModule } from "./modules/rules/rules.module";
import { SitesModule } from "./modules/sites/sites.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { ValueModule } from "./modules/value/value.module";
import { throttlers } from "./common/client-throttler";
import { PrincipalGuard } from "./common/principal.guard";
import { RbacGuard } from "./common/rbac.guard";
import { TenantStatusGuard } from "./common/tenant-status.guard";
import { DatabaseModule } from "./database/database.module";
import { PlatformModule } from "./platform/platform.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // A generous global default (defense in depth for every endpoint) plus a much stricter
    // override on POST /auth/login specifically (see auth.controller.ts's @Throttle) — brute
    // force protection promised in docs/15-master-roadmap.md, Phase 0. Counted per logged-in user
    // / per login account rather than per source IP, since every browser request reaches this API
    // via the web service (see common/client-throttler.ts). In-memory storage is fine for a
    // single-instance pilot deployment; revisit with a Redis storage adapter only once there's
    // more than one API replica running.
    ThrottlerModule.forRoot({ throttlers }),
    DatabaseModule,
    PlatformModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    SitesModule,
    AssetsModule,
    DevicesModule,
    GatewaysModule,
    PlatformAdminModule,
    PointsModule,
    TelemetryModule,
    DerivedStatesModule,
    RulesModule,
    CommandsModule,
    DashboardModule,
    AlertsModule,
    IncidentsModule,
    MaintenanceModule,
    ReportsModule,
    ValueModule,
    AuditModule,
    EdgeSyncModule,
    HealthModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PrincipalGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: TenantStatusGuard }
  ]
})
export class AppModule {}
