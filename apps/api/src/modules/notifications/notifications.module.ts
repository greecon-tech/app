import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";

// The service lives with the platform (PlatformModule), because it works through PlatformService.
@Module({
  controllers: [NotificationsController]
})
export class NotificationsModule {}
