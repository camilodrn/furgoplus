import { useState, type ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ApiError, AuthApi } from "./api";
import type {
  DriverChecklist,
  DriverDocuments,
  DriverProfile,
  DriverValidations,
  Publication,
} from "./api-types";
import { DriverOnboarding } from "./ValidationScreens";

const checklist: DriverChecklist = {
  demo_only: true,
  allowed_content_types: ["application/pdf"],
  max_bytes: 10485760,
  items: [
    {
      kind: "demo_identity_document",
      label: "Identidad",
      requires_expiry: false,
    },
    {
      kind: "demo_vehicle_document",
      label: "Vehículo",
      requires_expiry: false,
    },
    {
      kind: "demo_expiring_credential",
      label: "Credencial",
      requires_expiry: true,
    },
  ],
};
const documents: DriverDocuments = {
  documents: checklist.items.map((item, index) => ({
    id: index + 1,
    version: 1,
    kind: item.kind,
    content_type: "application/pdf",
    byte_size: 20,
    uploaded_at: "2026-10-01T12:00:00Z",
    is_current: true,
    expires_on: item.requires_expiry ? "2026-12-31" : null,
  })),
};
const approvedProfile: DriverProfile = {
  display_name: "Servicio académico",
  service_summary: "Traslados escolares",
  service_contact_email: "servicio@example.test",
  validation_state: "approved",
  current_validation_revision: 1,
  approved_revision: 1,
};
const publication: Publication = {
  profile_status: "active",
  publication_requested: true,
  eligible: true,
  validation_state: "approved",
  current_validation_revision: 1,
  approved_revision: 1,
  blockers: [],
  subscription: null,
  active_route_count: 1,
  coverage: [],
};

function setup({
  profile = approvedProfile,
  files = documents,
  state = publication,
  validations = [],
  readFailure,
}: {
  profile?: DriverProfile;
  files?: DriverDocuments;
  state?: Publication | null;
  validations?: DriverValidations["validations"];
  readFailure?: ApiError;
} = {}) {
  let saved = { ...profile };
  const updateDriverProfile = vi.fn(async (data: Partial<DriverProfile>) => {
    saved = {
      ...saved,
      ...data,
      validation_state: "draft",
      approved_revision: null,
      current_validation_revision: 2,
    };
    return saved;
  });
  const upload = vi.fn(async () => {
    saved = {
      ...saved,
      validation_state: "draft",
      approved_revision: null,
      current_validation_revision: 2,
    };
    return files.documents[0];
  });
  const api = {
    driverProfile: vi.fn(async () => {
      if (readFailure) {
        const failure = readFailure;
        readFailure = undefined;
        throw failure;
      }
      return saved;
    }),
    checklist: async () => checklist,
    documents: async () => files,
    validations: async () => ({ ...saved, validations }),
    updateDriverProfile,
    upload,
  } as unknown as AuthApi;
  function Harness() {
    const [section, setSection] =
      useState<
        NonNullable<ComponentProps<typeof DriverOnboarding>["activeSection"]>
      >("service");
    return (
      <DriverOnboarding
        api={api}
        activeSection={section}
        onSectionChange={setSection}
        publication={state}
      />
    );
  }
  render(<Harness />);
  return { api, updateDriverProfile, upload };
}

afterEach(cleanup);
const overview = () =>
  screen.getByRole("region", { name: "Resumen de mi servicio" });

test.each([
  [true, true, "Visible para apoderados"],
  [false, true, "No visible · publicación solicitada"],
  [false, false, "No visible · sin solicitar"],
])(
  "approved service has a compact entry and independent publication (eligible=%s, requested=%s)",
  async (eligible, requested, label) => {
    setup({
      state: { ...publication, eligible, publication_requested: requested },
    });
    await screen.findByRole("heading", { name: "Resumen de tu servicio" });
    const view = within(overview());
    expect(view.getByText("Aprobado")).toBeTruthy();
    expect(view.getByText(label)).toBeTruthy();
    const data = within(
      view.getByRole("region", { name: "Datos del servicio" }),
    );
    expect(data.getByText(approvedProfile.display_name)).toBeTruthy();
    expect(data.getByText(approvedProfile.service_summary)).toBeTruthy();
    expect(data.getByText(approvedProfile.service_contact_email)).toBeTruthy();
    expect(data.getByText("Datos completos")).toBeTruthy();
    expect(view.getByText("3 de 3 cargados")).toBeTruthy();
    expect(
      view
        .getByText("31/12/2026", { selector: "time" })
        .getAttribute("datetime"),
    ).toBe("2026-12-31");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Prepara tu información" }),
    ).toBeNull();
    expect(screen.queryByText(/Siguiente paso/)).toBeNull();
    const consult = view.getByRole("button", { name: "Consultar publicación" });
    expect(consult.className).toContain(
      eligible ? "button-outline" : "button-primary",
    );
    expect(
      view.queryByRole("region", { name: "Acciones necesarias" }),
    ).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Editar datos" }));
    expect(
      await screen.findByRole("textbox", { name: "Nombre del servicio" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Si cambias el nombre del servicio que ya fue aprobado/),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Descripción del servicio" }),
      { target: { value: "Borrador privado" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Volver al resumen de mi servicio" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Resumen de tu servicio" }),
      ),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(
      within(overview()).getByRole("button", { name: "Editar datos" }),
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "Descripción del servicio",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Borrador privado");
  },
);

test("unknown publication never implies visibility from approval", async () => {
  setup({ state: null });
  await screen.findByText("Sin confirmar");
  expect(within(overview()).getByText("Aprobado")).toBeTruthy();
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Consultar publicación" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Publicación" }),
  ).toBeTruthy();
});

test.each([
  ["", [], "Completar datos del servicio", "Identidad y contacto"],
  ["Listo", [], "Completar documentos", "Documentos requeridos"],
  [
    "Listo",
    documents.documents,
    "Revisar y enviar información",
    "Completa tu información",
  ],
])(
  "draft entry points to the pending task (summary=%s)",
  async (summary, files, action, heading) => {
    setup({
      profile: {
        ...approvedProfile,
        service_summary: summary,
        validation_state: "draft",
        approved_revision: null,
      },
      files: { documents: files },
      state: { ...publication, eligible: false, validation_state: "draft" },
    });
    await screen.findByRole("heading", { name: "Prepara tu información" });
    const button = within(overview()).getByRole("button", { name: action });
    expect(button.className).toContain("button-primary");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(button);
    expect(
      screen.getByRole("heading", { name: heading, level: 2 }),
    ).toBeTruthy();
  },
);

test("pending entry opens the existing review and never asks for another submission", async () => {
  setup({
    profile: {
      ...approvedProfile,
      validation_state: "pending",
      approved_revision: null,
    },
    state: { ...publication, eligible: false, validation_state: "pending" },
  });
  await screen.findByRole("heading", {
    name: "Tu información está en revisión",
  });
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Ver revisión" }),
  );
  expect(
    screen.getByRole("heading", { name: "Estamos revisando tu información" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Enviar a revisión" }),
  ).toBeNull();
});

test("rejected entry leads to requested corrections", async () => {
  setup({
    profile: {
      ...approvedProfile,
      validation_state: "rejected",
      approved_revision: null,
    },
  });
  await screen.findByRole("heading", {
    name: "Revisa los cambios solicitados",
  });
  fireEvent.click(
    within(overview()).getByRole("button", {
      name: "Revisar cambios solicitados",
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Necesitas hacer algunos cambios" }),
  ).toBeTruthy();
});

test("suspended approved account keeps suspension separate and documents reachable", async () => {
  setup({
    state: {
      ...publication,
      profile_status: "suspended",
      eligible: false,
      blockers: [{ code: "driver_suspended", message: "INTERNAL" }],
    },
  });
  await screen.findByText("Tu servicio está suspendido.");
  const view = within(overview());
  expect(view.getByText("Aprobado")).toBeTruthy();
  expect(view.getByText("No visible · publicación solicitada")).toBeTruthy();
  expect(
    view.getByRole("button", { name: "Consultar publicación" }).className,
  ).toContain("button-primary");
  fireEvent.click(view.getByRole("button", { name: "Revisar documentos" }));
  expect(
    screen.getByRole("heading", { name: "Documentos requeridos" }),
  ).toBeTruthy();
});

test("approved entry surfaces expired documents and all publication blockers before opening details", async () => {
  setup({
    state: {
      ...publication,
      eligible: false,
      blockers: [
        { code: "required_document_expired", message: "INTERNAL" },
        { code: "subscription_expired", message: "INTERNAL" },
        { code: "approved_revision_stale", message: "INTERNAL" },
      ],
    },
  });
  await screen.findByRole("heading", { name: "Resumen de tu servicio" });
  expect(screen.getByText("Un documento requerido está vencido.")).toBeTruthy();
  expect(screen.getByText("Tu plan terminó.")).toBeTruthy();
  expect(
    screen.getByText(
      "Los cambios en tu información necesitan una nueva revisión.",
    ),
  ).toBeTruthy();
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Actualizar documentos" }),
  );
  expect(
    screen.getByText(
      /El servidor informa que hay un documento requerido vencido/,
    ),
  ).toBeTruthy();
});

test.each(["profile", "document"])(
  "server invalidation after editing %s returns to preparation",
  async (area) => {
    const { updateDriverProfile, upload } = setup();
    await screen.findByRole("heading", { name: "Resumen de tu servicio" });
    if (area === "profile") {
      fireEvent.click(
        within(overview()).getByRole("button", { name: "Editar datos" }),
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Nombre del servicio" }),
        { target: { value: "Nombre actualizado" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
      await waitFor(() => expect(updateDriverProfile).toHaveBeenCalledOnce());
    } else {
      fireEvent.click(
        within(overview()).getByRole("button", { name: "Revisar documentos" }),
      );
      fireEvent.change(screen.getByLabelText("Archivo para Identidad"), {
        target: {
          files: [new File(["demo"], "demo.pdf", { type: "application/pdf" })],
        },
      });
      expect(
        screen.getByText(/Al reemplazar este documento, tendrás que enviar/),
      ).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: "Reemplazar documento" }),
      );
      await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    }
    await screen.findByText(
      /Vuelve a enviar tu información para que revisemos los cambios/,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Volver al resumen de mi servicio" }),
    );
    expect(
      screen.getByRole("heading", { name: "Prepara tu información" }),
    ).toBeTruthy();
    expect(within(overview()).getByText("Sin enviar")).toBeTruthy();
    expect(within(overview()).queryByText("Aprobado")).toBeNull();
  },
);

test("rejected overview shows only the current revision observations, preserves blockers and permits corrections", async () => {
  const observation =
    "Reemplaza el archivo borroso.\nCorrige el nombre del servicio.";
  setup({
    profile: {
      ...approvedProfile,
      validation_state: "rejected",
      current_validation_revision: 2,
      approved_revision: null,
    },
    state: {
      ...publication,
      eligible: false,
      validation_state: "rejected",
      blockers: [{ code: "required_document_expired", message: "INTERNAL" }],
    },
    validations: [
      {
        id: 1,
        revision: 1,
        state: "rejected",
        observations: "Observaciones de una versión anterior",
        submitted_at: "2026-09-01T12:00:00Z",
        reviewed_at: "2026-09-02T12:00:00Z",
        display_name_snapshot: "Anterior",
        documents: [],
      },
      {
        id: 2,
        revision: 2,
        state: "rejected",
        observations: observation,
        submitted_at: "2026-10-01T12:00:00Z",
        reviewed_at: "2026-10-02T12:00:00Z",
        display_name_snapshot: approvedProfile.display_name,
        documents: [],
      },
    ],
  });
  const attention = await screen.findByRole("region", {
    name: "Acciones necesarias",
  });
  expect(attention.textContent).toContain(observation);
  expect(attention.textContent).not.toContain(
    "Observaciones de una versión anterior",
  );
  expect(
    within(attention).getByText("Un documento requerido está vencido."),
  ).toBeTruthy();
  expect(
    within(attention).getByRole("button", {
      name: "Revisar cambios solicitados",
    }).className,
  ).toContain("button-primary");
  expect(
    within(attention).getByRole("button", {
      name: "Actualizar mis documentos",
    }),
  ).toBeTruthy();
  fireEvent.click(
    within(attention).getByRole("button", { name: "Corregir información" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Nombre del servicio" }),
  ).toBeTruthy();
});

test("rejected overview never substitutes observations from an older revision", async () => {
  setup({
    profile: {
      ...approvedProfile,
      validation_state: "rejected",
      current_validation_revision: 2,
    },
    validations: [
      {
        id: 1,
        revision: 1,
        state: "rejected",
        observations: "Comentario anterior",
        submitted_at: "2026-09-01T12:00:00Z",
        reviewed_at: null,
        display_name_snapshot: "Anterior",
        documents: [],
      },
    ],
  });
  const attention = await screen.findByRole("region", {
    name: "Acciones necesarias",
  });
  expect(attention.textContent).not.toContain("Comentario anterior");
  fireEvent.click(
    within(attention).getByRole("button", {
      name: "Revisar cambios solicitados",
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Historial de revisiones" }),
  ).toBeTruthy();
  expect(screen.getAllByText("Comentario anterior").length).toBeGreaterThan(0);
});

test.each([
  ["suspended", "Tu servicio está suspendido."],
  ["deactivated", "Tu servicio está desactivado."],
] as const)(
  "%s remains prominent without a matching blocker",
  async (profile_status, message) => {
    setup({ state: { ...publication, profile_status, eligible: false } });
    const attention = await screen.findByRole("region", {
      name: "Acciones necesarias",
    });
    expect(within(attention).getByText(message)).toBeTruthy();
    expect(within(overview()).getByText("Aprobado")).toBeTruthy();
    expect(
      within(attention).getByRole("button", { name: "Consultar publicación" })
        .className,
    ).toContain("button-primary");
  },
);

test("account inactivity and suspension blockers are visible even if profile_status is active", async () => {
  setup({
    state: {
      ...publication,
      eligible: false,
      blockers: [
        { code: "account_inactive", message: "INTERNAL" },
        { code: "driver_suspended", message: "INTERNAL" },
        { code: "active_route_missing", message: "INTERNAL" },
      ],
    },
  });
  const attention = await screen.findByRole("region", {
    name: "Acciones necesarias",
  });
  expect(within(attention).getByText("Tu cuenta no está activa.")).toBeTruthy();
  expect(
    within(attention).getByText("Tu servicio está suspendido."),
  ).toBeTruthy();
  expect(
    within(attention).getByRole("button", { name: "Consultar publicación" }),
  ).toBeTruthy();
  expect(
    within(attention).getByRole("button", { name: "Configurar una ruta" }),
  ).toBeTruthy();
  expect(attention.textContent).not.toContain("INTERNAL");
});

test("required missing expiry stays pending and an old file does not complete the checklist", async () => {
  setup({
    files: {
      documents: documents.documents.map((file) => ({
        ...file,
        is_current: file.kind !== "demo_identity_document",
        expires_on: null,
      })),
    },
  });
  await screen.findByRole("region", { name: "Acciones necesarias" });
  const docs = within(
    within(overview()).getByRole("region", { name: "Documentos" }),
  );
  expect(docs.getByText("2 de 3 cargados")).toBeTruthy();
  expect(docs.getByText("Pendiente")).toBeTruthy();
  expect(docs.getByText("Falta fecha de vencimiento")).toBeTruthy();
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Completar documentos" }),
  );
  expect(
    screen.getByRole("heading", { name: "Documentos requeridos" }),
  ).toBeTruthy();
});

test("document dates are displayed exactly and ordered without inferring validity from the browser clock", async () => {
  setup({
    files: {
      documents: documents.documents.map((file) => ({
        ...file,
        expires_on:
          file.kind === "demo_identity_document"
            ? "2099-01-02"
            : file.kind === "demo_expiring_credential"
              ? "2000-02-03"
              : null,
      })),
    },
  });
  await screen.findByRole("heading", { name: "Resumen de tu servicio" });
  const docs = within(
    within(overview()).getByRole("region", { name: "Documentos" }),
  );
  const rows = docs.getAllByRole("listitem");
  expect(rows[0]!.textContent).toContain("Credencial");
  expect(rows[0]!.querySelector("time")?.getAttribute("datetime")).toBe(
    "2000-02-03",
  );
  expect(rows[0]!.textContent).toContain("03/02/2000");
  expect(rows[1]!.textContent).toContain("02/01/2099");
  expect(within(overview()).getByText("Visible para apoderados")).toBeTruthy();
  expect(
    within(overview()).queryByRole("region", { name: "Acciones necesarias" }),
  ).toBeNull();
  expect(
    within(overview()).queryByText(/Vigente|Vencido|Por vencer/),
  ).toBeNull();
});

test.each([
  [403, "forbidden", "Tu sesión no permite esta acción."],
  [503, "unavailable", "Revisa los datos e inténtalo nuevamente."],
])(
  "overview preserves read errors and offers retry (%s)",
  async (status, code, message) => {
    const { api, updateDriverProfile, upload } = setup({
      readFailure: new ApiError(status, code, "INTERNAL"),
    });
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(
      screen.queryByRole("region", { name: "Resumen de mi servicio" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    await screen.findByRole("heading", { name: "Resumen de tu servicio" });
    expect(api.driverProfile).toHaveBeenCalledTimes(2);
    expect(updateDriverProfile).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  },
);

test("failed save from the overview keeps the editor error and draft until an explicit successful retry", async () => {
  const { updateDriverProfile } = setup();
  updateDriverProfile.mockRejectedValueOnce(
    new ApiError(400, "validation_error", "INTERNAL", {
      service_contact_email: ["Ingresa un correo válido."],
    }),
  );
  await screen.findByRole("heading", { name: "Resumen de tu servicio" });
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Editar datos" }),
  );
  const field = screen.getByRole("textbox", {
    name: "Correo de contacto del servicio",
  });
  fireEvent.change(field, { target: { value: "nuevo@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Ingresa un correo válido.",
  );
  expect(field.getAttribute("aria-invalid")).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "Volver al resumen de mi servicio" }),
  );
  expect(
    within(overview()).getByText(approvedProfile.service_contact_email),
  ).toBeTruthy();
  fireEvent.click(
    within(overview()).getByRole("button", { name: "Editar datos" }),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Correo de contacto del servicio",
      }) as HTMLInputElement
    ).value,
  ).toBe("nuevo@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/Datos del servicio guardados/);
  fireEvent.click(
    screen.getByRole("button", { name: "Volver al resumen de mi servicio" }),
  );
  expect(within(overview()).getByText("nuevo@example.test")).toBeTruthy();
  expect(within(overview()).getByText("Sin enviar")).toBeTruthy();
  expect(updateDriverProfile).toHaveBeenCalledTimes(2);
});
