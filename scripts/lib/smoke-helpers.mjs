// What the smoke scripts share: calling the API as a person or as a box, and onboarding a customer.

export const API = (process.env.API_URL ?? "http://127.0.0.1:4010").replace(/\/+$/, "");

let failures = 0;
export const failed = () => failures;

export function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${message}`);
  } else {
    console.log(`  ok    ${message}`);
  }
}

export const step = (title) => console.log(`\n${title}`);

export async function call(method, path, { token, box, body, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { "x-greecon-session": token } : {}),
      ...(box ? { "x-edge-device-token": box } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: Object.fromEntries(response.headers) };
}

export async function login(email, password) {
  const result = await call("POST", "/auth/login", { body: { email, password } });
  if (result.status !== 201 && result.status !== 200) throw new Error(`Login failed for ${email}: ${result.status} ${result.text}`);
  return result.json;
}

/** Greecon onboards a customer; returns the owner's first session (and what it could do), an ordinary session and the customer's id. */
export async function onboard(adminToken, name, ownerEmail) {
  const created = await call("POST", "/platform-admin/tenants", { token: adminToken, body: { name, ownerName: "Owner", ownerEmail } });
  if (created.status !== 201) throw new Error(`Could not onboard ${name}: ${created.status} ${created.text}`);
  const temporary = created.json.temporaryPassword;
  const first = await login(ownerEmail, temporary);
  // What a temporary-password session can do is looked at now: once the person has chosen a password, that session has ended.
  const whileTemporary = await call("GET", "/sites", { token: first.token });
  const ownPassword = `Own-password-${Math.random().toString(36).slice(2, 10)}-1`;
  const changed = await call("POST", "/auth/change-password", { token: first.token, body: { currentPassword: temporary, newPassword: ownPassword } });
  if (changed.status !== 201 && changed.status !== 200) throw new Error(`Could not change password: ${changed.status} ${changed.text}`);
  return { first, whileTemporary, session: (await login(ownerEmail, ownPassword)).token, tenantId: created.json.tenant.id };
}

export async function until(description, probe, { timeoutMs = 60_000, everyMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  throw new Error(`Gave up waiting for ${description}.`);
}
