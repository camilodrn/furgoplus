import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { AuthApi } from "./api";
import type { Publication, DriverCapabilities } from "./api-types";
import { DriverPublicationScreen } from "./PublicationScreens";
import { AdminPublicationScreen } from "./AdminPlanControls";
import { AdminStatusBadges, AdminServiceSummary } from "./AdminExperience";
import { DriverReports } from "./DriverReports";
import { DriverSummaryScreen } from "./DriverOperations";
import { planValidity } from "./PlanValidity";

afterEach(cleanup);

test("UX02: unconfirmed validity never becomes Vigente, and profile availability does not rename a valid plan", () => {
  expect(
    planValidity({ status: "active", effective: false }, [
      "subscription_invalid_window",
    ]),
  ).toBe("Vigencia no confirmada");
  expect(planValidity({ status: "active" }, ["driver_suspended"])).toBe(
    "Vigente",
  );
  expect(
    planValidity({ status: "suspended" }, [
      "subscription_suspended",
      "subscription_expired",
    ]),
  ).toBe("Suspendido");
});
const published: Publication = {
  profile_status: "active",
  publication_requested: true,
  eligible: true,
  validation_state: "approved",
  current_validation_revision: 1,
  approved_revision: 1,
  active_route_count: 1,
  coverage: [],
  blockers: [],
  subscription: {
    plan_code: "basic",
    plan_label: "Básico",
    status: "active",
    starts_at: "2026-10-01T03:00:00Z",
    ends_at: "2026-11-01T03:00:00Z",
  },
};
function apiFor(publication: Publication) {
  return {
    publication: vi.fn(async () => publication),
    routes: vi.fn(async () => ({ routes: [] })),
    communes: vi.fn(async () => ({ communes: [] })),
    adminSubscription: vi.fn(async () => ({ publication, version: 1 })),
    plans: vi.fn(async () => ({ plans: [] })),
    summary: vi.fn(async () => ({
      publication,
      routes: [],
      active_assignments: 2,
      payment_counts: { pending: 3, paid: 0, void: 0 },
    })),
    driverContactRequests: vi.fn(async () => ({ results: [] })),
  };
}

test.each([
  ["Vigente", "active", null],
  ["Vencido", "active", "subscription_expired"],
  ["Aún no comienza", "active", "subscription_not_started"],
  ["Suspendido", "suspended", "subscription_suspended"],
  ["Inactivo", "inactive", "subscription_inactive"],
  ["Sin plan asignado", null, "subscription_missing"],
] as const)(
  "UX02: %s agrees across publication, admin and reports using server state",
  async (label, status, code) => {
    const publication: Publication = {
      ...published,
      eligible: !code,
      subscription: status ? { ...published.subscription!, status } : null,
      blockers: code ? [{ code, message: "INTERNAL" }] : [],
    };
    const caps = {
      plan: status ? { code: "basic", label: "Básico" } : null,
      subscription: publication.subscription
        ? { ...publication.subscription, effective: !code }
        : null,
      blockers: code ? [code] : [],
      capabilities: Object.fromEntries(
        [
          "assistant.faq",
          "assistant.contextual",
          "operations.core",
          "reports.monthly.read",
          "reports.detail.read",
          "reports.xlsx.export",
          "analytics.period_comparison",
        ].map((key) => [
          key,
          {
            enabled: key === "operations.core",
            included_in_plan: false,
            implemented: true,
            blockers: [],
          },
        ]),
      ),
    } as unknown as DriverCapabilities;
    const api = {
      ...apiFor(publication),
      driverCapabilities: vi.fn(async () => caps),
      monthlyReport: vi.fn(),
      advancedReport: vi.fn(),
    };
    render(
      <>
        <DriverPublicationScreen
          api={api as unknown as AuthApi}
          activeSection="publication"
        />
        <div data-testid="badges">
          <AdminStatusBadges publication={publication} />
        </div>
        <div data-testid="admin-summary">
          <AdminServiceSummary publication={publication} />
        </div>
        <AdminPublicationScreen
          api={api as unknown as AuthApi}
          driverId={7}
          showServiceSummary={false}
        />
        <DriverReports api={api as unknown as AuthApi} />
      </>,
    );
    const plan = await screen.findByLabelText("Plan actual");
    await screen.findByText("Tu plan actual");
    for (const view of [
      plan,
      screen.getByTestId("badges"),
      screen.getByTestId("admin-summary"),
      screen.getByRole("region", { name: "Plan del conductor" }),
      screen.getByRole("article", { name: status ? "Básico" : label }),
    ]) {
      expect(view.textContent).toContain(label);
    }
    expect(api.monthlyReport).not.toHaveBeenCalled();
    expect(api.advancedReport).not.toHaveBeenCalled();
    if (code && status)
      expect(plan.querySelector(".plan-status")!.textContent).not.toBe(
        "Activo",
      );
  },
);

test("UX01: preparation starts collapsed, has four groups and can be closed while activity stays available", async () => {
  const api = apiFor({
    ...published,
    eligible: false,
    profile_status: "suspended",
    blockers: [{ code: "driver_suspended", message: "INTERNAL" }],
  });
  const onNavigate = vi.fn();
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      onNavigate={onNavigate}
    />,
  );
  await screen.findByText("Servicio suspendido");
  const toggle = screen.getByText("Ver preparación del servicio", {
    selector: "summary",
  });
  const disclosure = toggle.closest("details")!;
  expect(disclosure.open).toBe(false);

  fireEvent.click(toggle);
  const steps = screen.getByRole("list", {
    name: "Pasos para aparecer en FurgoPlus",
  });
  expect(steps.querySelectorAll(":scope > li")).toHaveLength(4);
  expect(steps.textContent).not.toContain("Tu servicio está suspendido.");
  fireEvent.click(toggle);
  expect(disclosure.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Ver pasajeros" }));
  expect(onNavigate).toHaveBeenLastCalledWith("roster");
  const notice = screen.getByRole("region", { name: "Estado de tu servicio" });
  expect(within(notice).getByText("Tu servicio está suspendido.")).toBeTruthy();
  fireEvent.click(
    within(notice).getByRole("button", { name: "Consultar soporte" }),
  );
  expect(onNavigate).toHaveBeenLastCalledWith("help");
});

test("UX01: publication intent precedes the visible server requirements", async () => {
  const api = apiFor(published);
  render(
    <DriverPublicationScreen
      api={api as unknown as AuthApi}
      activeSection="publication"
    />,
  );
  const action = await screen.findByRole("button", {
    name: "Dejar de mostrar mi servicio",
  });
  const requirements = screen.getByRole("region", {
    name: "Requisitos de publicación",
  });
  expect(requirements.textContent).toContain("Cuenta habilitada");
  expect(requirements.textContent).toContain("Ruta activa");
  expect(
    action.compareDocumentPosition(requirements) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
