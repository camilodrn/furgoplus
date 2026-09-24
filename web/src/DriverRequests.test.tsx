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
  expect(await screen.findByText("Aceptada")).toBeTruthy();
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
  expect(await screen.findByText("Rechazada")).toBeTruthy();
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
  expect(await screen.findByText(/No puedes aceptar mientras/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Rechazar" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
  expect(await screen.findByText(/La solicitud cambió/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Aceptar" })).toBeTruthy();
});
