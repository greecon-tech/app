import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { createEnergyLedger } from "../value/create-ledger";
import { DemoFeedService } from "../value/demo-feed";
import { EnergyLedger } from "../value/energy-ledger";
import { PlatformService } from "./platform.service";

@Global()
@Module({
  providers: [{ provide: EnergyLedger, useFactory: (db: DatabaseService) => createEnergyLedger(db), inject: [DatabaseService] }, PlatformService, DemoFeedService],
  exports: [PlatformService]
})
export class PlatformModule {}
