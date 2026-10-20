import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlatformAdminController } from "./platform-admin.controller";

@Module({
  imports: [AuthModule],
  controllers: [PlatformAdminController]
})
export class PlatformAdminModule {}
