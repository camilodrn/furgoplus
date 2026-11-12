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

test("registered accounts use authenticated GET with server filters and pagination", async () => {
  const body = {
    totals: { parent: 1, driver: 0, admin: 1 },
    count: 1,
    results: [],
  };
  const fetchMock = vi.fn().mockResolvedValue(ok(body));
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    new AuthApi().adminRegistrations(
      new URLSearchParams({
        role: "parent",
        q: "feria@example.test",
        offset: "25",
        limit: "25",
      }),
    ),
  ).resolves.toEqual(body);
  expect(fetchMock.mock.calls[0]![0]).toBe(
    "/api/v1/admin/registrations/?role=parent&q=feria%40example.test&offset=25&limit=25",
  );
  expect(fetchMock.mock.calls[0]![1]).toMatchObject({
    method: "GET",
    credentials: "same-origin",
  });
});

test("registered accounts time out stalled reads and allow a manual retry", async () => {
  vi.useFakeTimers();
  try {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(
        ok({
          totals: { parent: 0, driver: 0, admin: 1 },
          count: 0,
          results: [],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new AuthApi();
    const filters = new URLSearchParams({ offset: "0", limit: "25" });
    const failed = expect(
      api.adminRegistrations(filters),
    ).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15_001);
    await failed;
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
    await expect(api.adminRegistrations(filters)).resolves.toMatchObject({
      count: 0,
    });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("confirmed expiry invalidates late private queue and identity responses and notifies once", async () => {
  const queue = deferred<Response>();
  const me = deferred<Response>();
  const expired = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      path.includes("admin/drivers/?")
        ? queue.promise
        : path.endsWith("auth/me/")
          ? me.promise
          : Promise.resolve(fail(403, "not_authenticated")),
    ),
  );
  const api = new AuthApi(expired);
  const queueResult = expect(
    api.adminDrivers(new URLSearchParams()),
  ).rejects.toMatchObject({ code: "stale_request" });
  const identityResult = expect(api.me()).rejects.toMatchObject({
    code: "stale_request",
  });
  await expect(api.adminDriver(7)).rejects.toMatchObject({
    code: "not_authenticated",
  });
  queue.resolve(
    ok({ results: [{ email: "old-private@example.test" }], count: 1 }),
  );
  me.resolve(ok(identity));
  await Promise.all([queueResult, identityResult]);
  expect(expired).toHaveBeenCalledTimes(1);
});

test.each(["permission_denied", "csrf_failed"])(
  "%s keeps the session generation and does not notify expiration",
  async (code) => {
    const pending = deferred<Response>();
    const expired = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        path.endsWith("auth/me/")
          ? pending.promise
          : Promise.resolve(fail(403, code)),
      ),
    );
    const api = new AuthApi(expired);
    const me = api.me();
    await expect(api.adminDriver(7)).rejects.toMatchObject({ code });
    pending.resolve(ok(identity));
    await expect(me).resolves.toEqual(identity);
    expect(expired).not.toHaveBeenCalled();
  },
);

test("account invalidation blocks a pending document download", async () => {
  const pending = deferred<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => pending.promise),
  );
  const api = new AuthApi();
  const result = expect(api.downloadDocument(7, true)).rejects.toMatchObject({
    code: "stale_request",
  });
  api.invalidateRequests();
  pending.resolve({
    ok: true,
    blob: async () => new Blob(["Synthetic private bytes"]),
  } as Response);
  await result;
});

test("expiration during CSRF bootstrap prevents a pending write from being sent", async () => {
  const bootstrap = deferred<Response>();
  const fetchMock = vi.fn((path: string) =>
    path.endsWith("auth/csrf/")
      ? bootstrap.promise
      : Promise.resolve(fail(403, "not_authenticated")),
  );
  vi.stubGlobal("fetch", fetchMock);
  const api = new AuthApi();
  const write = expect(
    api.changeProfileStatus(7, {
      status: "suspended",
      expected_status: "active",
      expected_version: null,
      reason: "Synthetic review",
    }),
  ).rejects.toMatchObject({ code: "stale_request" });
  await expect(api.me()).rejects.toMatchObject({ code: "not_authenticated" });
  bootstrap.resolve(ok({ csrf_token: "obsolete" }));
  await write;
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/auth/csrf/",
    "/api/v1/auth/me/",
  ]);
});

test.each(["routes", "assignments", "payments"] as const)(
  "%s bounds a stalled body read, aborts and ignores a late auth error before manual retry",
  async (method) => {
    vi.useFakeTimers();
    try {
      let rejectBody!: (cause: Error) => void;
      const body = new Promise((_, reject) => {
        rejectBody = reject;
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => body })
        .mockResolvedValueOnce(ok({ [method]: [] }));
      vi.stubGlobal("fetch", fetchMock);
      const expired = vi.fn();
      const api = new AuthApi(expired);
      const pending = api[method]();
      const failure = expect(pending).rejects.toMatchObject({
        code: "request_timeout",
      });
      await vi.advanceTimersByTimeAsync(15_001);
      await failure;
      expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
      const { ApiError } = await import("./api");
      rejectBody(new ApiError(403, "not_authenticated", "Late private error"));
      await Promise.resolve();
      await Promise.resolve();
      expect(expired).not.toHaveBeenCalled();
      await expect(api[method]()).resolves.toEqual({ [method]: [] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  },
);
