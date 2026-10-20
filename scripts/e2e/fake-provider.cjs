// A stand-in for the email and text-message providers, for rehearsals: it records every message the platform
// would have sent and answers the way the real ones do. GET /recorded lists them; POST /reset forgets them.
const http = require("http");
const recorded = [];
let counter = 0;

const server = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const reply = (status, json) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(json));
    };
    if (request.method === "GET" && request.url === "/recorded") return reply(200, recorded);
    if (request.method === "POST" && request.url === "/reset") {
      recorded.length = 0;
      return reply(200, { ok: true });
    }
    if (request.method === "POST" && request.url === "/emails") {
      const mail = JSON.parse(body);
      recorded.push({ channel: "email", to: mail.to[0], subject: mail.subject, text: mail.text, from: mail.from, auth: request.headers.authorization, key: request.headers["idempotency-key"], at: Date.now() });
      return reply(200, { id: `em_${(counter += 1)}` });
    }
    const sms = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\.json$/.exec(request.url ?? "");
    if (request.method === "POST" && sms) {
      const form = new URLSearchParams(body);
      recorded.push({ channel: "sms", to: form.get("To"), text: form.get("Body"), from: form.get("From"), at: Date.now() });
      return reply(201, { sid: `SM${(counter += 1)}`, status: "queued" });
    }
    reply(404, { message: "unknown" });
  });
});
const port = Number(process.env.FAKE_PROVIDER_PORT ?? 4100);
server.listen(port, "127.0.0.1", () => console.log(`fake provider on ${port}`));
