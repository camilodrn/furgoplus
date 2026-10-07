import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";
import type {
  AdminDriver,
  AdminValidation,
  Identity,
  Publication,
} from "./api-types";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const denied = (code = "not_authenticated") =>
  ({
    ok: false,
    status: 403,
    json: async () => ({ code, message: code, fields: {} }),
  }) as Response;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const publication: Publication = {
  profile_status: "active",
  publication_requested: true,
  eligible: true,
  blockers: [],
  validation_state: "approved",
  current_validation_revision: 1,
  approved_revision: 1,
  subscription: {
    plan_code: "basic",
    plan_label: "Basic",
    status: "active",
    starts_at: "2026-10-01T03:00:00Z",
    ends_at: "2026-11-01T03:00:00Z",
  },
  active_route_count: 1,
  coverage: [],
};
function fixture(role: "driver" | "admin") {
  let account: Identity = {
    id: 1,
    role,
    display_name: "Account A",
    email: "a@example.test",
  };
  let override: (path: string) => Promise<Response> | undefined = () =>
    undefined;
  const control = (): AdminDriver => ({
    id: 7,
    display_name: `Private driver ${account.id}`,
    email: `private-${account.id}@example.test`,
    profile_version: null,
    publication,
  });
  const profile = () => ({
    display_name: account.display_name,
    service_summary: `Private summary ${account.id}`,
    service_contact_email: `contact-${account.id}@example.test`,
    validation_state: "approved",
    current_validation_revision: 1,
    approved_revision: 1,
  });
  const summary = () => ({
    publication,
    routes: [
      {
        id: 9,
        revision: 1,
        label: `Private route ${account.id}`,
        status: "active",
        weekdays: ["monday"],
        start_time: "07:00",
        end_time: "08:00",
        seat_capacity: 4,
        next_service_date: "2026-10-05",
        used_seats: 1,
        available_seats: 3,
        destination_label: "Synthetic school",
        destination_address: "Synthetic street",
        coverage_codes: [],
      },
    ],
    active_assignments: 1,
    payment_counts: { pending: 2, paid: 1, void: 0 },
  });
  const validation = (): AdminValidation => ({
    id: 4,
    revision: 1,
    state: "pending",
    display_name_snapshot: `Private service ${account.id}`,
    submitted_at: "2026-10-01T12:00:00Z",
    reviewed_at: null,
    observations: `Private review note ${account.id}`,
    driver: {
      id: 7,
      display_name: `Private service ${account.id}`,
      email: `private-${account.id}@example.test`,
    },
    documents: [
      {
        id: 17,
        version: 1,
        kind: "demo_identity_document",
        content_type: "application/pdf",
        byte_size: 20,
        uploaded_at: "2026-10-01T11:00:00Z",
        expires_on: null,
      },
    ],
    comparison: {
      previous_revision: null,
      changed_document_count: 0,
      unchanged_document_count: 0,
      changed_identity_field_count: 0,
      has_material_changes: false,
      document_changes: [],
      identity_changes: [],
    },
  });
  const fetchMock = vi.fn((path: string): Promise<Response> => {
    const custom = override(path);
    if (custom) return custom;
    if (path.endsWith("auth/csrf/"))
      return Promise.resolve(ok({ csrf_token: "masked" }));
    if (path.endsWith("auth/me/")) return Promise.resolve(ok(account));
    if (path.endsWith("auth/login/"))
      return Promise.resolve(ok({ ...account, csrf_token: "rotated" }));
    if (path.endsWith("driver/profile/")) return Promise.resolve(ok(profile()));
    if (path.endsWith("driver/summary/")) return Promise.resolve(ok(summary()));
    if (path.endsWith("driver/publication/"))
      return Promise.resolve(ok(publication));
    if (path.endsWith("driver/routes/"))
      return Promise.resolve(ok({ routes: [] }));
    if (path.endsWith("driver/contact-requests/"))
      return Promise.resolve(ok({ results: [] }));
    if (path.endsWith("driver/communes/"))
      return Promise.resolve(ok({ communes: [] }));
    if (path.endsWith("checklist/"))
      return Promise.resolve(
        ok({
          demo_only: true,
          allowed_content_types: ["application/pdf"],
          max_bytes: 10485760,
          items: [],
        }),
      );
    if (path.endsWith("driver/documents/"))
      return Promise.resolve(ok({ documents: [] }));
    if (path.endsWith("driver/validations/"))
      return Promise.resolve(ok({ ...profile(), validations: [] }));
    if (path.includes("admin/validations/?"))
      return Promise.resolve(ok({ results: [validation()] }));
    if (path.endsWith("admin/validations/4/"))
      return Promise.resolve(ok(validation()));
    if (path.includes("admin/drivers/?"))
      return Promise.resolve(ok({ results: [control()], count: 1 }));
    if (path.endsWith("admin/drivers/7/"))
      return Promise.resolve(ok(control()));
    if (path.includes("admin/drivers/7/history/"))
      return Promise.resolve(
        ok({
          results: [
            {
              id: 8,
              actor: { id: 3, display_name: "Synthetic admin" },
              action: "profile_status_changed",
              target_type: "driver_profile",
              target_id: 7,
              occurred_at: "2026-10-01T03:00:00Z",
              correlation_id: "private-correlation",
              reason: `Private history ${account.id}`,
              before: { status: "suspended" },
              after: { status: "active" },
            },
          ],
          count: 26,
        }),
      );
    if (path.includes("admin/drivers/7/validations/"))
      return Promise.resolve(
        ok({
          count: 1,
          results: [
            {
              id: 4,
              revision: 1,
              state: "rejected",
              submitted_at: "2026-09-28T12:00:00Z",
              reviewed_at: "2026-09-28T13:00:00Z",
              observations: `Private observation ${account.id}`,
              display_name_snapshot: account.display_name,
            },
          ],
        }),
      );
    if (path.endsWith("admin/drivers/7/subscription/"))
      return Promise.resolve(ok({ publication, version: 8 }));
    if (path.endsWith("admin/plans/"))
      return Promise.resolve(
        ok({ plans: [{ code: "basic", display_label: "Basic" }] }),
      );
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    control,
    validation,
    profile,
    summary,
    replace: () => {
      account = {
        ...account,
        id: 2,
        display_name: "Account B",
        email: "b@example.test",
      };
    },
    intercept: (fn: typeof override) => {
      override = fn;
    },
  };
}
function refreshIdentity() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  fireEvent(document, new Event("visibilitychange"));
}
function section(name: string) {
  return within(
    screen.getByRole("navigation", { name: "Secciones del conductor" }),
  ).getByRole("button", { name });
}
function openAdminDisclosure(title: string) {
  const summary = screen.getByText(title).closest("summary")!;
  fireEvent.click(summary);
  summary.parentElement!.setAttribute("open", "");
}
async function openControl(readyPlan = true) {
  fireEvent.click(await screen.findByText("Ver conductor"));
  await screen.findByRole("region", { name: "Estado del servicio" });
  openAdminDisclosure("Validación y observaciones");
  openAdminDisclosure("Historial administrativo");
  expect(screen.queryByText("Private observation 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver observación" }));
  await screen.findByText("Private observation 1");
  fireEvent.click(screen.getByRole("button", { name: "Suspender perfil" }));
  if (readyPlan)
    fireEvent.click(
      await screen.findByRole("button", { name: "Administrar plan" }),
    );
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("same-role driver A to B discards loaded profile, summary, publication and drafts while B reads are pending", async () => {
  const mock = fixture("driver");
  render(<App />);
  await screen.findByDisplayValue("contact-1@example.test");
  fireEvent.change(screen.getByLabelText("Nombre del servicio"), {
    target: { value: "Private unsaved A" },
  });
  fireEvent.click(section("Inicio"));
  await screen.findByText(/Private route 1/);
  const oldRead = deferred<Response>();
  mock.intercept((path) =>
    path.endsWith("driver/summary/") ? oldRead.promise : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  const bProfile = deferred<Response>();
  const bPublication = deferred<Response>();
  mock.replace();
  const newProfile = mock.profile();
  mock.intercept((path) =>
    path.endsWith("driver/profile/")
      ? bProfile.promise
      : path.endsWith("driver/publication/")
        ? bPublication.promise
        : undefined,
  );
  refreshIdentity();
  await screen.findByText("Account B");
  expect(screen.queryByDisplayValue("contact-1@example.test")).toBeNull();
  expect(screen.queryByDisplayValue("Private unsaved A")).toBeNull();
  expect(screen.queryByText(/Private route 1/)).toBeNull();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  await waitFor(() =>
    expect(
      mock.fetchMock.mock.calls.filter(([path]) =>
        path.endsWith("driver/profile/"),
      ),
    ).toHaveLength(2),
  );
  await act(async () => {
    oldRead.resolve(
      ok({
        ...mock.summary(),
        routes: [{ ...mock.summary().routes[0]!, label: "Late A route" }],
      }),
    );
    bProfile.resolve(ok(newProfile));
    bPublication.resolve(ok(publication));
  });
  await screen.findByDisplayValue("contact-2@example.test");
  expect(screen.queryByText(/Late A route/)).toBeNull();
  mock.intercept(() => undefined);
  fireEvent.click(section("Inicio"));
  await screen.findByText(/Private route 2/);
});

test("same-role admin A to B discards a loaded queue, detail, plan and confirmation before B queue loads", async () => {
  const mock = fixture("admin");
  render(<App />);
  await openControl();
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Private reason A" },
  });
  fireEvent.click(screen.getByText("Revisar cambio de perfil"));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  const bQueue = deferred<Response>();
  mock.replace();
  mock.intercept((path) =>
    path.includes("admin/drivers/?") ? bQueue.promise : undefined,
  );
  refreshIdentity();
  await screen.findByText("Account B");
  expect(screen.queryByText("private-1@example.test")).toBeNull();
  expect(screen.queryByText("Private observation 1")).toBeNull();
  expect(screen.queryByDisplayValue("Private reason A")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.queryByLabelText("Motivo")).toBeNull();
  await waitFor(() =>
    expect(
      mock.fetchMock.mock.calls.filter(([path]) =>
        path.includes("admin/drivers/?"),
      ),
    ).toHaveLength(2),
  );
  await act(async () =>
    bQueue.resolve(ok({ results: [mock.control()], count: 1 })),
  );
  await screen.findByText("Private driver 2");
  fireEvent.click(screen.getByText("Ver conductor"));
  await screen.findByRole("region", { name: "Estado del servicio" });
  openAdminDisclosure("Validación y observaciones");
  expect(screen.queryByText("Private observation 2")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Ver observación" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Ver observación" }));
  await screen.findByText("Private observation 2");
});

test("driver private-read expiry clears loaded forms, publication and summary; late summary and identity cannot restore them", async () => {
  const mock = fixture("driver");
  render(<App />);
  await screen.findByDisplayValue("contact-1@example.test");
  fireEvent.click(section("Inicio"));
  await screen.findByText(/Private route 1/);
  expect(
    screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
  ).toContain("2 pendientes");
  expect(screen.getByText("Visible para apoderados")).toBeTruthy();
  const oldSummary = mock.summary();
  const oldRead = deferred<Response>();
  const oldIdentity = deferred<Response>();
  mock.intercept((path) =>
    path.endsWith("driver/summary/")
      ? oldRead.promise
      : path.endsWith("auth/me/")
        ? oldIdentity.promise
        : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  refreshIdentity();
  mock.intercept((path) =>
    path.endsWith("driver/summary/") ? Promise.resolve(denied()) : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  await screen.findByText(
    "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
  );
  expect(screen.queryByText(/Private route 1/)).toBeNull();
  expect(screen.queryByText(/Pagos:/)).toBeNull();
  expect(screen.queryByDisplayValue("contact-1@example.test")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Secciones del conductor" }),
  ).toBeNull();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  await act(async () => {
    oldRead.resolve(ok(oldSummary));
    oldIdentity.resolve(
      ok({
        id: 1,
        role: "driver",
        display_name: "Late Account A",
        email: "a@example.test",
      }),
    );
  });
  expect(
    screen.getByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Private route 1/)).toBeNull();
  expect(screen.queryByText("Late Account A")).toBeNull();
});

test("admin history expiry removes loaded queue, observations, confirmation and plan; late detail cannot restore private state", async () => {
  const mock = fixture("admin");
  const initialSubscription = deferred<Response>();
  mock.intercept((path) =>
    path.endsWith("admin/drivers/7/subscription/")
      ? initialSubscription.promise
      : undefined,
  );
  render(<App />);
  await openControl(false);
  expect(screen.getAllByText(/private-1@example.test/)).toHaveLength(1);
  // The current plan loads independently; the authoritative detail summary already exists.
  expect(screen.getByText("Cargando plan…")).toBeTruthy();
  expect(screen.getByText("Visible para apoderados")).toBeTruthy();
  await act(async () => {
    initialSubscription.resolve(ok({ publication, version: 8 }));
  });
  expect(await screen.findByText("Visible para apoderados")).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
  expect(
    screen.getByRole("region", { name: "Plan del conductor" }).textContent,
  ).toContain("Basic");
  expect((screen.getByLabelText("Plan") as HTMLSelectElement).value).toBe(
    "basic",
  );
  expect(screen.getByDisplayValue("01/10/2026")).toBeTruthy();
  expect(screen.getByText("Motivo: Private history 1")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Private draft A" },
  });
  fireEvent.click(screen.getByText("Revisar cambio de perfil"));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  const oldControl = mock.control();
  const oldDetail = deferred<Response>();
  const expiredHistory = deferred<Response>();
  mock.intercept((path) =>
    path.endsWith("admin/drivers/7/")
      ? oldDetail.promise
      : path.includes("admin/drivers/7/history/")
        ? expiredHistory.promise
        : undefined,
  );
  fireEvent.click(screen.getByText("Ver acciones anteriores"));
  // Pagination retains the hidden list and the visible confirmation while detail reloads.
  expect(
    screen.getByRole("region", { name: "Detalle del conductor" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "Lista de conductores" }),
  ).toBeNull();
  expect(
    mock.fetchMock.mock.calls.filter(([path]) =>
      path.endsWith("admin/drivers/7/"),
    ),
  ).toHaveLength(2);
  expect(mock.fetchMock).toHaveBeenCalledWith(
    "/api/v1/admin/drivers/7/history/?offset=25",
    expect.objectContaining({ method: "GET" }),
  );
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  await act(async () => {
    expiredHistory.resolve(denied());
  });
  await screen.findByText(
    "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
  );
  expect(screen.queryByText(/private-1@example.test/)).toBeNull();
  expect(screen.queryByText("Private observation 1")).toBeNull();
  expect(screen.queryByText("Motivo: Private history 1")).toBeNull();
  expect(screen.queryByDisplayValue("Private draft A")).toBeNull();
  expect(screen.queryByLabelText("Motivo")).toBeNull();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Plan del conductor" }),
  ).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await act(async () => {
    oldDetail.resolve(ok(oldControl));
  });
  expect(
    screen.getByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "Lista de conductores" }),
  ).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Detalle del conductor" }),
  ).toBeNull();
  expect(screen.queryByText("Private observation 1")).toBeNull();
  expect(screen.queryByText("Motivo: Private history 1")).toBeNull();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("permission_denied does not expire a loaded driver's session or erase its summary", async () => {
  const mock = fixture("driver");
  render(<App />);
  await screen.findByDisplayValue("contact-1@example.test");
  fireEvent.click(section("Inicio"));
  await screen.findByText(/Private route 1/);
  mock.intercept((path) =>
    path.endsWith("driver/summary/")
      ? Promise.resolve(denied("permission_denied"))
      : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  await screen.findByRole("alert");
  expect(screen.getByText(/Private route 1/)).toBeTruthy();
  expect(screen.getByText("Account A")).toBeTruthy();
  expect(
    screen.queryByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    ),
  ).toBeNull();
});

test("account replacement removes validation documents and a frozen decision; a late private download creates no URL", async () => {
  const mock = fixture("admin");
  const create = vi.fn(() => "blob:synthetic-private");
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Validaciones" }));
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Private frozen decision A" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  const lateDownload = deferred<Response>();
  mock.intercept((path) =>
    path.endsWith("admin/documents/17/download/")
      ? lateDownload.promise
      : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  expect(
    await screen.findByRole("button", { name: "Descargando…" }),
  ).toBeTruthy();
  const bQueue = deferred<Response>();
  mock.replace();
  mock.intercept((path) =>
    path.includes("admin/drivers/?") ? bQueue.promise : undefined,
  );
  refreshIdentity();
  await screen.findByText("Account B");
  expect(screen.queryByText("Private service 1")).toBeNull();
  expect(screen.queryByText("Private review note 1")).toBeNull();
  expect(screen.queryByText("Private frozen decision A")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Descargar" })).toBeNull();
  await act(async () => {
    lateDownload.resolve({
      ok: true,
      status: 200,
      blob: async () =>
        new Blob(["Synthetic private bytes"], { type: "application/pdf" }),
    } as Response);
    bQueue.resolve(ok({ results: [mock.control()], count: 1 }));
  });
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByText("Private service 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Validaciones" }));
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const comment = (await screen.findByLabelText(
    "Comentario para el conductor",
  )) as HTMLTextAreaElement;
  expect(comment.value).toBe("");
  expect(screen.queryByText("Private frozen decision A")).toBeNull();
});

test("document authorization expiry removes the review, observations and confirmation immediately", async () => {
  const mock = fixture("admin");
  const create = vi.fn(() => "blob:private");
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Validaciones" }));
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Private expiring note" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  mock.intercept((path) =>
    path.endsWith("admin/documents/17/download/")
      ? Promise.resolve(denied())
      : undefined,
  );
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  await screen.findByText(
    "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
  );
  expect(screen.queryByText("Private service 1")).toBeNull();
  expect(screen.queryByText("Private review note 1")).toBeNull();
  expect(screen.queryByText("Private expiring note")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Descargar" })).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test("account replacement clears selected upload bytes, filename and saved document metadata", async () => {
  const mock = fixture("driver");
  mock.intercept((path) =>
    path.endsWith("checklist/")
      ? Promise.resolve(
          ok({
            demo_only: true,
            allowed_content_types: ["application/pdf"],
            max_bytes: 10485760,
            items: [
              {
                kind: "demo_identity_document",
                label: "Documento sintético",
                requires_expiry: false,
              },
            ],
          }),
        )
      : path.endsWith("driver/documents/")
        ? Promise.resolve(
            ok({
              documents: [
                {
                  id: 17,
                  version: 1,
                  kind: "demo_identity_document",
                  content_type: "application/pdf",
                  byte_size: 20,
                  uploaded_at: "2026-10-01T11:00:00Z",
                  expires_on: null,
                  is_current: true,
                },
              ],
            }),
          )
        : undefined,
  );
  render(<App />);
  await screen.findByLabelText("Nombre del servicio");
  fireEvent.click(screen.getByRole("button", { name: /Documentos.*1 de 1/ }));
  fireEvent.change(screen.getByLabelText("Archivo para Documento sintético"), {
    target: {
      files: [
        new File(["synthetic-only"], "synthetic-private-A.pdf", {
          type: "application/pdf",
        }),
      ],
    },
  });
  expect(screen.getByText("synthetic-private-A.pdf")).toBeTruthy();
  const bProfile = deferred<Response>();
  mock.replace();
  mock.intercept((path) =>
    path.endsWith("driver/profile/") ? bProfile.promise : undefined,
  );
  refreshIdentity();
  await screen.findByText("Account B");
  expect(screen.queryByText("synthetic-private-A.pdf")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Descargar documento" }),
  ).toBeNull();
  await act(async () => bProfile.resolve(ok(mock.profile())));
  await screen.findByLabelText("Nombre del servicio");
  expect(screen.queryByText("synthetic-private-A.pdf")).toBeNull();
});

// Slice 3 private cards, drafts, details and inline confirmations remain inside
// the same identity-keyed workspace as Task 08. Use synthetic records only.
function operationalReads(
  mock: ReturnType<typeof fixture>,
  path: string,
): Promise<Response> | undefined {
  const suffix = mock.profile().service_contact_email.includes("-1@")
    ? "A"
    : "B";
  const assignment = {
    id: 5,
    route_id: 9,
    student_display_name: `Synthetic student ${suffix}`,
    pickup_instruction: `Synthetic pickup ${suffix}`,
    guardian_display_name: `Synthetic guardian ${suffix}`,
    guardian_contact: "912345678",
    starts_on: "2099-01-01",
    ends_on: null,
    created_at: "2026-09-28T12:00:00Z",
    updated_at: "2026-09-28T12:00:00Z",
  };
  const route = {
    ...mock.summary().routes[0],
    label: `Synthetic route ${suffix}`,
    destination_label: "Synthetic school",
    destination_address: "Synthetic destination",
    coverage_codes: ["demo"],
  };
  if (path.endsWith("driver/routes/"))
    return Promise.resolve(ok({ routes: [route] }));
  if (path.endsWith("driver/communes/"))
    return Promise.resolve(
      ok({ communes: [{ code: "demo", display_name: "Comuna Demo" }] }),
    );
  if (path.endsWith("driver/passenger-assignments/"))
    return Promise.resolve(ok({ assignments: [assignment] }));
  if (path.endsWith("driver/payments/"))
    return Promise.resolve(
      ok({
        payments: [
          {
            id: 8,
            assignment_id: 5,
            service_period_start: "2026-09-28",
            service_period_end: "2026-10-28",
            due_on: "2026-10-05",
            amount_clp: 50000,
            status: "pending",
            paid_at: null,
            created_at: "2026-09-28T12:00:00Z",
            updated_at: "2026-09-28T12:00:00Z",
          },
        ],
      }),
    );
  const request = {
    id: 7,
    parent_display_name: `Synthetic parent ${suffix}`,
    parent_email: `synthetic-${suffix}@example.test`,
    message: `Synthetic message ${suffix}`,
    status: "pending",
    created_at: "2026-09-28T12:00:00Z",
    updated_at: "2026-09-28T12:00:00Z",
    resolved_at: null,
  };
  if (path.endsWith("driver/contact-requests/"))
    return Promise.resolve(ok({ results: [request] }));
  if (path.endsWith("driver/contact-requests/7/"))
    return Promise.resolve(ok(request));
}
const operationalCases = [
  ["Rutas", "Nombre de la ruta", "Actualizar rutas", "driver/routes/"],
  [
    "Pasajeros",
    "Nombre del estudiante",
    "Actualizar pasajeros",
    "driver/passenger-assignments/",
  ],
  ["Pagos", "Monto CLP", "Actualizar pagos", "driver/payments/"],
  ["Solicitudes", "", "Actualizar solicitudes", "driver/contact-requests/"],
] as const;

test.each(["replacement", "expiry"] as const)(
  "Solicitudes %s clears local page, active filter and private selected detail before late inbox reads",
  async (boundary) => {
    const mock = fixture("driver");
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1,
      parent_display_name: `Paged parent A ${index + 1}`,
      parent_email: "paged-a@example.test",
      message: `Paged private message A ${index + 1}`,
      status: "pending",
      created_at: "2026-10-07T12:00:00Z",
      updated_at: "2026-10-07T12:00:00Z",
      resolved_at: null,
    }));
    mock.intercept((path) =>
      path.endsWith("driver/contact-requests/")
        ? Promise.resolve(ok({ results: rows }))
        : path.endsWith("driver/contact-requests/21/")
          ? Promise.resolve(ok(rows[20]))
          : operationalReads(mock, path),
    );
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section("Solicitudes"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Por responder 21" }),
    );
    const pages = () =>
      within(
        screen.getByRole("navigation", { name: "Páginas de solicitudes" }),
      );
    fireEvent.click(pages().getByRole("button", { name: "Siguiente →" }));
    fireEvent.click(pages().getByRole("button", { name: "Siguiente →" }));
    expect(screen.getByText("Página 3 de 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Paged parent A 21/ }));
    await screen.findByText("Paged private message A 21");
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Actualizar solicitudes" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    const old = deferred<Response>();
    mock.intercept((path) =>
      path.endsWith("driver/contact-requests/")
        ? old.promise
        : operationalReads(mock, path),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar solicitudes" }),
    );
    const replacementRows = rows.map((row) => ({
      ...row,
      parent_display_name: `Paged parent B ${row.id}`,
      parent_email: "paged-b@example.test",
      message: `Paged private message B ${row.id}`,
    }));
    if (boundary === "replacement") mock.replace();
    mock.intercept((path) =>
      boundary === "expiry" && path.endsWith("auth/me/")
        ? Promise.resolve(denied())
        : path.endsWith("driver/contact-requests/")
          ? Promise.resolve(ok({ results: replacementRows }))
          : operationalReads(mock, path),
    );
    refreshIdentity();
    if (boundary === "replacement") await screen.findByText("Account B");
    else
      await screen.findByText(
        "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
      );
    expect(
      screen.queryByRole("region", { name: "Solicitud de contacto" }),
    ).toBeNull();
    expect(screen.queryByText("Página 3 de 3")).toBeNull();
    expect(screen.queryByText("paged-a@example.test")).toBeNull();
    expect(screen.queryByText(/Paged private message A/)).toBeNull();
    expect(screen.queryByText("Ocultar detalle ↑")).toBeNull();
    await act(async () => old.resolve(ok({ results: rows })));
    expect(
      screen.queryByText(/Paged parent A|Paged private message A/),
    ).toBeNull();
    if (boundary === "replacement") {
      fireEvent.click(section("Solicitudes"));
      await screen.findByText("Paged parent B 1");
      expect(screen.getByText("Página 1 de 3")).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Todas 21" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen
          .getByRole("button", { name: "Por responder 21" })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      expect(
        screen.queryByRole("region", { name: "Solicitud de contacto" }),
      ).toBeNull();
      expect(screen.queryByText("paged-b@example.test")).toBeNull();
    } else {
      expect(
        screen.queryByRole("navigation", { name: "Páginas de solicitudes" }),
      ).toBeNull();
    }
  },
);

test.each(operationalCases)(
  "%s account replacement clears drafts/details and rejects a late A read",
  async (destination, field, refresh, endpoint) => {
    const mock = fixture("driver");
    mock.intercept((path) => operationalReads(mock, path));
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section(destination));
    await screen.findByText(
      destination === "Solicitudes"
        ? "Synthetic parent A"
        : destination === "Rutas"
          ? "Synthetic route A"
          : "Synthetic student A",
    );
    if (destination === "Solicitudes") {
      fireEvent.click(
        screen.getByRole("button", { name: /Synthetic parent A/ }),
      );
      await screen.findByText("Synthetic message A");
      await waitFor(() =>
        expect(
          (
            screen.getByRole("button", {
              name: "Actualizar solicitudes",
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
    } else {
      fireEvent.click(
        screen.getByRole("button", {
          name:
            destination === "Rutas"
              ? "Crear ruta"
              : destination === "Pasajeros"
                ? "Agregar pasajero"
                : "Registrar pago",
        }),
      );
      fireEvent.change(screen.getByLabelText(field), {
        target: {
          value: destination === "Pagos" ? "98765" : "Private draft A",
        },
      });
    }
    const old = deferred<Response>();
    mock.intercept((path) =>
      path.endsWith(endpoint) ? old.promise : operationalReads(mock, path),
    );
    fireEvent.click(screen.getByRole("button", { name: refresh }));
    mock.replace();
    refreshIdentity();
    await screen.findByText("Account B");
    expect(screen.queryByDisplayValue("Private draft A")).toBeNull();
    expect(screen.queryByDisplayValue("98765")).toBeNull();
    expect(screen.queryByText("Synthetic message A")).toBeNull();
    expect(screen.queryByText("synthetic-A@example.test")).toBeNull();
    await act(async () =>
      old.resolve(
        ok(
          destination === "Rutas"
            ? { routes: [] }
            : destination === "Pasajeros"
              ? { assignments: [] }
              : destination === "Pagos"
                ? { payments: [] }
                : {
                    results: [
                      { id: 70, parent_display_name: "Late A private parent" },
                    ],
                  },
        ),
      ),
    );
    expect(screen.queryByText("Late A private parent")).toBeNull();
    mock.intercept((path) => operationalReads(mock, path));
    fireEvent.click(section(destination));
    await screen.findByText(
      destination === "Solicitudes"
        ? "Synthetic parent B"
        : destination === "Rutas"
          ? "Synthetic route B"
          : "Synthetic student B",
    );
    if (field) {
      expect(screen.queryByLabelText(field)).toBeNull();
      fireEvent.click(
        screen.getByRole("button", {
          name:
            destination === "Rutas"
              ? "Crear ruta"
              : destination === "Pasajeros"
                ? "Agregar pasajero"
                : "Registrar pago",
        }),
      );
      expect((screen.getByLabelText(field) as HTMLInputElement).value).toBe("");
    }
  },
);

test.each(operationalCases)(
  "%s expiry removes private drafts/cards/confirmation before late reads return",
  async (destination, field, refresh, endpoint) => {
    const mock = fixture("driver");
    mock.intercept((path) => operationalReads(mock, path));
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section(destination));
    await screen.findByText(
      destination === "Solicitudes"
        ? "Synthetic parent A"
        : destination === "Rutas"
          ? "Synthetic route A"
          : "Synthetic student A",
    );
    if (destination === "Solicitudes") {
      fireEvent.click(
        screen.getByRole("button", { name: /Synthetic parent A/ }),
      );
      await screen.findByText("Synthetic message A");
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: refresh }) as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );
    } else {
      fireEvent.click(
        screen.getByRole("button", {
          name:
            destination === "Rutas"
              ? "Crear ruta"
              : destination === "Pasajeros"
                ? "Agregar pasajero"
                : "Registrar pago",
        }),
      );
      fireEvent.change(screen.getByLabelText(field), {
        target: {
          value: destination === "Pagos" ? "98765" : "Private draft A",
        },
      });
      if (destination !== "Rutas")
        fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      if (destination === "Pasajeros")
        fireEvent.click(
          screen.getByRole("button", { name: "Finalizar asignación" }),
        );
      if (destination === "Pagos") {
        fireEvent.click(screen.getByText("Ver registro"));
        fireEvent.click(screen.getByRole("button", { name: "Anular" }));
      }
    }
    const old = deferred<Response>();
    mock.intercept((path) =>
      path.endsWith(endpoint) ? old.promise : operationalReads(mock, path),
    );
    fireEvent.click(screen.getByRole("button", { name: refresh }));
    mock.intercept((path) =>
      path.endsWith("auth/me/")
        ? Promise.resolve(denied())
        : operationalReads(mock, path),
    );
    refreshIdentity();
    await screen.findByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    );
    expect(screen.queryByDisplayValue("Private draft A")).toBeNull();
    expect(screen.queryByDisplayValue("98765")).toBeNull();
    expect(
      screen.queryByText(/Synthetic (student|parent|message|route) A/),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Confirmar (finalización|anulación)/,
      }),
    ).toBeNull();
    await act(async () =>
      old.resolve(
        ok({
          results: [{ id: 99, parent_display_name: "Late A private" }],
          routes: [],
          assignments: [],
          payments: [],
        }),
      ),
    );
    expect(screen.queryByText("Late A private")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Secciones del conductor" }),
    ).toBeNull();
  },
);

test.each([
  ["Rutas", "Desactivar", "driver/routes/9/"],
  ["Pasajeros", "Guardar cambios", "driver/passenger-assignments/5/"],
  ["Pagos", "Marcar pagado", "driver/payments/8/mark-paid/"],
  ["Solicitudes", "Aceptar", "driver/contact-requests/7/accept/"],
] as const)(
  "%s late mutation cannot repopulate a replacement account",
  async (destination, action, endpoint) => {
    const mock = fixture("driver");
    mock.intercept((path) => operationalReads(mock, path));
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section(destination));
    await screen.findByText(
      destination === "Solicitudes"
        ? "Synthetic parent A"
        : destination === "Rutas"
          ? "Synthetic route A"
          : "Synthetic student A",
    );
    if (destination === "Pasajeros")
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    if (destination === "Solicitudes") {
      fireEvent.click(
        screen.getByRole("button", { name: /Synthetic parent A/ }),
      );
      await screen.findByText("Synthetic message A");
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: action }) as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );
    }
    if (destination === "Pagos")
      fireEvent.click(screen.getByText("Ver registro"));
    const write = deferred<Response>();
    mock.intercept((path) =>
      path.endsWith(endpoint) ? write.promise : operationalReads(mock, path),
    );
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() =>
      expect(
        mock.fetchMock.mock.calls.some(([path]) => path.endsWith(endpoint)),
      ).toBe(true),
    );
    mock.replace();
    mock.intercept((path) => operationalReads(mock, path));
    refreshIdentity();
    await screen.findByText("Account B");
    await act(async () =>
      write.resolve(
        ok({
          id: 99,
          parent_display_name: "Late A private",
          student_display_name: "Late A student",
          status: "accepted",
        }),
      ),
    );
    expect(screen.queryByText("Late A private")).toBeNull();
    expect(screen.queryByText("Late A student")).toBeNull();
    expect(
      screen.queryByText(
        /Ruta desactivada|Pasajero actualizado|Pago marcado como pagado|Solicitud aceptada/,
      ),
    ).toBeNull();
    fireEvent.click(section(destination));
    await screen.findByText(
      destination === "Solicitudes"
        ? "Synthetic parent B"
        : destination === "Rutas"
          ? "Synthetic route B"
          : "Synthetic student B",
    );
  },
);

test.each([
  [
    "Pasajeros",
    "Agregar pasajero",
    "Nombre del estudiante",
    "Borrador privado ficticio",
  ],
  ["Pagos", "Registrar pago", "Monto CLP", "45678"],
])(
  "%s session expiry removes an open focused draft immediately",
  async (destination, action, field, value) => {
    const mock = fixture("driver");
    mock.intercept((path) => operationalReads(mock, path));
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section(destination));
    await screen.findByText("Synthetic student A");
    fireEvent.click(screen.getByRole("button", { name: action }));
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
    expect(screen.getByDisplayValue(value)).toBeTruthy();
    mock.intercept((path) =>
      path.endsWith("auth/me/")
        ? Promise.resolve(denied())
        : operationalReads(mock, path),
    );
    refreshIdentity();
    await screen.findByText(
      "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
    );
    expect(screen.queryByDisplayValue(value)).toBeNull();
    expect(screen.queryByLabelText(field)).toBeNull();
    expect(screen.queryByText("Synthetic student A")).toBeNull();
  },
);

test.each(["replacement", "expiry", "logout"] as const)(
  "%s removes an already visible action notice and its contextual error",
  async (boundary) => {
    const mock = fixture("driver");
    mock.intercept((path) =>
      path.endsWith("driver/passenger-assignments/5/")
        ? Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              code: "validation_error",
              message: "Private failure A",
              fields: { seat_capacity: ["Private failure A"] },
            }),
          } as Response)
        : operationalReads(mock, path),
    );
    render(<App />);
    await screen.findByRole("navigation", { name: "Secciones del conductor" });
    fireEvent.click(section("Pasajeros"));
    await screen.findByText("Synthetic student A");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const notice = await screen.findByRole("complementary", {
      name: "Aviso de la acción",
    });
    expect(within(notice).getByRole("alert").textContent).toContain(
      "No pudimos actualizar al pasajero",
    );
    expect(notice.textContent).not.toMatch(
      /Synthetic|Private failure|912345678/,
    );
    if (boundary === "replacement") {
      mock.replace();
      mock.intercept((path) => operationalReads(mock, path));
      refreshIdentity();
      await screen.findByText("Account B");
      fireEvent.click(section("Pasajeros"));
      await screen.findByText("Synthetic student B");
    } else if (boundary === "expiry") {
      mock.intercept((path) =>
        path.endsWith("auth/me/")
          ? Promise.resolve(denied())
          : operationalReads(mock, path),
      );
      refreshIdentity();
      await screen.findByRole("button", { name: "Iniciar sesión" });
    } else {
      mock.intercept((path) =>
        path.endsWith("auth/logout/")
          ? Promise.resolve(ok({}))
          : operationalReads(mock, path),
      );
      fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
      await screen.findByRole("button", { name: "Iniciar sesión" });
    }
    expect(
      screen.queryByRole("complementary", { name: "Aviso de la acción" }),
    ).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Revisa esta acción" }),
    ).toBeNull();
    expect(screen.queryByText("Synthetic student A")).toBeNull();
  },
);

test.each(["replacement", "expiry"] as const)(
  "admin %s removes filters, selected detail, plan draft, confirmation, technical history and notice; late reads cannot restore them",
  async (boundary) => {
    const mock = fixture("admin");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Buscar conductor"), {
      target: { value: "Private filter A" },
    });
    await openControl();
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Private plan draft A" },
    });
    const changes = screen.getByText("Ver cambios").closest("details")!;
    changes.open = true;
    fireEvent(changes, new Event("toggle"));
    fireEvent.click(screen.getByText("Detalles técnicos"));
    const oldHistory = deferred<Response>();
    const oldDetail = deferred<Response>();
    const oldControl = mock.control();
    // A failed explicit write gives us a visible static notice while retaining
    // the local reason. No sensitive server error is copied into the portal.
    mock.intercept((path) =>
      path.endsWith("admin/drivers/7/status/")
        ? Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              code: "validation_error",
              message: "Private failure A",
              fields: { reason: ["Private failure A"] },
            }),
          } as Response)
        : undefined,
    );
    fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
      target: { value: "Private profile reason A" },
    });
    fireEvent.click(screen.getByText("Revisar cambio de perfil"));
    fireEvent.click(screen.getByText("Confirmar cambio"));
    const notice = await screen.findByRole("complementary", {
      name: "Aviso de la acción",
    });
    expect(notice.textContent).toContain("No pudimos actualizar el perfil");
    expect(notice.textContent).not.toMatch(/Private|private-|correlation/);
    // The error returns to the reason panel; a new explicit confirmation is
    // still necessary and remains open during the obsolete history read.
    fireEvent.click(screen.getByText("Revisar cambio de perfil"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    mock.intercept((path) =>
      path.endsWith("admin/drivers/7/")
        ? oldDetail.promise
        : path.includes("admin/drivers/7/history/")
          ? oldHistory.promise
          : undefined,
    );
    fireEvent.click(screen.getByText("Ver acciones anteriores"));
    expect(screen.getByDisplayValue("Private plan draft A")).toBeTruthy();
    await waitFor(() =>
      expect(
        mock.fetchMock.mock.calls.some(([path]) =>
          path.includes("history/?offset=25"),
        ),
      ).toBe(true),
    );
    const bQueue = deferred<Response>();
    if (boundary === "replacement") {
      mock.replace();
      mock.intercept((path) =>
        path.includes("admin/drivers/?") ? bQueue.promise : undefined,
      );
    } else {
      mock.intercept((path) =>
        path.endsWith("auth/me/") ? Promise.resolve(denied()) : undefined,
      );
    }
    refreshIdentity();
    if (boundary === "replacement") await screen.findByText("Account B");
    else
      await screen.findByText(
        "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
      );
    expect(
      screen.queryByRole("region", { name: "Detalle del conductor" }),
    ).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Aviso de la acción" }),
    ).toBeNull();
    expect(screen.queryByDisplayValue("Private filter A")).toBeNull();
    expect(screen.queryByDisplayValue("Private profile reason A")).toBeNull();
    expect(screen.queryByDisplayValue("Private plan draft A")).toBeNull();
    expect(screen.queryByText("Referencia: private-correlation")).toBeNull();
    await act(async () => {
      oldDetail.resolve(ok(oldControl));
      oldHistory.resolve(
        ok({
          count: 1,
          results: [
            {
              id: 80,
              actor: { display_name: "Late A actor" },
              action: "profile_status_changed",
              target_type: "driver_profile",
              target_id: 7,
              before: { status: "active" },
              after: { status: "suspended" },
              reason: "Late A history",
              correlation_id: "Late A reference",
              occurred_at: "2026-10-01T03:00:00Z",
            },
          ],
        }),
      );
    });
    expect(screen.queryByText(/Late A/)).toBeNull();
    if (boundary === "replacement") {
      await act(async () =>
        bQueue.resolve(ok({ results: [mock.control()], count: 1 })),
      );
      expect(
        (screen.getByLabelText("Buscar conductor") as HTMLInputElement).value,
      ).toBe("");
      fireEvent.click(screen.getByText("Ver conductor"));
      await screen.findByRole("region", { name: "Estado del servicio" });
      expect(screen.queryByLabelText("Motivo")).toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
      const history = screen
        .getByText("Historial administrativo")
        .closest("details")!;
      expect(history.open).toBe(false);
    }
  },
);

test.each(["profile", "plan"] as const)(
  "late admin %s write cannot populate another admin or its notice",
  async (action) => {
    const mock = fixture("admin");
    render(<App />);
    await openControl();
    const write = deferred<Response>();
    const endpoint =
      action === "profile"
        ? "admin/drivers/7/status/"
        : "admin/drivers/7/subscription/";
    mock.intercept((path) =>
      path.endsWith(endpoint) ? write.promise : undefined,
    );
    if (action === "profile") {
      fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
        target: { value: "Private reason A" },
      });
      fireEvent.click(screen.getByText("Revisar cambio de perfil"));
      fireEvent.click(screen.getByText("Confirmar cambio"));
    } else {
      fireEvent.change(screen.getByLabelText("Motivo"), {
        target: { value: "Private plan A" },
      });
      fireEvent.click(screen.getByText("Guardar plan"));
    }
    await waitFor(() =>
      expect(
        mock.fetchMock.mock.calls.some(([path]) => path.endsWith(endpoint)),
      ).toBe(true),
    );
    mock.replace();
    mock.intercept(() => undefined);
    refreshIdentity();
    await screen.findByText("Account B");
    await act(async () =>
      write.resolve(
        ok(
          action === "profile"
            ? { ...mock.control(), display_name: "Late A driver" }
            : { publication, version: 88 },
        ),
      ),
    );
    expect(screen.queryByText("Late A driver")).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Aviso de la acción" }),
    ).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  },
);

test.each(["replacement", "expiry"] as const)(
  "admin %s rejects an old plan read before it can restore visibility or editor data",
  async (boundary) => {
    const mock = fixture("admin");
    render(<App />);
    await openControl();
    const read = deferred<Response>();
    mock.intercept((path) =>
      path.endsWith("admin/drivers/7/subscription/") ? read.promise : undefined,
    );
    fireEvent.click(screen.getByText("Actualizar plan"));
    await waitFor(() =>
      expect(
        mock.fetchMock.mock.calls.filter(([path]) =>
          path.endsWith("admin/drivers/7/subscription/"),
        ),
      ).toHaveLength(2),
    );
    if (boundary === "replacement") {
      mock.replace();
      mock.intercept(() => undefined);
    } else
      mock.intercept((path) =>
        path.endsWith("auth/me/") ? Promise.resolve(denied()) : undefined,
      );
    refreshIdentity();
    if (boundary === "replacement") await screen.findByText("Account B");
    else await screen.findByRole("button", { name: "Iniciar sesión" });
    await act(async () =>
      read.resolve(
        ok({
          publication: {
            ...publication,
            subscription: {
              ...publication.subscription!,
              plan_label: "Late A plan",
            },
          },
          version: 88,
        }),
      ),
    );
    expect(screen.queryByText("Late A plan")).toBeNull();
    expect(screen.queryByText("Visible para apoderados")).toBeNull();
    expect(screen.queryByLabelText("Motivo")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Plan del conductor" }),
    ).toBeNull();
  },
);

test.each(["replacement", "expiry"] as const)(
  "admin %s clears opened validation observations and rejects a late validation-history response",
  async (boundary) => {
    const mock = fixture("admin");
    mock.intercept((path) =>
      path.includes("admin/drivers/7/validations/")
        ? Promise.resolve(
            ok({
              count: 26,
              results: Array.from({ length: 25 }, (_, index) => ({
                id: 100 - index,
                revision: 26 - index,
                state: "approved",
                submitted_at: "2026-10-01T03:00:00Z",
                reviewed_at: "2026-10-01T04:00:00Z",
                observations: `Private retained observation ${index + 1}`,
                display_name_snapshot: "Private driver 1",
              })),
            }),
          )
        : undefined,
    );
    render(<App />);
    fireEvent.click(await screen.findByText("Ver conductor"));
    await screen.findByRole("region", { name: "Estado del servicio" });
    openAdminDisclosure("Validación y observaciones");
    const context = within(
      screen.getByText("Validación y observaciones").closest("details")!,
    );
    expect(context.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(
      context.getAllByRole("button", { name: "Ver observación" })[0]!,
    );
    expect(context.getByText("Private retained observation 1")).toBeTruthy();
    for (let i = 0; i < 8; i++)
      fireEvent.click(
        context.getByRole("button", { name: "Ver validaciones anteriores" }),
      );
    expect(context.getAllByRole("listitem")).toHaveLength(25);
    const old = deferred<Response>();
    mock.intercept((path) =>
      path.includes("admin/drivers/7/validations/") ? old.promise : undefined,
    );
    fireEvent.click(
      context.getByRole("button", { name: "Ver validaciones anteriores" }),
    );
    await waitFor(() =>
      expect(
        mock.fetchMock.mock.calls.some(([path]) =>
          path.includes("validations/?offset=25"),
        ),
      ).toBe(true),
    );
    if (boundary === "replacement") {
      mock.replace();
      mock.intercept(() => undefined);
    } else {
      mock.intercept((path) =>
        path.endsWith("auth/me/") ? Promise.resolve(denied()) : undefined,
      );
    }
    refreshIdentity();
    if (boundary === "replacement") await screen.findByText("Account B");
    else await screen.findByRole("button", { name: "Iniciar sesión" });
    expect(screen.queryByText("Validación y observaciones")).toBeNull();
    expect(screen.queryByText(/Private retained observation/)).toBeNull();
    await act(async () =>
      old.resolve(
        ok({
          count: 26,
          results: [
            {
              id: 1,
              revision: 1,
              state: "rejected",
              submitted_at: "2026-09-01T03:00:00Z",
              reviewed_at: null,
              observations: "Late private validation observation",
              display_name_snapshot: "Private driver 1",
            },
          ],
        }),
      ),
    );
    expect(
      screen.queryByText(
        /Late private validation|Private retained observation/,
      ),
    ).toBeNull();
    if (boundary === "replacement") {
      fireEvent.click(await screen.findByText("Ver conductor"));
      await screen.findByRole("region", { name: "Estado del servicio" });
      expect(
        screen.getByText("Validación y observaciones").closest("details")!.open,
      ).toBe(false);
      openAdminDisclosure("Validación y observaciones");
      expect(
        within(
          screen.getByText("Validación y observaciones").closest("details")!,
        ).getAllByRole("listitem"),
      ).toHaveLength(1);
      expect(screen.queryByText("Private observation 2")).toBeNull();
      expect(
        screen
          .getByRole("button", { name: "Ver observación" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
      fireEvent.click(screen.getByRole("button", { name: "Ver observación" }));
      expect(screen.getByText("Private observation 2")).toBeTruthy();
    }
  },
);

test("admin control navigation exposes only the authorized workspace and sends validation review to Validaciones", async () => {
  const mock = fixture("admin");
  render(<App />);
  await openControl();
  const nav = screen.getByRole("navigation", {
    name: "Administración",
  });
  expect(
    within(nav)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim()),
  ).toEqual(["Validaciones", "Conductores"]);
  expect(mock.fetchMock.mock.calls.map(([path]) => path).join(" ")).not.toMatch(
    /\/driver\/|passenger|payment|contact-request|route-run/,
  );
  const detail = screen.getByRole("region", { name: "Detalle del conductor" });
  expect(detail.textContent).not.toMatch(
    /guardian_contact|pickup_instruction|student_display_name|storage_key|amount_clp/,
  );
  expect(screen.queryByRole("button", { name: "Descargar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ir a Validaciones" }));
  await screen.findByRole("button", { name: "Revisar" });
  expect(
    within(nav)
      .getByRole("button", { name: "Validaciones" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.queryByRole("region", { name: "Detalle del conductor" }),
  ).toBeNull();
});

test.each(["sidebar", "back"] as const)(
  "Conductores %s returns to the preserved queue, clears private detail and rejects late detail/history reads",
  async (navigation) => {
    const mock = fixture("admin");
    mock.intercept((path) =>
      path.includes("admin/drivers/?")
        ? Promise.resolve(ok({ results: [mock.control()], count: 60 }))
        : undefined,
    );
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Buscar conductor"), {
      target: { value: "Contexto sintético" },
    });
    openAdminDisclosure("Filtros");
    fireEvent.change(screen.getByLabelText("Estado de validación"), {
      target: { value: "approved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Búsqueda: Contexto sintético");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente →" }));
    await screen.findByText("Página 2 de 3");
    const queueRequests = mock.fetchMock.mock.calls.filter(([path]) =>
      path.includes("admin/drivers/?"),
    );
    expect(queueRequests.at(-1)![0]).toContain("offset=25");
    expect(queueRequests.at(-1)![0]).toContain("validation_state=approved");
    await openControl();
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Private plan navigation draft" },
    });
    const changes = screen.getByText("Ver cambios").closest("details")!;
    changes.open = true;
    fireEvent(changes, new Event("toggle"));
    fireEvent.click(screen.getByText("Detalles técnicos"));
    // Produce a driver-context notice, then leave a frozen confirmation open.
    mock.intercept((path) =>
      path.endsWith("admin/drivers/7/status/")
        ? Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              code: "validation_error",
              fields: { reason: ["Private synthetic failure"] },
            }),
          } as Response)
        : undefined,
    );
    fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
      target: { value: "Private profile navigation draft" },
    });
    fireEvent.click(screen.getByText("Revisar cambio de perfil"));
    fireEvent.click(screen.getByText("Confirmar cambio"));
    await screen.findByRole("complementary", { name: "Aviso de la acción" });
    fireEvent.click(screen.getByText("Revisar cambio de perfil"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    const lateDetail = deferred<Response>();
    const lateHistory = deferred<Response>();
    const oldDriver = mock.control();
    mock.intercept((path) =>
      path.endsWith("admin/drivers/7/")
        ? lateDetail.promise
        : path.includes("admin/drivers/7/history/")
          ? lateHistory.promise
          : undefined,
    );
    fireEvent.click(screen.getByText("Ver acciones anteriores"));
    const main = screen.getByRole("main");
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo;
    fireEvent.click(
      navigation === "sidebar"
        ? within(
            screen.getByRole("navigation", { name: "Administración" }),
          ).getByRole("button", { name: "Conductores" })
        : screen.getByRole("button", { name: "Volver a conductores" }),
    );
    expect(
      screen.getByRole("region", { name: "Lista de conductores" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Detalle del conductor" }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(
      screen.queryByRole("complementary", { name: "Aviso de la acción" }),
    ).toBeNull();
    expect(
      screen.queryByDisplayValue(/Private .* navigation draft/),
    ).toBeNull();
    expect(screen.queryByText("Ver cambios")).toBeNull();
    expect(screen.queryByText("Referencia: private-correlation")).toBeNull();
    expect(
      (screen.getByLabelText("Buscar conductor") as HTMLInputElement).value,
    ).toBe("Contexto sintético");
    expect(
      (screen.getByLabelText("Estado de validación") as HTMLSelectElement)
        .value,
    ).toBe("approved");
    expect(screen.getByText("Página 2 de 3")).toBeTruthy();
    expect(screen.getByText("Búsqueda: Contexto sintético")).toBeTruthy();
    expect(
      within(screen.getByRole("navigation", { name: "Administración" }))
        .getByRole("button", { name: "Conductores" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" }),
    );
    expect(document.activeElement).toBe(
      navigation === "sidebar"
        ? main
        : screen.getByRole("heading", { name: "Conductores" }),
    );
    await act(async () => {
      lateDetail.resolve(
        ok({ ...oldDriver, display_name: "Late navigation driver" }),
      );
      lateHistory.resolve(
        ok({
          count: 1,
          results: [{ id: 80, reason: "Late navigation history" }],
        }),
      );
    });
    expect(screen.queryByText(/Late navigation/)).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Detalle del conductor" }),
    ).toBeNull();
    expect(
      mock.fetchMock.mock.calls.filter(([path]) =>
        path.includes("admin/drivers/?"),
      ),
    ).toHaveLength(queueRequests.length);
    mock.intercept(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Ver conductor" }));
    await screen.findByRole("region", { name: "Estado del servicio" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.getByText("Historial administrativo").closest("details")!.open,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Suspender perfil" }));
    expect(
      (
        screen.getByLabelText(
          "Motivo del cambio de perfil",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
    expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe(
      "",
    );
  },
);
