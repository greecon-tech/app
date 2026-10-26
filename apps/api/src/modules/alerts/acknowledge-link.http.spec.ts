import "reflect-metadata";
import { INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AcknowledgeLinkView } from "@greecon/shared";
import { throttlers } from "../../common/client-throttler";
import { PrincipalGuard } from "../../common/principal.guard";
import { DatabaseService } from "../../database/database.service";
import { AcknowledgeLinkController } from "./acknowledge-link.controller";
import { AcknowledgeLinkService } from "./acknowledge-link.service";

// The link's two routes over real HTTP, behind the real guards and limits, as a production platform runs them: reachable with
// no session, one status for every answer, nothing done by a GET, and a limit on how fast anyone can try tokens.

const GOOD = "A".repeat(36);
const calls: string[] = [];
const fake = {
  view: (token: string): AcknowledgeLinkView => (calls.push(`view ${token}`), token === GOOD ? { valid: true, alert: { title: "Tank level is critical", siteName: "Hotel Adriatik", priority: "Act now", raisedAtUtc: "2026-10-19T12:05:00.000Z", state: "open" } } : { valid: false }),
  acknowledge: async (token: string): Promise<AcknowledgeLinkView> => (calls.push(`acknowledge ${token}`), token === GOOD ? { valid: true, alert: { title: "Tank level is critical", siteName: "Hotel Adriatik", priority: "Act now", raisedAtUtc: "2026-10-19T12:05:00.000Z", state: "acknowledged" } } : { valid: false })
};

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers })],
  controllers: [AcknowledgeLinkController],
  providers: [
    DatabaseService,
    { provide: AcknowledgeLinkService, useValue: fake },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PrincipalGuard }
  ]
})
class LinkRoutes {}

describe("the link's routes, over HTTP, as a production platform serves them", () => {
  let app: INestApplication;
  let base: string;
  const previous = { nodeEnv: process.env.NODE_ENV, databaseUrl: process.env.DATABASE_URL };

  beforeAll(async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    app = await NestFactory.create(LinkRoutes, { logger: false });
    await app.listen(0, "127.0.0.1");
    base = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  });

  afterAll(async () => {
    await app.close();
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.databaseUrl !== undefined) process.env.DATABASE_URL = previous.databaseUrl;
  });

  const call = async (method: "GET" | "POST", token: string) => {
    const response = await fetch(`${base}/public/acknowledge/${token}`, { method });
    return { status: response.status, body: (await response.json()) as AcknowledgeLinkView & { statusCode?: number } };
  };

  it("answers with no session, with the same status for a good link and a bad one, and a GET only looks", async () => {
    calls.length = 0;
    const answers = [await call("GET", GOOD), await call("GET", "B".repeat(36)), await call("POST", GOOD), await call("POST", "nonsense")];
    expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200, 200]);
    expect(answers.map((answer) => answer.body.valid)).toEqual([true, false, true, false]);
    expect(answers[1]?.body).toEqual({ valid: false });
    expect(calls).toEqual([`view ${GOOD}`, `view ${"B".repeat(36)}`, `acknowledge ${GOOD}`, "acknowledge nonsense"]);
  });

  it("stops anyone trying tokens one after another: 30 a minute from one address, for looking and for pressing each", async () => {
    // The test before made two calls of each kind; they count too.
    const looks: number[] = [];
    for (let attempt = 0; attempt < 30; attempt += 1) looks.push((await call("GET", String(attempt).padStart(36, "C"))).status);
    expect(looks.slice(0, 28).every((status) => status === 200)).toBe(true);
    expect(looks.slice(28)).toEqual([429, 429]);

    const presses: number[] = [];
    for (let attempt = 0; attempt < 29; attempt += 1) presses.push((await call("POST", String(attempt).padStart(36, "D"))).status);
    expect(presses.slice(0, 28).every((status) => status === 200)).toBe(true);
    expect(presses.slice(28)).toEqual([429]);
  });
});
