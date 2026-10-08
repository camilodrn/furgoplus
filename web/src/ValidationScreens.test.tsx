import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AdminValidationScreen, DriverOnboarding } from "./ValidationScreens";
import { ApiError, AuthApi } from "./api";
import type {
  AdminValidation,
  DriverValidations,
  Publication,
} from "./api-types";

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
  let state = options.state ?? "draft";
  let revision = 1;
  const submitValidation = vi.fn(async () => {
    const existing = history.find((item) => item.revision === revision);
    if (existing?.state === "pending") return existing;
    if (existing) revision++;
    const sent = { ...validation, id: 9 + history.length, revision };
    state = "pending";
    history.unshift(sent);
    return sent;
  });
  const history: DriverValidations["validations"] = options.observations
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
      validation_state: state,
      current_validation_revision: revision,
    }),
    checklist: async () => checklist,
    documents: async () => ({ documents: docs }),
    validations: async () => ({
      validation_state: state,
      current_validation_revision: revision,
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
  const onRelevantChange = vi.fn();
  render(<DriverOnboarding api={api} onRelevantChange={onRelevantChange} />);
  expect(await screen.findByText("Documento de identidad")).toBeTruthy();
  expect(screen.getAllByText("Preparando información").length).toBeGreaterThan(
    0,
  );
  expect(
    screen.getAllByText("Te falta subir 1 documento.").length,
  ).toBeGreaterThan(0);
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
  expect(screen.getByText("Aún no puedes enviar")).toBeTruthy();
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
  const submit = (await screen.findByRole("button", {
    name: "Enviar a revisión",
  })) as HTMLButtonElement;
  expect(submit.disabled).toBe(false);
  expect(submit.classList.contains("button-primary")).toBe(true);
  expect(screen.queryByText("Aún no puedes enviar")).toBeNull();
  fireEvent.click(submit);
  expect(submitValidation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(
    await screen.findByText(/Información enviada a revisión/),
  ).toBeTruthy();
  expect(submitValidation).toHaveBeenCalledTimes(1);
  expect(onRelevantChange).toHaveBeenCalledTimes(2);
});

test("driver sees rejected observations and accessible history", async () => {
  const { api } = driverApi({
    state: "rejected",
    documents: [document],
    observations: "Reemplaza el archivo borroso.",
  });
  render(<DriverOnboarding api={api} />);
  expect(
    (await screen.findAllByText("Requiere cambios")).length,
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
  expect(await screen.findByText("Tu información fue aprobada")).toBeTruthy();
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
    screen.getAllByText(/tendrás que enviar tu información nuevamente/).length,
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Reemplazar documento" }),
  ).toBeTruthy();
});

test("driver sees pending confirmation without a duplicate submit action", async () => {
  const { api } = driverApi({ state: "pending", documents: [document] });
  render(<DriverOnboarding api={api} />);
  expect(
    await screen.findByText("Estamos revisando tu información"),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
});

test("an incomplete server checklist keeps review accessible and links back to documents", async () => {
  const { api, submitValidation } = driverApi();
  vi.spyOn(api, "checklist").mockResolvedValue({
    ...checklist,
    items: [
      ...checklist.items,
      {
        kind: "demo_vehicle_document",
        label: "Documento del vehículo",
        requires_expiry: false,
      },
      {
        kind: "demo_expiring_credential",
        label: "Credencial con vencimiento",
        requires_expiry: true,
      },
    ],
  });
  function Harness() {
    const [section, setSection] = useState<"documents" | "validation">(
      "documents",
    );
    return (
      <DriverOnboarding
        api={api}
        activeSection={section}
        onSectionChange={(next) => {
          if (next === "documents" || next === "validation") setSection(next);
        }}
      />
    );
  }
  render(<Harness />);
  const summary = (await screen.findByRole("button", {
    name: "Ver resumen de revisión",
  })) as HTMLButtonElement;
  expect(summary.disabled).toBe(false);
  expect(
    screen.queryByRole("button", { name: "Continuar a revisión" }),
  ).toBeNull();
  expect(screen.getByText(/0 de 3 documentos cargados/)).toBeTruthy();
  fireEvent.click(summary);
  const review = screen.getByRole("region", {
    name: "Completa tu información",
  });
  expect(within(review).getByText("Aún no puedes enviar")).toBeTruthy();
  expect(
    within(review).getByText("! Falta subir: Documento de identidad"),
  ).toBeTruthy();
  expect(
    within(review).getByText("! Falta subir: Documento del vehículo"),
  ).toBeTruthy();
  expect(
    within(review).getByText("! Falta subir: Credencial con vencimiento"),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Completar documentos" }));
  expect(
    screen.getByRole("heading", { name: "Documentos requeridos" }),
  ).toBeTruthy();
  const reviewStep = screen.getByRole("button", {
    name: /Revisión.*Preparando información/,
  }) as HTMLButtonElement;
  expect(reviewStep.disabled).toBe(false);
  fireEvent.click(reviewStep);
  expect(screen.getByText("Aún no puedes enviar")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Historial de revisiones" }),
  ).toBeTruthy();
  expect(submitValidation).not.toHaveBeenCalled();
});

const draftPublication: Publication = {
  profile_status: "active",
  publication_requested: false,
  eligible: false,
  blockers: [
    { code: "publication_not_requested", message: "Publicación no solicitada" },
    { code: "validation_not_approved", message: "Validación no aprobada" },
    {
      code: "approved_revision_stale",
      message: "Revisión aprobada desactualizada",
    },
    { code: "subscription_missing", message: "Falta un plan asignado" },
    { code: "active_route_missing", message: "Falta una ruta activa" },
    { code: "profile_summary_missing", message: "Falta descripción" },
    {
      code: "service_contact_email_missing",
      message: "Falta correo de contacto",
    },
  ],
  validation_state: "draft",
  current_validation_revision: 1,
  approved_revision: null,
  subscription: null,
  active_route_count: 0,
  coverage: [],
};

test.each([
  [
    "required_document_missing",
    "Falta un documento requerido vigente",
    "Completar documentos",
    "documents",
  ],
  [
    "required_document_expired",
    "Un documento requerido está vencido",
    "Completar documentos",
    "documents",
  ],
  [
    "profile_display_name_missing",
    "Falta nombre visible",
    "Completar datos del servicio",
    "profile",
  ],
] as const)(
  "server blocker %s preserves its explanation and routes correction",
  async (code, message, action, destination) => {
    const { api, submitValidation } = driverApi({ documents: [document] });
    const onSectionChange = vi.fn();
    render(
      <DriverOnboarding
        api={api}
        activeSection="validation"
        onSectionChange={onSectionChange}
        publication={{
          ...draftPublication,
          blockers: [...draftPublication.blockers, { code, message }],
        }}
      />,
    );
    expect(await screen.findByText("Aún no puedes enviar")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Enviar a revisión" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(onSectionChange).toHaveBeenCalledWith(destination);
    expect(submitValidation).not.toHaveBeenCalled();
  },
);

test("review without known submission obstacles keeps primary sending and server confirmation despite publication blockers", async () => {
  const { api, submitValidation } = driverApi({ documents: [document] });
  render(
    <DriverOnboarding
      api={api}
      activeSection="validation"
      publication={draftPublication}
    />,
  );
  const send = (await screen.findByRole("button", {
    name: "Enviar a revisión",
  })) as HTMLButtonElement;
  expect(send.disabled).toBe(false);
  expect(send.classList.contains("button-primary")).toBe(true);
  expect(screen.queryByText("Aún no puedes enviar")).toBeNull();
  fireEvent.click(send);
  expect(submitValidation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(
    await screen.findByText("Información enviada a revisión."),
  ).toBeTruthy();
  expect(submitValidation).toHaveBeenCalledExactlyOnceWith();
  expect(
    screen.getByRole("heading", { name: "Estamos revisando tu información" }),
  ).toBeTruthy();
});

test("three task steps retain drafts, identify the current step and keep publication and routes reachable", async () => {
  const { api } = driverApi();
  function Harness() {
    const [section, setSection] = useState<
      | "profile"
      | "documents"
      | "validation"
      | "publication"
      | "routes"
      | "requests"
      | "summary"
      | "roster"
      | "payments"
    >("profile");
    return (
      <DriverOnboarding
        api={api}
        activeSection={section}
        onSectionChange={setSection}
      />
    );
  }
  render(<Harness />);
  await screen.findByLabelText("Nombre del servicio");
  const nav = screen.getByRole("navigation", {
    name: "Preparación de mi servicio",
  });
  const data = within(nav).getByRole("button", { name: /Datos del servicio/ });
  expect(data.getAttribute("aria-current")).toBe("step");
  expect(within(nav).getAllByRole("button")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Descripción del servicio"), {
    target: { value: "Borrador sintético" },
  });
  const docs = within(nav).getByRole("button", { name: /Documentos/ });
  docs.focus();
  expect(globalThis.document.activeElement).toBe(docs);
  fireEvent.click(docs);
  expect(docs.getAttribute("aria-current")).toBe("step");
  expect(
    screen.getByRole("heading", { name: "Documentos requeridos" }),
  ).toBeTruthy();
  fireEvent.click(within(nav).getByRole("button", { name: /Revisión/ }));
  expect(
    screen.getByRole("heading", { name: "Completa tu información" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Historial de revisiones" }),
  ).toBeTruthy();
  const other = screen.getByRole("navigation", {
    name: "Otras opciones de mi servicio",
  });
  fireEvent.click(within(other).getByRole("button", { name: "Publicación" }));
  fireEvent.click(within(other).getByRole("button", { name: "Rutas" }));
  fireEvent.click(data);
  expect(
    (screen.getByLabelText("Descripción del servicio") as HTMLTextAreaElement)
      .value,
  ).toBe("Borrador sintético");
});

test("submission confirmation is keyboard reachable and Escape restores focus", async () => {
  const { api, submitValidation } = driverApi({ documents: [document] });
  render(<DriverOnboarding api={api} />);
  const send = await screen.findByRole("button", { name: "Enviar a revisión" });
  send.focus();
  fireEvent.click(send);
  const confirm = screen.getByRole("alertdialog", {
    name: "Enviar tu información a revisión",
  });
  expect(globalThis.document.activeElement).toBe(confirm);
  expect(
    screen.getByText(
      "FurgoPlus revisará esta versión de tu información y documentos.",
    ),
  ).toBeTruthy();
  fireEvent.keyDown(confirm, { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await waitFor(() =>
    expect(globalThis.document.activeElement).toBe(
      screen.getByRole("button", { name: "Enviar a revisión" }),
    ),
  );
  expect(submitValidation).not.toHaveBeenCalled();
});

test("next step reflects published, ready, and blocked publication states", async () => {
  const { api } = driverApi({ state: "approved", documents: [document] });
  const base: Publication = {
    profile_status: "active",
    publication_requested: true,
    eligible: true,
    blockers: [],
    validation_state: "approved",
    current_validation_revision: 1,
    approved_revision: 1,
    subscription: null,
    active_route_count: 1,
    coverage: [],
  };
  const view = render(
    <DriverOnboarding
      api={api}
      activeSection="publication"
      publication={base}
    />,
  );
  expect(await screen.findByText(/Tu servicio ya está publicado/)).toBeTruthy();
  expect(screen.queryByText(/Revisa Publicación/)).toBeNull();
  view.rerender(
    <DriverOnboarding
      api={api}
      activeSection="publication"
      publication={{
        ...base,
        eligible: false,
        publication_requested: false,
        blockers: [
          {
            code: "publication_not_requested",
            message: "Solicita la publicación",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/Tu configuración está lista/)).toBeTruthy();
  view.rerender(
    <DriverOnboarding
      api={api}
      activeSection="publication"
      publication={{
        ...base,
        eligible: false,
        blockers: [
          {
            code: "active_route_missing",
            message: "Falta al menos una ruta activa y completa",
          },
          { code: "subscription_missing", message: "Falta un plan asignado" },
        ],
      }}
    />,
  );
  expect(screen.getByText("Crea una ruta activa y completa.")).toBeTruthy();
  expect(screen.queryByText(/Falta un plan asignado/)).toBeNull();
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
  expect(
    await screen.findByText("Nombre del servicio en este envío"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  await waitFor(() => expect(downloadDocument).toHaveBeenCalledWith(7, true));
  expect(create).toHaveBeenCalled();
});

test("admin detail switches validation and plan without duplicating review content", async () => {
  const { api } = adminApi();
  Object.assign(api, {
    adminSubscription: async () => ({
      publication: {
        profile_status: "active",
        publication_requested: false,
        eligible: false,
        blockers: [],
        validation_state: "pending",
        current_validation_revision: 1,
        approved_revision: null,
        subscription: null,
        active_route_count: 0,
        coverage: [],
      },
      version: null,
    }),
    plans: async () => ({ plans: [{ code: "basic", display_label: "Basic" }] }),
  });
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  expect(
    await screen.findByRole("heading", { name: "Documentos enviados" }),
  ).toBeTruthy();
  const planTab = screen.getByRole("button", { name: "Plan y publicación" });
  planTab.focus();
  expect(globalThis.document.activeElement).toBe(planTab);
  expect(planTab.tabIndex).toBe(0);
  fireEvent.click(planTab);
  expect(planTab.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "Plan actual" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Documentos enviados" }),
  ).toBeNull();
  expect(
    await screen.findAllByText("Plan actual", { exact: true }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Validación" }));
  expect(
    screen.getByRole("heading", { name: "Documentos enviados" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Plan actual" })).toBeNull();
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
  expect(await screen.findByText("Sin cambios en la información")).toBeTruthy();
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
      "Sin cambios en la información respecto del envío anterior.",
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

test("admin shows one neutral comment field with persistent label, help and mandatory semantics", async () => {
  const { api, adminDecision } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const comment = await screen.findByRole("textbox", {
    name: "Comentario para el conductor",
  });
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByText("Nota para la aprobación")).toBeNull();
  expect(comment.getAttribute("aria-required")).toBe("true");
  expect((comment as HTMLTextAreaElement).maxLength).toBe(1000);
  expect(comment.hasAttribute("required")).toBe(false);
  expect(comment.getAttribute("aria-describedby")).toBe(
    "decision-help decision-required",
  );
  expect(
    screen.getByText(
      "Escribe brevemente el resultado de la revisión. Este mensaje será visible para el conductor.",
    ).id,
  ).toBe("decision-help");
  for (const value of ["", "   "]) {
    fireEvent.change(comment, { target: { value } });
    for (const action of ["Aprobar", "Solicitar cambios"]) {
      const button = screen.getByRole("button", {
        name: action,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(adminDecision).not.toHaveBeenCalled();
  }
});

test.each(["Aprobar", "Solicitar cambios"])(
  "canceling %s preserves the exact typed comment and restores action focus",
  async (action) => {
    const { api, adminDecision } = adminApi();
    render(<AdminValidationScreen api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    const original = "  Revisa el documento sintético.  ";
    fireEvent.change(
      await screen.findByLabelText("Comentario para el conductor"),
      {
        target: { value: original },
      },
    );
    for (const cancel of ["button", "escape"]) {
      const trigger = screen.getByRole("button", { name: action });
      trigger.focus();
      fireEvent.click(trigger);
      const confirmation = screen.getByRole("alertdialog");
      expect(
        within(confirmation).getByText(/Revisa el documento sintético/),
      ).toBeTruthy();
      expect(globalThis.document.activeElement).toBe(confirmation);
      if (cancel === "button")
        fireEvent.click(
          within(confirmation).getByRole("button", { name: "Cancelar" }),
        );
      else fireEvent.keyDown(confirmation, { key: "Escape" });
      const comment = screen.getByLabelText(
        "Comentario para el conductor",
      ) as HTMLTextAreaElement;
      expect(comment.value).toBe(original);
      await waitFor(() =>
        expect(globalThis.document.activeElement).toBe(
          screen.getByRole("button", { name: action }),
        ),
      );
    }
    const otherAction = action === "Aprobar" ? "Solicitar cambios" : "Aprobar";
    fireEvent.click(screen.getByRole("button", { name: otherAction }));
    expect(
      within(screen.getByRole("alertdialog")).getByText(
        /Revisa el documento sintético/,
      ),
    ).toBeTruthy();
    expect(adminDecision).not.toHaveBeenCalled();
  },
);

test.each([
  ["Aprobar", "Confirmar aprobación"],
  ["Solicitar cambios", "Confirmar solicitud de cambios"],
])(
  "server comment errors for %s remain associated with the shared field and preserve its draft",
  async (action, confirm) => {
    const { api } = adminApi(async () => {
      throw new ApiError(400, "validation_error", "Invalid", {
        observations: ["Este campo no puede estar en blanco."],
      });
    });
    render(<AdminValidationScreen api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    fireEvent.change(
      await screen.findByLabelText("Comentario para el conductor"),
      {
        target: { value: "Comentario sintético" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: action }));
    fireEvent.click(screen.getByRole("button", { name: confirm }));
    const error = await screen.findByRole("alert");
    const comment = screen.getByLabelText(
      "Comentario para el conductor",
    ) as HTMLTextAreaElement;
    expect(error.textContent).toContain("Este campo no puede estar en blanco.");
    expect(comment.getAttribute("aria-invalid")).toBe("true");
    expect(comment.getAttribute("aria-describedby")?.split(" ")).toContain(
      error.id,
    );
    expect(comment.value).toBe("Comentario sintético");
    await waitFor(() =>
      expect(globalThis.document.activeElement).toBe(
        screen.getByRole("button", { name: action }),
      ),
    );
  },
);

test.each(["driver", "submission"])(
  "the shared comment cannot leak to a different reviewed %s",
  async (target) => {
    const { api, adminValidationDetail } = adminApi();
    render(<AdminValidationScreen api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    fireEvent.change(
      await screen.findByLabelText("Comentario para el conductor"),
      {
        target: { value: "Comentario privado del envío original" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Volver a validaciones" }),
    );
    const next = {
      ...adminValidation,
      id: 10,
      revision: 2,
      driver:
        target === "driver"
          ? { ...adminValidation.driver, id: 2, email: "otro@example.test" }
          : adminValidation.driver,
      display_name_snapshot: "Siguiente envío sintético",
    };
    vi.spyOn(api, "adminValidations").mockResolvedValue({ results: [next] });
    adminValidationDetail.mockResolvedValue(next);
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar validaciones" }),
    );
    await screen.findByText("Siguiente envío sintético");
    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    const comment = (await screen.findByLabelText(
      "Comentario para el conductor",
    )) as HTMLTextAreaElement;
    expect(comment.value).toBe("");
    expect(
      screen.queryByText("Comentario privado del envío original"),
    ).toBeNull();
    expect(adminValidationDetail).toHaveBeenLastCalledWith(10);
  },
);

test("admin approval reuses the shared comment in its confirmation and payload", async () => {
  const { api, adminDecision } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Documento legible" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "¿Aprobar esta revisión?",
  });
  expect(within(confirmation).getByText(/Documento legible/)).toBeTruthy();
  expect(within(confirmation).queryByRole("textbox")).toBeNull();
  expect(adminDecision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));
  expect(
    await screen.findByText("Decisión guardada correctamente."),
  ).toBeTruthy();
  expect(adminDecision).toHaveBeenCalledWith(9, "approve", {
    observations: "Documento legible",
  });
  expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
});

test("admin request changes reuses the shared comment in its confirmation and payload", async () => {
  const { api, adminDecision } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Sube una imagen clara" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Solicitar cambios" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "¿Solicitar cambios al conductor?",
  });
  expect(within(confirmation).getByText(/Sube una imagen clara/)).toBeTruthy();
  expect(within(confirmation).queryByRole("textbox")).toBeNull();
  expect(adminDecision).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar solicitud de cambios" }),
  );
  expect(
    await screen.findByText("Decisión guardada correctamente."),
  ).toBeTruthy();
  expect(adminDecision).toHaveBeenCalledWith(9, "reject", {
    observations: "Sube una imagen clara",
  });
});

test.each([
  ["Aprobar", "Confirmar aprobación", "approve"],
  ["Solicitar cambios", "Confirmar solicitud de cambios", "reject"],
])(
  "admin stale %s decision preserves authoritative conflict behavior",
  async (action, confirm, payloadAction) => {
    const { api, adminDecision, adminValidationDetail } = adminApi(async () => {
      throw new ApiError(409, "stale_validation", "Stale");
    });
    render(<AdminValidationScreen api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    fireEvent.change(
      await screen.findByLabelText("Comentario para el conductor"),
      {
        target: { value: "Revisado" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(adminDecision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: confirm }));
    expect(
      await screen.findByText(
        /La revisión cambió mientras la estabas revisando/,
      ),
    ).toBeTruthy();
    expect(adminDecision).toHaveBeenCalledTimes(1);
    expect(adminDecision).toHaveBeenCalledWith(9, payloadAction, {
      observations: "Revisado",
    });
    expect(adminValidationDetail).toHaveBeenCalledTimes(2);
    expect(adminValidationDetail).toHaveBeenLastCalledWith(9);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      (
        screen.getByLabelText(
          "Comentario para el conductor",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("");
  },
);

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("server submission errors identify expired documents and hide sending without a client date predicate", async () => {
  const { api } = driverApi({ documents: [document] });
  const submit = vi.spyOn(api, "submitValidation").mockRejectedValue(
    new ApiError(400, "validation_error", "Invalid", {
      demo_identity_document: ["El documento está vencido."],
    }),
  );
  render(<DriverOnboarding api={api} />);
  await screen.findByRole("button", { name: "Enviar a revisión" });
  expect(screen.queryByText("Aún no puedes enviar")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(await screen.findByText("Aún no puedes enviar")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
  expect(
    screen.getAllByText(/Documento de identidad: El documento está vencido/)
      .length,
  ).toBeGreaterThan(0);
  expect(screen.getByText("! Requiere atención")).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Información enviada a revisión.")).toBeNull();
});

test("submission stays pending and ignores repeated clicks until the server confirms", async () => {
  const { api } = driverApi({ documents: [document] });
  const response = deferred<typeof validation>();
  const submit = vi
    .spyOn(api, "submitValidation")
    .mockImplementation(() => response.promise);
  render(<DriverOnboarding api={api} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Enviar a revisión" }),
  );
  const confirm = screen.getByRole("button", { name: "Confirmar envío" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("button", { name: "Enviando…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByText("Información enviada a revisión.")).toBeNull();
  vi.spyOn(api, "driverProfile").mockResolvedValue({
    ...profile,
    validation_state: "pending",
  });
  response.resolve(validation);
  expect(
    await screen.findByText("Información enviada a revisión."),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Estamos revisando tu información" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
});

test("name change explains and refreshes revalidation while keeping prior requested changes", async () => {
  const { api } = driverApi({
    state: "approved",
    documents: [document],
    observations: "Usa un documento legible.",
  });
  const updated = {
    ...profile,
    display_name: "Servicio sintético nuevo",
    validation_state: "draft",
    current_validation_revision: 2,
  };
  const update = vi
    .spyOn(api, "updateDriverProfile")
    .mockImplementation(async () => {
      vi.spyOn(api, "driverProfile").mockResolvedValue(updated);
      return updated;
    });
  render(<DriverOnboarding api={api} />);
  expect(
    await screen.findByText(
      /Si cambias el nombre del servicio que ya fue aprobado/,
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(/Cambiar la descripción o el correo no reinicia/),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nombre del servicio"), {
    target: { value: "Servicio sintético nuevo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(
    await screen.findByText(/Datos del servicio guardados. Vuelve a enviar/),
  ).toBeTruthy();
  expect(update).toHaveBeenCalledWith({
    display_name: "Servicio sintético nuevo",
    service_summary: "",
    service_contact_email: "",
  });
  expect(
    screen.getByRole("heading", { name: "Completa tu información" }),
  ).toBeTruthy();
  expect(
    screen.getByText("Cambios solicitados en la última revisión"),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Tu información fue aprobada" }),
  ).toBeNull();
});

test("profile constraints use Spanish feedback, preserve the draft and permit explicit correction", async () => {
  const { api } = driverApi();
  const update = vi.spyOn(api, "updateDriverProfile");
  render(<DriverOnboarding api={api} />);
  const email = await screen.findByLabelText("Correo de contacto del servicio");
  fireEvent.change(email, { target: { value: "correo-invalido" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(
    within(email.closest("form")!).getByRole("alert").textContent,
  ).toContain("Revisa los campos obligatorios y su formato.");
  await waitFor(() => expect(window.document.activeElement).toBe(email));
  expect((email as HTMLInputElement).value).toBe("correo-invalido");
  expect(update).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: "demo@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Datos del servicio guardados.");
  expect(update).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ service_contact_email: "demo@example.test" }),
  );
});

test("description/contact save preserves the server approved state and associates field errors", async () => {
  const { api } = driverApi({ state: "approved", documents: [document] });
  const update = vi
    .spyOn(api, "updateDriverProfile")
    .mockRejectedValueOnce(
      new ApiError(400, "validation_error", "Invalid", {
        service_contact_email: ["Ingresa un correo válido."],
      }),
    )
    .mockResolvedValue({ ...profile, validation_state: "approved" });
  render(<DriverOnboarding api={api} />);
  await screen.findByLabelText("Correo de contacto del servicio");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByRole("alert");
  const email = screen.getByLabelText("Correo de contacto del servicio");
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(email.getAttribute("aria-describedby")).toContain("profile-notice");
  expect(screen.getByText(/No aparece en la búsqueda/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Descripción del servicio"), {
    target: { value: "Descripción sintética" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Datos del servicio guardados.");
  expect(update).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole("heading", { name: "Tu información fue aprobada" }),
  ).toBeTruthy();
  expect(email.getAttribute("aria-invalid")).toBe("false");
});

test("upload uses checklist formats/limit, resets selection, and keeps snapshot documents in history", async () => {
  const { api } = driverApi({ state: "approved", documents: [document] });
  vi.spyOn(api, "checklist").mockResolvedValue({
    ...checklist,
    allowed_content_types: ["image/png"],
    max_bytes: 2097152,
  });
  vi.spyOn(api, "validations").mockResolvedValue({
    validation_state: "approved",
    current_validation_revision: 1,
    approved_revision: 1,
    validations: [
      { ...validation, state: "approved", reviewed_at: "2026-09-24T12:00:00Z" },
    ],
  });
  vi.spyOn(api, "upload").mockImplementation(async () => {
    vi.spyOn(api, "documents").mockResolvedValue({
      documents: [{ ...document, id: 8, version: 2 }],
    });
    vi.spyOn(api, "driverProfile").mockResolvedValue({
      ...profile,
      validation_state: "draft",
      current_validation_revision: 2,
    });
    return { ...document, id: 8, version: 2 };
  });
  render(<DriverOnboarding api={api} />);
  const input = await screen.findByLabelText(
    "Archivo para Documento de identidad",
  );
  expect(input.getAttribute("accept")).toBe("image/png");
  expect(
    screen.getByText("Formatos: PNG. Máximo 2 MiB por archivo."),
  ).toBeTruthy();
  fireEvent.change(input, {
    target: {
      files: [new File(["synthetic"], "reemplazo.png", { type: "image/png" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar documento" }));
  await screen.findByText(/Documento reemplazado/);
  expect(screen.queryByText("reemplazo.png")).toBeNull();
  expect(screen.getByText("Revisión aprobada")).toBeTruthy();
  expect(screen.getByText(/Versión 1 · PDF/)).toBeTruthy();
});

test("pending checklist refers only to documents in the submitted snapshot", async () => {
  const { api } = driverApi({ state: "pending", documents: [document] });
  vi.spyOn(api, "validations").mockResolvedValue({
    validation_state: "pending",
    current_validation_revision: 1,
    approved_revision: null,
    validations: [validation],
  });
  render(<DriverOnboarding api={api} />);
  expect(await screen.findByText("◷ En revisión")).toBeTruthy();
  expect(
    screen.getByText(
      "No necesitas enviarla nuevamente mientras esté en revisión.",
    ),
  ).toBeTruthy();
});

test("home keeps the onboarding next action and profile drafts when returning to Mi servicio", async () => {
  const { api } = driverApi();
  function Harness() {
    const [section, setSection] = useState<
      | "profile"
      | "documents"
      | "validation"
      | "summary"
      | "publication"
      | "routes"
      | "requests"
      | "roster"
      | "payments"
    >("profile");
    return (
      <>
        <button onClick={() => setSection("summary")}>Inicio de prueba</button>
        <DriverOnboarding
          api={api}
          activeSection={section}
          onSectionChange={setSection}
        />
      </>
    );
  }
  render(<Harness />);
  fireEvent.change(await screen.findByLabelText("Nombre del servicio"), {
    target: { value: "Borrador privado sintético" },
  });
  fireEvent.click(screen.getByText("Inicio de prueba"));
  const home = screen.getByRole("region", {
    name: "Preparación de mi servicio",
  });
  expect(within(home).getByText("Te falta subir 1 documento.")).toBeTruthy();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  fireEvent.click(
    within(home).getByRole("button", { name: "Ver mi información" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Datos del servicio/ }));
  expect(
    (screen.getByLabelText("Nombre del servicio") as HTMLInputElement).value,
  ).toBe("Borrador privado sintético");
});

test("queue refresh keeps a confirmation pinned to its immutable submission while newer information arrives", async () => {
  const { api, adminDecision, adminValidationDetail } = adminApi();
  const newer = {
    ...adminValidation,
    id: 10,
    revision: 2,
    display_name_snapshot: "Servicio corregido",
  };
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Nota sobre envío original" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  const confirmation = screen.getByRole("alertdialog");
  vi.spyOn(api, "adminValidations").mockResolvedValue({ results: [newer] });
  fireEvent.click(
    screen.getByRole("button", { name: "Actualizar validaciones" }),
  );
  await waitFor(() => expect(adminValidationDetail).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Confirmar aprobación",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(within(confirmation).getByText(/Revisión 1/)).toBeTruthy();
  expect(within(confirmation).queryByText(/Servicio corregido/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));
  await screen.findByText("Decisión guardada correctamente.");
  expect(adminDecision).toHaveBeenCalledWith(9, "approve", {
    observations: "Nota sobre envío original",
  });
  expect(adminValidationDetail).toHaveBeenLastCalledWith(9);
});

test("refresh detects changed expected state, never sends a decision against a superseded submission", async () => {
  const { api, adminDecision, adminValidationDetail } = adminApi();
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  fireEvent.change(
    await screen.findByLabelText("Comentario para el conductor"),
    {
      target: { value: "Nota original" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  adminValidationDetail.mockResolvedValue({
    ...adminValidation,
    state: "superseded",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Actualizar validaciones" }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Confirmar aprobación",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));
  expect(
    await screen.findByText(
      "Esta revisión cambió. Vuelve a revisarla antes de decidir.",
    ),
  ).toBeTruthy();
  expect(adminDecision).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("admin cannot approve without observations; cancellation and pending decision prevent duplicate writes", async () => {
  const { api, adminDecision } = adminApi();
  const response = deferred<AdminValidation>();
  adminDecision.mockImplementation(() => response.promise);
  render(<AdminValidationScreen api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const approve = await screen.findByRole("button", { name: "Aprobar" });
  expect((approve as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Comentario para el conductor"), {
    target: { value: "Nota sintética" },
  });
  approve.focus();
  fireEvent.click(approve);
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  await waitFor(() =>
    expect(globalThis.document.activeElement).toBe(
      screen.getByRole("button", { name: "Aprobar" }),
    ),
  );
  expect(adminDecision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
  const confirm = screen.getByRole("button", { name: "Confirmar aprobación" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(adminDecision).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByText("Decisión guardada correctamente.")).toBeNull();
  response.resolve({
    ...adminValidation,
    state: "approved",
    observations: "Nota sintética",
  });
  await screen.findByText("Decisión guardada correctamente.");
});

test("review header uses the submitted name, keeps current identity separate, and filters remain available", async () => {
  const { api } = adminApi(undefined, {
    ...adminValidation,
    driver: {
      ...adminValidation.driver,
      display_name: "Nombre nuevo sin revisar",
    },
  });
  const queue = vi
    .spyOn(api, "adminValidations")
    .mockResolvedValue({ results: [adminValidation] });
  render(<AdminValidationScreen api={api} />);
  fireEvent.change(screen.getByLabelText("Mostrar"), {
    target: { value: "rejected" },
  });
  await waitFor(() => expect(queue).toHaveBeenCalledWith("rejected"));
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }));
  const heading = await screen.findByRole("heading", {
    name: "Conductor Demo",
    level: 2,
  });
  await waitFor(() => expect(globalThis.document.activeElement).toBe(heading));
  expect(
    screen.getByText(/Nombre actual del servicio: Nombre nuevo sin revisar/),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Volver a validaciones" }),
  );
  expect((screen.getByLabelText("Mostrar") as HTMLSelectElement).value).toBe(
    "rejected",
  );
});

test("missing-document server errors after stale metadata allow correction and resubmission; rejection observations stay in history", async () => {
  const { api } = driverApi({
    state: "rejected",
    documents: [document],
    observations: "Carga el documento sintético faltante.",
  });
  const submit = vi.spyOn(api, "submitValidation").mockRejectedValueOnce(
    new ApiError(400, "validation_error", "Invalid", {
      demo_identity_document: ["Falta el documento demo."],
    }),
  );
  render(<DriverOnboarding api={api} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Enviar a revisión" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(await screen.findByText("Aún no puedes enviar")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
  expect(
    screen.getAllByText("Documento de identidad: Falta el documento demo.")
      .length,
  ).toBeGreaterThan(0);
  fireEvent.change(
    screen.getByLabelText("Archivo para Documento de identidad"),
    {
      target: {
        files: [
          new File(["synthetic"], "demo-correction.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar documento" }));
  await screen.findByText(
    "Documento reemplazado. Los envíos anteriores conservan sus documentos.",
  );
  expect(screen.queryByText("Aún no puedes enviar")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(
    await screen.findByText("Información enviada a revisión."),
  ).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole("heading", { name: "Estamos revisando tu información" }),
  ).toBeTruthy();
  expect(
    screen.getAllByText("Carga el documento sintético faltante.").length,
  ).toBeGreaterThan(0);
});

test("a confirmed submission remains sent when the following refresh fails", async () => {
  const { api, submitValidation } = driverApi({ documents: [document] });
  render(<DriverOnboarding api={api} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Enviar a revisión" }),
  );
  vi.spyOn(api, "driverProfile").mockRejectedValue(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  expect(
    await screen.findByText(
      /La acción fue guardada, pero no pudimos actualizar/,
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Estamos revisando tu información" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
  expect(submitValidation).toHaveBeenCalledTimes(1);
  vi.spyOn(api, "driverProfile").mockResolvedValue({
    ...profile,
    validation_state: "pending",
  });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
  await screen.findByText("Información actualizada.");
  expect(submitValidation).toHaveBeenCalledTimes(1);
});

test("an owner document denial never creates a download URL or exposes another driver's file", async () => {
  const { api } = driverApi({ documents: [document] });
  const create = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  const read = vi
    .spyOn(api, "downloadDocument")
    .mockRejectedValue(new ApiError(404, "not_found", "Hidden document"));
  render(<DriverOnboarding api={api} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Descargar documento" }),
  );
  await screen.findByText(
    /Este documento o envío no está disponible para tu cuenta/,
  );
  expect(read).toHaveBeenCalledWith(7, false);
  expect(create).not.toHaveBeenCalled();
});
