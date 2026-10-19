import { Module } from "@nestjs/common";
import { AccessRequestsAdminController, PublicAccessRequestsController } from "./access-requests.controller";
import { AccessRequestsService } from "./access-requests.service";

@Module({
  controllers: [PublicAccessRequestsController, AccessRequestsAdminController],
  providers: [AccessRequestsService],
  exports: [AccessRequestsService]
})
export class AccessRequestsModule {}
