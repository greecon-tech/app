import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { EdgeBundleService } from "../setup/edge-bundle";
import { createEnrolmentStore } from "../setup/enrolment-store";
import { ENROLMENT_STORE, SetupService } from "../setup/setup.service";
import { createEnergyLedger } from "../value/create-ledger";
import { DemoFeedService } from "../value/demo-feed";
import { EnergyLedger } from "../value/energy-ledger";
import { PlatformService } from "./platform.service";

@Global()
@Module({
  providers: [
    { provide: EnergyLedger, useFactory: (db: DatabaseService) => createEnergyLedger(db), inject: [DatabaseService] },
    { provide: ENROLMENT_STORE, useFactory: (db: DatabaseService) => createEnrolmentStore(db), inject: [DatabaseService] },
    PlatformService,
    DemoFeedService,
    EdgeBundleService,
    SetupService
  ],
  exports: [PlatformService, SetupService, EdgeBundleService]
})
export class PlatformModule {}
