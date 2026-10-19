import { describe, expect, it } from "vitest";
import { apiDocsEnabled, checkRuntimeConfig, trustedProxyHops } from "./runtime-config";

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
  const production = { NODE_ENV: "production", DATABASE_URL: "postgres://db", JWT_SECRET: strong, TRUST_PROXY: "1" };

  it("accepts a properly configured production deployment", () => {
    expect(checkRuntimeConfig(production)).toEqual({ errors: [], warnings: [] });
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
});
