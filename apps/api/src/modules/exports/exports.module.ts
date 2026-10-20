import { Module } from "@nestjs/common";
import { ExportsService } from "../../exports/exports.service";
import { ExportsController } from "./exports.controller";

@Module({
  controllers: [ExportsController],
  providers: [ExportsService]
})
export class ExportsModule {}
