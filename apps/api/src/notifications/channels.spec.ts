import { describe, expect, it } from "vitest";
import { createChannels, resendChannel, twilioChannel } from "./channels";

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (call: Call) => Response | Promise<Response>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const mail = { to: "besa@hotel.example", subject: "Act now: Tank level is critical, Hotel Adriatik", body: "Act now: Tank level is critical.", idempotencyKey: "n-1" };

describe("email through Resend", () => {
  const options = { apiKey: "re_secret", from: "Greecon <alerts@greecon.example>", replyTo: "info@greecon.earth" };

  it("sends the message as plain text, from Greecon, with a key that makes a retry harmless", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { id: "em_123" }));
    const result = await resendChannel({ ...options, fetchImpl }).send(mail);
    expect(result).toEqual({ ok: true, providerId: "em_123" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_secret");
    expect(headers["idempotency-key"]).toBe("n-1");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: "Greecon <alerts@greecon.example>",
      to: ["besa@hotel.example"],
      reply_to: "info@greecon.earth",
      subject: mail.subject,
      text: mail.body
    });
  });

  it("calls a refusal that will repeat permanent, and says what the service said", async () => {
    const { fetchImpl } = fakeFetch(() => json(422, { name: "validation_error", message: "Invalid `to` field." }));
    expect(await resendChannel({ ...options, fetchImpl }).send(mail)).toEqual({ ok: false, transient: false, error: "The email service answered 422: Invalid `to` field." });
  });

  it("treats a wrong key as permanent too, without printing the key", async () => {
    const { fetchImpl } = fakeFetch(() => json(401, { message: "API key is invalid" }));
    const result = await resendChannel({ ...options, fetchImpl }).send(mail);
    expect(result).toMatchObject({ ok: false, transient: false });
    expect(JSON.stringify(result)).not.toContain("re_secret");
  });

  it("calls the service's own trouble transient, so it is tried again", async () => {
    for (const status of [429, 500, 503]) {
      const { fetchImpl } = fakeFetch(() => json(status, { message: "try later" }));
      expect(await resendChannel({ ...options, fetchImpl }).send(mail), String(status)).toMatchObject({ ok: false, transient: true });
    }
  });

  it("calls a service that cannot be reached transient", async () => {
    const { fetchImpl } = fakeFetch(() => {
      throw new Error("getaddrinfo ENOTFOUND api.resend.com");
    });
    expect(await resendChannel({ ...options, fetchImpl }).send(mail)).toEqual({ ok: false, transient: true, error: "The email service could not be reached: getaddrinfo ENOTFOUND api.resend.com" });
  });

  it("copes with an answer that is not JSON", async () => {
    const { fetchImpl } = fakeFetch(() => new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    expect(await resendChannel({ ...options, fetchImpl }).send(mail)).toEqual({ ok: false, transient: true, error: "The email service answered 502: Bad Gateway" });
  });
});

describe("text messages through Twilio", () => {
  const options = { accountSid: "AC123", authToken: "tw_secret", from: "+15005550006" };

  it("posts the message as a form from the number, with the account's own credentials", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { sid: "SM456", status: "queued" }));
    const result = await twilioChannel({ ...options, fetchImpl }).send({ to: "+355691234567", body: "Act now: Tank level is critical." });
    expect(result).toEqual({ ok: true, providerId: "SM456" });
    expect(calls[0]?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("AC123:tw_secret").toString("base64")}`);
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(String(calls[0]?.init.body));
    expect(Object.fromEntries(form)).toEqual({ To: "+355691234567", Body: "Act now: Tank level is critical.", From: "+15005550006" });
  });

  it("uses a messaging service instead of a number when it has one", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { sid: "SM1" }));
    await twilioChannel({ accountSid: "AC123", authToken: "t", messagingServiceSid: "MG789", fetchImpl }).send({ to: "+355691234567", body: "x" });
    const form = new URLSearchParams(String(calls[0]?.init.body));
    expect(form.get("MessagingServiceSid")).toBe("MG789");
    expect(form.has("From")).toBe(false);
  });

  it("calls a number that cannot be texted permanent", async () => {
    const { fetchImpl } = fakeFetch(() => json(400, { code: 21211, message: "The 'To' number is not a valid phone number." }));
    expect(await twilioChannel({ ...options, fetchImpl }).send({ to: "+3550", body: "x" })).toEqual({
      ok: false,
      transient: false,
      error: "The text-message service answered 400: The 'To' number is not a valid phone number."
    });
  });

  it("calls the service's trouble transient and never prints the token", async () => {
    const { fetchImpl } = fakeFetch(() => json(503, { message: "unavailable" }));
    const result = await twilioChannel({ ...options, fetchImpl }).send({ to: "+355691234567", body: "x" });
    expect(result).toMatchObject({ ok: false, transient: true });
    expect(JSON.stringify(result)).not.toContain("tw_secret");
  });
});

describe("which channels a platform has", () => {
  it("has none without keys, and says nothing is wrong", () => {
    const channels = createChannels({});
    expect(channels.email).toBeUndefined();
    expect(channels.sms).toBeUndefined();
    expect(channels.problems).toEqual([]);
  });

  it("has email with the key, from Greecon's own address unless told otherwise", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { id: "em_1" }));
    const channels = createChannels({ RESEND_API_KEY: "re_x" }, fetchImpl);
    expect(channels.email).toBeDefined();
    await channels.email?.send(mail);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.from).toBe("Greecon <alerts@greecon.earth>");
    expect(body.reply_to).toBe("info@greecon.earth");
  });

  it("takes the sender's name and address from the settings", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { id: "em_1" }));
    await createChannels({ RESEND_API_KEY: "re_x", ALERT_FROM_EMAIL: "Alerts@Mail.Greecon.Earth", ALERT_FROM_NAME: "Greecon alerts" }, fetchImpl).email?.send(mail);
    expect(JSON.parse(String(calls[0]?.init.body)).from).toBe("Greecon alerts <alerts@mail.greecon.earth>");
  });

  it("leaves email off, and says why, when the sender address is not one", () => {
    const channels = createChannels({ RESEND_API_KEY: "re_x", ALERT_FROM_EMAIL: "not an address" });
    expect(channels.email).toBeUndefined();
    expect(channels.problems).toEqual(["ALERT_FROM_EMAIL is not an email address, so email is off."]);
  });

  it("has text messages only with the account, the token and a sender", () => {
    expect(createChannels({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15005550006" }).sms).toBeDefined();
    expect(createChannels({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_MESSAGING_SERVICE_SID: "MG1" }).sms).toBeDefined();

    const noToken = createChannels({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_FROM: "+15005550006" });
    expect(noToken.sms).toBeUndefined();
    expect(noToken.problems).toEqual(["Text messages need both TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, so text messages are off."]);

    const noSender = createChannels({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" });
    expect(noSender.sms).toBeUndefined();
    expect(noSender.problems).toEqual(["Text messages need TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID, so text messages are off."]);
  });

  it("can be pointed at a stand-in for rehearsal, and still sends the same requests", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { id: "x", sid: "y" }));
    const channels = createChannels(
      { RESEND_API_KEY: "re_x", RESEND_API_URL: "http://127.0.0.1:4100/", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15005550006", TWILIO_API_URL: "http://127.0.0.1:4100" },
      fetchImpl
    );
    await channels.email?.send(mail);
    await channels.sms?.send({ to: "+355691234567", body: "x" });
    expect(calls.map((call) => call.url)).toEqual(["http://127.0.0.1:4100/emails", "http://127.0.0.1:4100/2010-04-01/Accounts/AC1/Messages.json"]);
  });

  it("ignores keys that are only spaces", () => {
    const channels = createChannels({ RESEND_API_KEY: "   ", TWILIO_ACCOUNT_SID: "  " });
    expect(channels.email).toBeUndefined();
    expect(channels.sms).toBeUndefined();
    expect(channels.problems).toEqual([]);
  });
});
