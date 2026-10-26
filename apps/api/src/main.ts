import "reflect-metadata";
import helmet from "helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { apiDocsEnabled, checkRuntimeConfig, restartGraceMs, trustedProxyHops } from "./common/runtime-config";
import { prepareDatabase } from "./database/startup";
import { PlatformService } from "./platform/platform.service";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");

  // A missing DATABASE_URL is legitimate (local dev without Postgres, the in-memory-only fallback
  // every domain in PlatformService has). A real database with a missing or weak JWT_SECRET is not:
  // on a production deployment that stops the boot here, so it shows in the deploy logs at once
  // instead of surfacing as "nobody can sign in" or, worse, as sessions anyone could forge.
  const config = checkRuntimeConfig(process.env);
  for (const warning of config.warnings) logger.warn(warning);
  if (config.errors.length > 0) {
    for (const error of config.errors) logger.error(error);
    throw new Error("The deployment's settings are not safe to start with. See the errors above.");
  }

  // Brings the schema up to this version and closes accounts that carry a published password,
  // before anything reads the database (PlatformService hydrates from it when the module starts).
  await prepareDatabase(process.env, (message) => (message.startsWith("SECURITY") ? logger.warn(message) : logger.log(message)));

  // The default request body limit (100 kB) is smaller than a hundred readings sent at once.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false
  });
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "1mb" });

  // Behind a reverse proxy (Railway, a load balancer) every connection arrives from the proxy, so
  // without this every caller looks like one address and shares one rate-limit bucket. Opt-in and
  // exact: TRUST_PROXY is the number of trusted hops (see common/runtime-config.ts).
  const proxyHops = trustedProxyHops(process.env);
  if (proxyHops !== undefined) {
    app.set("trust proxy", proxyHops);
    logger.log(`Trusting ${proxyHops} reverse proxy hop(s) for the caller's address (TRUST_PROXY).`);
  }

  // Said once at every start, so that a platform that keeps restarting shows it in the log: for this long after a start nothing that
  // comes from missing readings is raised or messaged (platform/restart-grace.ts).
  const graceMs = restartGraceMs(process.env);
  logger.log(
    graceMs > 0
      ? `After this start nothing about missing readings (a silent box, a reading out of date) is raised or messaged for ${graceMs / 60_000} minute(s), while the boxes reconnect (RESTART_GRACE_MINUTES). A measured danger is never held back.`
      : "No wait after a start (RESTART_GRACE_MINUTES is 0): boxes that are still reconnecting after a deploy may be called silent."
  );

  app.use(helmet());
  app.enableCors({
    origin: [/^http:\/\/localhost:\d+$/],
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Greecon Platform API")
    .setDescription("Operational API for Greecon sites, devices, telemetry, automation, alerts, and audit evidence.")
    .setVersion("0.1.0")
    .build();
  // The spec lists every route, so a production deployment keeps it off unless asked
  // (ENABLE_API_DOCS=true) — see common/runtime-config.ts.
  if (apiDocsEnabled(process.env)) {
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  } else {
    logger.log("API docs (/docs) are disabled in production; set ENABLE_API_DOCS=true to enable them.");
  }

  // PORT is Railway's convention; API_PORT is ours (docker-compose, GCP). Railway's
  // private networking requires listening on "::" (IPv6), which also accepts ordinary
  // IPv4 connections on a dual-stack host — but not every host has IPv6 available at
  // all, so fall back to the plain default (0.0.0.0) rather than assuming.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  try {
    await app.listen(port, "::");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EAFNOSUPPORT") throw error;
    await app.listen(port);
  }

  // A host stops a service with SIGTERM when it deploys a new version. Nothing here listens for it by default,
  // so the energy and water counted since the last save would be lost at every deploy. The counts are saved
  // first, while the database is still open, and then everything is closed. (Nest's own shutdown hooks are not
  // used: they close the database before the application's shutdown step, which would leave the counts unsaved.)
  let stopping = false;
  const stop = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.log(`${signal} received: saving what has been counted, then stopping.`);
    setTimeout(() => process.exit(1), 8_000).unref();
    app
      .get(PlatformService)
      .saveBeforeStopping()
      .then(() => app.close())
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error(`Stopping did not finish cleanly: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}

bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
