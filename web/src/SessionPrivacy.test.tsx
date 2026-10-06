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
  fireEvent.click(screen.getByText("Actualizar resumen / Reintentar"));
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
  expect(
    screen.queryByText("Tu servicio está visible para apoderados"),
  ).toBeNull();
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
  expect(screen.getByText(/2 pendientes/)).toBeTruthy();
  expect(
    screen.getByText("Tu servicio está visible para apoderados"),
  ).toBeTruthy();
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
  fireEvent.click(screen.getByText("Actualizar resumen / Reintentar"));
  refreshIdentity();
  mock.intercept((path) =>
    path.endsWith("driver/summary/") ? Promise.resolve(denied()) : undefined,
  );
  fireEvent.click(screen.getByText("Actualizar resumen / Reintentar"));
  await screen.findByText(
    "Tu sesión caducó. Inicia sesión de nuevo para continuar.",
  );
  expect(screen.queryByText(/Private route 1/)).toBeNull();
  expect(screen.queryByText(/Pagos:/)).toBeNull();
  expect(screen.queryByDisplayValue("contact-1@example.test")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Secciones del conductor" }),
  ).toBeNull();
  expect(
    screen.queryByText("Tu servicio está visible para apoderados"),
  ).toBeNull();
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
  fireEvent.click(screen.getByText("Actualizar resumen / Reintentar"));
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
