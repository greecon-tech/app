import "reflect-metadata";
import helmet from "helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { apiDocsEnabled, checkRuntimeConfig, trustedProxyHops } from "./common/runtime-config";
import { prepareDatabase } from "./database/startup";

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
}

bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
