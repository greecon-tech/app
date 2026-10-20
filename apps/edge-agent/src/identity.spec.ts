import { describe, expect, it } from "vitest";
import { IdentityError, loadIdentity, platformAddress } from "./identity";

const good = { apiUrl: "https://api.greecon.example/", tenantId: "t", siteId: "s", gatewayId: "g", secret: "x".repeat(64) };
const fileWith = (value: unknown) => () => JSON.stringify(value);
const noFile = () => {
  throw Object.assign(new Error("no such file"), { code: "ENOENT" });
};

describe("who this box is", () => {
  it("is read from the file the installer wrote, with the address tidied", () => {
    expect(loadIdentity({}, fileWith(good))).toEqual({ ...good, apiUrl: "https://api.greecon.example" });
  });

  it("reads the file named by GREECON_EDGE_CONFIG", () => {
    let asked = "";
    loadIdentity({ GREECON_EDGE_CONFIG: "/tmp/other.json" }, (path) => {
      asked = path;
      return JSON.stringify(good);
    });
    expect(asked).toBe("/tmp/other.json");
  });

  it("falls back to the environment for development against a local platform", () => {
    const identity = loadIdentity({ API_URL: "http://localhost:4000", TENANT_ID: "t", SITE_ID: "s", GATEWAY_ID: "g", EDGE_TOKEN: "y".repeat(40) }, noFile);
    expect(identity).toMatchObject({ apiUrl: "http://localhost:4000", gatewayId: "g" });
  });

  it("says what to do when nothing tells the box who it is", () => {
    expect(() => loadIdentity({}, noFile)).toThrow(/Nothing tells this box who it is.*Run the install command/);
  });

  it("says what is missing from a file that is incomplete, without showing the credential", () => {
    const attempt = () => loadIdentity({}, fileWith({ ...good, siteId: "", secret: "x".repeat(64) }));
    expect(attempt).toThrow(IdentityError);
    expect(attempt).toThrow(/missing siteId/);
    expect(attempt).not.toThrow(/xxxxxxxx/);
  });

  it("refuses a file that is not JSON, rather than treating the box as new", () => {
    expect(() => loadIdentity({}, () => "not json {")).toThrow(/cannot be read as the box's identity/);
  });

  it("refuses an address that is not a web address, and a credential too short to be real", () => {
    expect(() => loadIdentity({}, fileWith({ ...good, apiUrl: "api.greecon.example" }))).toThrow(/not a web address/);
    expect(() => loadIdentity({}, fileWith({ ...good, apiUrl: "ftp://api.greecon.example" }))).toThrow(/not a web address/);
    expect(() => loadIdentity({}, fileWith({ ...good, secret: "short" }))).toThrow(/too short to be real/);
  });
});

describe("the platform's address", () => {
  it("must be https on the open internet, because the box sends its credential there and takes its software from there", () => {
    expect(platformAddress("https://api.greecon.earth/")).toBe("https://api.greecon.earth");
    expect(() => platformAddress("http://api.greecon.earth")).toThrow(/is not https/);
    expect(() => platformAddress("http://203.0.113.9:4000")).toThrow(/is not https/);
    expect(() => platformAddress("http://greecon.earth.example.com")).toThrow(/is not https/);
  });

  it("may be plain http for a platform on the same private network, as in a rehearsal on a desk", () => {
    for (const address of ["http://localhost:4000", "http://127.0.0.1:4000", "http://192.168.1.20:4000", "http://10.0.0.5:4000", "http://172.16.4.2:4000", "http://172.31.255.1:4000", "http://169.254.1.1", "http://laptop:4000", "http://laptop.local:4000", "http://[::1]:4000"]) {
      expect(() => platformAddress(address), address).not.toThrow();
    }
    // 172.32 is not private; 192.169 is not either.
    expect(() => platformAddress("http://172.32.0.1:4000")).toThrow(/is not https/);
    expect(() => platformAddress("http://192.169.0.1:4000")).toThrow(/is not https/);
  });

  it("is checked when a box is read from its file, not only when it is enrolled", () => {
    expect(() => loadIdentity({}, fileWith({ ...good, apiUrl: "http://api.greecon.example" }))).toThrow(/is not https/);
  });
});
