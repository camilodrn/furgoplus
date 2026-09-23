import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AdminValidationScreen, DriverOnboarding } from "./ValidationScreens";
import { ApiError, AuthApi } from "./api";
import type { AdminValidation } from "./api-types";

const checklist = {
  demo_only: true as const,
  allowed_content_types: ["application/pdf"],
  max_bytes: 10485760,
  items: [
    {
      kind: "demo_identity_document",
      label: "Documento de identidad",
      requires_expiry: false,
    },
  ],
};
const profile = {
  display_name: "Conductor Demo",
  service_summary: "",
  service_contact_email: "",
  validation_state: "draft",
  current_validation_revision: 1,
  approved_revision: null,
};
const document = {
  id: 7,
  version: 1,
  kind: "demo_identity_document",
  content_type: "application/pdf",
  byte_size: 200,
  uploaded_at: "2026-09-23T10:00:00Z",
  expires_on: null,
  is_current: true,
};
const validation = {
  id: 9,
  revision: 1,
  state: "pending" as const,
  submitted_at: "2026-09-23T10:00:00Z",
  reviewed_at: null,
  observations: null,
  display_name_snapshot: "Conductor Demo",
  documents: [document],
};
const adminValidation: AdminValidation = {
  ...validation,
  comparison: {
    previous_revision: null,
    changed_document_count: 0,
    unchanged_document_count: 0,
    changed_identity_field_count: 0,
    has_material_changes: false,
    document_changes: [],
    identity_changes: [],
  },
  driver: {
    id: 1,
    display_name: "Conductor Demo",
    email: "conductor@example.test",
  },
};

function driverApi(
  options: {
    state?: string;
    documents?: (typeof document)[];
    observations?: string;
  } = {},
) {
  let docs = options.documents ?? [];
  const upload = vi.fn(async () => {
    docs = [document];
    return document;
  });
  const submitValidation = vi.fn(async () => validation);
  const history = options.observations
    ? [
        {
          ...validation,
          state: "rejected" as const,
          observations: options.observations,
        },
      ]
    : [];
  const api = {
    driverProfile: async () => ({
      ...profile,
      validation_state: options.state ?? "draft",
    }),
    checklist: async () => checklist,
    documents: async () => ({ documents: docs }),
    validations: async () => ({
      validation_state: options.state ?? "draft",
      current_validation_revision: 1,
      approved_revision: null,
      validations: history,
    }),
    updateDriverProfile: async () => profile,
    upload,
    submitValidation,
    downloadDocument: vi.fn(
      async () => new Blob(["pdf"], { type: "application/pdf" }),
    ),
  } as unknown as AuthApi;
  return { api, upload, submitValidation };
}

function adminApi(
  decision?: (action: string) => Promise<AdminValidation>,
  initial: AdminValidation = adminValidation,
) {
  let current = initial;
  const adminDecision = vi.fn(async (_id: number, action: string) => {
    current = decision
      ? await decision(action)
      : ({
          ...current,
          state: action === "approve" ? "approved" : "rejected",
        } as AdminValidation);
    return current;
  });
  const adminValidationDetail = vi.fn(async () => current);
  const downloadDocument = vi.fn(
    async () => new Blob(["pdf"], { type: "application/pdf" }),
  );
  const api = {
    adminValidations: async () => ({ results: [current] }),
    adminValidation: adminValidationDetail,
    adminDecision,
    downloadDocument,
  } as unknown as AuthApi;
  return { api, adminDecision, adminValidationDetail, downloadDocument };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("driver sees Spanish state, missing item, selects, uploads, and submits", async () => {
  const { api, upload, submitValidation } = driverApi();
  render(<DriverOnboarding api={api} />);
  expect(await screen.findByText("Documento de identidad")).toBeTruthy();
  expect(screen.getAllByText("Borrador").length).toBeGreaterThan(0);
  expect(screen.getByText("Falta subir Documento de identidad.")).toBeTruthy();
  const submit = screen.getByRole("button", {
    name: "Enviar documentos a revisión",
  }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.change(
    screen.getByLabelText("Archivo para Documento de identidad"),
    {
      target: {
        files: [new File(["pdf"], "demo.pdf", { type: "application/pdf" })],
      },
    },
  );
  expect(screen.getByText("demo.pdf")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Subir documento" }));
  expect(
    await screen.findByText("Documento cargado correctamente."),
  ).toBeTruthy();
  expect(upload).toHaveBeenCalledWith(
    "demo_identity_document",
    "",
    expect.any(File),
  );
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  expect(
    await screen.findByText(/Documentos enviados a revisión/),
  ).toBeTruthy();
  expect(submitValidation).toHaveBeenCalledTimes(1);
});

test("driver sees rejected observations and accessible history", async () => {
  const { api } = driverApi({
    state: "rejected",
    documents: [document],
    observations: "Reemplaza el archivo borroso.",
  });
  render(<DriverOnboarding api={api} />);
  expect(
    (await screen.findAllByText("Requiere correcciones")).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByText("Reemplaza el archivo borroso.").length,
  ).toBeGreaterThan(0);
  fireEvent.click(screen.getByText("Ver detalles"));
  expect(screen.getByText("Documentos enviados")).toBeTruthy();
});

test("driver sees approved state and replacement warning", async () => {
  const { api } = driverApi({ state: "approved", documents: [document] });
  render(<DriverOnboarding api={api} />);
  expect(await screen.findByText("Tu validación fue aprobada.")).toBeTruthy();
  fireEvent.change(
    screen.getByLabelText("Archivo para Documento de identidad"),
    {
      target: {
        files: [
          new File(["replacement"], "nuevo.pdf", { type: "application/pdf" }),
        ],
      },
    },
  );
  expect(
    screen.getAllByText(/tu validación deberá revisarse nuevamente/).length,
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Reemplazar documento" }),
  ).toBeTruthy();
});

test("driver sees pending confirmation without a duplicate submit action", async () => {
  const { api } = driverApi({ state: "pending", documents: [document] });
  render(<DriverOnboarding api={api} />);
  expect(
    await screen.findByText("Tu información fue enviada. Estamos revisándola."),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar documentos a revisión" }),
  ).toBeNull();
});

test("admin queue uses Spanish labels, opens detail, and downloads via binary action", async () => {
  const create = vi.fn(() => "blob:demo");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { api, downloadDocument } = adminApi();
  render(<AdminValidationScreen api={api} />);
  expect(await screen.findByText("Pendientes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
  expect(await screen.findByText("Nombre informado")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  await waitFor(() => expect(downloadDocument).toHaveBeenCalledWith(7, true));
  expect(create).toHaveBeenCalled();
});

test("admin queue distinguishes first, unchanged, and changed submissions", async () => {
  const first = adminApi();
  render(<AdminValidationScreen api={first.api} />);
  expect(await screen.findByText("Primera revisión")).toBeTruthy();
  cleanup();
  const unchanged = adminApi(undefined, {
    ...adminValidation,
    comparison: {
      ...adminValidation.comparison,
      previous_revision: 1,
      unchanged_document_count: 3,
    },
  });
  render(<AdminValidationScreen api={unchanged.api} />);
  expect(await screen.findByText("Sin cambios materiales")).toBeTruthy();
  cleanup();
  const changed = adminApi(undefined, {
    ...adminValidation,
    comparison: {
      ...adminValidation.comparison,
      previous_revision: 1,
      changed_document_count: 2,
      unchanged_document_count: 1,
      has_material_changes: true,
    },
  });
  render(<AdminValidationScreen api={changed.api} />);
  expect(await screen.findByText("2 documentos modificados")).toBeTruthy();
});

test("admin detail shows changed and unchanged versions, types, expiry, and identity", async () => {
  const detail: AdminValidation = {
    ...adminValidation,
    revision: 2,
    display_name_snapshot: "Conductor Principal",
    comparison: {
      previous_revision: 1,
      changed_document_count: 2,
      unchanged_document_count: 1,
      changed_identity_field_count: 1,
      has_material_changes: true,
      document_changes: [
        {
          kind: "demo_identity_document",
          status: "replaced",
          previous_version: 1,
          current_version: 2,
          previous_content_type: "image/png",
          current_content_type: "application/pdf",
          previous_expires_on: null,
          current_expires_on: null,
        },
        {
          kind: "demo_vehicle_document",
          status: "replaced",
          previous_version: 1,
          current_version: 2,
          previous_content_type: "application/pdf",
          current_content_type: "application/pdf",
          previous_expires_on: "2026-09-23",
          current_expires_on: "2026-10-23",
        },
        {
          kind: "demo_expiring_credential",
          status: "unchanged",
          previous_version: 1,
          current_version: 1,
          previous_content_type: "application/pdf",
          current_content_type: "application/pdf",
          previous_expires_on: "2026-09-26",
          current_expires_on: "2026-09-26",
        },
      ],
      identity_changes: [
        {
          field: "display_name",
          previous_value: "Conductor Demo",
          current_value: "Conductor Principal",
        },
      ],
    },
  };
  const { api } = adminApi(undefined, detail);
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  expect(await screen.findByText("Cambios desde la revisión 1")).toBeTruthy();
  expect(
    screen.getByText("2 documentos modificados · 1 sin cambios"),
  ).toBeTruthy();
  expect(screen.getByText(/Versión 1 → Versión 2 · PNG → PDF/)).toBeTruthy();
  expect(screen.getByText(/Vence: 23\/09\/2026 → 23\/10\/2026/)).toBeTruthy();
  expect(screen.getByText(/Versión 1 · vence 26 sep 2026/)).toBeTruthy();
  expect(screen.getAllByText("CAMBIADO")).toHaveLength(2);
  expect(screen.getByText("SIN CAMBIOS")).toBeTruthy();
  expect(screen.getByText("Datos del conductor modificados")).toBeTruthy();
  expect(
    screen.getByText(/“Conductor Demo” → “Conductor Principal”/),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /La aprobación siempre corresponde a la revisión completa mostrada/,
    ),
  ).toBeTruthy();
});

test("admin detail states no material changes after resubmission", async () => {
  const { api } = adminApi(undefined, {
    ...adminValidation,
    comparison: {
      ...adminValidation.comparison,
      previous_revision: 1,
      unchanged_document_count: 1,
      document_changes: [
        {
          kind: "demo_identity_document",
          status: "unchanged",
          previous_version: 1,
          current_version: 1,
          previous_content_type: "application/pdf",
          current_content_type: "application/pdf",
          previous_expires_on: null,
          current_expires_on: null,
        },
      ],
    },
  });
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  expect(
    await screen.findByText(
      "Sin cambios materiales respecto de la revisión anterior.",
    ),
  ).toBeTruthy();
});

test("expiry field rejects invalid Chilean dates and sends ISO to the API", async () => {
  const { api, upload } = driverApi();
  vi.spyOn(api, "checklist").mockResolvedValue({
    ...checklist,
    items: [{ ...checklist.items[0]!, requires_expiry: true }],
  });
  render(<DriverOnboarding api={api} />);
  fireEvent.change(
    await screen.findByLabelText("Archivo para Documento de identidad"),
    {
      target: {
        files: [new File(["pdf"], "demo.pdf", { type: "application/pdf" })],
      },
    },
  );
  const date = screen.getByLabelText(
    "Fecha de vencimiento",
  ) as HTMLInputElement;
  expect(date.type).toBe("text");
  expect(date.placeholder).toBe("dd/mm/aaaa");
  fireEvent.change(date, { target: { value: "31/02/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Subir documento" }));
  expect(
    screen.getByText("Ingresa una fecha válida en formato dd/mm/aaaa."),
  ).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
  fireEvent.change(date, { target: { value: "23/09/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Subir documento" }));
  await waitFor(() =>
    expect(upload).toHaveBeenCalledWith(
      "demo_identity_document",
      "2026-09-23",
      expect.any(File),
    ),
  );
});

test("calendar-selected expiry is submitted to the API as ISO", async () => {
  const { api, upload } = driverApi();
  vi.spyOn(api, "checklist").mockResolvedValue({
    ...checklist,
    items: [{ ...checklist.items[0]!, requires_expiry: true }],
  });
  render(<DriverOnboarding api={api} />);
  fireEvent.change(
    await screen.findByLabelText("Archivo para Documento de identidad"),
    {
      target: {
        files: [new File(["pdf"], "demo.pdf", { type: "application/pdf" })],
      },
    },
  );
  const date = screen.getByLabelText(
    "Fecha de vencimiento",
  ) as HTMLInputElement;
  fireEvent.change(date, { target: { value: "10/09/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
  fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
  fireEvent.click(
    screen.getByRole("button", { name: "10 de octubre de 2026" }),
  );
  expect(date.value).toBe("10/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Subir documento" }));
  await waitFor(() =>
    expect(upload).toHaveBeenCalledWith(
      "demo_identity_document",
      "2026-10-10",
      expect.any(File),
    ),
  );
});

test("admin approves and can request corrections", async () => {
  const { api, adminDecision } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(await screen.findByLabelText("Nota para la aprobación"), {
    target: { value: "Documento legible" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar validación" }));
  expect(
    await screen.findByText("Decisión guardada correctamente."),
  ).toBeTruthy();
  expect(adminDecision).toHaveBeenCalledWith(9, "approve", {
    observations: "Documento legible",
  });
  expect(
    screen.queryByRole("button", { name: "Aprobar validación" }),
  ).toBeNull();
});

test("admin correction flow sends the requested observations", async () => {
  const { api, adminDecision } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Solicitar correcciones" }),
  );
  fireEvent.change(
    screen.getByLabelText("Indica qué debe corregir el conductor"),
    { target: { value: "Sube una imagen clara" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Enviar correcciones" }));
  expect(
    await screen.findByText("Decisión guardada correctamente."),
  ).toBeTruthy();
  expect(adminDecision).toHaveBeenCalledWith(9, "reject", {
    observations: "Sube una imagen clara",
  });
});

test("admin stale decision explains the conflict in Spanish", async () => {
  const { api, adminDecision, adminValidationDetail } = adminApi(async () => {
    throw new ApiError(409, "stale_validation", "Stale");
  });
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(await screen.findByLabelText("Nota para la aprobación"), {
    target: { value: "Revisado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar validación" }));
  expect(
    await screen.findByText(/La revisión cambió mientras la estabas revisando/),
  ).toBeTruthy();
  expect(adminDecision).toHaveBeenCalledTimes(1);
  expect(adminValidationDetail).toHaveBeenCalledTimes(2);
});

test("private download requests binary data with cookies and wildcard Accept", async () => {
  const blob = new Blob(["private"], { type: "application/pdf" });
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    blob: async () => blob,
  }));
  vi.stubGlobal("fetch", fetchMock);
  const api = new AuthApi();
  expect(await api.downloadDocument(42, true)).toBe(blob);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/admin/documents/42/download/",
    { method: "GET", credentials: "same-origin", headers: { Accept: "*/*" } },
  );
  expect(await api.downloadDocument(42, false)).toBe(blob);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/driver/documents/42/download/",
    { method: "GET", credentials: "same-origin", headers: { Accept: "*/*" } },
  );
});

test("private download keeps structured authorization errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        code: "permission_denied",
        message: "Denied",
        fields: {},
      }),
    })),
  );
  await expect(new AuthApi().downloadDocument(4, true)).rejects.toMatchObject({
    status: 403,
    code: "permission_denied",
  });
});
