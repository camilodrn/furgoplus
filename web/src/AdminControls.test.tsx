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
import { AdminControlScreen } from "./AdminControls";
import { ApiError, AuthApi } from "./api";
import { humanChileanDate } from "./dates";
import type {
  AdminDriver,
  AdminDriverHistory,
  AdminDriverValidations,
} from "./api-types";

const initial: AdminDriver = {
  id: 7,
  display_name: "Conductor Demo",
  email: "driver@example.test",
  profile_version: null,
  publication: {
    profile_status: "active",
    publication_requested: true,
    eligible: true,
    blockers: [],
    validation_state: "approved",
    current_validation_revision: 2,
    approved_revision: 2,
    subscription: {
      plan_code: "basic",
      plan_label: "Basic",
      status: "active",
      starts_at: "2026-10-01T03:00:00Z",
      ends_at: "2026-11-01T03:00:00Z",
    },
    active_route_count: 1,
    coverage: [],
  },
};
const revisions: AdminDriverValidations = {
  count: 1,
  results: [
    {
      id: 4,
      revision: 1,
      state: "rejected",
      submitted_at: "2026-09-28T12:00:00Z",
      reviewed_at: "2026-09-28T13:00:00Z",
      observations: "Reemplaza el documento",
      display_name_snapshot: "Conductor Demo",
    },
  ],
};
const history: AdminDriverHistory = {
  count: 1,
  results: [
    {
      id: 8,
      actor: { id: 3, display_name: "admin@example.test" },
      action: "validation_rejected",
      target_type: "validation",
      target_id: 4,
      occurred_at: "2026-09-28T13:00:00Z",
      correlation_id: "synthetic-id",
      reason: "Reemplaza el documento",
      before: { status: "pending" },
      after: { status: "rejected" },
    },
  ],
};
function fixture() {
  let driver = structuredClone(initial);
  let subscriptionVersion = 8;
  const api = {
    adminDrivers: vi.fn(async (_filters: URLSearchParams) => ({
      results: [driver],
      count: 1,
    })),
    adminDriver: vi.fn(async () => driver),
    adminDriverHistory: vi.fn(async () => history),
    adminDriverValidations: vi.fn(async () => revisions),
    plans: vi.fn(async () => ({
      plans: [
        { code: "basic", display_label: "Basic" },
        { code: "pro", display_label: "Pro" },
        { code: "elite", display_label: "Elite" },
      ],
    })),
    adminSubscription: vi.fn(async () => ({
      publication: driver.publication,
      version: subscriptionVersion,
    })),
    changeSubscription: vi.fn(async (_id, input) => {
      driver = {
        ...driver,
        publication: {
          ...driver.publication,
          subscription: {
            ...driver.publication.subscription!,
            plan_code: input.plan_code,
            plan_label: "Elite",
            status: input.status,
          },
          eligible: input.status === "active",
          blockers:
            input.status === "active"
              ? []
              : [
                  {
                    code: "subscription_suspended",
                    message: "Plan suspendido",
                  },
                ],
        },
      };
      subscriptionVersion += 1;
      return { publication: driver.publication, version: subscriptionVersion };
    }),
    changeProfileStatus: vi.fn(async (_id, input) => {
      driver = {
        ...driver,
        profile_version: 9,
        publication: {
          ...driver.publication,
          profile_status: input.status,
          eligible: input.status === "active",
          blockers:
            input.status === "active"
              ? []
              : [
                  {
                    code:
                      input.status === "deactivated"
                        ? "driver_deactivated"
                        : "driver_suspended",
                    message: "Perfil restringido",
                  },
                ],
        },
      };
      return driver;
    }),
  };
  return {
    api: api as unknown as AuthApi,
    mock: api,
    replace: (current: AdminDriver, version = subscriptionVersion) => {
      driver = current;
      subscriptionVersion = version;
    },
  };
}
afterEach(cleanup);

test.each([390, 1280])(
  "validation context at %spx reveals small newest-first batches and exact observations across server pages",
  async (width) => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    try {
      const { api, mock } = fixture();
      const entries = Array.from({ length: 54 }, (_, index) => ({
        ...revisions.results[0]!,
        id: 100 - index,
        revision: 54 - index,
        state: index === 0 ? ("approved" as const) : ("rejected" as const),
        observations:
          index === 1
            ? ""
            : `Observación retenida ${index + 1}.\nTexto exacto.`,
        reviewed_at: new Date(
          Date.UTC(2026, 9, 6, 12) - index * 60000,
        ).toISOString(),
      }));
      mock.adminDriverValidations.mockImplementation(
        async (_id?: number, offset = 0) => ({
          count: entries.length,
          results: entries.slice(offset, offset + 25),
        }),
      );
      render(<AdminControlScreen api={api} />);
      await open();
      const summary = screen
        .getByText("Validación y observaciones")
        .closest("summary")!;
      expect(summary.textContent).toContain("Aprobada");
      expect(summary.closest("details")!.open).toBe(false);
      const context = disclosure("Validación y observaciones");
      expect(context.getAllByRole("listitem")).toHaveLength(3);
      expect(
        context.getAllByRole("heading").map((node) => node.textContent),
      ).toEqual(["Aprobada", "Con observaciones", "Con observaciones"]);
      expect(context.getByRole("status").textContent).toBe(
        "Mostrando 3 de 54 validaciones. Más recientes primero.",
      );
      expect(context.getByText("Sin observaciones.")).toBeTruthy();
      expect(context.queryByText(/Observación retenida/)).toBeNull();
      expect(
        context
          .getAllByRole("button", { name: "Ver observación" })
          .every((button) => button.getAttribute("aria-expanded") === "false"),
      ).toBe(true);
      const first = within(context.getAllByRole("listitem")[0]!);
      fireEvent.click(first.getByRole("button", { name: "Ver observación" }));
      expect(
        document.getElementById("admin-validation-observation-100")
          ?.textContent,
      ).toBe(entries[0]!.observations);
      expect(context.getAllByText(/Observación retenida/)).toHaveLength(1);
      fireEvent.click(
        first.getByRole("button", { name: "Ocultar observación" }),
      );
      expect(context.queryByText(/Observación retenida/)).toBeNull();

      for (const pageEnd of [25, 50, 54]) {
        while (context.getAllByRole("listitem").length < pageEnd) {
          const before = context.getAllByRole("listitem").length;
          const calls = mock.adminDriverValidations.mock.calls.length;
          const reveal = context.getByRole("button", {
            name: "Ver validaciones anteriores",
          });
          reveal.focus();
          fireEvent.click(reveal);
          expect(context.getAllByRole("listitem")).toHaveLength(
            Math.min(pageEnd, before + 3),
          );
          expect(document.activeElement).toBe(
            context.getAllByRole("heading")[before],
          );
          expect(mock.adminDriverValidations).toHaveBeenCalledTimes(calls);
        }
        if (pageEnd === 54) break;
        const older = deferred<AdminDriverValidations>();
        mock.adminDriverValidations.mockReturnValueOnce(older.promise);
        fireEvent.click(
          context.getByRole("button", { name: "Ver validaciones anteriores" }),
        );
        expect(context.getAllByRole("listitem")).toHaveLength(pageEnd);
        expect(mock.adminDriverValidations).toHaveBeenLastCalledWith(
          7,
          pageEnd,
        );
        expect(
          (
            context.getByRole("button", {
              name: "Cargando validaciones…",
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(true);
        await act(async () =>
          older.resolve({
            count: entries.length,
            results: entries.slice(pageEnd, pageEnd + 25),
          }),
        );
        expect(context.getAllByRole("listitem")).toHaveLength(pageEnd + 3);
        expect(document.activeElement).toBe(
          context.getAllByRole("heading")[pageEnd],
        );
      }
      expect(
        context
          .getAllByRole("listitem")
          .map((item) => item.querySelector("time")?.dateTime),
      ).toEqual(entries.map((entry) => entry.reviewed_at));
      expect(context.getAllByRole("listitem")[0]!.textContent).toContain(
        humanChileanDate(entries[0]!.reviewed_at),
      );
      expect(
        context.queryByRole("button", { name: "Ver validaciones anteriores" }),
      ).toBeNull();
      expect(mock.adminDriverValidations.mock.calls).toEqual([
        [7, 0],
        [7, 25],
        [7, 50],
      ]);
      expect(summary.textContent).toContain("Aprobada");
      // Check exact retained text at both ends of every server page.
      const items = context.getAllByRole("listitem");
      for (const index of [0, 24, 25, 49, 50, 53]) {
        const item = items[index]!;
        const row = within(item);
        fireEvent.click(row.getByRole("button", { name: "Ver observación" }));
        expect(
          item.querySelector(".admin-validation-observation")?.textContent,
        ).toBe(entries[index]!.observations);
        fireEvent.click(
          row.getByRole("button", { name: "Ocultar observación" }),
        );
      }
      fireEvent.click(first.getByRole("button", { name: "Ver observación" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Actualizar conductor" }),
      );
      await waitFor(() =>
        expect(mock.adminDriverValidations).toHaveBeenLastCalledWith(7, 0),
      );
      await waitFor(() =>
        expect(context.getAllByRole("listitem")).toHaveLength(3),
      );
      expect(context.queryByText(/Observación retenida/)).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: previousWidth,
      });
    }
  },
  15000,
);

test("changing driver clears observation disclosure and rejects a late validation page from the previous driver", async () => {
  const { api, mock } = fixture();
  const other = { ...initial, id: 8, display_name: "Otro conductor" };
  mock.adminDrivers.mockResolvedValue({ results: [initial, other], count: 2 });
  mock.adminDriver.mockImplementation(async (id?: number) =>
    id === 8 ? other : initial,
  );
  mock.adminDriverValidations.mockResolvedValueOnce({
    ...revisions,
    count: 26,
  });
  render(<AdminControlScreen api={api} />);
  fireEvent.click(
    (await screen.findAllByRole("button", { name: "Ver conductor" }))[0]!,
  );
  await screen.findByRole("region", { name: "Estado del servicio" });
  const context = disclosure("Validación y observaciones");
  fireEvent.click(context.getByRole("button", { name: "Ver observación" }));
  expect(context.getByText("Reemplaza el documento")).toBeTruthy();
  const old = deferred<AdminDriverValidations>();
  mock.adminDriverValidations.mockReturnValueOnce(old.promise);
  fireEvent.click(
    context.getByRole("button", { name: "Ver validaciones anteriores" }),
  );
  await waitFor(() =>
    expect(mock.adminDriverValidations).toHaveBeenLastCalledWith(7, 25),
  );
  fireEvent.click(screen.getByRole("button", { name: "Volver a conductores" }));
  mock.adminDriverValidations.mockResolvedValueOnce({
    count: 1,
    results: [
      {
        ...revisions.results[0]!,
        id: 9,
        observations: "Observación del segundo conductor",
      },
    ],
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Ver conductor" })[1]!);
  await screen.findByRole("heading", { name: "Otro conductor" });
  await waitFor(() =>
    expect(mock.adminDriverValidations).toHaveBeenLastCalledWith(8, 0),
  );
  await act(async () =>
    old.resolve({
      count: 1,
      results: [
        {
          ...revisions.results[0]!,
          observations: "Observación tardía del primer conductor",
        },
      ],
    }),
  );
  expect(
    screen.getByText("Validación y observaciones").closest("details")!.open,
  ).toBe(false);
  const next = disclosure("Validación y observaciones");
  expect(next.queryByText(/Observación|Reemplaza el documento/)).toBeNull();
  fireEvent.click(next.getByRole("button", { name: "Ver observación" }));
  expect(next.getByText("Observación del segundo conductor")).toBeTruthy();
  expect(
    next.queryByText(/primer conductor|Reemplaza el documento/),
  ).toBeNull();
});

test.each([390, 1280])(
  "dialog semantics and cancel focus remain available at a %spx viewport",
  async (width) => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    try {
      const { api } = fixture();
      render(<AdminControlScreen api={api} />);
      await open();
      for (const action of ["Desactivar perfil", "Administrar plan"]) {
        const trigger = screen.getByRole("button", { name: action });
        trigger.focus();
        fireEvent.click(trigger);
        const modal = screen.getByRole("dialog", {
          name: `${action}: Conductor Demo`,
        });
        expect(modal.getAttribute("aria-modal")).toBe("true");
        expect(document.activeElement).toBe(within(modal).getByRole("heading"));
        if (action === "Administrar plan") {
          for (const label of [
            "Plan",
            "Estado del plan",
            "Fecha de inicio",
            "Hora de inicio",
            "Fecha de término",
            "Hora de término",
            "Motivo",
          ]) {
            expect(within(modal).getByLabelText(label)).toBeTruthy();
          }
        } else {
          expect(
            within(modal).getByLabelText("Motivo del cambio de perfil"),
          ).toBeTruthy();
        }
        if (action === "Desactivar perfil") {
          fireEvent(modal, new Event("cancel", { cancelable: true }));
        } else {
          fireEvent.click(
            within(modal).getByRole("button", { name: "Cerrar" }),
          );
        }
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(trigger);
      }
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: previousWidth,
      });
    }
  },
);

test("blocker disclosure preserves server order, primary reason and all seven requirements", async () => {
  const { api, replace } = fixture();
  const codes = [
    "validation_not_approved",
    "subscription_missing",
    "active_route_missing",
    "publication_not_requested",
    "required_document_missing",
    "profile_summary_missing",
    "service_contact_email_missing",
  ] as const;
  replace({
    ...initial,
    publication: {
      ...initial.publication,
      eligible: false,
      blockers: codes.map((code) => ({ code, message: "Server detail" })),
    },
  });
  render(<AdminControlScreen api={api} />);
  await open();
  const service = within(
    screen.getByRole("region", { name: "Estado del servicio" }),
  );
  expect(service.getByText("No visible para apoderados")).toBeTruthy();
  expect(service.getByText("Faltan 7 requisitos.")).toBeTruthy();
  expect(service.getByText("La validación aún no está aprobada.").tagName).toBe(
    "STRONG",
  );
  expect(
    service.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["Falta un plan activo.", "Falta una ruta activa y completa."]);
  expect(service.queryByText("Falta la descripción del servicio.")).toBeNull();
  const reveal = service.getByRole("button", {
    name: "Ver los 4 requisitos restantes",
  });
  expect(reveal.getAttribute("aria-expanded")).toBe("false");
  expect(
    document.getElementById(reveal.getAttribute("aria-controls")!)?.tagName,
  ).toBe("UL");
  fireEvent.click(reveal);
  expect(reveal.getAttribute("aria-expanded")).toBe("true");
  expect(service.getAllByRole("listitem")).toHaveLength(6);
  expect(
    service.getByText("Falta el correo de contacto del servicio."),
  ).toBeTruthy();
  fireEvent.click(service.getByRole("button", { name: "Ocultar requisitos" }));
  expect(service.getAllByRole("listitem")).toHaveLength(2);
  expect(service.getByText("La validación aún no está aprobada.")).toBeTruthy();
  fireEvent.click(reveal);
  expect(service.getAllByRole("listitem")).toHaveLength(6);
});

test("profile modal opens on demand, validates in Spanish, retains the draft and traps focus", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  for (const title of [
    "Validación y observaciones",
    "Historial administrativo",
  ]) {
    expect(screen.getByText(title).closest("details")!.open).toBe(false);
  }
  const trigger = screen.getByRole("button", { name: "Suspender perfil" });
  trigger.focus();
  fireEvent.click(trigger);
  const modal = screen.getByRole("dialog", {
    name: "Suspender perfil: Conductor Demo",
  });
  expect(modal.tagName).toBe("DIALOG");
  expect(modal.getAttribute("aria-modal")).toBe("true");
  expect(modal.hasAttribute("open")).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  const reason = within(modal).getByLabelText(
    "Motivo del cambio de perfil",
  ) as HTMLTextAreaElement;
  expect(reason.closest("form")!.noValidate).toBe(true);
  expect(reason.required).toBe(false);
  fireEvent.change(reason, { target: { value: "   " } });
  fireEvent.click(
    within(modal).getByRole("button", { name: "Revisar cambio de perfil" }),
  );
  expect(document.activeElement).toBe(reason);
  expect(reason.value).toBe("   ");
  expect(reason.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(reason.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("Ingresa el motivo del cambio.");
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  const close = within(modal).getByRole("button", { name: "Cerrar" });
  fireEvent.keyDown(reason, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab" });
  expect(document.activeElement).toBe(reason);
  fireEvent.click(close);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
});

test("profile server failure stays readable inside the modal and keeps the reason", async () => {
  const { api, mock } = fixture();
  mock.changeProfileStatus.mockRejectedValueOnce(new Error("offline"));
  render(<AdminControlScreen api={api} />);
  await open();
  profile("Suspender perfil", "Motivo conservado en el diálogo");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
  const modal = await screen.findByRole("dialog", {
    name: "Suspender perfil: Conductor Demo",
  });
  expect((await within(modal).findByRole("alert")).textContent).toBe(
    "No pudimos obtener una respuesta. Revisa tu conexión.",
  );
  expect(
    (
      within(modal).getByLabelText(
        "Motivo del cambio de perfil",
      ) as HTMLTextAreaElement
    ).value,
  ).toBe("Motivo conservado en el diálogo");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(mock.changeProfileStatus).toHaveBeenCalledTimes(1);
});

test("plan modal validates required fields in Spanish, focuses the first error and preserves drafts", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  const trigger = screen.getByRole("button", { name: "Administrar plan" });
  expect(screen.queryByLabelText("Fecha de inicio")).toBeNull();
  trigger.focus();
  fireEvent.click(trigger);
  const modal = screen.getByRole("dialog", {
    name: "Administrar plan: Conductor Demo",
  });
  expect(modal.tagName).toBe("DIALOG");
  expect(modal.getAttribute("aria-modal")).toBe("true");
  const fields = within(modal);
  const reason = fields.getByLabelText("Motivo") as HTMLTextAreaElement;
  expect(reason.closest("form")!.noValidate).toBe(true);
  expect(reason.closest("form")!.querySelectorAll("[required]")).toHaveLength(
    0,
  );
  fireEvent.change(fields.getByLabelText("Plan"), {
    target: { value: "elite" },
  });
  fireEvent.change(reason, { target: { value: "   " } });
  fireEvent.click(fields.getByRole("button", { name: "Guardar plan" }));
  expect(document.activeElement).toBe(reason);
  expect(reason.value).toBe("   ");
  expect(reason.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(reason.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("Ingresa el motivo del cambio de plan.");
  const start = fields.getByLabelText("Fecha de inicio") as HTMLInputElement;
  const startTime = fields.getByLabelText("Hora de inicio") as HTMLInputElement;
  fireEvent.change(start, { target: { value: "" } });
  fireEvent.change(startTime, { target: { value: "" } });
  fireEvent.click(fields.getByRole("button", { name: "Guardar plan" }));
  expect(document.activeElement).toBe(start);
  expect(start.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(start.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toContain("Ingresa una fecha de inicio válida");
  expect(startTime.getAttribute("aria-invalid")).toBe("true");
  expect(fields.getByText("Ingresa la hora de inicio.")).toBeTruthy();
  expect((fields.getByLabelText("Plan") as HTMLSelectElement).value).toBe(
    "elite",
  );
  expect(reason.value).toBe("   ");
  expect(mock.changeSubscription).not.toHaveBeenCalled();
  fireEvent.click(
    fields.getByRole("button", { name: "Abrir calendario de fecha de inicio" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(
    screen.getByRole("dialog", { name: "Administrar plan: Conductor Demo" }),
  ).toBe(modal);
  expect(
    fields.queryByRole("dialog", { name: "Calendario de fecha de inicio" }),
  ).toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

async function open() {
  fireEvent.click(await screen.findByRole("button", { name: "Ver conductor" }));
  await screen.findByRole("region", { name: "Estado del servicio" });
  await screen.findByRole("button", { name: "Administrar plan" });
}
function profile(action = "Suspender perfil", reason = "Revisión manual") {
  fireEvent.click(screen.getByRole("button", { name: action }));
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: reason },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Revisar cambio de perfil" }),
  );
}
function disclosure(title: string) {
  const summary = screen.getByText(title).closest("summary")!;
  fireEvent.click(summary);
  summary.parentElement!.setAttribute("open", "");
  return within(summary.parentElement!);
}

test("queue submits authoritative filters, paginates, and renders empty/retry", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await screen.findByText("1 conductor");
  fireEvent.change(screen.getByLabelText("Buscar conductor"), {
    target: { value: "Demo" },
  });
  fireEvent.click(screen.getByText("Filtros"));
  fireEvent.change(screen.getByLabelText("Estado de validación"), {
    target: { value: "approved" },
  });
  fireEvent.change(screen.getByLabelText("Estado del perfil"), {
    target: { value: "suspended" },
  });
  fireEvent.change(screen.getByLabelText("Plan asignado"), {
    target: { value: "elite" },
  });
  fireEvent.change(screen.getByLabelText("Estado del plan"), {
    target: { value: "active" },
  });
  fireEvent.change(screen.getByLabelText("Visibilidad"), {
    target: { value: "blocked" },
  });
  mock.adminDrivers.mockResolvedValueOnce({ results: [], count: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await screen.findByText("No hay conductores con estos filtros.");
  const params = mock.adminDrivers.mock.calls.at(
    -1,
  )![0] as unknown as URLSearchParams;
  expect(Object.fromEntries(params)).toEqual({
    q: "Demo",
    validation_state: "approved",
    profile_status: "suspended",
    plan_code: "elite",
    subscription_status: "active",
    publication: "blocked",
    offset: "0",
    limit: "25",
  });
  mock.adminDrivers.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByText("Actualizar lista"));
  await screen.findByRole("alert");
  mock.adminDrivers.mockResolvedValue({ results: [initial], count: 26 });
  fireEvent.click(screen.getByText("Actualizar lista"));
  await screen.findByText("26 conductores");
  const navigation = within(
    screen.getByRole("navigation", { name: "Páginas de conductores" }),
  );
  expect(navigation.getByText("Página 1 de 2")).toBeTruthy();
  expect(
    (
      navigation.getByRole("button", {
        name: "← Anterior",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(navigation.getByRole("button", { name: "Siguiente →" }));
  await waitFor(() =>
    expect(
      (
        mock.adminDrivers.mock.calls.at(-1)![0] as unknown as URLSearchParams
      ).get("offset"),
    ).toBe("25"),
  );
  await screen.findByText("Página 2 de 2");
  expect(
    (screen.getByRole("button", { name: "Siguiente →" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "← Anterior" }));
  await screen.findByText("Página 1 de 2");
  expect(
    (mock.adminDrivers.mock.calls.at(-1)![0] as URLSearchParams).get("offset"),
  ).toBe("0");
});

test("detail shows retained observations, allowlisted history and profile confirmation with reason", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  const observations = disclosure("Validación y observaciones");
  expect(observations.queryByText("Reemplaza el documento")).toBeNull();
  fireEvent.click(
    observations.getByRole("button", { name: "Ver observación" }),
  );
  expect(observations.getByText("Reemplaza el documento")).toBeTruthy();
  const timeline = disclosure("Historial administrativo");
  expect(timeline.getByText(/admin@example.test/)).toBeTruthy();
  expect(timeline.queryByText("Antes")).toBeNull();
  const changes = timeline.getByText("Ver cambios").closest("details")!;
  fireEvent.click(within(changes).getByText("Ver cambios"));
  changes.open = true;
  fireEvent(changes, new Event("toggle"));
  expect(timeline.getByText("Detalles técnicos").closest("details")!.open).toBe(
    false,
  );
  fireEvent.click(timeline.getByText("Detalles técnicos"));
  expect(timeline.getByText(/synthetic-id/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Suspender perfil" }));
  expect(
    (screen.getByText("Revisar cambio de perfil") as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Revisión manual" },
  });
  fireEvent.click(screen.getByText("Revisar cambio de perfil"));
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(within(dialog).getByText("Confirmar cambio"));
  await screen.findByText("Perfil suspendido");
  await waitFor(() =>
    expect(mock.changeProfileStatus).toHaveBeenCalledWith(7, {
      status: "suspended",
      expected_status: "active",
      expected_version: null,
      reason: "Revisión manual",
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Estado del servicio" }).textContent,
    ).toContain("Suspendido"),
  );
  await waitFor(() =>
    expect(mock.adminDriverHistory.mock.calls.length).toBeGreaterThan(1),
  );
});

test("plan mutation reuses explicit validity/version and refreshes integrated history", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Plan"), {
    target: { value: "elite" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Cambio de plan" },
  });
  fireEvent.click(screen.getByText("Guardar plan"));
  await screen.findByText("Plan actualizado");
  expect(mock.changeSubscription).toHaveBeenCalledWith(
    7,
    expect.objectContaining({
      plan_code: "elite",
      expected_version: 8,
      reason: "Cambio de plan",
      starts_at: "2026-10-01T03:00:00.000Z",
      ends_at: "2026-11-01T03:00:00.000Z",
    }),
  );
  await waitFor(() =>
    expect(mock.adminDriverHistory.mock.calls.length).toBeGreaterThan(1),
  );
});

test("conflict preserves reason, refreshes current profile version and allows explicit retry", async () => {
  const { api, mock, replace } = fixture();
  mock.changeProfileStatus.mockImplementationOnce(async () => {
    replace({ ...initial, profile_version: 12 });
    throw new ApiError(409, "stale_state", "Conflict", {});
  });
  render(<AdminControlScreen api={api} />);
  await open();
  profile("Suspender perfil", "Motivo conservado");
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText(/El estado de este conductor cambió/);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Suspender perfil",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Suspender perfil" }));
  expect(
    (
      screen.getByLabelText(
        "Motivo del cambio de perfil",
      ) as HTMLTextAreaElement
    ).value,
  ).toBe("Motivo conservado");
  expect(mock.adminDriver.mock.calls.length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByText("Revisar cambio de perfil"));
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText("Perfil suspendido");
  expect(
    mock.changeProfileStatus.mock.calls[0]![1].expected_version,
  ).toBeNull();
  expect(mock.changeProfileStatus.mock.calls[1]![1]).toMatchObject({
    status: "suspended",
    expected_status: "active",
    expected_version: 12,
  });
});

test.each([
  ["not_authenticated", "La sesión caducó"],
  ["permission_denied", "Tu sesión no permite"],
])("queue handles %s without exposing control data", async (code, message) => {
  const { api, mock } = fixture();
  mock.adminDrivers.mockRejectedValueOnce(
    new ApiError(403, code, "Denied", {}),
  );
  render(<AdminControlScreen api={api} />);
  expect((await screen.findByRole("alert")).textContent).toContain(message);
  expect(screen.queryByText("driver@example.test")).toBeNull();
});

test("history refresh preserves deactivation intent and its original concurrency snapshot", async () => {
  const { api, mock, replace } = fixture();
  mock.adminDriverHistory.mockResolvedValue({ ...history, count: 26 });
  render(<AdminControlScreen api={api} />);
  await open();
  disclosure("Historial administrativo");
  profile("Desactivar perfil", "Desactivar por revisión");
  expect(screen.getByRole("alertdialog").textContent).toContain("Desactivado");
  replace({
    ...initial,
    profile_version: 20,
    publication: {
      ...initial.publication,
      profile_status: "suspended",
      eligible: false,
      blockers: [{ code: "driver_suspended", message: "Conductor suspendido" }],
    },
  });
  mock.changeProfileStatus.mockRejectedValueOnce(
    new ApiError(409, "stale_state", "Conflict"),
  );
  fireEvent.click(screen.getByText("Ver acciones anteriores"));
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Estado del servicio" }).textContent,
    ).toContain("Suspendido"),
  );
  expect(screen.getByRole("alertdialog").textContent).toContain("Desactivado");
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText(/El estado de este conductor cambió/);
  expect(mock.changeProfileStatus).toHaveBeenCalledExactlyOnceWith(7, {
    status: "deactivated",
    reason: "Desactivar por revisión",
    expected_status: "active",
    expected_version: null,
  });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("refresh without a pending confirmation updates the current profile and version", async () => {
  const { api, mock, replace } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  replace({
    ...initial,
    profile_version: 20,
    publication: {
      ...initial.publication,
      profile_status: "suspended",
      eligible: false,
      blockers: [{ code: "driver_suspended", message: "Conductor suspendido" }],
    },
  });
  fireEvent.click(screen.getByText("Actualizar conductor"));
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Estado del servicio" }).textContent,
    ).toContain("Suspendido"),
  );
  expect(screen.getByRole("button", { name: "Reactivar perfil" })).toBeTruthy();
  profile("Desactivar perfil", "Revisión actualizada");
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await waitFor(() =>
    expect(mock.changeProfileStatus).toHaveBeenCalledWith(7, {
      status: "deactivated",
      reason: "Revisión actualizada",
      expected_status: "suspended",
      expected_version: 20,
    }),
  );
});

test("overall refresh and retry read subscription eligibility even when profile version is unchanged, without writes", async () => {
  const { api, mock, replace } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  const panel = () =>
    within(screen.getByRole("region", { name: "Plan del conductor" }));
  const summary = () =>
    within(screen.getByRole("region", { name: "Estado del servicio" }));
  expect(summary().getByText("Visible para apoderados")).toBeTruthy();
  expect(panel().getByText("Activo")).toBeTruthy();
  replace(
    {
      ...initial,
      publication: {
        ...initial.publication,
        subscription: {
          ...initial.publication.subscription!,
          status: "suspended",
        },
        eligible: false,
        blockers: [
          {
            code: "subscription_suspended",
            message: "El plan está suspendido",
          },
        ],
      },
    },
    13,
  );
  mock.adminSubscription.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByText("Actualizar conductor"));
  await waitFor(() => expect(panel().getByRole("alert")).toBeTruthy());
  fireEvent.click(screen.getByText("Actualizar conductor"));
  await summary().findByText("El plan está suspendido.");
  expect(summary().getByText("No visible para apoderados")).toBeTruthy();
  expect(panel().getByText("Suspendido")).toBeTruthy();
  fireEvent.click(panel().getByRole("button", { name: "Administrar plan" }));
  expect(
    (panel().getByLabelText("Estado del plan") as HTMLSelectElement).value,
  ).toBe("suspended");
  expect(mock.adminSubscription).toHaveBeenCalledTimes(3);
  await expect(
    mock.adminDriver.mock.results.at(-1)!.value,
  ).resolves.toMatchObject({ profile_version: null });
  expect(mock.changeSubscription).not.toHaveBeenCalled();
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function summary() {
  return within(screen.getByRole("region", { name: "Estado del servicio" }));
}
test("queue cards distinguish the four states and detail leads with authoritative visibility", async () => {
  const { api, replace } = fixture();
  replace({
    ...initial,
    publication: {
      ...initial.publication,
      eligible: false,
      subscription: null,
      blockers: [
        { code: "subscription_missing", message: "Internal predicate text" },
      ],
    },
  });
  render(<AdminControlScreen api={api} />);
  const list = await screen.findByRole("region", {
    name: "Lista de conductores",
  });
  expect(list.textContent).toContain("Perfil: Activo");
  expect(list.textContent).toContain("Validación: Aprobada");
  expect(list.textContent).toContain("Visibilidad: No visible");
  expect(list.textContent).toContain("Plan: Sin plan");
  expect(list.textContent).not.toMatch(
    /approved|eligible|subscription_missing/,
  );
  expect(screen.queryByLabelText("Motivo")).toBeNull();
  await open();
  expect(summary().getByText("Falta un plan activo.")).toBeTruthy();
  expect(summary().getByText("No visible para apoderados")).toBeTruthy();
  expect(screen.queryByLabelText("Motivo del cambio de perfil")).toBeNull();
  expect(screen.queryByLabelText("Plan")).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Lista de conductores" }),
  ).toBeNull();
  const detail = screen.getByRole("region", { name: "Detalle del conductor" });
  const sections = within(detail).getAllByRole("region");
  expect(sections[0]).toBe(summary().getByRole("heading").closest("section"));
  expect(detail.textContent).not.toMatch(
    /expected_version|Internal predicate|correlation|precio|beneficio|cobro/i,
  );
});

test.each([
  ["active", "suspended", "Suspender perfil", "Perfil suspendido"],
  ["active", "deactivated", "Desactivar perfil", "Perfil desactivado"],
  ["suspended", "active", "Reactivar perfil", "Perfil reactivado"],
  ["suspended", "deactivated", "Desactivar perfil", "Perfil desactivado"],
  ["deactivated", "active", "Reactivar perfil", "Perfil reactivado"],
] as const)(
  "%s → %s keeps the transition contract and visible success",
  async (current, target, action, result) => {
    const { api, mock, replace } = fixture();
    replace({
      ...initial,
      profile_version: 17,
      publication: { ...initial.publication, profile_status: current },
    });
    render(<AdminControlScreen api={api} />);
    await open();
    expect(screen.queryByLabelText("Nuevo estado del perfil")).toBeNull();
    if (current === "deactivated")
      expect(
        screen.queryByRole("button", { name: "Suspender perfil" }),
      ).toBeNull();
    profile(action, "Motivo sintético");
    const confirmation = screen.getByRole("alertdialog");
    expect(confirmation.textContent).toContain("Conductor Demo");
    expect(confirmation.textContent).toContain("Estado resultante");
    expect(confirmation.textContent).toContain(
      target === "active" ? "solo si cumple" : "no aparecerá",
    );
    expect(mock.changeProfileStatus).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByText("Confirmar cambio"));
    const notice = await screen.findByRole("complementary", {
      name: "Aviso de la acción",
    });
    expect(within(notice).getByRole("status").textContent).toContain(result);
    expect(notice.textContent).not.toContain("Conductor Demo");
    expect(mock.changeProfileStatus).toHaveBeenCalledExactlyOnceWith(7, {
      status: target,
      expected_status: current,
      expected_version: 17,
      reason: "Motivo sintético",
    });
    await waitFor(() =>
      expect(
        summary().getByText(
          target === "active"
            ? "Visible para apoderados"
            : "No visible para apoderados",
        ),
      ).toBeTruthy(),
    );
  },
);

test("profile and plan focus, Escape and explicit refresh safely close drafts/confirmations", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  const action = screen.getByRole("button", { name: "Desactivar perfil" });
  action.focus();
  fireEvent.click(action);
  expect(document.activeElement?.textContent).toContain(
    "Desactivar perfil: Conductor Demo",
  );
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "   " },
  });
  expect(
    (screen.getByText("Revisar cambio de perfil") as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Desactivar perfil" }),
  );
  profile("Desactivar perfil");
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Confirmar cambio de perfil" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  const plan = screen.getByRole("button", { name: "Administrar plan" });
  plan.focus();
  fireEvent.click(plan);
  expect(document.activeElement?.textContent).toContain(
    "Administrar plan: Conductor Demo",
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Administrar plan" }),
  );
  profile("Desactivar perfil");
  fireEvent.click(screen.getByRole("button", { name: "Actualizar conductor" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await waitFor(() => expect(mock.adminDriver).toHaveBeenCalledTimes(2));
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
});

test("suspending/restoring a plan refreshes summary and history with unchanged profile version", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(
    within(
      screen.getByRole("region", { name: "Plan del conductor" }),
    ).getByLabelText("Estado del plan"),
    {
      target: { value: "suspended" },
    },
  );
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Pausa sintética" },
  });
  expect(
    (screen.getByRole("button", { name: "Guardar plan" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByLabelText(
      "Confirmo que este plan dejará de habilitar la visibilidad",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await summary().findByText("El plan está suspendido.");
  expect(summary().getByText("No visible para apoderados")).toBeTruthy();
  expect(summary().getByText("Activo")).toBeTruthy();
  expect(screen.queryByLabelText("Motivo")).toBeNull();
  expect(
    screen.getByRole("complementary", { name: "Aviso de la acción" })
      .textContent,
  ).toContain("Plan actualizado");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Administrar plan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(
    within(
      screen.getByRole("region", { name: "Plan del conductor" }),
    ).getByLabelText("Estado del plan"),
    {
      target: { value: "active" },
    },
  );
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Reactivar plan" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await summary().findByText("Visible para apoderados");
  expect(mock.changeSubscription.mock.calls[0]![1].expected_version).toBe(8);
  expect(mock.changeSubscription.mock.calls[1]![1].expected_version).toBe(9);
  await expect(
    mock.adminDriver.mock.results.at(-1)!.value,
  ).resolves.toMatchObject({ profile_version: null });
  expect(mock.adminDriverHistory.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
});

test("restoration displays server blockers even when the visible facts appear complete", async () => {
  const { api, mock, replace } = fixture();
  replace({
    ...initial,
    publication: {
      ...initial.publication,
      profile_status: "suspended",
      eligible: false,
    },
  });
  mock.changeProfileStatus.mockImplementationOnce(async () => {
    const current: AdminDriver = {
      ...initial,
      publication: {
        ...initial.publication,
        eligible: false,
        blockers: [
          { code: "required_document_expired", message: "Internal code" },
        ],
      },
    };
    replace(current);
    return current;
  });
  render(<AdminControlScreen api={api} />);
  await open();
  profile("Reactivar perfil");
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await summary().findByText("Un documento requerido está vencido.");
  expect(summary().getByText("No visible para apoderados")).toBeTruthy();
  expect(
    screen.getByRole("complementary", { name: "Aviso de la acción" })
      .textContent,
  ).toContain("El servicio no está visible");
});

test("plan conflict closes the editor, refreshes version and requires explicit review without replay", async () => {
  const { api, mock, replace } = fixture();
  mock.changeSubscription.mockImplementationOnce(async () => {
    replace(initial, 21);
    throw new ApiError(409, "stale_state", "Conflict");
  });
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Cambio antiguo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await screen.findByText(/El estado de este conductor cambió/);
  expect(screen.queryByLabelText("Motivo")).toBeNull();
  expect(mock.changeSubscription).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: /^Reintentar/ })).toBeNull();
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Administrar plan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Cambio revisado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await screen.findByText("Plan actualizado");
  expect(mock.changeSubscription.mock.calls[1]![1].expected_version).toBe(21);
});

test("history renders known human events and only allowlisted state fields with driver-scoped pagination", async () => {
  const { api, mock } = fixture();
  mock.adminDriverHistory.mockResolvedValueOnce({
    count: 26,
    results: [
      {
        ...history.results[0]!,
        action: "profile_status_changed",
        target_type: "driver_profile",
        before: {
          status: "active",
          storage_key: "Secret storage",
          guardian_contact: "Secret contact",
        } as never,
        after: {
          status: "suspended",
          message: "Secret message",
          student_display_name: "Secret student",
          amount_clp: "Secret payment",
        } as never,
      },
      {
        ...history.results[0]!,
        id: 9,
        action: "document_read",
        target_type: "document",
        reason: "Secret document data",
        before: { status: "Private status" },
      },
    ],
  });
  render(<AdminControlScreen api={api} />);
  await open();
  const timeline = disclosure("Historial administrativo");
  expect(
    timeline.getByRole("heading", { name: "Perfil suspendido" }),
  ).toBeTruthy();
  expect(timeline.getAllByText("28 sep 2026 · 10:00")).toHaveLength(2);
  expect(
    timeline.getByRole("heading", { name: "Documento consultado" }),
  ).toBeTruthy();
  expect(timeline.queryByText("Antes")).toBeNull();
  expect(timeline.queryByText("Después")).toBeNull();
  const changes = timeline.getAllByText("Ver cambios")[0]!.closest("details")!;
  changes.open = true;
  fireEvent(changes, new Event("toggle"));
  expect(timeline.getByText("Antes")).toBeTruthy();
  expect(timeline.getByText("Después")).toBeTruthy();
  expect(timeline.queryByText(/Secret|Private status/)).toBeNull();
  mock.adminDriverHistory.mockResolvedValueOnce({
    count: 26,
    results: [
      { ...history.results[0]!, id: 10, reason: "Acción anterior sintética" },
    ],
  });
  fireEvent.click(timeline.getByText("Ver acciones anteriores"));
  await timeline.findByText("Motivo: Acción anterior sintética");
  expect(mock.adminDriverHistory).toHaveBeenLastCalledWith(7, 25);
  expect(
    timeline.getByRole("heading", { name: "Perfil suspendido" }),
  ).toBeTruthy();
  expect(timeline.queryByText("Ver acciones anteriores")).toBeNull();
  expect(mock.adminDriverHistory).toHaveBeenCalledTimes(2);
});

test("late queue reads cannot replace newer filters; server-invalid filters offer no automatic retry", async () => {
  const { api, mock } = fixture();
  const old = deferred<{ results: AdminDriver[]; count: number }>();
  mock.adminDrivers.mockReturnValueOnce(old.promise);
  render(<AdminControlScreen api={api} />);
  fireEvent.change(screen.getByLabelText("Buscar conductor"), {
    target: { value: "New" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("1 conductor");
  await act(async () =>
    old.resolve({
      results: [{ ...initial, display_name: "Old queue" }],
      count: 1,
    }),
  );
  expect(screen.queryByText("Old queue")).toBeNull();
  mock.adminDrivers.mockRejectedValueOnce(
    new ApiError(400, "validation_error", "Invalid", {
      filters: ["Filtros no permitidos."],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("Filtros no permitidos.");
  expect(screen.queryByRole("button", { name: /^Reintentar/ })).toBeNull();
});

test("history refresh leaves an open plan's draft/version unchanged; overall refresh cancels it", async () => {
  const { api, mock, replace } = fixture();
  mock.adminDriverHistory.mockResolvedValue({ ...history, count: 26 });
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Plan con versión original" },
  });
  replace(initial, 34);
  disclosure("Historial administrativo");
  fireEvent.click(screen.getByText("Ver acciones anteriores"));
  await waitFor(() =>
    expect(mock.adminDriverHistory).toHaveBeenLastCalledWith(7, 25),
  );
  expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe(
    "Plan con versión original",
  );
  mock.changeSubscription.mockRejectedValueOnce(
    new ApiError(409, "stale_state", "Conflict"),
  );
  fireEvent.click(screen.getByText("Guardar plan"));
  await screen.findByText(/El estado de este conductor cambió/);
  expect(mock.changeSubscription.mock.calls[0]![1].expected_version).toBe(8);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Administrar plan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Borrador que se cancela" },
  });
  fireEvent.click(screen.getByText("Actualizar conductor"));
  await waitFor(() => expect(screen.queryByLabelText("Motivo")).toBeNull());
  expect(mock.changeSubscription).toHaveBeenCalledTimes(1);
});

test("confirmed plan success remains visible if its following read fails; retry performs only reads", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Actualización sintética" },
  });
  mock.adminSubscription.mockRejectedValue(new Error("offline"));
  fireEvent.click(screen.getByText("Guardar plan"));
  await screen.findByText("Plan actualizado");
  await screen.findByRole("button", { name: "Reintentar carga del plan" });
  expect(mock.changeSubscription).toHaveBeenCalledTimes(1);
  mock.adminSubscription.mockResolvedValueOnce({
    publication: initial.publication,
    version: 9,
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar carga del plan" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Reintentar carga del plan" }),
    ).toBeNull(),
  );
  expect(mock.changeSubscription).toHaveBeenCalledTimes(1);
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
});

test.each(["profile", "plan"] as const)(
  "pending %s mutation cannot be submitted twice",
  async (action) => {
    const { api, mock } = fixture();
    const write = deferred<never>();
    if (action === "profile")
      mock.changeProfileStatus.mockReturnValueOnce(write.promise);
    else mock.changeSubscription.mockReturnValueOnce(write.promise);
    render(<AdminControlScreen api={api} />);
    await open();
    if (action === "profile") profile();
    else {
      fireEvent.click(screen.getByRole("button", { name: "Administrar plan" }));
      fireEvent.change(screen.getByLabelText("Motivo"), {
        target: { value: "Plan sintético" },
      });
    }
    const button = screen.getByRole("button", {
      name: action === "profile" ? "Confirmar cambio" : "Guardar plan",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(
      action === "profile" ? mock.changeProfileStatus : mock.changeSubscription,
    ).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(
      screen.getByRole(action === "profile" ? "alertdialog" : "dialog", {
        name:
          action === "profile"
            ? "Confirmar cambio de perfil"
            : "Administrar plan: Conductor Demo",
      }),
    ).toBeTruthy();
  },
);

test("selecting a different driver resets expanded history and rejects a late previous-driver response", async () => {
  const { api, mock } = fixture();
  const other = { ...initial, id: 8, display_name: "Otro servicio sintético" };
  mock.adminDrivers.mockResolvedValue({ results: [initial, other], count: 2 });
  mock.adminDriver.mockImplementation(async (id?: number) =>
    id === 8 ? other : initial,
  );
  mock.adminDriverHistory.mockResolvedValue({ ...history, count: 26 });
  render(<AdminControlScreen api={api} />);
  fireEvent.click(
    (await screen.findAllByRole("button", { name: "Ver conductor" }))[0]!,
  );
  await screen.findByRole("region", { name: "Estado del servicio" });
  const timeline = disclosure("Historial administrativo");
  const old = deferred<AdminDriverHistory>();
  mock.adminDriverHistory.mockReturnValueOnce(old.promise);
  fireEvent.click(timeline.getByText("Ver acciones anteriores"));
  fireEvent.click(screen.getByRole("button", { name: "Volver a conductores" }));
  mock.adminDriverHistory.mockResolvedValueOnce({ count: 0, results: [] });
  fireEvent.click(screen.getAllByRole("button", { name: "Ver conductor" })[1]!);
  await screen.findByRole("heading", { name: "Otro servicio sintético" });
  await waitFor(() =>
    expect(mock.adminDriverHistory).toHaveBeenLastCalledWith(8, 0),
  );
  await act(async () =>
    old.resolve({
      count: 1,
      results: [
        { ...history.results[0]!, reason: "Late other driver's history" },
      ],
    }),
  );
  expect(screen.queryByText(/Late other driver's history/)).toBeNull();
  expect(
    screen.getByText("Historial administrativo").closest("details")!.open,
  ).toBe(false);
  expect(
    disclosure("Historial administrativo").getByText(
      "Sin acciones administrativas.",
    ),
  ).toBeTruthy();
});

test.each([390, 1280])(
  "history at %spx starts compact and reveals every server-paginated event without prefetching",
  async (width) => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    try {
      const { api, mock } = fixture();
      const events = Array.from({ length: 28 }, (_, index) => ({
        ...history.results[0]!,
        id: 100 - index,
        reason: `Acción sintética ${index + 1}`,
        occurred_at: new Date(
          Date.UTC(2026, 9, 6, 12, 0) - index * 60000,
        ).toISOString(),
      }));
      mock.adminDriverHistory.mockImplementation(
        async (_id?: number, offset = 0) => ({
          count: events.length,
          results: events.slice(offset, offset + 25),
        }),
      );
      render(<AdminControlScreen api={api} />);
      await open();
      const timeline = disclosure("Historial administrativo");
      expect(timeline.getByText("28 acciones")).toBeTruthy();
      expect(timeline.getAllByRole("listitem")).toHaveLength(3);
      expect(timeline.getByRole("status").textContent).toBe(
        "Mostrando 3 de 28 acciones.",
      );
      expect(timeline.queryByText("Antes")).toBeNull();
      expect(timeline.queryByText("Después")).toBeNull();
      expect(timeline.queryByText("Detalles técnicos")).toBeNull();
      expect(mock.adminDriverHistory).toHaveBeenCalledTimes(1);
      const changes = timeline
        .getAllByText("Ver cambios")[0]!
        .closest("details")!;
      fireEvent.click(within(changes).getByText("Ver cambios"));
      await timeline.findByText("Antes");
      expect(changes.open).toBe(true);
      expect(
        timeline.getByText("Detalles técnicos").closest("details")!.open,
      ).toBe(false);
      expect(
        timeline
          .getAllByText("Ver cambios")
          .slice(1)
          .every((summary) => !summary.closest("details")!.open),
      ).toBe(true);
      fireEvent.click(within(changes).getByText("Ver cambios"));
      await waitFor(() => expect(timeline.queryByText("Antes")).toBeNull());

      for (const count of [6, 9, 12, 15, 18, 21, 24, 25]) {
        const reveal = timeline.getByRole("button", {
          name: "Ver acciones anteriores",
        });
        reveal.focus();
        const previousCount = timeline.getAllByRole("listitem").length;
        fireEvent.click(reveal);
        expect(timeline.getAllByRole("listitem")).toHaveLength(count);
        expect(document.activeElement).toBe(
          timeline.getAllByRole("heading")[previousCount],
        );
        expect(mock.adminDriverHistory).toHaveBeenCalledTimes(1);
      }
      const older = deferred<AdminDriverHistory>();
      mock.adminDriverHistory.mockReturnValueOnce(older.promise);
      fireEvent.click(
        timeline.getByRole("button", { name: "Ver acciones anteriores" }),
      );
      expect(timeline.getAllByRole("listitem")).toHaveLength(25);
      expect(mock.adminDriverHistory).toHaveBeenLastCalledWith(7, 25);
      expect(
        (
          timeline.getByRole("button", {
            name: "Cargando acciones…",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      await act(async () =>
        older.resolve({ count: 28, results: events.slice(25) }),
      );
      expect(timeline.getAllByRole("listitem")).toHaveLength(28);
      expect(
        timeline
          .getAllByRole("listitem")
          .map((item) => within(item).getByText(/^Motivo:/).textContent),
      ).toEqual(events.map((entry) => `Motivo: ${entry.reason}`));
      expect(document.activeElement).toBe(timeline.getAllByRole("heading")[25]);
      expect(timeline.getByRole("status").textContent).toBe(
        "Mostrando 28 de 28 acciones.",
      );
      expect(
        timeline.queryByRole("button", { name: "Ver acciones anteriores" }),
      ).toBeNull();
      expect(mock.adminDriverHistory.mock.calls).toEqual([
        [7, 0],
        [7, 25],
      ]);
      fireEvent.click(
        screen.getByRole("button", { name: "Actualizar conductor" }),
      );
      await waitFor(() =>
        expect(mock.adminDriverHistory).toHaveBeenLastCalledWith(7, 0),
      );
      await waitFor(() =>
        expect(timeline.getAllByRole("listitem")).toHaveLength(3),
      );
      expect(timeline.queryByText("Antes")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: previousWidth,
      });
    }
  },
);
