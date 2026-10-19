import { Global, Module } from "@nestjs/common";
import { ACCESS_REQUEST_NOTIFIER } from "../modules/access-requests/access-requests.service";
import { DatabaseService } from "../database/database.service";
import { createAccessRequestNotifier } from "../notifications/access-request-notifier";
import { Channels, NOTIFICATION_CHANNELS, createChannels } from "../notifications/channels";
import { NotificationConfig } from "../notifications/config";
import { NOTIFICATION_OPTIONS, NotificationsService, OUTBOX_STORE } from "../notifications/notifications.service";
import { createOutboxStore } from "../notifications/outbox";
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
    // Telling people (docs/27-launch-decisions.md): email and text messages when something needs a person.
    { provide: NOTIFICATION_CHANNELS, useFactory: () => createChannels(process.env) },
    { provide: NOTIFICATION_OPTIONS, useFactory: () => ({ webUrl: process.env.PUBLIC_WEB_URL }) },
    { provide: OUTBOX_STORE, useFactory: (db: DatabaseService) => createOutboxStore(db), inject: [DatabaseService] },
    { provide: "ALERT_SOURCE", useExisting: PlatformService },
    NotificationConfig,
    NotificationsService,
    { provide: ACCESS_REQUEST_NOTIFIER, useFactory: (channels: Channels) => createAccessRequestNotifier(channels, process.env), inject: [NOTIFICATION_CHANNELS] },
    SetupService
  ],
  exports: [PlatformService, SetupService, EdgeBundleService, NotificationsService, NotificationConfig, ACCESS_REQUEST_NOTIFIER]
})
export class PlatformModule {}
