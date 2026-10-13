import { describe, expect, it } from "vitest";
import { apiDocsEnabled, trustedProxyHops } from "./runtime-config";

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
