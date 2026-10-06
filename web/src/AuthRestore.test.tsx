import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";
import { AuthApi } from "./api";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, code: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ code, message: code, fields: {} }),
  }) as Response;
const csrf = () => ok({ csrf_token: "masked" });
const oldIdentity = {
  id: 1,
  role: "parent",
  display_name: "Account A",
  email: "a@example.test",
};
const newIdentity = {
  ...oldIdentity,
  id: 2,
  display_name: "Account B",
  email: "b@example.test",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function overlappingRestores() {
  const responses = [deferred<Response>(), deferred<Response>()];
  let restore = 0;
  // Observe the real guard; neither AuthApi nor its generation is mocked.
  const me = vi.spyOn(AuthApi.prototype, "me");
  const fetchMock = vi.fn((path: string) => {
    if (path.endsWith("auth/csrf/")) return Promise.resolve(csrf());
    if (path.endsWith("auth/me/")) return responses[restore++]!.promise;
    if (path.endsWith("auth/login/"))
      return Promise.resolve(ok({ ...newIdentity, csrf_token: "rotated" }));
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  // main.tsx uses StrictMode: the first effect is cleaned up while its
  // restore continues, and the second effect starts on the same AuthApi.
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await waitFor(() => expect(me).toHaveBeenCalledTimes(2));
  expect(me.mock.contexts[0]).toBe(me.mock.contexts[1]);
  expect(
    fetchMock.mock.calls.filter(([path]) => path.endsWith("auth/csrf/")),
  ).toHaveLength(2);
  return { responses, me };
}

function expectSignedOut() {
  expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeTruthy();
  expect(screen.getByText("Registrar conductor")).toBeTruthy();
  expect(screen.queryByText("No se pudo restaurar la sesión.")).toBeNull();
  expect(screen.queryByText("La sesión caducó.")).toBeNull();
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("initial not_authenticated renders login without an expiry or restore error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("auth/csrf/") ? csrf() : fail(403, "not_authenticated"),
      ),
    ),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Iniciar sesión" });
  expectSignedOut();
});

test.each([
  [0, "not_authenticated"],
  [0, "identity"],
  [1, "not_authenticated"],
  [1, "identity"],
] as const)(
  "StrictMode overlapping restores: request %i confirms no session before a late %s",
  async (first, late) => {
    const { responses, me } = await overlappingRestores();
    const sibling = 1 - first;
    await act(async () =>
      responses[first]!.resolve(fail(403, "not_authenticated")),
    );
    await expect(me.mock.results[first]!.value).rejects.toMatchObject({
      code: "not_authenticated",
    });
    expectSignedOut();
    await act(async () =>
      responses[sibling]!.resolve(
        late === "identity" ? ok(oldIdentity) : fail(403, "not_authenticated"),
      ),
    );
    await expect(me.mock.results[sibling]!.value).rejects.toMatchObject({
      code: "stale_request",
    });
    expectSignedOut();
    expect(screen.queryByText("Account A")).toBeNull();
  },
);

test.each(["identity", "not_authenticated", "server_error"])(
  "a stale active restore with late %s cannot overwrite a newer authenticated identity",
  async (late) => {
    const { responses, me } = await overlappingRestores();
    // The cleaned-up restore confirms no session while the active one waits.
    await act(async () =>
      responses[0]!.resolve(fail(403, "not_authenticated")),
    );
    expectSignedOut();
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: newIdentity.email },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Synthetic-Password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByText("Account B");
    await act(async () =>
      responses[1]!.resolve(
        late === "identity"
          ? ok(oldIdentity)
          : fail(late === "server_error" ? 500 : 403, late),
      ),
    );
    await expect(me.mock.results[1]!.value).rejects.toMatchObject({
      code: "stale_request",
    });
    expect(screen.getByText("Account B")).toBeTruthy();
    expect(screen.getByText("Usa la aplicación móvil")).toBeTruthy();
    expect(screen.queryByText("Account A")).toBeNull();
    expect(screen.queryByText("Iniciar sesión")).toBeNull();
    expect(screen.queryByText("La sesión caducó.")).toBeNull();
    expect(screen.queryByText("No se pudo restaurar la sesión.")).toBeNull();
  },
);

test.each([
  "network",
  "malformed_json",
  "malformed_csrf",
  "server_error",
  "permission_denied",
])(
  "a genuine %s restore failure retains the error and retry surface",
  async (failure) => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path.endsWith("auth/csrf/"))
          return Promise.resolve(
            failure === "malformed_csrf" ? ok({}) : csrf(),
          );
        if (failure === "network")
          return Promise.reject(new TypeError("Network failure"));
        if (failure === "malformed_json")
          return Promise.resolve(new Response("invalid JSON", { status: 200 }));
        return Promise.resolve(
          fail(failure === "server_error" ? 500 : 403, failure),
        );
      }),
    );
    render(<App />);
    await screen.findByText("No se pudo restaurar la sesión.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.queryByText("Iniciar sesión")).toBeNull();
    expect(screen.queryByText("La sesión caducó.")).toBeNull();
  },
);
