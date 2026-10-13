import "reflect-metadata";
import helmet from "helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { apiDocsEnabled, trustedProxyHops } from "./common/runtime-config";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");

  // A missing DATABASE_URL is legitimate (local dev without Postgres, the in-memory-only fallback
  // every domain in PlatformService has); a missing JWT_SECRET alongside a REAL database is not —
  // it means login can never work on what's clearly meant to be a real deployment. Warn loudly at
  // boot rather than letting that surface only when someone's first login attempt fails, so a
  // misconfigured production deploy is obvious in the deploy logs immediately.
  if (process.env.DATABASE_URL && !process.env.JWT_SECRET) {
    logger.warn(
      "DATABASE_URL is set but JWT_SECRET is not — this deployment has a real database but " +
        "login will fail for every user until JWT_SECRET is configured (docs/07-security-and-rbac.md)."
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true
  });

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

void bootstrap();
