import { Module } from "@nestjs/common";
import { SetupController } from "./setup.controller";

// The service itself lives with the platform (PlatformModule), because it works through PlatformService.
@Module({
  controllers: [SetupController]
})
export class SetupModule {}
