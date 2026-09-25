import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, test, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type { AuthApi } from "./api";
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
  const prompt = vi.spyOn(window, "prompt").mockReturnValue("28/09/2026");
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no hay pasajeros asignados.");
  fireEvent.change(screen.getByLabelText("Ruta"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Nombre visible del estudiante"), {
    target: { value: assignment.student_display_name },
  });
  fireEvent.change(screen.getByLabelText("Recogida / instrucciones"), {
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
  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: "28/09/2026" },
  });
  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe(
    "28/09/2026",
  );
  expect((screen.getByLabelText("Desde") as HTMLInputElement).type).toBe(
    "text",
  );
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
  expect(screen.getByText(/28\/09\/2026–sin término/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe(
    "28/09/2026",
  );
  fireEvent.change(screen.getByLabelText("Hasta (opcional)"), {
    target: { value: "27/11/2026" },
  });
  fireEvent.change(screen.getByLabelText("Nombre visible del estudiante"), {
    target: { value: "Estudiante Ficticio 2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(api.updateAssignment).toHaveBeenCalledOnce());
  expect(api.updateAssignment).toHaveBeenCalledWith(
    5,
    expect.objectContaining({ ends_on: "2026-11-27" }),
  );
  expect(screen.getByText(/28\/09\/2026–27\/11\/2026/)).toBeTruthy();
  prompt.mockReturnValueOnce("31/02/2026");
  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  expect(api.endAssignment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  await waitFor(() =>
    expect(api.endAssignment).toHaveBeenCalledWith(5, "2026-09-28"),
  );
  expect(prompt).toHaveBeenCalledWith(
    "Último día de servicio (DD/MM/AAAA)",
    expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
  );
  prompt.mockRestore();
});

test("roster rejects invalid Chilean dates and short guardian phones", async () => {
  const api = {
    routes: vi.fn(async () => ({ routes: [route] })),
    assignments: vi.fn(async () => ({ assignments: [] })),
    createAssignment: vi.fn(),
  };
  render(<DriverRoster api={api as unknown as AuthApi} />);
  await screen.findByText("Aún no hay pasajeros asignados.");
  fireEvent.change(screen.getByLabelText("Ruta"), { target: { value: "2" } });
  for (const [label, value] of [
    ["Nombre visible del estudiante", "Estudiante Ficticio"],
    ["Recogida / instrucciones", "Parada ficticia"],
    ["Nombre del apoderado", "Apoderado Ficticio"],
    ["Teléfono del apoderado", "912345678"],
    ["Desde", "31/02/2026"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  expect(api.createAssignment).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Desde").getAttribute("aria-invalid")).toBe(
    "true",
  );
  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: "28/09/2026" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono del apoderado"), {
    target: { value: "12345678" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
  expect(api.createAssignment).not.toHaveBeenCalled();
  expect(screen.getByText(/exactamente 9 dígitos/)).toBeTruthy();
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
  await screen.findByText("Aún no hay pagos registrados.");
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
  expect(amount.value).toBe("");
  expect(
    screen.getByText(
      /Período: 28\/09\/2026–28\/10\/2026 · Vence: 05\/10\/2026/,
    ),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Marcar pagado" }));
  await waitFor(() => expect(api.markPaymentPaid).toHaveBeenCalledWith(8));
  expect(screen.getByText(/Pagado: 28\/09\/2026/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Anular" }));
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
  await screen.findByText("Aún no hay pagos registrados.");
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
    summary: vi.fn(async () => ({
      publication: {
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
  expect(await screen.findByText(/0 usados \/ 1 disponibles/)).toBeTruthy();
  expect(screen.getByText(/Próximo servicio: 28\/09\/2026/)).toBeTruthy();
  expect(screen.getByText(/1 pendientes/)).toBeTruthy();
});
