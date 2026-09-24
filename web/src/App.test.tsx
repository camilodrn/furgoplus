import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, code: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ code, message: code, fields: {} }),
  }) as Response;
const csrf = ok({ csrf_token: "masked" });
const driver = {
  id: 1,
  email: "sample@example.test",
  role: "driver",
  display_name: "Sample",
};

const domain = (path: string) => {
  if (path.includes("driver/publication"))
    return ok({
      publication_requested: false,
      eligible: false,
      blockers: [],
      validation_state: "draft",
      current_validation_revision: 1,
      approved_revision: null,
      subscription: null,
      active_route_count: 0,
      coverage: [],
    });
  if (path.includes("driver/routes")) return ok({ routes: [] });
  if (path.includes("driver/communes")) return ok({ communes: [] });
  if (path.includes("driver/profile"))
    return ok({
      display_name: "Sample",
      service_summary: "",
      service_contact_email: "",
      validation_state: "draft",
      current_validation_revision: 1,
      approved_revision: null,
    });
  if (path.includes("checklist"))
    return ok({
      demo_only: true,
      allowed_content_types: ["application/pdf"],
      max_bytes: 10485760,
      items: [
        {
          kind: "demo_identity_document",
          label: "Documento demo",
          requires_expiry: false,
        },
      ],
    });
  if (path.includes("driver/documents")) return ok({ documents: [] });
  if (path.includes("driver/validations"))
    return ok({
      validation_state: "draft",
      current_validation_revision: 1,
      approved_revision: null,
      validations: [],
    });
  return ok({ ok: true });
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

test("restores a driver through csrf then me", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockImplementation((path: string) => Promise.resolve(domain(path)));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(screen.getByText("Restaurando sesión…")).toBeTruthy();
  expect(await screen.findByText("Completa tu validación")).toBeTruthy();
  expect(screen.getByAltText("FurgoPlus Transporte Escolar")).toBeTruthy();
  expect(screen.getByText("Sample")).toBeTruthy();
  expect(fetchMock.mock.calls.map(([path]) => path).slice(0, 2)).toEqual([
    "/api/v1/auth/csrf/",
    "/api/v1/auth/me/",
  ]);
  expect(fetchMock.mock.calls[1]![1].credentials).toBe("same-origin");
});

test("successful profile update automatically fetches publication state", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockImplementation((path: string) => Promise.resolve(domain(path)));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await screen.findByLabelText("Nombre visible");
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(
        ([path, options]) =>
          path.includes("driver/publication") && options.method === "GET",
      ),
    ).toHaveLength(1),
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Cambios guardados correctamente.");
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(
        ([path, options]) =>
          path.includes("driver/publication") && options.method === "GET",
      ),
    ).toHaveLength(2),
  );
  expect(
    within(
      screen.getByRole("navigation", { name: "Secciones del conductor" }),
    ).getByRole("button", { name: "Perfil" }),
  ).toBeTruthy();
});

test("brand falls back to a wordmark when the logo cannot load", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(ok(driver))
      .mockImplementation((path: string) => Promise.resolve(domain(path))),
  );
  render(<App />);
  fireEvent.error(await screen.findByAltText("FurgoPlus Transporte Escolar"));
  expect(screen.getByText("FurgoPlus")).toBeTruthy();
});

test("parent role is unsupported on web", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(ok({ ...driver, role: "parent" })),
  );
  render(<App />);
  expect(await screen.findByText("Usa la aplicación móvil")).toBeTruthy();
  expect(screen.queryByText("Completa tu validación")).toBeNull();
});

test("signed-out state follows failed restore and driver registration", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(fail(403, "not_authenticated"))
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByText("Registrar conductor"));
  fireEvent.change(screen.getByLabelText("Nombre visible"), {
    target: { value: "Sample" },
  });
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByText("Crear cuenta"));
  expect(await screen.findByText("Cuenta creada. Inicia sesión.")).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toMatchObject({
    role: "driver",
    display_name: "Sample",
  });
  expect(fetchMock.mock.calls[3]![1].headers["X-CSRFToken"]).toBe("masked");
  expect(sessionStorage.length).toBe(0);
});

test("invalid login credentials get a friendly generic message", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(fail(403, "not_authenticated"))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: "validation_error",
          message: "Invalid input.",
          fields: { credentials: ["Invalid credentials."] },
        }),
      }),
  );
  render(<App />);
  await screen.findByText("Iniciar sesión");
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "synthetic@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Wrong-Synthetic-Password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(
    await screen.findByText("Correo o contraseña incorrectos."),
  ).toBeTruthy();
  expect(screen.queryByText("Invalid input.")).toBeNull();
});

test("login keeps CSRF and throttling errors distinct from credentials", async () => {
  for (const [status, code, expected] of [
    [403, "csrf_failed", "La verificación caducó. Repite la acción."],
    [429, "throttled", "throttled"],
  ] as const) {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(csrf)
        .mockResolvedValueOnce(fail(403, "not_authenticated"))
        .mockResolvedValueOnce(fail(status, code))
        .mockResolvedValueOnce(csrf)
        .mockResolvedValueOnce(fail(status, code)),
    );
    render(<App />);
    await screen.findByText("Iniciar sesión");
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "synthetic@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Wrong-Synthetic-Password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(screen.queryByText("Correo o contraseña incorrectos.")).toBeNull();
    cleanup();
  }
});

test("logout clears UI and records unconfirmed server logout", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockImplementation((path: string) =>
      path.includes("logout")
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(domain(path)),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByText("Cerrar sesión"));
  expect(await screen.findByText("Iniciar sesión")).toBeTruthy();
  expect(
    await screen.findByText(/cierre en el servidor no está confirmado/),
  ).toBeTruthy();
  expect(sessionStorage.getItem("furgoplus-signed-out")).toBe("1");
  expect(
    fetchMock.mock.calls.find(([path]) => path.includes("logout"))![1].headers[
      "X-CSRFToken"
    ],
  ).toBe("masked");
});

test("login uses rotated CSRF token for logout", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(fail(403, "not_authenticated"))
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok({ ...driver, csrf_token: "rotated" }))
    .mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("logout") ? ok({ ok: true }) : domain(path),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Correo"), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByText("Entrar"));
  fireEvent.click(await screen.findByText("Cerrar sesión"));
  expect(await screen.findByText("Iniciar sesión")).toBeTruthy();
  expect(
    fetchMock.mock.calls.find(([path]) => path.includes("logout"))![1].headers[
      "X-CSRFToken"
    ],
  ).toBe("rotated");
  expect(sessionStorage.getItem("furgoplus-signed-out")).toBeNull();
});

test("a confirmed session expiry clears the authenticated shell", async () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("auth/me")
          ? fail(403, "not_authenticated")
          : domain(path),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(await screen.findByText("Completa tu validación")).toBeTruthy();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(await screen.findByText("La sesión caducó.")).toBeTruthy();
  expect(screen.queryByText("Completa tu validación")).toBeNull();
});
