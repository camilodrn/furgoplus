import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { AuthApi } from "./api";
import { DriverSummaryScreen } from "./DriverOperations";
import { homeStatus } from "./DriverHomeStatus";
import type { Publication } from "./api-types";

afterEach(cleanup);
const base: Publication = {
  profile_status: "active",
  publication_requested: false,
  eligible: false,
  validation_state: "draft",
  current_validation_revision: 1,
  approved_revision: null,
  active_route_count: 0,
  coverage: [],
  subscription: null,
  blockers: [
    { code: "required_document_missing", message: "INTERNAL" },
    { code: "validation_not_approved", message: "INTERNAL" },
    { code: "approved_revision_stale", message: "INTERNAL" },
    { code: "subscription_missing", message: "INTERNAL" },
    { code: "active_route_missing", message: "INTERNAL" },
    { code: "publication_not_requested", message: "INTERNAL" },
  ],
};
function setup(publication = base, active = 0, payments = 0) {
  const onNavigate = vi.fn();
  const api = {
    summary: vi.fn(async () => ({
      publication,
      routes: [],
      active_assignments: active,
      payment_counts: { pending: payments, paid: 0, void: 0 },
    })),
    driverContactRequests: vi.fn(async () => ({ results: [] })),
  };
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      name="Conductor Demo"
      onNavigate={onNavigate}
    />,
  );
  return { api, onNavigate };
}

test("unpublished summary chooses documents once, groups reasons under native accessible disclosures", async () => {
  const { onNavigate } = setup();
  await screen.findByText("Servicio no publicado");
  expect(screen.getByText("0 de 4 requisitos completados")).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: "Completar documentos" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Completar documentos" }));
  expect(onNavigate).toHaveBeenCalledWith("documents");
  const trigger = screen.getByText("Ver detalles de información aprobada");
  const disclosure = trigger.closest("details")!;
  expect(disclosure.open).toBe(false);
  fireEvent.click(trigger);
  expect(disclosure.open).toBe(true);
  expect(
    within(disclosure).getByText("Falta un documento requerido vigente."),
  ).toBeTruthy();
  expect(
    within(disclosure).getByText(
      "Los cambios en tu información necesitan una nueva revisión.",
    ),
  ).toBeTruthy();
  expect(within(disclosure).queryByRole("button")).toBeNull();
  fireEvent.click(trigger);
  expect(disclosure.open).toBe(false);
  expect(screen.queryByText("INTERNAL")).toBeNull();
  expect(screen.queryByText("Tu camino para aparecer en FurgoPlus")).toBeNull();
});

test("published status trusts server eligibility, completes requirements and uses existing publication destination", async () => {
  const { onNavigate } = setup({ ...base, eligible: true, blockers: [] }, 3, 2);
  await screen.findByText("Tu servicio está visible");
  expect(screen.getByText("4 de 4 requisitos completados")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("4");
  fireEvent.click(
    screen.getByRole("button", { name: "Ver estado de publicación" }),
  );
  expect(onNavigate).toHaveBeenLastCalledWith("publication");
  expect(
    screen.getByRole("region", { name: "Resumen de pasajeros" }).textContent,
  ).toContain("3 asignados hoy");
  expect(
    screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
  ).toContain("2 pendientes");
  expect(screen.queryByText("Sin pasajeros asignados hoy.")).toBeNull();
});

test("empty statistics are real zeros and activity precedes checklist, with no invented request count", async () => {
  setup();
  await screen.findByText("Servicio no publicado");
  await screen.findByText("Sin solicitudes por responder.");
  expect(screen.getByText("Sin pasajeros asignados hoy.")).toBeTruthy();
  expect(screen.getByText("Sin pagos pendientes.")).toBeTruthy();
  const activity = screen.getByRole("region", { name: "Resumen de rutas" });
  const checklist = screen.getByRole("region", {
    name: "Progreso de activación",
  });
  expect(
    activity.compareDocumentPosition(checklist) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("status and contextual actions are derived from actual blocker codes", () => {
  expect(
    homeStatus({
      ...base,
      blockers: [{ code: "profile_summary_missing", message: "INTERNAL" }],
    }).destination,
  ).toBe("profile");
  expect(homeStatus({ ...base, validation_state: "pending" }).title).toBe(
    "Publicación pendiente",
  );
  const suspended = homeStatus({
    ...base,
    profile_status: "suspended",
    blockers: [
      ...base.blockers,
      { code: "driver_suspended", message: "INTERNAL" },
    ],
  });
  expect(suspended.title).toBe("Servicio suspendido");
  expect(suspended.destination).toBe("publication");
  expect(suspended.steps).toHaveLength(5);
});
