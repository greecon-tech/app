import { describe, expect, it } from "vitest";
import { apiDocsEnabled, checkRuntimeConfig, restartGraceMs, trustedProxyHops } from "./runtime-config";

describe("restartGraceMs", () => {
  it("waits ten minutes after a start unless told otherwise", () => {
    expect(restartGraceMs({})).toBe(10 * 60_000);
    expect(restartGraceMs({ RESTART_GRACE_MINUTES: "" })).toBe(10 * 60_000);
  });

  it("takes a whole number of minutes up to an hour, and 0 to switch the wait off", () => {
    expect(restartGraceMs({ RESTART_GRACE_MINUTES: " 5 " })).toBe(5 * 60_000);
    expect(restartGraceMs({ RESTART_GRACE_MINUTES: "60" })).toBe(60 * 60_000);
    expect(restartGraceMs({ RESTART_GRACE_MINUTES: "0" })).toBe(0);
  });

  it("keeps the standard wait for anything else, and says so at start", () => {
    for (const value of ["61", "2.5", "-1", "ten", "999"]) {
      expect(restartGraceMs({ RESTART_GRACE_MINUTES: value })).toBe(10 * 60_000);
      expect(checkRuntimeConfig({ RESTART_GRACE_MINUTES: value }).warnings.join("\n")).toMatch(/RESTART_GRACE_MINUTES is not a whole number of minutes from 0 to 60/);
    }
    expect(checkRuntimeConfig({ RESTART_GRACE_MINUTES: "5" }).warnings).toEqual([]);
  });
});

describe("apiDocsEnabled", () => {
  it("is on in development and test, where it helps people building against the API", () => {
    expect(apiDocsEnabled({})).toBe(true);
    expect(apiDocsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(apiDocsEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("is off in production by default, so a public API does not publish its own route map", () => {
    expect(apiDocsEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("can be turned on deliberately in production", () => {
    expect(apiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "true" })).toBe(true);
    expect(apiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: " TRUE " })).toBe(true);
  });

  it("can be turned off explicitly anywhere, and an unrecognised value does not switch it on in production", () => {
    expect(apiDocsEnabled({ NODE_ENV: "development", ENABLE_API_DOCS: "false" })).toBe(false);
    expect(apiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "yes" })).toBe(false);
  });
});

describe("trustedProxyHops", () => {
  it("trusts no proxy unless told how many to trust", () => {
    expect(trustedProxyHops({})).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "" })).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "false" })).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "0" })).toBeUndefined();
  });

  it("accepts a small exact hop count", () => {
    expect(trustedProxyHops({ TRUST_PROXY: "1" })).toBe(1);
    expect(trustedProxyHops({ TRUST_PROXY: " 2 " })).toBe(2);
  });

  it("refuses values that would trust arbitrary callers, such as 'true' or a subnet list", () => {
    expect(trustedProxyHops({ TRUST_PROXY: "true" })).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "10.0.0.0/8" })).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "-1" })).toBeUndefined();
    expect(trustedProxyHops({ TRUST_PROXY: "999" })).toBeUndefined();
  });
});

describe("checkRuntimeConfig", () => {
  const strong = "x".repeat(40);
  const production = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db",
    JWT_SECRET: strong,
    TRUST_PROXY: "1",
    PUBLIC_API_URL: "https://api.greecon.earth",
    PUBLIC_WEB_URL: "https://app.greecon.earth",
    RESEND_API_KEY: "re_x",
    TWILIO_ACCOUNT_SID: "AC1",
    TWILIO_AUTH_TOKEN: "t",
    TWILIO_FROM: "+15005550006",
    SALES_NOTIFY_EMAIL: "info@greecon.earth"
  };

  it("accepts a properly configured production deployment", () => {
    expect(checkRuntimeConfig(production)).toEqual({ errors: [], warnings: [] });
  });

  it("says, at every start, when alert messages cannot be sent at all", () => {
    const { RESEND_API_KEY: _a, TWILIO_ACCOUNT_SID: _b, TWILIO_AUTH_TOKEN: _c, TWILIO_FROM: _d, ...without } = production;
    const report = checkRuntimeConfig(without);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      "Alert messages are OFF: neither email (RESEND_API_KEY) nor text messages (TWILIO_*) are set up, so alerts show in Greecon and nobody is sent a message. A site cannot be commissioned until one is."
    ]);
  });

  it("says when only text messages are set up, because Check today and the morning message are email", () => {
    const { RESEND_API_KEY: _omitted, ...withoutEmail } = production;
    expect(checkRuntimeConfig(withoutEmail).warnings).toEqual(["Email (RESEND_API_KEY) is not set up. Only Act now reaches people, by text; Check today and the morning message are not sent."]);
  });

  it("reports a half-set messaging provider as the problem it is", () => {
    const report = checkRuntimeConfig({ ...production, TWILIO_AUTH_TOKEN: undefined, ALERT_FROM_EMAIL: "not an address" });
    expect(report.warnings).toEqual([
      "ALERT_FROM_EMAIL is not an email address, so email is off.",
      "Text messages need both TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, so text messages are off.",
      "Alert messages are OFF: neither email (RESEND_API_KEY) nor text messages (TWILIO_*) are set up, so alerts show in Greecon and nobody is sent a message. A site cannot be commissioned until one is."
    ]);
  });

  it("asks for the web address, so messages can link back, and for who hears of a request for access", () => {
    const report = checkRuntimeConfig({ ...production, PUBLIC_WEB_URL: undefined, SALES_NOTIFY_EMAIL: "  " });
    expect(report.warnings.join("\n")).toMatch(/PUBLIC_WEB_URL is not set/);
    expect(report.warnings.join("\n")).toMatch(/SALES_NOTIFY_EMAIL is not set/);
  });

  it("stops a production deployment that has a database but no signing secret", () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = production;
    const report = checkRuntimeConfig(withoutSecret);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatch(/JWT_SECRET is not set/);
  });

  it("stops a production deployment still using the example secret or a short one", () => {
    expect(checkRuntimeConfig({ ...production, JWT_SECRET: "local-dev-only-change-me" }).errors[0]).toMatch(/example value/);
    expect(checkRuntimeConfig({ ...production, JWT_SECRET: "short" }).errors[0]).toMatch(/shorter than 32/);
  });

  it("only warns about the same things outside production, where a laptop may use the example secret", () => {
    const report = checkRuntimeConfig({ DATABASE_URL: "postgres://db", JWT_SECRET: "local-dev-only-change-me" });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(1);
  });

  it("does not care about the secret when there is no database, because nobody can sign in anyway", () => {
    expect(checkRuntimeConfig({ NODE_ENV: "production" }).errors).toEqual([]);
  });

  it("warns, without stopping, about half-set pairs and a missing proxy setting", () => {
    const report = checkRuntimeConfig({
      ...production,
      TRUST_PROXY: undefined,
      BOOTSTRAP_ADMIN_EMAIL: "a@b.c",
      EDGE_INGEST_TOKEN: "t"
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.join("\n")).toMatch(/BOOTSTRAP_ADMIN/);
    expect(report.warnings.join("\n")).toMatch(/EDGE_INGEST_TOKEN/);
    expect(report.warnings.join("\n")).toMatch(/TRUST_PROXY/);
  });

  it("warns, without stopping, when a box would be told an address it cannot reach", () => {
    const missing = checkRuntimeConfig({ ...production, PUBLIC_API_URL: undefined });
    expect(missing.errors).toEqual([]);
    expect(missing.warnings.join("\n")).toMatch(/PUBLIC_API_URL is not set/);

    expect(checkRuntimeConfig({ ...production, PUBLIC_API_URL: "api.greecon.earth" }).warnings.join("\n")).toMatch(/PUBLIC_API_URL is not set \(or is not an address\)/);
    expect(checkRuntimeConfig({ ...production, PUBLIC_API_URL: "http://api.greecon.earth" }).warnings.join("\n")).toMatch(/not https/);
  });

  it("does not mind the public address outside production or without a database", () => {
    expect(checkRuntimeConfig({ DATABASE_URL: "postgres://db", JWT_SECRET: strong }).warnings).toEqual([]);
    expect(checkRuntimeConfig({ NODE_ENV: "production" }).warnings).toEqual([]);
  });
});
