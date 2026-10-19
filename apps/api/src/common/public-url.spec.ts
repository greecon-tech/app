import { describe, expect, it } from "vitest";
import { configuredPublicApiUrl, publicApiUrl } from "./public-url";

const request = (host: string | undefined, protocol = "http") => ({ protocol, get: (name: string) => (name === "host" ? host : undefined) });

describe("the address a box can reach the API at", () => {
  it("is the configured one when there is one, tidied", () => {
    expect(publicApiUrl({ PUBLIC_API_URL: "https://api.greecon.earth/" }, request("api.railway.internal:4000"))).toBe("https://api.greecon.earth");
    expect(publicApiUrl({ PUBLIC_API_URL: "  https://api.greecon.earth  " }, request("x"))).toBe("https://api.greecon.earth");
    expect(publicApiUrl({ PUBLIC_API_URL: "https://api.greecon.earth/some/path?x=1" }, request("x"))).toBe("https://api.greecon.earth");
  });

  it("is the address the request came in on, in development", () => {
    expect(publicApiUrl({}, request("localhost:4000"))).toBe("http://localhost:4000");
    expect(publicApiUrl({}, request("api.example.test", "https"))).toBe("https://api.example.test");
    expect(publicApiUrl({}, request(undefined))).toBe("http://localhost");
  });

  it("ignores a setting that is not an address", () => {
    for (const value of ["", "   ", "api.greecon.earth", "ftp://api.greecon.earth", "javascript:alert(1)", "not a url"]) {
      expect(configuredPublicApiUrl({ PUBLIC_API_URL: value }), value).toBeUndefined();
    }
    expect(publicApiUrl({ PUBLIC_API_URL: "api.greecon.earth" }, request("localhost:4000"))).toBe("http://localhost:4000");
  });
});
