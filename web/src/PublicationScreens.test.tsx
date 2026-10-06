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
import { ApiError, AuthApi } from "./api";
import type {
  AdminSubscription,
  Publication,
  Route,
  RouteInput,
  SubscriptionInput,
} from "./api-types";

afterEach(cleanup);
const blocked: Publication = {
  profile_status: "active",
  publication_requested: false,
  eligible: false,
  blockers: [
    {
      code: "subscription_missing",
      message: "Aún no tienes un plan asignado.",
    },
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
  expect(await screen.findByText("Aún no visible")).toBeTruthy();
  expect(screen.getByText("Aún no tienes un plan asignado.")).toBeTruthy();
  expect(
    screen.getByRole("button", {
      name: "Solicitar que mi servicio sea visible",
    }).className,
  ).toContain("button-primary");
  fireEvent.click(screen.getByText("Solicitar que mi servicio sea visible"));
  expect(await screen.findByText("Dejar de mostrar mi servicio")).toBeTruthy();
  fireEvent.click(screen.getByText("Dejar de mostrar mi servicio"));
  expect(
    await screen.findByText("Solicitar que mi servicio sea visible"),
  ).toBeTruthy();
  expect(api.setPublication).toHaveBeenLastCalledWith({
    publication_requested: false,
  });
  expect(screen.queryByLabelText("Nombre de la ruta")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Crear primera ruta" }));
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ida demo" },
  });
  fireEvent.click(screen.getByLabelText("Lunes"));
  fireEvent.change(screen.getByLabelText("Hora de inicio"), {
    target: { value: "07:30" },
  });
  fireEvent.change(screen.getByLabelText("Hora de término"), {
    target: { value: "08:30" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar: cupos y cobertura" }),
  );
  fireEvent.click(screen.getByLabelText("Comuna Demo Norte"));
  fireEvent.change(screen.getByLabelText("Nombre del destino"), {
    target: { value: "Escuela demo" },
  });
  fireEvent.change(screen.getByLabelText("Dirección del destino (privada)"), {
    target: { value: "Dirección privada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Revisar ruta" }));
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
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar: cupos y cobertura" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Revisar ruta" }));
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
  expect(await screen.findByText("Visible para apoderados")).toBeTruthy();
  const plan = screen.getByLabelText("Plan actual");
  expect(plan.querySelector(".plan-name")?.textContent).toBe("Basic");
  expect(plan.textContent).toContain("Activo");
  expect(plan.textContent).toContain("Vigente hasta");
  expect(screen.getByText("Información aprobada")).toBeTruthy();
  expect(screen.getByText("Ruta activa y completa")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Actualizar estado" }).className,
  ).toContain("button-link");
  expect(api.routes).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  const refresh = screen.getByRole("button", { name: "Actualizar rutas" });
  expect(refresh.className).toContain("button-link driver-refresh");
  fireEvent.click(refresh);
  await waitFor(() => expect(api.routes).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect((refresh as HTMLButtonElement).disabled).toBe(false),
  );
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
  fireEvent.click(
    await screen.findByRole("button", { name: "Crear primera ruta" }),
  );
  await screen.findByLabelText("Nombre de la ruta");
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ruta por guardar" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ver publicación" }));
  expect(
    screen.getByRole("heading", { name: "Visibilidad de tu servicio" }),
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
  expect(await screen.findByText("Falta un plan activo.")).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
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
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
  expect(screen.getAllByPlaceholderText("DD/MM/AAAA")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "pro" } });
  fireEvent.change(screen.getByLabelText("Estado del plan"), {
    target: { value: "suspended" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Suspensión demo" },
  });
  expect((screen.getByText("Guardar plan") as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(
    screen.getByLabelText(
      "Confirmo que este plan dejará de habilitar la visibilidad",
    ),
  );
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
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
  fireEvent.change(screen.getByLabelText("Estado del plan"), {
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
  await screen.findByText("Aún no visible");
  fireEvent.click(screen.getByRole("button", { name: "Crear primera ruta" }));
  expect(screen.getByLabelText("Hora de inicio").getAttribute("type")).toBe(
    "time",
  );
  expect(screen.getByLabelText("Hora de término").getAttribute("step")).toBe(
    "60",
  );
  expect(
    screen.getByRole("button", { name: "Continuar: cupos y cobertura" })
      .className,
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
  await screen.findAllByText("Sin plan asignado");
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
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
  await screen.findAllByText("Sin plan asignado");
  fireEvent.click(
    await screen.findByRole("button", { name: "Administrar plan" }),
  );
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

test("route server validation remains inline and frozen-day conflicts explain the protection", async () => {
  const api = driverApi();
  api.routes.mockResolvedValue({ routes: [route] });
  api.updateRoute.mockRejectedValueOnce(
    new ApiError(400, "validation_error", "Invalid", {
      end_time: ["El horario final debe ser posterior al inicial."],
    }),
  );
  render(
    <DriverPublicationScreen
      api={api as unknown as AuthApi}
      activeSection="routes"
    />,
  );
  await screen.findByText("Ida demo");
  expect(screen.getByText("Lun")).toBeTruthy();
  expect(screen.getByText("07:00 → 08:00")).toBeTruthy();
  expect(screen.getByText(/Cobertura: Comuna Demo Norte/)).toBeTruthy();
  expect(screen.getByText("0 de 3 cupos utilizados")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar: cupos y cobertura" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Revisar ruta" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText("Hora de término").getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(
    screen.getByLabelText("Hora de término").getAttribute("aria-describedby"),
  ).toContain("driver-end_time-error");
  api.updateRoute.mockRejectedValueOnce(
    new ApiError(409, "run_conflict", "frozen"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "No puedes cambiar esta ruta porque el servicio de hoy ya comenzó",
  );
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect(
    (screen.getByLabelText("Nombre de la ruta") as HTMLInputElement).value,
  ).toBe("Ida demo");
});

test("publication retry never treats requested-but-blocked as visible", async () => {
  const api = driverApi();
  api.publication.mockRejectedValueOnce(new Error("network"));
  render(
    <DriverPublicationScreen
      api={api as unknown as AuthApi}
      activeSection="publication"
    />,
  );
  await screen.findByRole("alert");
  expect(screen.queryByText("Visible para apoderados")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Aún no visible");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Solicitar que mi servicio sea visible",
    }),
  );
  await screen.findByText(
    /Pediste que tu servicio sea visible, pero aún falta/,
  );
  expect(screen.getByText("Aún no visible")).toBeTruthy();
  expect(api.setPublication).toHaveBeenCalledWith({
    publication_requested: true,
  });
  expect(api.publication).toHaveBeenCalledTimes(3);
});

test("technical blockers become actionable Spanish without revision numbers or raw codes", async () => {
  const api = driverApi();
  api.publication.mockResolvedValue({
    ...blocked,
    publication_requested: true,
    current_validation_revision: 8,
    blockers: [
      { code: "approved_revision_stale", message: "approved_revision_stale" },
      {
        code: "required_document_expired",
        message: "required_document_expired",
      },
      { code: "subscription_suspended", message: "subscription_suspended" },
      {
        code: "profile_display_name_missing",
        message: "profile_display_name_missing",
      },
    ],
  });
  render(
    <DriverPublicationScreen
      api={api as unknown as AuthApi}
      activeSection="publication"
    />,
  );
  await screen.findByText("Aún no visible");
  expect(
    screen.getByText(
      "Los cambios en tu información necesitan una nueva revisión.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Un documento requerido está vencido.")).toBeTruthy();
  expect(screen.getByText("Tu plan está suspendido.")).toBeTruthy();
  expect(screen.getByText("Completa el nombre de tu servicio.")).toBeTruthy();
  expect(
    screen.queryByText(
      /approved_revision_stale|subscription_suspended|Revisión 8/,
    ),
  ).toBeNull();
});

test("route creation discloses one stage at a time, reviews exact data, and Escape returns to the list", async () => {
  const api = driverApi();
  render(
    <DriverPublicationScreen
      api={api as unknown as AuthApi}
      activeSection="routes"
    />,
  );
  const start = await screen.findByRole("button", {
    name: "Crear primera ruta",
  });
  expect(screen.queryByLabelText("Nombre de la ruta")).toBeNull();
  start.focus();
  fireEvent.click(start);
  const panel = screen.getByRole("region", { name: "Crear ruta" });
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Crear ruta" }),
  );
  expect(screen.queryByLabelText("Nombre del destino")).toBeNull();
  fireEvent.change(screen.getByLabelText("Nombre de la ruta"), {
    target: { value: "Ruta nueva ficticia" },
  });
  fireEvent.click(screen.getByLabelText("Lunes"));
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar: cupos y cobertura" }),
  );
  expect(screen.queryByLabelText("Nombre de la ruta")).toBeNull();
  fireEvent.change(screen.getByLabelText("Nombre del destino"), {
    target: { value: "Destino ficticio" },
  });
  fireEvent.change(screen.getByLabelText("Dirección del destino (privada)"), {
    target: { value: "Dirección ficticia" },
  });
  fireEvent.click(screen.getByLabelText("Comuna Demo Norte"));
  fireEvent.click(screen.getByRole("button", { name: "Revisar ruta" }));
  expect(screen.queryByLabelText("Nombre del destino")).toBeNull();
  expect(
    screen.getByRole("region", { name: "Revisión de la ruta" }).textContent,
  ).toContain("Ruta nueva ficticia");
  expect(api.createRoute).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(
    (screen.getByLabelText("Nombre del destino") as HTMLInputElement).value,
  ).toBe("Destino ficticio");
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Crear ruta" })).toBeNull();
  expect(document.activeElement).toBe(start);
  fireEvent.click(screen.getByRole("button", { name: "Crear ruta" }));
  expect(
    (screen.getByLabelText("Nombre de la ruta") as HTMLInputElement).value,
  ).toBe("");
});
