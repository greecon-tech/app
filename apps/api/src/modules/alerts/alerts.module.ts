import { Module } from "@nestjs/common";
import { AcknowledgeLinkController } from "./acknowledge-link.controller";
import { AcknowledgeLinkService } from "./acknowledge-link.service";
import { AlertsController } from "./alerts.controller";

@Module({
  controllers: [AlertsController, AcknowledgeLinkController],
  providers: [AcknowledgeLinkService]
})
export class AlertsModule {}
