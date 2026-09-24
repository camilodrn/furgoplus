// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { AuthApi } from "./api";
import viteConfig from "../vite.config";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, code: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ code, message: code, fields: {} }),
  }) as Response;
const credentials = {
  email: "local@example.test",
  password: "Synthetic-Only-Password-781!",
};
const identity = {
  id: 7,
  email: credentials.email,
  role: "driver" as const,
  display_name: "Local Driver",
  csrf_token: "rotated",
};

afterEach(() => vi.unstubAllGlobals());

test("Vite preserves the browser Host for Django's same-origin CSRF check", () => {
  expect(viteConfig.server?.proxy?.["/api"]).toMatchObject({
    changeOrigin: false,
  });
});

test("explicit stale CSRF refreshes and retries the rejected login exactly once", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(ok({ csrf_token: "old" }))
    .mockResolvedValueOnce(fail(403, "csrf_failed"))
    .mockResolvedValueOnce(ok({ csrf_token: "fresh" }))
    .mockResolvedValueOnce(ok(identity));
  vi.stubGlobal("fetch", fetchMock);

  await expect(new AuthApi().login(credentials)).resolves.toMatchObject({
    email: credentials.email,
    role: "driver",
  });
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/auth/csrf/",
    "/api/v1/auth/login/",
    "/api/v1/auth/csrf/",
    "/api/v1/auth/login/",
  ]);
  expect(fetchMock.mock.calls[1]![1].headers["X-CSRFToken"]).toBe("old");
  expect(fetchMock.mock.calls[3]![1].headers["X-CSRFToken"]).toBe("fresh");
});

test("a second CSRF failure is surfaced without another refresh or retry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(ok({ csrf_token: "old" }))
    .mockResolvedValueOnce(fail(403, "csrf_failed"))
    .mockResolvedValueOnce(ok({ csrf_token: "fresh" }))
    .mockResolvedValueOnce(fail(403, "csrf_failed"));
  vi.stubGlobal("fetch", fetchMock);

  await expect(new AuthApi().login(credentials)).rejects.toMatchObject({
    code: "csrf_failed",
  });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test.each([
  [400, "validation_error"],
  [429, "throttled"],
  [403, "not_authenticated"],
])("%s %s is surfaced without refresh or retry", async (status, code) => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(ok({ csrf_token: "valid" }))
    .mockResolvedValueOnce(fail(status, code));
  vi.stubGlobal("fetch", fetchMock);

  await expect(new AuthApi().login(credentials)).rejects.toMatchObject({
    status,
    code,
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("network errors are surfaced without retrying an ambiguous write", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(ok({ csrf_token: "valid" }))
    .mockRejectedValueOnce(new TypeError("Network failure"));
  vi.stubGlobal("fetch", fetchMock);

  await expect(new AuthApi().login(credentials)).rejects.toThrow(
    "Network failure",
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
