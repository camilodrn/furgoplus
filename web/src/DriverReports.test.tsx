import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ApiError, AuthApi } from "./api";
import type {
  AdvancedReport,
  DriverCapabilities,
  MonthlyReport,
} from "./api-types";
import { DriverReports } from "./DriverReports";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function capabilities(plan = "pro", enabled = true): DriverCapabilities {
  const codes = [
    "operations.core",
    "dashboard.basic",
    "reports.monthly.read",
    "reports.detail.read",
    "reports.xlsx.export",
    "analytics.period_comparison",
    "help.center",
    "support.requests",
    "assistant.faq",
    "assistant.contextual",
  ];
  const caps = Object.fromEntries(
    codes.map((code) => {
      const implemented =
        code.startsWith("reports.") ||
        code.startsWith("analytics.") ||
        code === "operations.core" ||
        code === "dashboard.basic";
      const included =
        (!code.startsWith("reports.") && !code.startsWith("analytics.")) ||
        (code === "reports.monthly.read" ? plan !== "basic" : plan === "elite");
      return [
        code,
        {
          enabled: implemented && included && enabled,
          implemented,
          included_in_plan: included,
          blockers: enabled ? [] : ["subscription_expired"],
        },
      ];
    }),
  );
  return {
    catalog_version: "test",
    evaluated_at: new Date().toISOString(),
    plan: {
      code: plan,
      label: plan === "basic" ? "Básico" : plan === "elite" ? "Elite" : "Pro",
      monthly_price_clp:
        plan === "basic" ? 19990 : plan === "elite" ? 69990 : 39990,
      support_priority:
        plan === "basic"
          ? "standard"
          : plan === "elite"
            ? "priority"
            : "preferred",
    },
    subscription: {
      status: "active",
      starts_at: "2026-01-01T00:00:00-03:00",
      ends_at: "2099-12-31T00:00:00-03:00",
      effective: enabled,
    },
    capabilities: caps,
    blockers: enabled ? [] : ["subscription_expired"],
  } as unknown as DriverCapabilities;
}
const monthly: MonthlyReport = {
  period: {
    month: "2026-10",
    start: "2026-10-01",
    end_exclusive: "2026-11-01",
    timezone: "America/Santiago",
  },
  generated_at: "2026-10-20T01:00:00-03:00",
  summary: {
    payments: {
      pending: { count: 0, amount_clp: 0 },
      paid: { count: 0, amount_clp: 0 },
      void: { count: 0, amount_clp: 0 },
    },
    payment_count: 0,
    non_void_amount_clp: 0,
    runs: { planned: 0, in_progress: 0, completed: 0 },
    run_count: 0,
    recorded_capacity_total: 0,
    contacts: { pending: 0, accepted: 0, declined: 0, cancelled: 0 },
    contact_count: 0,
  },
  current_capacity: { as_of: "2026-10-20", routes: [] },
  notes: ["Son pagos manuales, no cobros bancarios."],
};
const advanced: AdvancedReport = {
  ...monthly,
  previous: {
    period: { ...monthly.period, month: "2026-09" },
    summary: monthly.summary,
  },
  details: { payments: [], runs: [], contacts: [] },
};
function setup(
  caps = capabilities(),
  data: MonthlyReport = monthly,
  navigation: { onHome?: () => void; onHelp?: () => void } = {},
) {
  const api = {
    driverCapabilities: vi.fn(async () => caps),
    monthlyReport: vi.fn(async () => data),
    advancedReport: vi.fn(async () => advanced),
    downloadReport: vi.fn(async () => new Blob(["xlsx"])),
  };
  const view = render(
    <DriverReports api={api as unknown as AuthApi} {...navigation} />,
  );
  return { api, ...view };
}

test("Básico presents the plan and continuity without technical entitlements", async () => {
  const { api } = setup(capabilities("basic"));
  await screen.findByRole("heading", { name: "Básico", level: 2 });
  expect(screen.getByText(/Tu gestión diaria sigue disponible/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(
    /included_in_plan|implemented|enabled|No incluido en tu plan|Aún no implementado/,
  );
  expect(screen.getByText("$19.990")).toBeTruthy();
  expect(api.monthlyReport).not.toHaveBeenCalled();
  expect(api.advancedReport).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Descargar Excel/ })).toBeNull();
  expect(screen.getByText(/1 ene 2026/)).toBeTruthy();
});

test("Pro sees real empty monthly report, period filter and no Elite controls", async () => {
  const { api } = setup();
  await screen.findByText("Sin datos registrados para este período.");
  fireEvent.change(screen.getByLabelText("Mes del reporte"), {
    target: { value: "2024-02" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar mes" }));
  await waitFor(() =>
    expect(api.monthlyReport).toHaveBeenLastCalledWith("2024-02"),
  );
  expect(screen.queryByText("Comparación mensual")).toBeNull();
  expect(api.advancedReport).not.toHaveBeenCalled();
});

test("Elite sees comparison, empty baseline and three authenticated downloads", async () => {
  const { api } = setup(capabilities("elite"));
  await screen.findByText("Comparación mensual");
  expect(screen.getByText(/Sin datos en el mes anterior/)).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: /Descargar Excel/ }),
  ).toHaveLength(3);
  const create = vi.fn(() => "blob:private");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: create,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  for (const [kind, name] of [
    ["payments", "pagos"],
    ["runs", "recorridos y cupos"],
    ["contacts", "solicitudes de contacto"],
  ]) {
    const button = screen.getByRole("button", {
      name: `Descargar Excel de ${name}`,
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(api.downloadReport).toHaveBeenLastCalledWith(
        kind,
        expect.stringMatching(/^\d{4}-\d{2}$/),
      ),
    );
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
  }
  expect(create).toHaveBeenCalledTimes(3);
});

test("focus refresh reflects admin downgrade and cannot restore stale Elite data", async () => {
  const { api } = setup(capabilities("elite"));
  await screen.findByText("Comparación mensual");
  api.driverCapabilities.mockResolvedValue(capabilities("basic"));
  fireEvent(window, new Event("focus"));
  await screen.findByRole("heading", { name: "Básico", level: 2 });
  expect(screen.queryByText("Comparación mensual")).toBeNull();
  expect(
    screen.queryAllByRole("button", { name: /Descargar Excel/ }),
  ).toHaveLength(0);
});

test("expired plan and network failures clear reports and allow retry", async () => {
  const { api } = setup(capabilities("elite", false));
  await screen.findByText(/Vencido/);
  expect(api.advancedReport).not.toHaveBeenCalled();
  api.driverCapabilities.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(
    screen.getByRole("button", { name: "Actualizar información" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("heading", { name: /^(Básico|Pro|Elite)$/ }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Actualizar información" }),
  );
  await screen.findByRole("heading", { name: "Elite", level: 2 });
});

test("download denial refreshes capabilities immediately after administrative change", async () => {
  const { api } = setup(capabilities("elite"));
  await screen.findByText("Comparación mensual");
  api.downloadReport.mockRejectedValueOnce(
    new ApiError(403, "capability_unavailable", "No disponible"),
  );
  api.driverCapabilities.mockResolvedValue(capabilities("pro"));
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar Excel de pagos" }),
  );
  await screen.findByRole("heading", { name: "Pro", level: 2 });
  expect(screen.queryByText("Comparación mensual")).toBeNull();
  expect(
    screen.queryAllByRole("button", { name: /Descargar Excel/ }),
  ).toHaveLength(0);
});

test("expired session uses central API handler and erases plan and reports", async () => {
  const expired = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({
      code: "not_authenticated",
      message: "Expired",
      fields: {},
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<DriverReports api={new AuthApi(expired)} />);
  await screen.findByText("La sesión caducó. Vuelve a iniciar sesión.");
  expect(expired).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("heading", { name: /^(Básico|Pro|Elite)$/ }),
  ).toBeNull();
});

test("a late report after unmount cannot appear in another view", async () => {
  const { api, unmount } = setup(capabilities("elite"));
  await screen.findByText("Comparación mensual");
  let resolve!: (v: AdvancedReport) => void;
  api.advancedReport.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(api.advancedReport).toHaveBeenCalledTimes(2));
  unmount();
  await act(async () => resolve(advanced));
  expect(screen.queryByText("Comparación mensual")).toBeNull();
});

test("expiry schedules a server recheck and polling picks up later plan changes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  const caps = capabilities("elite");
  caps.subscription!.ends_at = "2026-10-20T12:00:10Z";
  const { api } = setup(caps);
  await act(async () => {});
  expect(screen.getByText("Comparación mensual")).toBeTruthy();
  api.driverCapabilities.mockResolvedValue(capabilities("elite", false));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10100);
  });
  expect(api.driverCapabilities).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Comparación mensual")).toBeNull();
  expect(screen.getByText(/Vencido/)).toBeTruthy();
  api.driverCapabilities.mockResolvedValue(capabilities("pro"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(screen.getByRole("heading", { name: "Pro", level: 2 })).toBeTruthy();
  expect(api.monthlyReport).toHaveBeenCalledTimes(1);
});

test("no subscription offers information and help without exposing report controls", async () => {
  const caps = capabilities("basic");
  caps.plan = null;
  caps.subscription = null;
  caps.blockers = ["subscription_missing"];
  const home = vi.fn();
  const { api } = setup(caps, monthly, { onHome: home });
  await screen.findByRole("heading", { name: "Sin plan asignado", level: 2 });
  expect(screen.getByText(/Las guías|Puedes consultar las guías/)).toBeTruthy();
  expect(screen.queryByLabelText("Mes del reporte")).toBeNull();
  expect(screen.queryByText(/CLP \/ mes/)).toBeNull();
  expect(screen.getAllByText("Sin plan asignado")).toHaveLength(1);
  const knowPlans = screen.getByRole("button", { name: "Conocer los planes" });
  const homeButton = screen.getByRole("button", { name: "Ir a Inicio" });
  expect(knowPlans.classList.contains("button-primary")).toBe(true);
  expect(homeButton.classList.contains("button-outline")).toBe(true);
  const benefits = document.getElementById(
    "plan-benefits",
  ) as HTMLDetailsElement;
  expect(benefits.open).toBe(false);
  fireEvent.click(knowPlans);
  expect(benefits.open).toBe(true);
  expect(document.activeElement).toBe(benefits.querySelector("summary"));
  fireEvent.click(homeButton);
  expect(home).toHaveBeenCalledOnce();
  expect(api.monthlyReport).not.toHaveBeenCalled();
});

test("populated Pro summaries show actual amounts and counts with detail on demand", async () => {
  const data = structuredClone(monthly);
  data.summary.payment_count = 2;
  data.summary.non_void_amount_clp = 125000;
  data.summary.payments.pending = { count: 1, amount_clp: 50000 };
  data.summary.payments.paid = { count: 1, amount_clp: 75000 };
  data.summary.run_count = 4;
  data.summary.runs.completed = 4;
  data.summary.contact_count = 3;
  data.summary.contacts.accepted = 3;
  setup(capabilities(), data);
  await screen.findByRole("heading", { name: "Recorridos" });
  expect(screen.getByText("$125.000")).toBeTruthy();
  expect(screen.getByText("4", { selector: ".report-value" })).toBeTruthy();
  expect(screen.getByText("3", { selector: ".report-value" })).toBeTruthy();
  expect(
    screen.queryByText("Sin datos registrados para este período."),
  ).toBeNull();
  const detail = screen
    .getByText("Ver 2 registros de pago")
    .closest("details")!;
  expect(detail.open).toBe(false);
  fireEvent.click(screen.getByText("Ver 2 registros de pago"));
  expect(detail.open).toBe(true);
  expect(screen.getByText("1 · $50.000")).toBeTruthy();
});

test("automatic refresh keeps the summary steady and removes revoked access on response", async () => {
  const { api } = setup(capabilities("elite"));
  const heading = await screen.findByRole("heading", {
    name: "Comparación mensual",
  });
  let resolve!: (caps: DriverCapabilities) => void;
  api.driverCapabilities.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent(window, new Event("focus"));
  expect(screen.queryByText("Cargando plan y reportes…")).toBeNull();
  expect(screen.getByRole("heading", { name: "Comparación mensual" })).toBe(
    heading,
  );
  await act(async () => resolve(capabilities("basic")));
  expect(
    screen.queryByRole("heading", { name: "Comparación mensual" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: /Descargar Excel/ })).toBeNull();
});

test("report failure retains known plan information and supports an explicit retry", async () => {
  const { api } = setup();
  await screen.findByRole("heading", { name: "Resumen mensual" });
  api.monthlyReport.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(
    screen.getByRole("button", { name: "Actualizar información" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("heading", { name: "Pro", level: 2 })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Pagos manuales" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await screen.findByRole("heading", { name: "Pagos manuales" });
  expect(screen.queryByRole("alert")).toBeNull();
});

test("report capacity reuses the responsive operational table and benefits remain read-only", async () => {
  const { api } = setup(capabilities(), {
    ...monthly,
    current_capacity: {
      as_of: "2026-10-20",
      routes: [
        {
          route_id: 3,
          status: "active",
          next_service_date: "2026-10-21",
          seat_capacity: 12,
          used_seats: 5,
          available_seats: 7,
        },
      ],
    },
  });
  await screen.findByRole("button", { name: "Ver beneficios" });
  const before = api.driverCapabilities.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Ver beneficios" }));
  expect(screen.getByText("Qué incluye Pro")).toBeTruthy();
  expect(document.activeElement?.textContent).toBe(
    "Conocer los beneficios de mi plan",
  );
  fireEvent.click(screen.getByText("Ver cupos actuales"));
  const table = screen.getByRole("table", {
    name: "Cupos de las rutas registradas",
  });
  expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
  expect(
    within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["Activa", "21/10/2026", "12", "5", "7"]);
  expect(api.driverCapabilities.mock.calls.length).toBe(before);
  expect(api.downloadReport).not.toHaveBeenCalled();
});

test("monthly detail collections and current route capacity have independent bounded local pages", async () => {
  const payments = Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    status: "pending",
    amount_clp: i + 1,
    due_on: "2026-10-01",
    service_period_start: "2026-10-01",
    service_period_end: "2026-10-31",
  }));
  const runs = Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    route_id: 1,
    state: "completed",
    service_date: "2026-10-01",
    seat_capacity_snapshot: i + 1,
    start_time_snapshot: "07:00",
    end_time_snapshot: "08:00",
  }));
  const contacts = Array.from({ length: 23 }, (_, i) => ({
    id: i + 1,
    status: "pending",
    created_at: "2026-10-01T12:00:00Z",
    resolved_at: null,
  }));
  const data = {
    ...advanced,
    details: { payments, runs, contacts },
    current_capacity: {
      ...advanced.current_capacity,
      routes: Array.from({ length: 23 }, (_, i) => ({
        route_id: i + 1,
        status: "active",
        next_service_date: "2026-10-01",
        seat_capacity: 30,
        used_seats: 1,
        available_seats: 29,
      })),
    },
  };
  const api = {
    driverCapabilities: vi.fn().mockResolvedValue(capabilities("elite")),
    advancedReport: vi.fn().mockResolvedValue(data),
  };
  render(<DriverReports api={api as unknown as AuthApi} />);
  fireEvent.click(await screen.findByText("Ver registros del mes"));
  const nav = (name: string) =>
    within(screen.getByRole("navigation", { name }));
  fireEvent.click(
    nav("Páginas de pagos del reporte").getByRole("button", {
      name: "Siguiente",
    }),
  );
  expect(
    nav("Páginas de pagos del reporte").getByText(/11–20 de 23/),
  ).toBeTruthy();
  expect(
    nav("Páginas de recorridos del reporte").getByText(/1–10 de 23/),
  ).toBeTruthy();
  fireEvent.click(
    nav("Páginas de contactos del reporte").getByRole("button", {
      name: "Siguiente",
    }),
  );
  fireEvent.click(
    nav("Páginas de contactos del reporte").getByRole("button", {
      name: "Siguiente",
    }),
  );
  expect(
    nav("Páginas de contactos del reporte").getByText(/21–23 de 23/),
  ).toBeTruthy();
  fireEvent.click(screen.getByText("Ver cupos actuales"));
  fireEvent.click(
    nav("Páginas de cupos por ruta").getByRole("button", { name: "Siguiente" }),
  );
  expect(
    nav("Páginas de cupos por ruta").getByText(/11–20 de 23/),
  ).toBeTruthy();
  expect(
    nav("Páginas de pagos del reporte").getByText(/11–20 de 23/),
  ).toBeTruthy();
  expect(api.advancedReport).toHaveBeenCalledTimes(1);
});
