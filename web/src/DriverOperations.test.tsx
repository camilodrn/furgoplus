import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, test, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { ApiError, type AuthApi } from "./api";
import type { Assignment, Payment } from "./api-types";
import {
  DriverPayments,
  DriverRoster,
  DriverSummaryScreen,
} from "./DriverOperations";

const assignment: Assignment = {
  id: 5,
  route_id: 2,
  student_display_name: "Estudiante Ficticio",
  pickup_instruction: "Parada ficticia",
  guardian_display_name: "Apoderado Ficticio",
  guardian_contact: "912345678",
  starts_on: "2026-09-28",
  ends_on: null,
  created_at: "2026-09-24T00:00:00Z",
  updated_at: "2026-09-24T00:00:00Z",
};
const route = {
  id: 2,
  revision: 1,
  label: "Ruta ficticia",
  status: "active" as const,
  weekdays: ["monday" as const],
  start_time: "07:00",
  end_time: "08:00",
  seat_capacity: 1,
  next_service_date: "2026-09-28",
  used_seats: 0,
  available_seats: 1,
  destination_label: "Escuela ficticia",
  destination_address: "Dirección ficticia",
  coverage_codes: ["demo"],
};
const payment: Payment = {
  id: 8,
  assignment_id: 5,
  service_period_start: "2026-09-28",
  service_period_end: "2026-10-28",
  amount_clp: 50000,
  due_on: "2026-10-05",
  status: "pending",
  paid_at: null,
  created_at: "2026-09-24T00:00:00Z",
  updated_at: "2026-09-24T00:00:00Z",
};

afterEach(cleanup);

test.each(["roster", "payments"])(
  "%s required selections produce Spanish feedback and preserve the draft without writing",
  async (area) => {
    const api = {
      routes: vi.fn(async () => ({ routes: [route] })),
      assignments: vi.fn(async () => ({ assignments: [assignment] })),
      payments: vi.fn(async () => ({ payments: [] })),
      createAssignment: vi.fn(),
      createPayment: vi.fn(),
    };
    render(
      area === "roster" ? (
        <DriverRoster api={api as unknown as AuthApi} />
      ) : (
        <DriverPayments api={api as unknown as AuthApi} />
      ),
    );
    const open = await screen.findByRole("button", {
      name: area === "roster" ? "Agregar pasajero" : /Registrar pago$/,
    });
    await waitFor(() => expect(open.hasAttribute("disabled")).toBe(false));
    fireEvent.click(open);
    const label = area === "roster" ? "Nombre del estudiante" : "Monto CLP";
    const value = area === "roster" ? "Estudiante ficticio" : "30000";
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(
      screen.getByRole("button", {
        name: area === "roster" ? "Crear asignación" : "Registrar pendiente",
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Revisa los campos obligatorios y su formato.",
    );
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(
      value,
    );
    expect(api.createAssignment).not.toHaveBeenCalled();
    expect(api.createPayment).not.toHaveBeenCalled();
  },
);

test("roster creates, edits and ends an owned fictional assignment", async () => {
  let rows: Assignment[] = [];
  const api = {
    routes: vi.fn(async () => ({ routes: [route] })),
    assignments: vi.fn(async () => ({ assignments: rows })),
    createAssignment: vi.fn(async (input: Assignment) => {
      rows = [{ ...assignment, ...input }];
      return rows[0];
    }),
    updateAssignment: vi.fn(async (_id: number, input: Partial<Assignment>) => {
      rows = [{ ...rows[0]!, ...input }];
      return rows[0];
    }),
    endAssignment: vi.fn(async (_id: number, endsOn: string) => {
      rows = [{ ...rows[0]!, ends_on: endsOn }];
      return rows[0];
    }),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no tienes pasajeros asignados.");
  expect(screen.queryByLabelText("Nombre del estudiante")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Agregar primer pasajero" }),
  );
  fireEvent.change(screen.getByLabelText("Ruta"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Nombre del estudiante"), {
    target: { value: assignment.student_display_name },
  });
  fireEvent.change(screen.getByLabelText("Instrucciones de recogida"), {
    target: { value: assignment.pickup_instruction },
  });
  fireEvent.change(screen.getByLabelText("Nombre del apoderado"), {
    target: { value: assignment.guardian_display_name },
  });
  const phone = screen.getByLabelText(
    "Teléfono del apoderado",
  ) as HTMLInputElement;
  expect(phone.maxLength).toBe(9);
  expect(phone.inputMode).toBe("numeric");
  fireEvent.change(phone, {
    target: { value: "a91234567890" },
  });
  expect(phone.value).toBe("912345678");
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
    target: { value: "28/09/2026" },
  });
  expect(
    (screen.getByLabelText("Fecha de inicio") as HTMLInputElement).value,
  ).toBe("28/09/2026");
  expect(
    (screen.getByLabelText("Fecha de inicio") as HTMLInputElement).type,
  ).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  await waitFor(() => expect(api.createAssignment).toHaveBeenCalledOnce());
  expect(api.createAssignment).toHaveBeenCalledWith(
    expect.objectContaining({
      guardian_contact: "912345678",
      starts_on: "2026-09-28",
      ends_on: null,
    }),
  );
  await screen.findByText("Estudiante Ficticio");
  expect(
    within(
      screen.getByRole("complementary", { name: "Aviso de la acción" }),
    ).getByRole("status").textContent,
  ).toContain("Pasajero agregado correctamente");
  expect(screen.getByText(/28\/09\/2026–sin término/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(
    (screen.getByLabelText("Fecha de inicio") as HTMLInputElement).value,
  ).toBe("28/09/2026");
  fireEvent.change(screen.getByLabelText("Fecha de término (opcional)"), {
    target: { value: "27/11/2026" },
  });
  fireEvent.change(screen.getByLabelText("Nombre del estudiante"), {
    target: { value: "Estudiante Ficticio 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(api.updateAssignment).toHaveBeenCalledOnce());
  expect(api.updateAssignment).toHaveBeenCalledWith(
    5,
    expect.objectContaining({ ends_on: "2026-11-27" }),
  );
  expect(screen.getByText(/28\/09\/2026–27\/11\/2026/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Finalizar asignación" }));
  fireEvent.change(screen.getByLabelText("Último día de traslado"), {
    target: { value: "31/02/2026" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  );
  expect(api.endAssignment).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Último día de traslado"), {
    target: { value: "28/09/2026" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  );
  await waitFor(() =>
    expect(api.endAssignment).toHaveBeenCalledWith(5, "2026-09-28"),
  );
});

test("roster rejects invalid Chilean dates and short guardian phones", async () => {
  const api = {
    routes: vi.fn(async () => ({ routes: [route] })),
    assignments: vi.fn(async () => ({ assignments: [] })),
    createAssignment: vi.fn(),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no tienes pasajeros asignados.");
  expect(screen.queryByLabelText("Nombre del estudiante")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Agregar primer pasajero" }),
  );
  fireEvent.change(screen.getByLabelText("Ruta"), { target: { value: "2" } });
  for (const [label, value] of [
    ["Nombre del estudiante", "Estudiante Ficticio"],
    ["Instrucciones de recogida", "Parada ficticia"],
    ["Nombre del apoderado", "Apoderado Ficticio"],
    ["Teléfono del apoderado", "912345678"],
    ["Fecha de inicio", "31/02/2026"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  expect(api.createAssignment).not.toHaveBeenCalled();
  expect(
    screen.getByLabelText("Fecha de inicio").getAttribute("aria-invalid"),
  ).toBe("true");
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
    target: { value: "28/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono del apoderado"), {
    target: { value: "12345678" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  expect(api.createAssignment).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole("alert")).getByText(/exactamente 9 dígitos/),
  ).toBeTruthy();
});

test("payments create pending then mark paid and void", async () => {
  let rows: Payment[] = [];
  const api = {
    payments: vi.fn(async () => ({ payments: rows })),
    assignments: vi.fn(async () => ({ assignments: [assignment] })),
    createPayment: vi.fn(async () => {
      rows = [payment];
      return payment;
    }),
    markPaymentPaid: vi.fn(async () => {
      rows = [
        {
          ...payment,
          status: "paid" as const,
          paid_at: "2026-09-28T12:00:00Z",
        },
      ];
      return rows[0];
    }),
    voidPayment: vi.fn(async () => {
      rows = [{ ...rows[0]!, status: "void" as const }];
      return rows[0];
    }),
  };
  render(<DriverPayments api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no has registrado pagos.");
  expect(screen.queryByLabelText("Monto CLP")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Registrar pago$/ }));
  fireEvent.change(screen.getByLabelText("Asignación"), {
    target: { value: "5" },
  });
  const amount = screen.getByLabelText("Monto CLP") as HTMLInputElement;
  expect(amount.value).toBe("");
  fireEvent.change(amount, { target: { value: "30000" } });
  expect(amount.value).toBe("30000");
  fireEvent.change(amount, { target: { value: "" } });
  expect(amount.value).toBe("");
  fireEvent.change(screen.getByLabelText("Inicio del período"), {
    target: { value: "28/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Fin del período"), {
    target: { value: "28/10/2026" },
  });
  fireEvent.change(amount, { target: { value: "30000" } });
  fireEvent.change(screen.getByLabelText("Vencimiento"), {
    target: { value: "05/10/2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar pendiente" }));
  await waitFor(() => expect(api.createPayment).toHaveBeenCalledOnce());
  expect(api.createPayment).toHaveBeenCalledWith({
    assignment_id: 5,
    service_period_start: "2026-09-28",
    service_period_end: "2026-10-28",
    amount_clp: 30000,
    due_on: "2026-10-05",
  });
  expect(screen.queryByLabelText("Monto CLP")).toBeNull();
  const disclosure = screen.getByText("Ver registro").closest("details")!;
  expect(disclosure.open).toBe(false);
  fireEvent.click(screen.getByText("Ver registro"));
  expect(disclosure.open).toBe(true);
  expect(
    screen.getByText(
      /Período: 28\/09\/2026–28\/10\/2026 · Vence: 05\/10\/2026/,
    ),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Marcar pagado" }));
  await waitFor(() => expect(api.markPaymentPaid).toHaveBeenCalledWith(8));
  expect(screen.getByText(/Pagado: 28\/09\/2026/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Anular" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar anulación" }));
  await waitFor(() => expect(api.voidPayment).toHaveBeenCalledWith(8));
  expect(screen.queryByRole("button", { name: "Marcar pagado" })).toBeNull();
});

test("payment refuses blank, zero, negative, decimal and invalid dates", async () => {
  const api = {
    payments: vi.fn(async () => ({ payments: [] })),
    assignments: vi.fn(async () => ({ assignments: [assignment] })),
    createPayment: vi.fn(),
  };
  render(<DriverPayments api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no has registrado pagos.");
  expect(screen.queryByLabelText("Monto CLP")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Registrar pago$/ }));
  fireEvent.change(screen.getByLabelText("Asignación"), {
    target: { value: "5" },
  });
  for (const [label, value] of [
    ["Inicio del período", "28/09/2026"],
    ["Fin del período", "28/10/2026"],
    ["Vencimiento", "05/10/2026"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = screen.getByRole("button", { name: "Registrar pendiente" });
  const amount = screen.getByLabelText("Monto CLP") as HTMLInputElement;
  for (const value of ["", "0", "-1", "1.5"]) {
    fireEvent.change(amount, { target: { value } });
    fireEvent.click(submit);
    expect(api.createPayment).not.toHaveBeenCalled();
  }
  fireEvent.change(amount, { target: { value: "30000" } });
  fireEvent.change(screen.getByLabelText("Vencimiento"), {
    target: { value: "31/02/2026" },
  });
  fireEvent.click(submit);
  expect(api.createPayment).not.toHaveBeenCalled();
  expect(
    screen.getByLabelText("Vencimiento").getAttribute("aria-invalid"),
  ).toBe("true");
});

test("summary shows dated route capacity and payment state", async () => {
  const api = {
    driverContactRequests: vi.fn(async () => ({ results: [] })),
    summary: vi.fn(async () => ({
      publication: {
        profile_status: "active",
        publication_requested: true,
        current_validation_revision: 1,
        approved_revision: 1,
        active_route_count: 1,
        coverage: [],
        blockers: [],
        validation_state: "approved",
        eligible: true,
        subscription: null,
      },
      routes: [route],
      active_assignments: 1,
      payment_counts: { pending: 1, paid: 0, void: 0 },
    })),
  };
  render(<DriverSummaryScreen api={api as unknown as AuthApi} />);
  expect(await screen.findByText(/0 de 1 cupos utilizados/)).toBeTruthy();
  expect(screen.getByText(/Próximo servicio: 28\/09\/2026/)).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
  ).toContain("1 pendientes");
});

test("driver summary refreshes suspension, deactivation and subscription blockers without hiding owner controls", async () => {
  const base = {
    profile_status: "active" as const,
    publication_requested: true,
    eligible: true,
    blockers: [],
    validation_state: "approved" as const,
    current_validation_revision: 1,
    approved_revision: 1,
    subscription: {
      plan_code: "basic" as const,
      plan_label: "Basic",
      status: "active" as const,
      starts_at: "2026-10-01T03:00:00Z",
      ends_at: "2026-11-01T03:00:00Z",
    },
    active_route_count: 1,
    coverage: [],
  };
  const data = {
    publication: base,
    routes: [route],
    active_assignments: 1,
    payment_counts: { pending: 1, paid: 0, void: 0 },
  };
  const api = {
    driverContactRequests: vi.fn(async () => ({ results: [] })),
    summary: vi.fn(async () => data),
  };
  render(<DriverSummaryScreen api={api as unknown as AuthApi} />);
  await screen.findByText("Tu servicio está visible");
  expect(screen.queryByText(/Revisión 1/)).toBeNull();
  expect(
    screen.getByRole("region", { name: "Resumen de rutas" }).textContent,
  ).toContain("1 activas");
  for (const [status, code, message] of [
    ["suspended", "driver_suspended", "Tu servicio está suspendido."],
    ["deactivated", "driver_deactivated", "Tu servicio está desactivado."],
    ["active", "subscription_suspended", "Tu plan está suspendido."],
    ["active", "subscription_expired", "Tu plan terminó."],
  ] as const) {
    api.summary.mockResolvedValueOnce({
      ...data,
      publication: {
        ...base,
        profile_status: status,
        eligible: false,
        subscription: {
          ...base.subscription,
          status: code === "subscription_suspended" ? "suspended" : "active",
          ends_at:
            code === "subscription_expired"
              ? "2026-10-02T03:00:00Z"
              : base.subscription.ends_at,
        },
        blockers: [{ code, message }],
      },
    } as typeof data);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByText(message);
    expect(
      screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
    ).toContain("1 pendientes");
    expect(screen.getByText(/Próximo servicio:/)).toBeTruthy();
  }
});

test("home reserves retry for read errors and keeps manual refresh after recovery", async () => {
  const summary = {
    publication: {
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
    },
    routes: [route],
    active_assignments: 1,
    payment_counts: { pending: 1, paid: 0, void: 0 },
  };
  const api = {
    driverContactRequests: vi.fn(async () => ({ results: [] })),
    summary: vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(summary),
  };
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      name="Transporte Escolar Demo UX — "
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Hola, Transporte Escolar Demo UX" }),
  ).toBeTruthy();
  await screen.findByRole("alert");
  expect(api.summary).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Actualizar" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Tu servicio está visible");
  expect(api.summary).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Reintentar/)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  const refresh = screen.getByRole("button", { name: "Actualizar" });
  expect(refresh.className).toContain("button-link driver-refresh");
  api.summary.mockResolvedValueOnce({
    ...summary,
    payment_counts: { pending: 2, paid: 0, void: 0 },
  });
  fireEvent.click(refresh);
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
    ).toContain("2 pendientes"),
  );
  expect(api.summary).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(/Reintentar/)).toBeNull();
});

test("driver summary clears previously loaded private state on confirmed expiry and ignores an older successful refresh", async () => {
  const data = {
    publication: {
      profile_status: "active",
      publication_requested: false,
      eligible: false,
      blockers: [{ code: "subscription_missing", message: "Sin plan" }],
      validation_state: "approved",
      current_validation_revision: 1,
      approved_revision: 1,
      subscription: null,
      active_route_count: 1,
      coverage: [],
    },
    routes: [route],
    active_assignments: 1,
    payment_counts: { pending: 1, paid: 0, void: 0 },
  };
  let resolveOld!: (value: typeof data) => void;
  const old = new Promise<typeof data>((resolve) => {
    resolveOld = resolve;
  });
  const api = {
    driverContactRequests: vi.fn(async () => ({ results: [] })),
    summary: vi
      .fn()
      .mockResolvedValueOnce(data)
      .mockReturnValueOnce(old)
      .mockRejectedValueOnce(new ApiError(403, "not_authenticated", "Expired"))
      .mockResolvedValueOnce(data),
  };
  render(<DriverSummaryScreen api={api as unknown as AuthApi} />);
  await waitFor(() =>
    expect(
      screen.getByRole("region", { name: "Resumen de pagos" }).textContent,
    ).toContain("1 pendientes"),
  );
  expect(screen.getByText(new RegExp(route.label))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "La sesión caducó",
  );
  expect(screen.queryByText(/Pagos:/)).toBeNull();
  await act(async () => resolveOld(data));
  expect(screen.queryByText(new RegExp(route.label))).toBeNull();
  expect(screen.queryByText(/Pagos:/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect(api.summary).toHaveBeenCalledTimes(3);
});

test("visual home follows server blockers and navigates to the exact next task", async () => {
  const onNavigate = vi.fn();
  const api = {
    driverContactRequests: vi.fn(async () => ({
      results: [{ status: "pending" }, { status: "accepted" }],
    })),
    summary: vi.fn(async () => ({
      publication: {
        profile_status: "active",
        validation_state: "approved",
        eligible: false,
        publication_requested: true,
        blockers: [{ code: "active_route_missing", message: "INTERNAL CODE" }],
        subscription: null,
        active_route_count: 0,
        coverage: [],
        current_validation_revision: 7,
        approved_revision: 7,
      },
      routes: [],
      active_assignments: 0,
      payment_counts: { pending: 0, paid: 0, void: 0 },
    })),
  };
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      name="Servicio — Demo"
      onNavigate={onNavigate}
    />,
  );
  await screen.findByText("Tu servicio aún no está visible");
  expect(
    screen.getByRole("heading", { name: "Hola, Servicio — Demo" }),
  ).toBeTruthy();
  expect(screen.getByText(/Pediste que tu servicio sea visible/)).toBeTruthy();
  expect(screen.queryByText("INTERNAL CODE")).toBeNull();
  expect(screen.queryByText(/completa.*validación/i)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Configurar una ruta" }));
  expect(onNavigate).toHaveBeenCalledWith("routes");
  expect(
    (await screen.findByRole("region", { name: "Resumen de solicitudes" }))
      .textContent,
  ).toContain("1 por responder");
  // The backend result stays authoritative even if its other fields look approved.
  api.summary.mockResolvedValueOnce({
    ...(await api.summary()),
    publication: {
      ...(await api.summary()).publication,
      eligible: true,
      blockers: [],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  await screen.findByText("Tu servicio está visible");
  expect(screen.queryByText("Siguiente paso")).toBeNull();
});

test("future passengers use minimal student wording and authoritative capacity rejection", async () => {
  const api = {
    routes: vi.fn(async () => ({ routes: [route] })),
    assignments: vi.fn(async () => ({
      assignments: [{ ...assignment, starts_on: "2099-01-01" }],
    })),
    updateAssignment: vi.fn().mockRejectedValue(
      new ApiError(400, "validation_error", "Capacity", {
        seat_capacity: ["Internal capacity algorithm"],
      }),
    ),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Comienza próximamente");
  expect(
    screen.getByText(/Esta asignación comienza el 01\/01\/2099/),
  ).toBeTruthy();
  expect(screen.getByText(/Esta información es privada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(
    screen.getByText(
      "Usa el nombre habitual y el apellido necesario para distinguirlo.",
    ),
  ).toBeTruthy();
  const input = screen.getByLabelText("Nombre del estudiante");
  expect(input.getAttribute("aria-describedby")).toContain("student-name-help");
  expect(screen.queryByLabelText(/\bRUT\b|legal|nacimiento|médic/i)).toBeNull();
  expect((screen.getByLabelText("Ruta") as HTMLSelectElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Esta ruta no tiene cupos disponibles para esas fechas.",
  );
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect((input as HTMLInputElement).value).toBe(
    assignment.student_display_name,
  );
});

test.each(["roster", "payments"])(
  "%s shows loading, read failure, retry and a truthful empty state",
  async (area) => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((resolvePromise) => {
      resolve = resolvePromise;
    });
    const api = {
      routes: vi.fn(async () => ({ routes: [] })),
      assignments: vi.fn(async () => ({ assignments: [] })),
      payments: vi.fn(async () => ({ payments: [] })),
    };
    if (area === "roster")
      api.assignments.mockReturnValueOnce(pending as never);
    else api.payments.mockReturnValueOnce(pending as never);
    render(
      area === "roster" ? (
        <DriverRoster api={api as unknown as AuthApi} />
      ) : (
        <DriverPayments api={api as unknown as AuthApi} />
      ),
    );
    expect(screen.getByText("Cargando información…")).toBeTruthy();
    expect(screen.queryByText(/Aún no (tienes|has)/)).toBeNull();
    await act(async () => resolve(Promise.reject(new Error("network"))));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText(
      area === "roster"
        ? "Aún no tienes pasajeros asignados."
        : "Aún no has registrado pagos.",
    );
    if (area === "payments")
      expect(
        screen.getByText(/Registra los pagos acordados con las familias/),
      ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    const refresh = screen.getByRole("button", {
      name: area === "roster" ? "Actualizar pasajeros" : "Actualizar pagos",
    });
    expect(refresh.className).toContain("button-link driver-refresh");
    fireEvent.click(refresh);
    const read = area === "roster" ? api.assignments : api.payments;
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect((refresh as HTMLButtonElement).disabled).toBe(false),
    );
  },
);

test("home shows four actionable activation steps, four operational cards and dated informational capacity", async () => {
  const onNavigate = vi.fn();
  const api = {
    driverContactRequests: vi.fn(async () => ({
      results: [{ status: "pending" }],
    })),
    summary: vi.fn(async () => ({
      publication: {
        profile_status: "active",
        publication_requested: false,
        eligible: false,
        validation_state: "approved",
        current_validation_revision: 9,
        approved_revision: 9,
        subscription: null,
        active_route_count: 0,
        coverage: [],
        blockers: [
          { code: "subscription_missing", message: "INTERNAL" },
          { code: "active_route_missing", message: "INTERNAL" },
          { code: "publication_not_requested", message: "INTERNAL" },
        ],
      },
      routes: [{ ...route, used_seats: 1, available_seats: 0 }],
      active_assignments: 1,
      payment_counts: { pending: 2, paid: 4, void: 3 },
    })),
  };
  render(
    <DriverSummaryScreen
      api={api as unknown as AuthApi}
      onNavigate={onNavigate}
    />,
  );
  await screen.findByText("Tu servicio aún no está visible");
  expect(
    screen.getByText("Te faltan 3 pasos para aparecer en FurgoPlus."),
  ).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Progreso de activación" }),
  ).toBeTruthy();
  const path = screen.getByRole("list", {
    name: "Pasos para aparecer en FurgoPlus",
  });
  expect(path.querySelectorAll("li")).toHaveLength(4);
  expect(path.querySelectorAll(".step-complete")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ver qué me falta" }));
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Progreso de activación",
  );
  expect(
    screen.queryByRole("button", {
      name: /Revisar mi plan|cambiar.*plan|asignar.*plan/i,
    }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver estado del plan" }));
  expect(onNavigate).toHaveBeenLastCalledWith("publication");
  fireEvent.click(screen.getByRole("button", { name: "Configurar una ruta" }));
  expect(onNavigate).toHaveBeenLastCalledWith("routes");
  expect(
    screen.getAllByRole("region", {
      name: /^Resumen de (rutas|pasajeros|solicitudes|pagos)$/,
    }),
  ).toHaveLength(4);
  const meter = screen.getByRole("meter", {
    name: "Cupos utilizados para el 28/09/2026",
  });
  expect(meter.getAttribute("value")).toBe("1");
  expect(meter.getAttribute("max")).toBe("1");
  expect(screen.queryByRole("button", { name: /asiento|cupo/i })).toBeNull();
  expect(screen.queryByText(/INTERNAL|active|approved|Revisión 9/)).toBeNull();
});

test.each(["roster", "payments"])(
  "%s keeps the default list and restores keyboard focus after closing a private draft",
  async (area) => {
    const api = {
      routes: vi.fn(async () => ({ routes: [route] })),
      assignments: vi.fn(async () => ({ assignments: [assignment] })),
      payments: vi.fn(async () => ({
        payments: [
          payment,
          {
            ...payment,
            id: 9,
            status: "paid",
            paid_at: "2026-09-28T12:00:00Z",
          },
          { ...payment, id: 10, status: "void" },
        ],
      })),
    };
    render(
      area === "roster" ? (
        <DriverRoster api={api as unknown as AuthApi} />
      ) : (
        <DriverPayments api={api as unknown as AuthApi} />
      ),
    );
    const field = area === "roster" ? "Nombre del estudiante" : "Monto CLP";
    const action = area === "roster" ? "Agregar pasajero" : "Registrar pago";
    const trigger = await screen.findByRole("button", { name: action });
    await screen.findAllByText(assignment.student_display_name);
    expect(screen.queryByLabelText(field)).toBeNull();
    if (area === "payments") {
      const counts = screen.getAllByRole("definition")[0]!.parentElement;
      expect(counts?.textContent).toContain("Pendientes1");
      expect(
        screen.getAllByRole("definition").map((item) => item.textContent),
      ).toEqual(["1", "1", "1"]);
    }
    trigger.focus();
    fireEvent.click(trigger);
    if (area === "payments")
      expect(
        screen.getByText(
          "FurgoPlus solo registra este pago. No procesa ni cobra dinero.",
        ),
      ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(field), {
      target: { value: area === "roster" ? "Borrador ficticio" : "45000" },
    });
    fireEvent.keyDown(
      screen.getByRole("region", {
        name:
          area === "roster" ? "Agregar pasajero" : "Registrar pago pendiente",
      }),
      { key: "Escape" },
    );
    expect(screen.queryByLabelText(field)).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect((screen.getByLabelText(field) as HTMLInputElement).value).toBe("");
  },
);

test("full two-seat route rejects a third passenger with viewport feedback, retained draft and no blind retry", async () => {
  const fullRoute = {
    ...route,
    seat_capacity: 2,
    used_seats: 2,
    available_seats: 0,
  };
  const api = {
    routes: vi.fn(async () => ({ routes: [fullRoute] })),
    assignments: vi.fn(async () => ({
      assignments: [
        assignment,
        { ...assignment, id: 6, student_display_name: "Segundo Ficticio" },
      ],
    })),
    createAssignment: vi.fn().mockRejectedValue(
      new ApiError(400, "validation_error", "Capacity", {
        seat_capacity: ["Private backend details"],
      }),
    ),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Segundo Ficticio");
  fireEvent.click(screen.getByRole("button", { name: "Agregar pasajero" }));
  const draft = [
    ["Ruta", "2"],
    ["Nombre del estudiante", "Tercero Ficticio"],
    ["Instrucciones de recogida", "Parada de prueba"],
    ["Nombre del apoderado", "Familia de prueba"],
    ["Teléfono del apoderado", "912345678"],
    ["Fecha de inicio", "28/09/2026"],
    ["Fecha de término (opcional)", "28/10/2026"],
  ] as const;
  for (const [label, value] of draft)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  const notice = await screen.findByRole("complementary", {
    name: "Aviso de la acción",
  });
  expect(notice.className).toBe("viewport-action-notice");
  // The body portal is independent of a long/hidden section and its scroll position.
  expect(notice.parentElement).toBe(document.body);
  expect(within(notice).getByRole("alert").textContent).toContain(
    "No pudimos agregar al pasajero",
  );
  const explanation = "Esta ruta no tiene cupos disponibles para esas fechas.";
  expect(within(notice).getByText(explanation)).toBeTruthy();
  const context = screen.getByRole("group", { name: "Revisa esta acción" });
  expect(within(context).getByText(explanation)).toBeTruthy();
  expect(context.closest("form")).toBe(
    screen.getByRole("button", { name: "Crear asignación" }).closest("form"),
  );
  await waitFor(() => expect(document.activeElement).toBe(context));
  expect(
    screen.getByText("Prueba con otra ruta o cambia las fechas."),
  ).toBeTruthy();
  expect(screen.queryByText("Private backend details")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect(api.createAssignment).toHaveBeenCalledOnce();
  for (const [label, value] of draft)
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(
      value,
    );
  fireEvent.click(within(notice).getByRole("button", { name: "Cerrar aviso" }));
  expect(
    screen.queryByRole("complementary", { name: "Aviso de la acción" }),
  ).toBeNull();
  expect(within(context).getByText(explanation)).toBeTruthy();
  for (const [label, value] of draft)
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(
      value,
    );
});

test("confirmed passenger save stays successful when the following read fails; retry only reloads", async () => {
  const api = {
    routes: vi.fn(async () => ({ routes: [route] })),
    assignments: vi
      .fn()
      .mockResolvedValueOnce({ assignments: [assignment] })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ assignments: [assignment] }),
    updateAssignment: vi.fn(async () => assignment),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText(assignment.student_display_name);
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const notice = await screen.findByRole("complementary", {
    name: "Aviso de la acción",
  });
  expect(within(notice).getByRole("status").textContent).toContain(
    "Pasajero actualizado correctamente",
  );
  const retry = await screen.findByRole("button", { name: "Reintentar" });
  expect(screen.getByRole("alert").textContent).toContain(
    "No pudimos cargar la información",
  );
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(api.updateAssignment).toHaveBeenCalledOnce();
  expect(api.assignments).toHaveBeenCalledTimes(3);
  expect(within(notice).getByRole("status").textContent).toContain(
    "Pasajero actualizado correctamente",
  );
});

test("payment domain errors keep authoritative contextual details out of global notices and offer no retry", async () => {
  const api = {
    payments: vi.fn(async () => ({ payments: [payment] })),
    assignments: vi.fn(async () => ({ assignments: [assignment] })),
    markPaymentPaid: vi.fn().mockRejectedValue(
      new ApiError(400, "validation_error", "Private server detail", {
        status: ["Private payment detail"],
      }),
    ),
  };
  render(<DriverPayments api={api as unknown as AuthApi} />);
  await screen.findByText(assignment.student_display_name);
  fireEvent.click(screen.getByText("Ver registro"));
  fireEvent.click(screen.getByRole("button", { name: "Marcar pagado" }));
  const notice = await screen.findByRole("complementary", {
    name: "Aviso de la acción",
  });
  expect(within(notice).getByRole("alert").textContent).toContain(
    "No pudimos marcar el pago como pagado",
  );
  expect(notice.textContent).not.toMatch(/Private|Estudiante|50000|912345678/);
  expect(
    screen.getByRole("group", { name: "Revisa esta acción" }).textContent,
  ).toContain("Private payment detail");
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect(api.markPaymentPaid).toHaveBeenCalledWith(payment.id);
});
