import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { AuthApi } from "./api";
import type { AdminDrivers } from "./api-types";
import { ApiError } from "./api";
import { AdminOverview } from "./AdminOverview";

afterEach(cleanup);
function setup(overrides: Partial<AuthApi> = {}) {
  const driversRead = vi.fn(async (params: URLSearchParams) => ({
    results: [],
    count: params.has("validation_state")
      ? 62
      : params.has("publication")
        ? 9
        : 200,
  }));
  const api = {
    adminDrivers: driversRead,
    supportTickets: vi.fn(async () => ({
      count: 60,
      results: [{ id: 10, severity: 1 }],
    })),
    ...overrides,
  };
  const navigation = {
    onDrivers: vi.fn(),
    onValidations: vi.fn(),
    onSupport: vi.fn(),
  };
  const view = render(
    <AdminOverview api={api as unknown as AuthApi} {...navigation} />,
  );
  return { api, driversRead, ...navigation, ...view };
}
test("overview uses server totals, scopes critical counts and opens real workspaces without writes", async () => {
  const { driversRead, onDrivers, onValidations, onSupport } = setup();
  await screen.findByText(/62 conductores con información pendiente/);
  expect(screen.getByText("200")).toBeTruthy();
  expect(screen.getByText("60 casos activos.")).toBeTruthy();
  expect(
    screen.getByText(/1 caso crítico en los primeros 1 recibidos/),
  ).toBeTruthy();
  expect(
    driversRead.mock.calls.map(([params]) => Object.fromEntries(params)),
  ).toEqual([
    { offset: "0", limit: "1" },
    { validation_state: "pending", offset: "0", limit: "1" },
    { publication: "blocked", offset: "0", limit: "1" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Revisar soporte" }));
  expect(onSupport).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Revisar antecedentes" }));
  expect(onValidations).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Buscar en todos los conductores pendientes",
    }),
  );
  expect(onDrivers).toHaveBeenCalledWith(true);
});
test("failed summaries remain unknown and can be refreshed independently of successful counts", async () => {
  const read = vi
    .fn()
    .mockRejectedValueOnce(new ApiError(403, "permission_denied", "Denied", {}))
    .mockResolvedValue({ count: 0, results: [] });
  setup({ supportTickets: read });
  await screen.findByText("Resumen de soporte no disponible.");
  expect(screen.queryByText("0 casos activos.")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain(
    "Tu sesión no permite",
  );
  expect(screen.getByText("200")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar resumen" }));
  await screen.findByText("0 casos activos.");
});
test("unmounted overview discards old account counts", async () => {
  let complete!: (value: { count: number; results: [] }) => void;
  const { unmount } = setup({
    adminDrivers: vi.fn(
      () =>
        new Promise<AdminDrivers>((resolve) => {
          complete = resolve;
        }),
    ),
  });
  unmount();
  setup();
  await screen.findByText("200");
  await act(async () => complete({ count: 999, results: [] }));
  expect(screen.queryByText("999")).toBeNull();
});
