import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { LIMITS } from "../src/rate-limit.ts";
import { SESSION_COOKIE } from "../src/sessions.ts";

const config: Config = {
  host: "127.0.0.1",
  port: 0,
  databasePath: ":memory:",
  secureCookies: false,
  trustProxy: false,
};

/** A fresh API and database, with a tiny browser: it keeps the session cookie. */
function client() {
  const db = openDatabase(":memory:");
  const app = createApp(db, config);
  let cookie = "";

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await app.request(path, {
      method,
      headers: {
        ...(method === "GET" ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      if (pair.startsWith(`${SESSION_COOKIE}=`)) cookie = pair === `${SESSION_COOKIE}=` ? "" : pair;
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  }

  return {
    db,
    call,
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
  };
}

const ada = { email: "ada@example.com", password: "analytical-engine" };

test("health", async () => {
  const { call } = client();
  assert.deepEqual((await call("GET", "/health")).body, { ok: true });
});

test("sign up, read the account, sign out, sign in", async () => {
  const api = client();

  const created = await api.call("POST", "/auth/signup", { ...ada, email: "  Ada@Example.com ", locale: "pt" });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, "ada@example.com");
  assert.equal(created.body.user.locale, "pt");
  assert.equal(created.body.user.password_hash, undefined);
  assert.match(created.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax/);

  assert.equal((await api.call("GET", "/me")).body.user.email, "ada@example.com");

  assert.equal((await api.call("POST", "/auth/logout")).status, 204);
  assert.equal((await api.call("GET", "/me")).status, 401);

  assert.equal((await api.call("POST", "/auth/login", { ...ada, password: "wrong-password" })).status, 401);
  assert.equal((await api.call("POST", "/auth/login", { ...ada, email: "nobody@example.com" })).status, 401);
  assert.equal((await api.call("POST", "/auth/login", ada)).status, 200);
  assert.equal((await api.call("GET", "/me")).status, 200);
});

test("signing out ends the session on the server", async () => {
  const api = client();
  await api.call("POST", "/auth/signup", ada);
  const stolen = api.cookie;
  await api.call("POST", "/auth/logout");
  api.cookie = stolen;
  assert.equal((await api.call("GET", "/me")).status, 401);
});

test("sign-up rejects bad input and a taken e-mail", async () => {
  const api = client();
  assert.deepEqual((await api.call("POST", "/auth/signup", { ...ada, email: "not-an-email" })).body, {
    error: "invalid",
    field: "email",
  });
  assert.equal((await api.call("POST", "/auth/signup", { ...ada, password: "short" })).body.field, "password");
  assert.equal((await api.call("POST", "/auth/signup", ada)).status, 201);
  const again = await api.call("POST", "/auth/signup", { ...ada, email: "ADA@example.com" });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "email_taken");
});

test("changes must be same-origin JSON", async () => {
  const api = client();
  const crossSite = await api.call("POST", "/auth/signup", ada, { "sec-fetch-site": "cross-site" });
  assert.equal(crossSite.status, 403);
  const form = await api.call("POST", "/auth/signup", ada, { "content-type": "text/plain" });
  assert.equal(form.status, 400);
  const sameOrigin = await api.call("POST", "/auth/signup", ada, { "sec-fetch-site": "same-origin" });
  assert.equal(sameOrigin.status, 201);
});

test("settings: name, language and e-mail", async () => {
  const api = client();
  await api.call("POST", "/auth/signup", ada);

  const renamed = await api.call("PATCH", "/me", { displayName: "  Ada   Lovelace ", locale: "pt" });
  assert.equal(renamed.body.user.displayName, "Ada Lovelace");
  assert.equal(renamed.body.user.locale, "pt");
  assert.equal((await api.call("PATCH", "/me", { locale: "xx" })).status, 400);

  // A new e-mail needs the current password.
  assert.equal((await api.call("PATCH", "/me", { email: "countess@example.com" })).status, 400);
  const wrong = await api.call("PATCH", "/me", { email: "countess@example.com", currentPassword: "nope-nope" });
  assert.equal(wrong.status, 403);
  const moved = await api.call("PATCH", "/me", { email: "countess@example.com", currentPassword: ada.password });
  assert.equal(moved.body.user.email, "countess@example.com");
  assert.equal((await api.call("GET", "/me")).body.user.displayName, "Ada Lovelace");

  // Someone else cannot take that address.
  await api.call("POST", "/auth/logout");
  await api.call("POST", "/auth/signup", { email: "babbage@example.com", password: "difference-engine" });
  const taken = await api.call("PATCH", "/me", {
    email: "countess@example.com",
    currentPassword: "difference-engine",
  });
  assert.equal(taken.status, 409);
});

test("changing the password signs out other devices", async () => {
  const api = client();
  await api.call("POST", "/auth/signup", ada);
  const laptop = api.cookie;
  await api.call("POST", "/auth/login", ada);
  const phone = api.cookie;
  assert.notEqual(laptop, phone);

  const wrong = await api.call("PUT", "/me/password", { currentPassword: "nope-nope", newPassword: "x".repeat(12) });
  assert.equal(wrong.body.error, "wrong_password");
  const changed = await api.call("PUT", "/me/password", {
    currentPassword: ada.password,
    newPassword: "a-much-newer-password",
  });
  assert.equal(changed.status, 204);

  assert.equal((await api.call("GET", "/me")).status, 200);
  api.cookie = laptop;
  assert.equal((await api.call("GET", "/me")).status, 401);
  assert.equal((await api.call("POST", "/auth/login", ada)).status, 401);
  assert.equal((await api.call("POST", "/auth/login", { ...ada, password: "a-much-newer-password" })).status, 200);
});

test("saves: stored per account, and only ever move forward", async () => {
  const api = client();
  assert.equal((await api.call("GET", "/saves")).status, 401);
  await api.call("POST", "/auth/signup", ada);

  const first = { game: "dig-site", day: 3, progress: 2, record: { siteId: "petra", digs: [1, 2] } };
  assert.equal((await api.call("PUT", "/saves", { saves: [first] })).status, 204);

  // A stale device (less progress) or a tie does not overwrite.
  await api.call("PUT", "/saves", { saves: [{ ...first, progress: 1, record: { siteId: "petra", digs: [9] } }] });
  await api.call("PUT", "/saves", { saves: [{ ...first, record: { siteId: "petra", digs: [8, 8] } }] });
  let pulled = await api.call("GET", "/saves");
  assert.deepEqual(pulled.body.saves, [first]);

  const further = { ...first, progress: 3, record: { siteId: "petra", digs: [1, 2, 3] } };
  await api.call("PUT", "/saves", { saves: [further, { game: "wayfarer", day: 3, progress: 1, record: { g: [] } }] });
  pulled = await api.call("GET", "/saves");
  assert.equal(pulled.body.saves.length, 2);
  assert.deepEqual(
    pulled.body.saves.find((save: { game: string }) => save.game === "dig-site"),
    further,
  );

  // Nothing has changed since the cursor that came with that pull.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const since = await api.call("GET", `/saves?since=${pulled.body.cursor + 1}`);
  assert.deepEqual(since.body.saves, []);

  // Another account sees none of it.
  await api.call("POST", "/auth/logout");
  await api.call("POST", "/auth/signup", { email: "babbage@example.com", password: "difference-engine" });
  assert.deepEqual((await api.call("GET", "/saves")).body.saves, []);
});

test("saves: bad input is refused", async () => {
  const api = client();
  await api.call("POST", "/auth/signup", ada);
  const good = { game: "dig-site", day: 1, progress: 0, record: {} };
  for (const bad of [
    { ...good, game: "Not A Slug" },
    { ...good, day: 0 },
    { ...good, day: 1.5 },
    { ...good, progress: -1 },
    { ...good, record: [] },
    { ...good, record: { blob: "x".repeat(5000) } },
  ]) {
    assert.equal((await api.call("PUT", "/saves", { saves: [bad] })).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await api.call("PUT", "/saves", { saves: "nope" })).status, 400);
  assert.deepEqual((await api.call("GET", "/saves")).body.saves, []);
});

test("deleting the account removes its data", async () => {
  const api = client();
  await api.call("POST", "/auth/signup", ada);
  await api.call("PUT", "/saves", { saves: [{ game: "dig-site", day: 1, progress: 1, record: {} }] });

  assert.equal((await api.call("DELETE", "/me", { password: "wrong-password" })).status, 403);
  assert.equal((await api.call("DELETE", "/me", { password: ada.password })).status, 204);

  const count = (table: string) =>
    (api.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  assert.deepEqual([count("users"), count("sessions"), count("saves")], [0, 0, 0]);
  assert.equal((await api.call("POST", "/auth/login", ada)).status, 401);
});

test("repeated sign-in attempts are slowed down", async () => {
  const api = client();
  let last = { status: 0, headers: new Headers() };
  for (let attempt = 0; attempt <= LIMITS.loginPerEmail.max; attempt++) {
    last = await api.call("POST", "/auth/login", { ...ada, password: "wrong-password" });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) > 0);
});

test("unknown routes and broken JSON", async () => {
  const api = client();
  const response = await createApp(api.db, config).request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  assert.equal(response.status, 400);
});
