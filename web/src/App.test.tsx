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
      profile_status: "active",
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
  vi.useRealTimers();
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

test("assignment create, edit and end refresh server capacity in routes and summary", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  let usedSeats = 0;
  let availableSeats = 12;
  let assignment: Record<string, unknown> | null = null;
  const route = () => ({
    id: 2,
    revision: 1,
    label: "Ruta ficticia",
    status: "active",
    weekdays: ["monday"],
    start_time: "07:00",
    end_time: "08:00",
    seat_capacity: 12,
    next_service_date: "2026-09-28",
    used_seats: usedSeats,
    available_seats: availableSeats,
    destination_label: "Escuela ficticia",
    destination_address: "Dirección ficticia",
    coverage_codes: ["demo"],
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockImplementation((path: string, options: RequestInit) => {
      if (path.endsWith("driver/routes/") && options.method === "GET")
        return Promise.resolve(ok({ routes: [route()] }));
      if (path.endsWith("driver/summary/"))
        return Promise.resolve(
          ok({
            publication: {
              profile_status: "active",
              publication_requested: false,
              eligible: false,
              blockers: [],
              validation_state: "draft",
              current_validation_revision: 1,
              approved_revision: null,
              subscription: null,
              active_route_count: 1,
              coverage: [],
            },
            routes: [route()],
            active_assignments: assignment ? 1 : 0,
            payment_counts: { pending: 0, paid: 0, void: 0 },
          }),
        );
      if (path.endsWith("driver/passenger-assignments/")) {
        if (options.method === "GET")
          return Promise.resolve(
            ok({ assignments: assignment ? [assignment] : [] }),
          );
        usedSeats = 4;
        availableSeats = 8;
        assignment = {
          ...JSON.parse(options.body as string),
          id: 5,
          created_at: "2026-09-24T00:00:00Z",
          updated_at: "2026-09-24T00:00:00Z",
        };
        return Promise.resolve(ok(assignment));
      }
      if (path.endsWith("driver/passenger-assignments/5/")) {
        usedSeats = 6;
        availableSeats = 6;
        assignment = { ...assignment, ...JSON.parse(options.body as string) };
        return Promise.resolve(ok(assignment));
      }
      if (path.endsWith("driver/passenger-assignments/5/end/")) {
        usedSeats = 0;
        availableSeats = 12;
        assignment = { ...assignment, ends_on: "2026-09-28" };
        return Promise.resolve(ok(assignment));
      }
      return Promise.resolve(domain(path));
    });
  vi.stubGlobal("fetch", fetchMock);
  const prompt = vi.spyOn(window, "prompt").mockReturnValue("28/09/2026");
  const section = (name: string) =>
    within(
      screen.getByRole("navigation", { name: "Secciones del conductor" }),
    ).getByRole("button", { name });
  render(<App />);
  await screen.findByRole("navigation", { name: "Secciones del conductor" });
  fireEvent.click(section("Rutas"));
  expect(await screen.findByText(/0 usados · 12 disponibles/)).toBeTruthy();

  fireEvent.click(section("Pasajeros"));
  await screen.findByText("Aún no hay pasajeros asignados.");
  fireEvent.change(screen.getByLabelText("Ruta"), { target: { value: "2" } });
  for (const [label, value] of [
    ["Nombre visible del estudiante", "Estudiante Ficticio"],
    ["Recogida / instrucciones", "Parada ficticia"],
    ["Nombre del apoderado", "Apoderado Ficticio"],
    ["Teléfono del apoderado", "912345678"],
    ["Desde", "28/09/2026"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  expect(await screen.findByText("Estudiante Ficticio")).toBeTruthy();
  fireEvent.click(section("Rutas"));
  expect(await screen.findByText(/4 usados · 8 disponibles/)).toBeTruthy();
  fireEvent.click(section("Resumen"));
  expect(
    await screen.findByText(/4 usados \/ 8 disponibles de 12/),
  ).toBeTruthy();

  fireEvent.click(section("Pasajeros"));
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText("Hasta (opcional)"), {
    target: { value: "30/09/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/28\/09\/2026–30\/09\/2026/);
  fireEvent.click(section("Rutas"));
  expect(await screen.findByText(/6 usados · 6 disponibles/)).toBeTruthy();

  fireEvent.click(section("Pasajeros"));
  fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
  await screen.findByText(/28\/09\/2026–28\/09\/2026/);
  fireEvent.click(section("Rutas"));
  expect(await screen.findByText(/0 usados · 12 disponibles/)).toBeTruthy();
  fireEvent.click(section("Resumen"));
  expect(
    await screen.findByText(/0 usados \/ 12 disponibles de 12/),
  ).toBeTruthy();
  expect(
    fetchMock.mock.calls.filter(
      ([path, options]) =>
        path.includes("driver/routes/") && options.method !== "GET",
    ),
  ).toHaveLength(0);
  expect(
    fetchMock.mock.calls.filter(
      ([path, options]) =>
        path.endsWith("driver/routes/") && options.method === "GET",
    ).length,
  ).toBeGreaterThanOrEqual(4);
  prompt.mockRestore();
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
  await screen.findByDisplayValue("Sample");
  fireEvent.change(screen.getByLabelText("Descripción del servicio"), {
    target: { value: "Private loaded draft" },
  });
  expect(screen.getByDisplayValue("Private loaded draft")).toBeTruthy();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(await screen.findByText("La sesión caducó.")).toBeTruthy();
  expect(screen.queryByText("Completa tu validación")).toBeNull();
  expect(screen.queryByDisplayValue("Private loaded draft")).toBeNull();
});

test("administrator can open control queue and retain the authorized document review workflow", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok({ ...driver, role: "admin" }))
    .mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("admin/validations/")
          ? ok({ results: [] })
          : ok({ results: [], count: 0 }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await screen.findByText("No hay conductores con estos filtros.");
  fireEvent.click(screen.getByText("Revisión de documentos"));
  await screen.findByText("No hay solicitudes en este estado.");
  expect(
    fetchMock.mock.calls.some(([path]) =>
      path.startsWith("/api/v1/admin/drivers/?"),
    ),
  ).toBe(true);
  expect(
    fetchMock.mock.calls.some(
      ([path]) => path === "/api/v1/admin/validations/?state=pending",
    ),
  ).toBe(true);
});
