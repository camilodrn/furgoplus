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
async function openControl() {
  fireEvent.click(await screen.findByText("Abrir control"));
  await screen.findByText("Private observation 1");
  await screen.findByLabelText("Motivo");
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
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
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
  await screen.findByText("private-2@example.test");
  fireEvent.click(screen.getByText("Abrir control"));
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
  await openControl();
  expect(screen.getAllByText(/private-1@example.test/)).toHaveLength(2);
  // The subscription form mounts before its private data has loaded.
  expect(screen.getByText("Cargando plan…")).toBeTruthy();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  await act(async () => {
    initialSubscription.resolve(ok({ publication, version: 8 }));
  });
  expect(await screen.findByText("Visible para apoderados")).toBeTruthy();
  expect(screen.getByText(/Plan actual: Basic · Activo/)).toBeTruthy();
  expect((screen.getByLabelText("Plan") as HTMLSelectElement).value).toBe(
    "basic",
  );
  expect(screen.getByDisplayValue("01/10/2026")).toBeTruthy();
  expect(screen.getByText("Motivo: Private history 1")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Private draft A" },
  });
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
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
  fireEvent.click(screen.getByText("Más acciones"));
  // Pagination keeps the successfully loaded queue mounted while detail reloads.
  expect(screen.getByRole("region", { name: "Cola de control" })).toBeTruthy();
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
    screen.queryByRole("region", { name: "Plan y publicación del conductor" }),
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
  expect(screen.queryByRole("region", { name: "Cola de control" })).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Detalle de control" }),
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
