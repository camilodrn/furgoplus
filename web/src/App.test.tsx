import { afterEach, expect, test, vi } from "vitest";
import {
  act,
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
  expect(screen.getByRole("status")).toBeTruthy();
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
  fireEvent.click(section("Inicio"));
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
  fireEvent.click(section("Inicio"));
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
  await screen.findByText("Cerrar sesión");
  fireEvent.error(screen.getByAltText("FurgoPlus Transporte Escolar"));
  expect(
    screen.getByText("FurgoPlus", {
      selector: ".sidebar-brand .brand-wordmark",
    }),
  ).toBeTruthy();
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
  fireEvent.click(await screen.findByText("Crear cuenta de conductor"));
  fireEvent.change(screen.getByLabelText("Cómo te llamas"), {
    target: { value: "Sample" },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
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
    email: "sample@example.test",
    password: "Synthetic-Password",
  });
  expect(fetchMock.mock.calls[3]![1].headers["X-CSRFToken"]).toBe("masked");
  expect(sessionStorage.length).toBe(0);
});

test.each(["login", "register"])(
  "%s shows associated Spanish required errors without native validation",
  async (mode) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(fail(403, "not_authenticated"));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("heading", { name: "Inicia sesión" });
    if (mode === "register")
      fireEvent.click(
        screen.getByRole("button", { name: "Crear cuenta de conductor" }),
      );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(form.noValidate).toBe(true);
    const email = screen.getByLabelText("Correo electrónico");
    expect((email as HTMLInputElement).validity.valueMissing).toBe(true);
    const nativeInvalid = vi.fn();
    form.addEventListener("invalid", nativeInvalid, true);
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "login" ? "Iniciar sesión" : "Crear cuenta",
      }),
    );
    const errors: [string, string][] = [
      ["Correo electrónico", "Ingresa tu correo electrónico."],
      ["Contraseña", "Ingresa tu contraseña."],
    ];
    if (mode === "register")
      errors.unshift(["Cómo te llamas", "Ingresa tu nombre."]);
    for (const [label, message] of errors) {
      const field = screen.getByLabelText(label);
      const error = screen.getByText(message);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(
        error.id,
      );
    }
    expect(screen.getByRole("alert").textContent).toBe(
      "Revisa los campos indicados.",
    );
    expect(document.activeElement).toBe(
      mode === "register" ? screen.getByLabelText("Cómo te llamas") : email,
    );
    expect(nativeInvalid).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(form.getAttribute("aria-busy")).toBe("false");
  },
);

test.each(["login", "register"])(
  "%s validates malformed email in Spanish and preserves entered values",
  async (mode) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(fail(403, "not_authenticated"));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("heading", { name: "Inicia sesión" });
    if (mode === "register") {
      fireEvent.click(
        screen.getByRole("button", { name: "Crear cuenta de conductor" }),
      );
      fireEvent.change(screen.getByLabelText("Cómo te llamas"), {
        target: { value: "Demo" },
      });
    }
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "correo-incompleto" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Synthetic-Password" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "login" ? "Iniciar sesión" : "Crear cuenta",
      }),
    );
    const email = screen.getByRole("textbox", {
      name: "Correo electrónico",
      description: "Ingresa un correo electrónico válido.",
    }) as HTMLInputElement;
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(email);
    expect(email.value).toBe("correo-incompleto");
    expect(
      (screen.getByLabelText("Contraseña") as HTMLInputElement).value,
    ).toBe("Synthetic-Password");
    expect(
      screen.getByLabelText("Contraseña").getAttribute("aria-invalid"),
    ).toBe("false");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

test("registration leaves nonempty password requirements to the backend", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(fail(403, "not_authenticated"))
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        code: "validation_error",
        message: "Invalid input.",
        fields: { account: ["Invalid registration details."] },
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Crear cuenta de conductor" }),
  );
  for (const [label, value] of [
    ["Cómo te llamas", "Demo"],
    ["Correo electrónico", "demo@example.test"],
    ["Contraseña", "short"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "No pudimos crear la cuenta. Revisa tu correo, nombre y los requisitos de la contraseña e inténtalo de nuevo.",
  );
  const registration = fetchMock.mock.calls.find(
    ([path]) => path === "/api/v1/auth/register/",
  );
  expect(registration).toBeTruthy();
  expect(JSON.parse(registration![1].body)).toEqual({
    role: "driver",
    display_name: "Demo",
    email: "demo@example.test",
    password: "short",
  });
  expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe(
    "short",
  );
  expect(screen.queryByText("Invalid registration details.")).toBeNull();
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
  await screen.findByText("Inicia sesión");
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "synthetic@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Wrong-Synthetic-Password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(
    await screen.findByText("Correo o contraseña incorrectos."),
  ).toBeTruthy();
  expect(screen.queryByText("Invalid input.")).toBeNull();
});

test("login keeps CSRF and throttling errors distinct from credentials", async () => {
  for (const [status, code, expected] of [
    [403, "csrf_failed", "La verificación caducó. Repite la acción."],
    [
      429,
      "throttled",
      "Hay demasiados intentos. Espera un momento y vuelve a intentarlo.",
    ],
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
    await screen.findByText("Inicia sesión");
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "synthetic@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Wrong-Synthetic-Password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
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
  expect(await screen.findByText("Inicia sesión")).toBeTruthy();
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
  fireEvent.change(await screen.findByLabelText("Correo electrónico"), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByText("Iniciar sesión"));
  fireEvent.click(await screen.findByText("Cerrar sesión"));
  expect(await screen.findByText("Inicia sesión")).toBeTruthy();
  expect(
    JSON.parse(
      fetchMock.mock.calls.find(([path]) => path.includes("auth/login/"))![1]
        .body,
    ),
  ).toEqual({
    email: "sample@example.test",
    password: "Synthetic-Password",
  });
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
  expect(
    await screen.findByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    ),
  ).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button", { name: "Validaciones" }));
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

test.each(["login", "register"])(
  "%s blocks duplicate submission while pending",
  async (mode) => {
    let complete!: (value: Response) => void;
    const response = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    const fetchMock = vi.fn((path: string) => {
      if (path.endsWith("auth/csrf/")) return Promise.resolve(csrf);
      if (path.endsWith("auth/me/"))
        return Promise.resolve(fail(403, "not_authenticated"));
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("heading", { name: "Inicia sesión" });
    expect(
      screen.getByText("Si eres apoderado, usa la aplicación móvil."),
    ).toBeTruthy();
    if (mode === "register") {
      fireEvent.click(
        screen.getByRole("button", { name: "Crear cuenta de conductor" }),
      );
      expect(
        screen.getByText(/Después podrás completar tus datos/),
      ).toBeTruthy();
      expect(screen.getByText(/información sintética/)).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Cómo te llamas"), {
        target: { value: "Demo" },
      });
      expect(
        screen.getByLabelText("Contraseña").getAttribute("aria-describedby"),
      ).toBe("password-help");
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "login" ? "Iniciar sesión" : "Crear cuenta",
      }),
    );
    expect(screen.getByText("Ingresa tu correo electrónico.")).toBeTruthy();
    expect(screen.getByText("Ingresa tu contraseña.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "demo@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Synthetic-Password" },
    });
    const form = screen.getByRole("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.queryByText("Ingresa tu correo electrónico.")).toBeNull();
    expect(screen.queryByText("Ingresa tu contraseña.")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: mode === "login" ? "Iniciando sesión…" : "Creando cuenta…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([path]) =>
          path.endsWith(mode === "login" ? "auth/login/" : "auth/register/"),
        ),
      ).toHaveLength(1),
    );
    await act(async () =>
      complete(mode === "login" ? fail(400, "validation_error") : ok(driver)),
    );
    expect(
      screen
        .getByRole("button", {
          name: "Iniciar sesión",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Privacidad|Términos/ }),
    ).toBeNull();
  },
);

test("password visibility has accessible state and preserves the value", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("csrf/") ? csrf : fail(403, "not_authenticated"),
      ),
    ),
  );
  render(<App />);
  const input = (await screen.findByLabelText(
    "Contraseña",
  )) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Synthetic-Secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
  expect(input.type).toBe("text");
  expect(input.value).toBe("Synthetic-Secret");
  expect(
    screen
      .getByRole("button", { name: "Ocultar contraseña" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
  expect(input.type).toBe("password");
});

test("restore retry makes a fresh read and recovers without submitting credentials", async () => {
  let attempts = 0;
  const fetchMock = vi.fn((path: string) => {
    if (path.endsWith("csrf/")) return Promise.resolve(csrf);
    attempts++;
    return attempts === 1
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(fail(403, "not_authenticated"));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Inicia sesión" });
  expect(attempts).toBe(2);
  expect(
    fetchMock.mock.calls.some(([path]) => /login|register/.test(path)),
  ).toBe(false);
});

test("shell disclosure Escape and selection preserve keyboard landmarks", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(ok(driver))
      .mockImplementation((path: string) => Promise.resolve(domain(path))),
  );
  render(<App />);
  const nav = await screen.findByRole("navigation", {
    name: "Secciones del conductor",
  });
  for (const name of [
    "Inicio",
    "Mi servicio",
    "Pasajeros",
    "Solicitudes",
    "Pagos",
  ])
    expect(within(nav).getByRole("button", { name })).toBeTruthy();
  const menu = screen.getByRole("button", { name: "Menú" });
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(menu);
  expect(menu.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(nav, { key: "Escape" });
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(menu);
  fireEvent.click(menu);
  fireEvent.click(within(nav).getByRole("button", { name: "Inicio" }));
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(screen.getByRole("main"));
  expect(
    within(nav)
      .getByRole("button", { name: "Inicio" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "Ir al contenido" }).getAttribute("href"),
  ).toBe("#main-content");
});

test("an obsolete logout failure cannot clear a newer account's rotated CSRF", async () => {
  let complete!: (value: Response) => void;
  const oldLogout = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  let authenticated = true;
  const fetchMock = vi.fn((path: string) => {
    if (path.endsWith("auth/csrf/")) return Promise.resolve(csrf);
    if (path.endsWith("auth/me/")) return Promise.resolve(ok(driver));
    if (path.endsWith("auth/login/"))
      return Promise.resolve(
        ok({
          ...driver,
          id: 2,
          display_name: "New Demo",
          csrf_token: "new-rotated",
        }),
      );
    if (path.endsWith("auth/logout/")) {
      if (authenticated) {
        authenticated = false;
        return oldLogout;
      }
      return Promise.resolve(ok({ ok: true }));
    }
    return Promise.resolve(domain(path));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
  fireEvent.change(await screen.findByLabelText("Correo electrónico"), {
    target: { value: "new@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  await screen.findByText("New Demo");
  await act(async () => complete(fail(500, "server_error")));
  expect(screen.queryByText(/no está confirmado/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  await screen.findByRole("heading", { name: "Inicia sesión" });
  const logouts = fetchMock.mock.calls.filter(([path]) =>
    path.endsWith("auth/logout/"),
  );
  expect(logouts).toHaveLength(2);
  expect(
    (logouts[1] as unknown as [string, RequestInit])[1].headers,
  ).toMatchObject({ "X-CSRFToken": "new-rotated" });
});
