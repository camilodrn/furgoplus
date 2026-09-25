import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  AdminPublicationScreen,
  DriverPublicationScreen,
} from "./PublicationScreens";
import { chileDateTimeParts, chileInstant } from "./dates";
import { AuthApi } from "./api";
import type {
  AdminSubscription,
  Publication,
  Route,
  RouteInput,
  SubscriptionInput,
} from "./api-types";

afterEach(cleanup);
const blocked: Publication = {
  publication_requested: false,
  eligible: false,
  blockers: [
    { code: "subscription_missing", message: "Falta un plan asignado" },
    {
      code: "active_route_missing",
      message: "Falta al menos una ruta activa y completa",
    },
  ],
  validation_state: "approved",
  current_validation_revision: 1,
  approved_revision: 1,
  subscription: null,
  active_route_count: 0,
  coverage: [],
};
const route: Route = {
  id: 10,
  revision: 1,
  label: "Ida demo",
  status: "active",
  weekdays: ["monday"],
  start_time: "07:00",
  end_time: "08:00",
  seat_capacity: 3,
  next_service_date: "2026-09-28",
  used_seats: 0,
  available_seats: 3,
  destination_label: "Escuela demo",
  destination_address: "Dirección privada",
  coverage_codes: ["demo-norte"],
};
function driverApi() {
  let state = blocked;
  let routes: Route[] = [];
  const api = {
    publication: vi.fn(async () => state),
    routes: vi.fn(async () => ({ routes })),
    communes: vi.fn(async () => ({
      communes: [{ code: "demo-norte", display_name: "Comuna Demo Norte" }],
    })),
    setPublication: vi.fn(async (input: { publication_requested: boolean }) => {
      state = { ...state, publication_requested: input.publication_requested };
      return state;
    }),
    createRoute: vi.fn(async () => {
      routes = [route];
      return route;
    }),
    updateRoute: vi.fn(
      async (
        _id: number,
        input: RouteInput & { expected_revision: number },
      ) => {
        routes = [
          {
            ...route,
            ...input,
            id: route.id,
            revision: input.expected_revision + 1,
          },
        ];
        return routes[0];
      },
    ),
  };
  return api;
}

test("driver sees blockers, requests publication, creates and deactivates a route", async () => {
  const api = driverApi();
  render(<DriverPublicationScreen api={api as unknown as AuthApi} />);
  expect(
    await screen.findByText("Tu servicio no está visible para apoderados"),
  ).toBeTruthy();
  expect(screen.getByText("Falta un plan asignado")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Solicitar publicación" }).className,
  ).toContain("button-primary");
  fireEvent.click(screen.getByText("Solicitar publicación"));
  expect(
    await screen.findByText("Retirar solicitud de publicación"),
  ).toBeTruthy();
  fireEvent.click(screen.getByText("Retirar solicitud de publicación"));
  expect(await screen.findByText("Solicitar publicación")).toBeTruthy();
  expect(api.setPublication).toHaveBeenLastCalledWith({
    publication_requested: false,
  });
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ida demo" },
  });
  fireEvent.click(screen.getByLabelText("Lunes"));
  fireEvent.click(screen.getByLabelText("Comuna Demo Norte"));
  fireEvent.change(screen.getByLabelText("Nombre del destino"), {
    target: { value: "Escuela demo" },
  });
  fireEvent.change(screen.getByLabelText("Dirección del destino (privada)"), {
    target: { value: "Dirección privada" },
  });
  fireEvent.change(screen.getByLabelText("Hora de inicio"), {
    target: { value: "07:30" },
  });
  fireEvent.change(screen.getByLabelText("Hora de término"), {
    target: { value: "08:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear ruta" }));
  expect(api.createRoute).toHaveBeenCalledWith(
    expect.objectContaining({ start_time: "07:30", end_time: "08:30" }),
  );
  expect(await screen.findByText(/Ida demo/)).toBeTruthy();
  expect(screen.getByText(/Próximo servicio: 28\/09\/2026/)).toBeTruthy();
  fireEvent.click(screen.getByText("Editar"));
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ida corregida" },
  });
  fireEvent.click(screen.getByText("Guardar cambios"));
  expect(await screen.findByText(/Ida corregida/)).toBeTruthy();
  expect(api.updateRoute).toHaveBeenCalledWith(
    10,
    expect.objectContaining({ label: "Ida corregida", expected_revision: 1 }),
  );
  fireEvent.click(screen.getByText("Desactivar"));
  await waitFor(() =>
    expect(api.updateRoute).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ status: "inactive", expected_revision: 2 }),
    ),
  );
  await waitFor(() => expect(api.publication).toHaveBeenCalledTimes(6));
  expect(screen.getByLabelText("Plan actual").textContent).toContain(
    "Sin plan activo",
  );
});

test("eligible driver sees success and plan summary", async () => {
  const api = driverApi();
  api.publication.mockResolvedValue({
    ...blocked,
    publication_requested: true,
    eligible: true,
    blockers: [],
    active_route_count: 1,
    subscription: {
      plan_code: "basic",
      plan_label: "Basic",
      status: "active",
      starts_at: "2026-09-01T00:00:00Z",
      ends_at: "2026-10-01T00:00:00Z",
    },
  });
  render(<DriverPublicationScreen api={api as unknown as AuthApi} />);
  expect(
    await screen.findByText("Tu servicio está visible para apoderados"),
  ).toBeTruthy();
  const plan = screen.getByLabelText("Plan actual");
  expect(plan.querySelector(".plan-name")?.textContent).toBe("BASIC");
  expect(plan.textContent).toContain("Activo");
  expect(plan.textContent).toContain("Vigente hasta");
  expect(screen.getByText("Validación aprobada")).toBeTruthy();
  expect(screen.getByText("1 ruta activa completa")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Actualizar estado" }).className,
  ).toContain("button-link");
});

test("switching publication and routes keeps an unfinished route", async () => {
  const api = driverApi();
  function Harness() {
    const [section, setSection] = useState<"publication" | "routes">("routes");
    return (
      <>
        <button onClick={() => setSection("publication")}>
          Ver publicación
        </button>
        <button onClick={() => setSection("routes")}>Ver rutas</button>
        <DriverPublicationScreen
          api={api as unknown as AuthApi}
          activeSection={section}
        />
      </>
    );
  }
  render(<Harness />);
  await screen.findByLabelText("Nombre de la ruta");
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ruta por guardar" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ver publicación" }));
  expect(
    screen.getByRole("heading", { name: "Estado de publicación" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Mis rutas" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver rutas" }));
  expect(
    (screen.getByLabelText("Nombre de la ruta") as HTMLInputElement).value,
  ).toBe("Ruta por guardar");
});

test("admin sees blockers and saves an audited bounded plan action with Chilean date entry", async () => {
  let current: AdminSubscription = { publication: blocked, version: null };
  const changeSubscription = vi.fn(
    async (_id: number, input: SubscriptionInput) => {
      current = {
        publication: {
          ...blocked,
          subscription: {
            plan_code: input.plan_code,
            plan_label: input.plan_code,
            status: input.status,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
          },
        },
        version: (current.version ?? 10) + 1,
      };
      return current;
    },
  );
  const api = {
    adminSubscription: vi.fn(async () => current),
    plans: vi.fn(async () => ({
      plans: [
        { code: "basic", display_label: "Basic" },
        { code: "pro", display_label: "Pro" },
        { code: "elite", display_label: "Elite" },
      ],
    })),
    changeSubscription,
  };
  render(
    <AdminPublicationScreen api={api as unknown as AuthApi} driverId={7} />,
  );
  expect(await screen.findByText("Falta un plan asignado")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
    target: { value: "01/10/2026" },
  });
  fireEvent.change(screen.getByLabelText("Fecha de término"), {
    target: { value: "02/10/2026" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Asignación demo" },
  });
  fireEvent.click(screen.getByText("Guardar plan"));
  await waitFor(() =>
    expect(changeSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        plan_code: "basic",
        status: "active",
        reason: "Asignación demo",
        expected_version: null,
      }),
    ),
  );
  const sent = changeSubscription.mock.calls[0]![1];
  expect(sent.starts_at).toBe(chileInstant("01/10/2026", "00:00"));
  expect(sent.ends_at).toBe(chileInstant("02/10/2026", "00:00"));
  await waitFor(() => expect(api.adminSubscription).toHaveBeenCalledTimes(2));
  expect(screen.getAllByPlaceholderText("DD/MM/AAAA")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "pro" } });
  fireEvent.change(screen.getByLabelText("Estado"), {
    target: { value: "suspended" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Suspensión demo" },
  });
  fireEvent.click(screen.getByText("Guardar plan"));
  await waitFor(() =>
    expect(changeSubscription).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({
        plan_code: "pro",
        status: "suspended",
        reason: "Suspensión demo",
        expected_version: 11,
      }),
    ),
  );
  await waitFor(() => expect(api.adminSubscription).toHaveBeenCalledTimes(3));
  fireEvent.change(screen.getByLabelText("Estado"), {
    target: { value: "active" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Reactivación demo" },
  });
  fireEvent.click(screen.getByText("Guardar plan"));
  await waitFor(() =>
    expect(changeSubscription).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({
        plan_code: "pro",
        status: "active",
        reason: "Reactivación demo",
        expected_version: 12,
      }),
    ),
  );
  await waitFor(() => expect(api.adminSubscription).toHaveBeenCalledTimes(4));
});

test("Chile local conversion never assumes US ordering and rejects ambiguous transition hour", () => {
  expect(chileDateTimeParts("2026-10-01T12:30:00Z")).toEqual({
    date: "01/10/2026",
    time: "09:30",
  });
  expect(chileInstant("10/01/2026", "09:30")).not.toBe(
    chileInstant("01/10/2026", "09:30"),
  );
  expect(chileInstant("13/13/2026", "09:30")).toBeNull();
});

test("route and subscription times use native minute controls and primary actions stay blue", async () => {
  const driver = driverApi();
  render(<DriverPublicationScreen api={driver as unknown as AuthApi} />);
  await screen.findByText("Tu servicio no está visible para apoderados");
  expect(screen.getByLabelText("Hora de inicio").getAttribute("type")).toBe(
    "time",
  );
  expect(screen.getByLabelText("Hora de término").getAttribute("step")).toBe(
    "60",
  );
  expect(
    screen.getByRole("button", { name: "Crear ruta" }).className,
  ).toContain("button-primary");
  cleanup();
  const api = {
    adminSubscription: vi.fn(async () => ({
      publication: blocked,
      version: null,
    })),
    plans: vi.fn(async () => ({
      plans: [{ code: "basic", display_label: "Basic" }],
    })),
    changeSubscription: vi.fn(async () => ({
      publication: blocked,
      version: 1,
    })),
  };
  render(
    <AdminPublicationScreen api={api as unknown as AuthApi} driverId={7} />,
  );
  await screen.findByText("Falta un plan asignado");
  const startTime = screen.getByLabelText("Hora de inicio") as HTMLInputElement;
  const endTime = screen.getByLabelText("Hora de término") as HTMLInputElement;
  for (const input of [startTime, endTime]) {
    expect(input.type).toBe("time");
    expect(input.lang).toBe("es-CL");
    expect(input.step).toBe("60");
    expect(input.value).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  }
  expect(
    screen.getByRole("button", { name: "Guardar plan" }).className,
  ).toContain("button-primary");
});

test("calendar-selected subscription dates and native times submit exact Chilean UTC instants", async () => {
  const changeSubscription = vi.fn(async () => ({
    publication: blocked,
    version: 1,
  }));
  const api = {
    adminSubscription: vi.fn(async () => ({
      publication: blocked,
      version: null,
    })),
    plans: vi.fn(async () => ({
      plans: [{ code: "basic", display_label: "Basic" }],
    })),
    changeSubscription,
  };
  render(
    <AdminPublicationScreen api={api as unknown as AuthApi} driverId={7} />,
  );
  await screen.findByText("Falta un plan asignado");
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
    target: { value: "01/10/2026" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir calendario de fecha de inicio" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "2 de octubre de 2026" }));
  fireEvent.change(screen.getByLabelText("Fecha de término"), {
    target: { value: "03/10/2026" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Abrir calendario de fecha de término",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "4 de octubre de 2026" }));
  fireEvent.change(screen.getByLabelText("Hora de inicio"), {
    target: { value: "09:30" },
  });
  fireEvent.change(screen.getByLabelText("Hora de término"), {
    target: { value: "10:30" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Plan demo" },
  });
  expect(
    (screen.getByLabelText("Fecha de inicio") as HTMLInputElement).value,
  ).toBe("02/10/2026");
  expect(
    (screen.getByLabelText("Fecha de término") as HTMLInputElement).value,
  ).toBe("04/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await waitFor(() =>
    expect(changeSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        starts_at: chileInstant("02/10/2026", "09:30"),
        ends_at: chileInstant("04/10/2026", "10:30"),
      }),
    ),
  );
});
