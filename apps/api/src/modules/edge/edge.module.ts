import { Module } from "@nestjs/common";
import { EdgeController } from "./edge.controller";

@Module({
  controllers: [EdgeController]
})
export class EdgeModule {}
