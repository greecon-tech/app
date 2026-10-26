import "reflect-metadata";
import { BadRequestException, HttpException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../../database/database.service";
import { AccessRequestsService, KEPT_PER_HOUR_AT_MOST, NewAccessRequest, SALES_EMAILS_PER_HOUR } from "./access-requests.service";
import { CreateAccessRequestDto } from "./create-access-request.dto";

const request = (overrides: Partial<NewAccessRequest> = {}): NewAccessRequest => ({
  name: "  Besa   Krasniqi ",
  company: "Hotel Adriatik",
  email: "Besa@Hotel-Adriatik.example ",
  phone: "+355 69 123 4567",
  siteType: "hotel",
  message: "We have a wastewater plant and a solar roof.",
  ...overrides
});

const NOW = Date.parse("2026-10-19T10:00:00Z");

describe("access requests", () => {
  it("takes a request, tidies it, and keeps it in Greecon's inbox as new", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    await expect(service.receive(request(), NOW)).resolves.toEqual({ received: true });

    const [stored] = await service.list();
    expect(stored).toMatchObject({ name: "Besa Krasniqi", company: "Hotel Adriatik", email: "besa@hotel-adriatik.example", siteType: "hotel", status: "new" });
    expect(stored?.id).toBeTruthy();
  });

  it("gives a script the same answer and keeps nothing when the hidden field is filled", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    await expect(service.receive(request({ website: "https://spam.example" }), NOW)).resolves.toEqual({ received: true });
    expect(await service.list()).toEqual([]);
  });

  it("treats the same address asking again within a day as the same request, and a later one as new", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    await service.receive(request(), NOW);
    await service.receive(request({ name: "Besa again" }), NOW + 3_600_000);
    expect(await service.list()).toHaveLength(1);

    await service.receive(request(), NOW + 25 * 3_600_000);
    expect(await service.list()).toHaveLength(2);
  });

  it("keeps every request in a flood, stops emailing each one after thirty in an hour, and says so once", async () => {
    const notify = Object.assign(vi.fn().mockResolvedValue(undefined), { flood: vi.fn().mockResolvedValue(undefined) });
    const service = new AccessRequestsService(new DatabaseService(), notify);
    for (let index = 0; index < 45; index += 1) await service.receive(request({ email: `person${index}@example.com` }), NOW + index * 1_000);

    expect(await service.list()).toHaveLength(45);
    expect(notify).toHaveBeenCalledTimes(SALES_EMAILS_PER_HOUR);
    expect(notify.flood).toHaveBeenCalledTimes(1);
    expect(notify.flood).toHaveBeenCalledWith(SALES_EMAILS_PER_HOUR + 1);

    // For the rest of the hour after it was said, nothing more is emailed, whatever arrives; after it, a request is emailed again.
    await service.receive(request({ email: "later@example.com" }), NOW + 3_000_000);
    expect(notify).toHaveBeenCalledTimes(SALES_EMAILS_PER_HOUR);
    await service.receive(request({ email: "next-hour@example.com" }), NOW + 2 * 3_600_000);
    expect(notify).toHaveBeenCalledTimes(SALES_EMAILS_PER_HOUR + 1);
    expect(notify.flood).toHaveBeenCalledTimes(1);
  });

  it("turns a flood far beyond that away, with a way to reach Greecon instead, so that it cannot fill the database", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    for (let index = 0; index < KEPT_PER_HOUR_AT_MOST; index += 1) await service.receive(request({ email: `person${index}@example.com` }), NOW);

    const flooded = service.receive(request({ email: "one-more@example.com" }), NOW);
    await expect(flooded).rejects.toBeInstanceOf(HttpException);
    await expect(flooded).rejects.toThrow(/info@greecon\.earth/);
    // An hour later it is open again.
    await expect(service.receive(request({ email: "one-more@example.com" }), NOW + 3_700_000)).resolves.toEqual({ received: true });
  });

  it("answers a filled hidden field exactly as a real request, and tells nobody", async () => {
    const notify = Object.assign(vi.fn().mockResolvedValue(undefined), { flood: vi.fn().mockResolvedValue(undefined) });
    const service = new AccessRequestsService(new DatabaseService(), notify);
    const real = await service.receive(request(), NOW);
    const script = await service.receive(request({ email: "bot@example.com", website: "http://spam.example" }), NOW);
    expect(script).toEqual(real);
    expect(notify).toHaveBeenCalledTimes(1);
    expect((await service.list()).map((stored) => stored.email)).toEqual(["besa@hotel-adriatik.example"]);
  });

  it("answers the same address asking again as if it were new, keeps nothing more and tells nobody again", async () => {
    const notify = Object.assign(vi.fn().mockResolvedValue(undefined), { flood: vi.fn() });
    const service = new AccessRequestsService(new DatabaseService(), notify);
    for (const spelling of ["Besa@Hotel-Adriatik.example", " besa@hotel-adriatik.example", "besa@hotel-adriatik.example\u200b"]) {
      await expect(service.receive(request({ email: spelling }), NOW + 60_000)).resolves.toEqual({ received: true });
    }
    expect(await service.list()).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("keeps each field on one line, without control or invisible characters, and the words with their line breaks", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    const rlo = String.fromCodePoint(0x202e);
    const zeroWidth = String.fromCodePoint(0x200b);
    await service.receive(
      request({
        name: `  Besa\nKrasniqi${rlo}\u0007 `,
        company: `Hotel\tAdriatik${zeroWidth}`,
        phone: "+355 69\r\n123 4567",
        message: `First line\r\nSecond line${rlo}\n\n\n\nAfter a gap\u0000`
      }),
      NOW
    );
    const [stored] = await service.list();
    expect(stored).toMatchObject({ name: "Besa Krasniqi", company: "Hotel Adriatik", phone: "+355 69 123 4567", message: "First line\nSecond line\n\nAfter a gap" });
  });

  it("refuses a name or an address with a web address in it, and words with more than two", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    for (const bad of [
      { name: "Cheap pills https://spam.example" },
      { name: "Visit www.spam.example" },
      { name: "Besa spam.com" },
      { email: "http://x@spam.example" },
      { email: "www.spam@example.com" },
      { message: "See https://a.example, www.b.example and c.com for prices." }
    ]) {
      await expect(service.receive(request(bad), NOW), JSON.stringify(bad)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(await service.list()).toEqual([]);
    // A company may be named after its website, and a prospect may give theirs, and the address of a colleague.
    await service.receive(request({ company: "Adriatik.al Sh.p.k", message: "Our site is https://hotel-adriatik.example and the farm is at farm.al. Write to ardit@farm.al too." }), NOW);
    expect(await service.list()).toHaveLength(1);
  });

  it("moves a request along and keeps the note, newest first", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    await service.receive(request({ email: "a@example.com" }), NOW);
    await service.receive(request({ email: "b@example.com" }), NOW + 1000);
    const [newest] = await service.list();

    const updated = await service.update(newest?.id as string, { status: "contacted", note: "  Called, visit on Thursday " }, "pm-1");
    expect(updated).toMatchObject({ status: "contacted", note: "Called, visit on Thursday" });

    expect((await service.list("contacted")).map((item) => item.email)).toEqual(["b@example.com"]);
    expect((await service.list("new")).map((item) => item.email)).toEqual(["a@example.com"]);
    await expect(service.update("missing", { status: "declined" }, "pm-1")).rejects.toThrow(/not found/i);
  });

  it("tells Greecon about each new request, and a failure to tell never loses the request", async () => {
    const notify = vi.fn().mockRejectedValue(new Error("mail is down"));
    const service = new AccessRequestsService(new DatabaseService(), notify);

    await expect(service.receive(request(), NOW)).resolves.toEqual({ received: true });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toMatchObject({ company: "Hotel Adriatik", status: "new" });
    expect(await service.list()).toHaveLength(1);
  });
});

describe("the request form's limits", () => {
  const valid = { name: "Besa Krasniqi", company: "Hotel Adriatik", email: "besa@hotel-adriatik.example", phone: "+355 69 123 4567", siteType: "hotel", message: "Hello", website: "" };
  const problems = async (overrides: Record<string, unknown>) => (await validate(plainToInstance(CreateAccessRequestDto, { ...valid, ...overrides }))).map((error) => error.property);

  it("takes a request within every limit", async () => {
    expect(await problems({ name: "n".repeat(80), company: "c".repeat(120), phone: "1".repeat(30), message: "m".repeat(1000) })).toEqual([]);
  });

  it("refuses a field one character past its limit: name 80, company 120, email 254, phone 30, words 1000", async () => {
    expect(await problems({ name: "n".repeat(81) })).toEqual(["name"]);
    expect(await problems({ company: "c".repeat(121) })).toEqual(["company"]);
    expect(await problems({ email: `${"e".repeat(64)}@${"d".repeat(185)}.example` })).toEqual(["email"]);
    expect(await problems({ phone: "1".repeat(31) })).toEqual(["phone"]);
    expect(await problems({ message: "m".repeat(1001) })).toEqual(["message"]);
  });
});
