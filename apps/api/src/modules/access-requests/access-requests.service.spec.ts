import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../../database/database.service";
import { AccessRequestsService, NewAccessRequest } from "./access-requests.service";

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

  it("refuses a flood, with a way to reach Greecon instead", async () => {
    const service = new AccessRequestsService(new DatabaseService());
    for (let index = 0; index < 40; index += 1) await service.receive(request({ email: `person${index}@example.com` }), NOW);

    const flooded = service.receive(request({ email: "one-more@example.com" }), NOW);
    await expect(flooded).rejects.toBeInstanceOf(HttpException);
    await expect(flooded).rejects.toThrow(/info@greecon\.earth/);
    // An hour later it is open again.
    await expect(service.receive(request({ email: "one-more@example.com" }), NOW + 3_700_000)).resolves.toEqual({ received: true });
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
