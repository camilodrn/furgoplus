import {
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
        },
      };
      return { publication: driver.publication, version: 9 };
    }),
    changeProfileStatus: vi.fn(async (_id, input) => {
      driver = {
        ...driver,
        profile_version: 9,
        publication: {
          ...driver.publication,
          profile_status: input.status,
          eligible: false,
          blockers: [
            { code: "driver_suspended", message: "Conductor suspendido" },
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

async function open() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir control" }));
  await screen.findByText(/Validación actual: Aprobada/);
  await screen.findByLabelText("Motivo");
}

test("queue submits authoritative filters, paginates, and renders empty/retry", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await screen.findByText("1 conductores");
  fireEvent.change(screen.getByLabelText("Buscar nombre o correo"), {
    target: { value: "Demo" },
  });
  fireEvent.change(screen.getByLabelText("Validación actual"), {
    target: { value: "approved" },
  });
  fireEvent.change(screen.getByLabelText("Estado del perfil"), {
    target: { value: "suspended" },
  });
  fireEvent.change(screen.getByLabelText("Plan asignado"), {
    target: { value: "elite" },
  });
  fireEvent.change(screen.getByLabelText("Suscripción"), {
    target: { value: "active" },
  });
  fireEvent.change(screen.getByLabelText("Publicación"), {
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
  });
  mock.adminDrivers.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByText("Actualizar cola"));
  await screen.findByRole("alert");
  mock.adminDrivers.mockResolvedValueOnce({ results: [initial], count: 26 });
  fireEvent.click(screen.getByText("Actualizar cola"));
  await screen.findByText("26 conductores");
  fireEvent.click(screen.getByText("Conductores siguientes"));
  await waitFor(() =>
    expect(
      (
        mock.adminDrivers.mock.calls.at(-1)![0] as unknown as URLSearchParams
      ).get("offset"),
    ).toBe("25"),
  );
});

test("detail shows retained observations, allowlisted history and profile confirmation with reason", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  expect(screen.getAllByText(/Reemplaza el documento/).length).toBeGreaterThan(
    0,
  );
  expect(screen.getByText(/admin@example.test/)).toBeTruthy();
  expect(screen.getByText(/synthetic-id/)).toBeTruthy();
  expect(
    (screen.getByText("Cambiar estado del perfil") as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Revisión manual" },
  });
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(within(dialog).getByText("Confirmar cambio"));
  await screen.findByText("Estado del perfil guardado.");
  await waitFor(() =>
    expect(mock.changeProfileStatus).toHaveBeenCalledWith(7, {
      status: "suspended",
      expected_status: "active",
      expected_version: null,
      reason: "Revisión manual",
    }),
  );
  await screen.findByText(/Estado del perfil: Suspendido/);
  await waitFor(() =>
    expect(mock.adminDriverHistory.mock.calls.length).toBeGreaterThan(1),
  );
});

test("plan mutation reuses explicit validity/version and refreshes integrated history", async () => {
  const { api, mock } = fixture();
  render(<AdminControlScreen api={api} />);
  await open();
  fireEvent.change(screen.getByLabelText("Plan"), {
    target: { value: "elite" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Cambio de plan" },
  });
  fireEvent.click(screen.getByText("Guardar plan"));
  await screen.findByText("Plan guardado. Estado de publicación actualizado.");
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
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Motivo conservado" },
  });
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText(/La información cambió/);
  expect(
    (
      screen.getByLabelText(
        "Motivo del cambio de perfil",
      ) as HTMLTextAreaElement
    ).value,
  ).toBe("Motivo conservado");
  expect(mock.adminDriver).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText("Estado del perfil guardado.");
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
  fireEvent.change(screen.getByLabelText("Nuevo estado del perfil"), {
    target: { value: "deactivated" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Desactivar por revisión" },
  });
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
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
  fireEvent.click(screen.getByText("Más acciones"));
  await screen.findByText(/Estado del perfil: Suspendido/);
  expect(screen.getByRole("alertdialog").textContent).toContain("Desactivado");
  fireEvent.click(screen.getByText("Confirmar cambio"));
  await screen.findByText(/La información cambió/);
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
  fireEvent.click(screen.getByText("Actualizar control / Reintentar"));
  await screen.findByText(/Estado del perfil: Suspendido/);
  expect(
    (screen.getByLabelText("Nuevo estado del perfil") as HTMLSelectElement)
      .value,
  ).toBe("active");
  fireEvent.change(screen.getByLabelText("Nuevo estado del perfil"), {
    target: { value: "deactivated" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del cambio de perfil"), {
    target: { value: "Revisión actualizada" },
  });
  fireEvent.click(screen.getByText("Cambiar estado del perfil"));
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
    within(
      screen.getByRole("region", { name: "Plan y publicación del conductor" }),
    );
  expect(panel().getByText("Visible para apoderados")).toBeTruthy();
  expect((panel().getByLabelText("Estado") as HTMLSelectElement).value).toBe(
    "active",
  );
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
  fireEvent.click(screen.getByText("Actualizar control / Reintentar"));
  await waitFor(() => expect(panel().getByRole("alert")).toBeTruthy());
  fireEvent.click(screen.getByText("Actualizar control / Reintentar"));
  await panel().findByText("El plan está suspendido");
  expect(panel().getByText("No visible para apoderados")).toBeTruthy();
  expect((panel().getByLabelText("Estado") as HTMLSelectElement).value).toBe(
    "suspended",
  );
  expect(mock.adminSubscription).toHaveBeenCalledTimes(3);
  await expect(
    mock.adminDriver.mock.results.at(-1)!.value,
  ).resolves.toMatchObject({ profile_version: null });
  expect(mock.changeSubscription).not.toHaveBeenCalled();
  expect(mock.changeProfileStatus).not.toHaveBeenCalled();
});
