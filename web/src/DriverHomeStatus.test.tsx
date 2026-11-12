import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "./api";
import { readFileSync } from "node:fs";
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

test("declared operational text colours retain AA contrast on their surfaces", () => {
  const visualTokens = readFileSync("src/style.css", "utf8");
  const token = (name: string) => {
    const value = visualTokens
      .split(`--${name}:`)[1]
      ?.trim()
      .match(/^#[0-9a-f]{6}/i)?.[0];
    if (!value) throw new Error(`Missing colour token: ${name}`);
    return value;
  };
  const luminance = (hex: string) => {
    const linear = (offset: number) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return linear(1) * 0.2126 + linear(3) * 0.7152 + linear(5) * 0.0722;
  };
  for (const [foreground, background] of [
    ["ink", "#ffffff"],
    ["muted", "#ffffff"],
    ["brand", "#ffffff"],
    ["positive", "#ffffff"],
    ["warning", token("warning-soft")],
    ["danger", token("danger-soft")],
  ] as const) {
    const a = luminance(token(foreground)),
      b = luminance(background);
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
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
function setup(
  publication = base,
  active = 0,
  payments = 0,
  pendingRequests = 0,
) {
  const onNavigate = vi.fn();
  const api = {
    summary: vi.fn(async () => ({
      publication,
      routes: [],
      active_assignments: active,
      payment_counts: { pending: payments, paid: 0, void: 0 },
    })),
    driverContactRequests: vi.fn(async () => ({
      results: Array.from({ length: pendingRequests }, (_, id) => ({
        id,
        status: "pending",
      })),
    })),
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
  const hero = within(
    screen.getByRole("region", { name: "Visibilidad del servicio" }),
  );
  fireEvent.click(hero.getByRole("button", { name: "Completar documentos" }));
  expect(onNavigate).toHaveBeenCalledWith("documents");
  fireEvent.click(
    screen.getByText("Ver preparación del servicio", { selector: "summary" }),
  );
  const trigger = screen.getByText("Ver detalles de datos y documentos");
  const disclosure = trigger.closest("details")!;
  expect(disclosure.open).toBe(false);
  fireEvent.click(trigger);
  expect(disclosure.open).toBe(true);
  expect(
    within(disclosure).getByText("Falta un documento requerido vigente."),
  ).toBeTruthy();
  expect(disclosure.textContent).not.toContain(
    "Los cambios en tu información necesitan una nueva revisión.",
  );
  const review = screen
    .getByText("Ver detalles de revisión del equipo")
    .closest("details")!;
  fireEvent.click(review.querySelector("summary")!);
  expect(
    within(review).getByText(
      "Los cambios en tu información necesitan una nueva revisión.",
    ),
  ).toBeTruthy();
  expect(within(disclosure).queryByRole("button")).toBeNull();
  fireEvent.click(trigger);
  expect(disclosure.open).toBe(false);
  expect(screen.queryByText("INTERNAL")).toBeNull();
  expect(screen.queryByText("Tu camino para aparecer en FurgoPlus")).toBeNull();
});

test.each([
  [2, 3, 4, "Ver solicitudes", "requests"],
  [0, 3, 4, "Ver registro de pagos", "payments"],
  [0, 0, 4, "Ver pasajeros", "roster"],
  [0, 0, 0, "Gestionar rutas", "routes"],
] as const)(
  "operational home prioritizes actual pending work (%s requests, %s payments, %s passengers)",
  async (requests, payments, passengers, action, destination) => {
    const { onNavigate } = setup(
      { ...base, eligible: true, blockers: [] },
      passengers,
      payments,
      requests,
    );
    await screen.findByText(
      requests ? `${requests}` : "Sin solicitudes por responder.",
      requests ? { selector: ".snapshot-count strong" } : undefined,
    );
    const primary = screen.getByRole("button", { name: action });
    expect(primary.classList.contains("button-primary")).toBe(true);
    expect(
      document.querySelectorAll(".driver-home .button-primary"),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("button", { name: "Ver estado de publicación" })
        .classList.contains("button-outline"),
    ).toBe(true);
    expect(screen.getByRole("heading", { name: "Pendientes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tu operación" })).toBeTruthy();
    fireEvent.click(primary);
    expect(onNavigate).toHaveBeenCalledWith(destination);
  },
);

test("request read failure stays unknown and retry promotes recovered work without duplicating the publication summary", async () => {
  const api = {
    summary: vi.fn(async () => ({
      publication: { ...base, eligible: true, blockers: [] },
      routes: [],
      active_assignments: 2,
      payment_counts: { pending: 1, paid: 0, void: 0 },
    })),
    driverContactRequests: vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(503, "unavailable", "No pudimos consultar solicitudes"),
      )
      .mockResolvedValueOnce({ results: [{ status: "pending" }] }),
  };
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      onNavigate={vi.fn()}
    />,
  );
  await screen.findByRole("alert");
  const requests = within(
    screen.getByRole("region", { name: "Resumen de solicitudes" }),
  );
  expect(requests.queryByText("Sin solicitudes por responder.")).toBeNull();
  expect(requests.queryByText("0")).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Ver registro de pagos" })
      .classList.contains("button-primary"),
  ).toBe(true);
  fireEvent.click(requests.getByRole("button", { name: "Reintentar" }));
  await requests.findByText("1");
  expect(
    screen
      .getByRole("button", { name: "Ver solicitudes" })
      .classList.contains("button-primary"),
  ).toBe(true);
  expect(screen.queryByRole("heading", { name: "Documentos" })).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Datos del servicio" }),
  ).toBeNull();
});

test("publication requirements remain the only primary task while service is not visible", async () => {
  setup(base, 2, 4, 3);
  await screen.findByText("3", { selector: ".snapshot-count strong" });
  expect(
    document.querySelectorAll(".driver-home .button-primary"),
  ).toHaveLength(1);
  expect(
    screen
      .getByRole("region", { name: "Visibilidad del servicio" })
      .querySelector(".button-primary")?.textContent,
  ).toBe("Completar documentos");
  expect(
    screen
      .getByRole("button", { name: "Ver solicitudes" })
      .classList.contains("button-primary"),
  ).toBe(false);
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
  const checklist = screen.getByRole("group", {
    name: "Preparación del servicio",
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
  expect(suspended.destination).toBe("documents");
  expect(suspended.steps).toHaveLength(4);
});

test("review waiting on the team leaves route preparation available, without an approval action", async () => {
  const { onNavigate } = setup({
    ...base,
    validation_state: "pending",
    subscription: {
      plan_code: "pro",
      plan_label: "Pro",
      status: "active",
      starts_at: "2026-10-01T03:00:00Z",
      ends_at: "2026-11-01T03:00:00Z",
    },
    blockers: [
      { code: "validation_not_approved", message: "INTERNAL" },
      { code: "active_route_missing", message: "INTERNAL" },
      { code: "publication_not_requested", message: "INTERNAL" },
    ],
  });
  await screen.findByText("Publicación pendiente");
  const hero = within(
    screen.getByRole("region", { name: "Visibilidad del servicio" }),
  );
  fireEvent.click(hero.getByRole("button", { name: "Configurar una ruta" }));
  expect(onNavigate).toHaveBeenCalledWith("routes");
  fireEvent.click(
    screen.getByText("Ver preparación del servicio", { selector: "summary" }),
  );
  const review = screen
    .getByRole("heading", { name: "Revisión del equipo" })
    .closest("li")!;
  expect(within(review).getByText("En revisión")).toBeTruthy();
  expect(
    within(review).getByText("El equipo está revisando tu información."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /aprobar/i })).toBeNull();
});
