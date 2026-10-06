import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ApiError, AuthApi } from "./api";
import { DriverRequests } from "./DriverRequests";
import type { DriverContactRequest } from "./api-types";

afterEach(cleanup);
const pending: DriverContactRequest = {
  id: 7,
  parent_display_name: "Familia Demo",
  parent_email: "parent@example.test",
  message: "Consulta sintética",
  status: "pending",
  created_at: "2026-09-23T12:00:00Z",
  updated_at: "2026-09-23T12:00:00Z",
  resolved_at: null,
};
function fakeApi() {
  let row = pending;
  return {
    driverContactRequests: vi.fn(async () => ({ results: [row] })),
    driverContactRequest: vi.fn(async () => row),
    decideContactRequest: vi.fn(
      async (_id: number, decision: "accept" | "decline") => {
        row = {
          ...row,
          status: decision === "accept" ? "accepted" : "declined",
          resolved_at: "2026-09-23T13:00:00Z",
        };
        return row;
      },
    ),
  };
}

test("driver opens own request and accepts with consented email visible", async () => {
  const api = fakeApi();
  render(<DriverRequests api={api as unknown as AuthApi} />);
  fireEvent.click(await screen.findByRole("button", { name: /Familia Demo/ }));
  expect(await screen.findByText("Consulta sintética")).toBeTruthy();
  expect(screen.getByText("parent@example.test")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  await waitFor(() =>
    expect(api.decideContactRequest).toHaveBeenCalledWith(7, "accept"),
  );
  expect((await screen.findAllByText("Aceptada")).length).toBe(2);
  expect(screen.queryByRole("button", { name: "Aceptar" })).toBeNull();
});

test("driver can decline pending request", async () => {
  const api = fakeApi();
  render(<DriverRequests api={api as unknown as AuthApi} />);
  fireEvent.click(await screen.findByRole("button", { name: /Familia Demo/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
  await waitFor(() =>
    expect(api.decideContactRequest).toHaveBeenCalledWith(7, "decline"),
  );
  expect((await screen.findAllByText("Rechazada")).length).toBe(2);
});

test("eligibility and stale conflicts keep confirmed pending state", async () => {
  const api = fakeApi();
  api.decideContactRequest = vi
    .fn()
    .mockRejectedValueOnce(new ApiError(409, "driver_ineligible", "blocked"))
    .mockRejectedValueOnce(new ApiError(409, "contact_conflict", "stale"));
  render(<DriverRequests api={api as unknown as AuthApi} />);
  fireEvent.click(await screen.findByRole("button", { name: /Familia Demo/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Aceptar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "No puedes aceptar mientras",
  );
  expect(screen.getByRole("button", { name: "Rechazar" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "La información cambió",
    ),
  );
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  expect(screen.getByRole("button", { name: "Aceptar" })).toBeTruthy();
});

test("contact read failure retries without implying an empty inbox or exposing detail", async () => {
  const api = fakeApi();
  api.driverContactRequests.mockRejectedValueOnce(new Error("network"));
  render(<DriverRequests api={api as unknown as AuthApi} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("No tienes solicitudes pendientes.")).toBeNull();
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("button", { name: /Familia Demo/ });
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Familia Demo/ }));
  await screen.findByText(pending.parent_email);
  expect(
    screen.getByText(/El apoderado autorizó compartir este correo/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Al aceptar, el apoderado podrá ver el correo/),
  ).toBeTruthy();
});

test("contact empty history and pending decision prevent duplicate writes", async () => {
  const api = fakeApi();
  api.driverContactRequests.mockResolvedValueOnce({ results: [] });
  render(<DriverRequests api={api as unknown as AuthApi} />);
  await screen.findByText("No tienes solicitudes pendientes.");
  expect(api.driverContactRequests).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  const refresh = screen.getByRole("button", {
    name: "Actualizar solicitudes",
  });
  expect(refresh.className).toContain("button-link driver-refresh");
  fireEvent.click(refresh);
  await waitFor(() =>
    expect(api.driverContactRequests).toHaveBeenCalledTimes(2),
  );
  fireEvent.click(await screen.findByRole("button", { name: /Familia Demo/ }));
  await screen.findByText(pending.parent_email);
  let finish!: (row: DriverContactRequest) => void;
  api.decideContactRequest.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Aceptar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  expect(api.decideContactRequest).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("button", { name: "Rechazar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  api.driverContactRequests.mockResolvedValueOnce({
    results: [{ ...pending, status: "accepted" }],
  });
  finish({ ...pending, status: "accepted" });
  await screen.findByText(/Solicitud aceptada. El apoderado puede ver/);
});

test("inbox filters actual lifecycle states and keeps contact/message private until opening the request", async () => {
  const api = fakeApi();
  api.driverContactRequests.mockResolvedValue({
    results: [
      pending,
      {
        ...pending,
        id: 8,
        parent_display_name: "Familia Anterior",
        status: "declined",
      },
    ],
  });
  render(<DriverRequests api={api as unknown as AuthApi} />);
  await screen.findByRole("button", { name: /Familia Demo/ });
  expect(screen.getByText("Nueva · Por responder")).toBeTruthy();
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  expect(screen.queryByText(pending.message)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Por responder 1" }));
  expect(screen.queryByRole("button", { name: /Familia Anterior/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Aceptadas 0" }));
  expect(screen.getByText("No hay solicitudes en esta vista.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cerradas 1" }));
  expect(screen.getByRole("button", { name: /Familia Anterior/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Todas 2" }));
  fireEvent.click(screen.getByRole("button", { name: /Familia Demo/ }));
  await screen.findByText(pending.message);
  expect(screen.getByRole("button", { name: "Aceptar" })).toBeTruthy();
  fireEvent.keyDown(
    screen.getByRole("region", { name: "Solicitud de contacto" }),
    { key: "Escape" },
  );
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  expect(screen.queryByText(pending.message)).toBeNull();
  expect(api.decideContactRequest).not.toHaveBeenCalled();
});
