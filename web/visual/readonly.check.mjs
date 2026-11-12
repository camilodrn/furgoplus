import assert from "node:assert/strict";
import { test } from "node:test";
import {
  academicOrigin as origin,
  requestDecision as decide,
  protectContext,
} from "./readonly.mjs";

test("only one explicit login grant; no other business writes", () => {
  assert.equal(decide(`${origin}/api/v1/auth/login/`, "POST", true), "login");
  assert.equal(decide(`${origin}/api/v1/auth/login/`, "POST", false), "block");
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    for (const path of [
      "/api/v1/driver/payments/",
      "/api/v1/auth/register/",
      "/api/v1/auth/logout/",
      "/api/v1/admin/plans/",
      "/api/v1/support/tickets/",
      "/unexpected",
    ]) {
      assert.equal(decide(origin + path, method, true), "block");
    }
  }
});
test("external origins, credential URLs and audited GET downloads are blocked", () => {
  for (const url of [
    "https://example.test/",
    "http://127.0.0.1:18080/api/v1/health/",
    "http://127.0.0.1:18082/api/v1/health/",
    "http://localhost:15173/",
    "http://user:secret@127.0.0.1:15173/",
    "http://127.0.0.1:15173.evil.test/",
    `${origin}/api/v1/documents/1/download/`,
    `${origin}/api/v1/reports/export/`,
    `${origin}/api/v1/driver/reports/summary.xlsx?month=2026-10`,
  ]) {
    assert.equal(decide(url, "GET", true), "block");
  }
  assert.equal(
    decide(`${origin}/api/v1/auth/login/?next=/`, "POST", true),
    "block",
  );
});
test("same-origin source and API reads remain available", () => {
  for (const path of [
    "/",
    "/src/App.tsx",
    "/src/style.css",
    "/api/v1/auth/csrf/",
    "/api/v1/driver/routes/",
  ]) {
    assert.equal(decide(origin + path, "GET"), "read");
  }
});

test("context consumes login once, seals it and never follows redirects", async () => {
  let handler;
  const context = {
    routeWebSocket: async () => {},
    route: async (_pattern, callback) => {
      handler = callback;
    },
  };
  const guard = await protectContext(context);
  const decisions = [];
  async function request(path, method, status = 200) {
    await handler({
      request: () => ({ url: () => origin + path, method: () => method }),
      abort: async () => {
        decisions.push("block");
      },
      fulfill: async () => {
        decisions.push("allow");
      },
      fetch: async ({ maxRedirects }) => {
        assert.equal(maxRedirects, 0);
        return { status: () => status };
      },
    });
  }
  await request("/api/v1/auth/login/", "POST");
  await request("/api/v1/auth/login/", "POST");
  await request("/api/v1/driver/routes/", "GET", 302);
  await request("/api/v1/driver/payments/", "PATCH");
  assert.deepEqual(decisions, ["allow", "block", "block", "block"]);
  assert.equal(guard.blocked.length, 3);
  guard.sealLogin();
});
