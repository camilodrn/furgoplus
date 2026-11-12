import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ApiError, type AuthApi } from "./api";
import type { AdminRegistrations as Report } from "./api-types";
import { AdminRegistrations } from "./AdminRegistrations";

afterEach(cleanup);

const row = {
  id: 45,
  display_name: "Apoderada Feria",
  email: "profesora@example.test",
  role: "parent" as const,
  created_at: "2026-11-04T02:30:00Z",
};
const report: Report = {
  totals: { parent: 37, driver: 14, admin: 2 },
  count: 1,
  results: [row],
};

function setup(read = vi.fn().mockResolvedValue(report)) {
  const api = { adminRegistrations: read } as unknown as AuthApi;
  return { ...render(<AdminRegistrations api={api} />), read };
}

test("loads bounded server data and formats creation in Chile, including previous day", async () => {
  const { read } = setup();
  expect(screen.getByRole("status").textContent).toBe("Cargando usuarios…");
  await screen.findByText("profesora@example.test");
  expect(screen.getByText("37")).toBeTruthy();
  expect(screen.getByText("3 nov 2026 · 23:30")).toBeTruthy();
  expect(Object.fromEntries(read.mock.calls[0]![0])).toEqual({
    offset: "0",
    limit: "25",
  });
  expect(screen.getByText(/Totales globales/)).toBeTruthy();
});

test("winter instants and missing name/email are shown truthfully", async () => {
  setup(
    vi.fn().mockResolvedValue({
      ...report,
      results: [
        {
          ...row,
          display_name: null,
          email: null,
          created_at: "2026-07-04T03:30:00Z",
        },
      ],
    }),
  );
  await screen.findByText("3 jul 2026 · 23:30");
  expect(screen.getByText("Sin nombre registrado")).toBeTruthy();
  expect(screen.getByText("Correo reservado")).toBeTruthy();
});

test("server pagination and applied filters reset to the first page and preserve global totals", async () => {
  const read = vi.fn().mockResolvedValue({ ...report, count: 26 });
  setup(read);
  await screen.findByText("profesora@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(read.mock.calls[1]![0].get("offset")).toBe("25");
  await screen.findByText("profesora@example.test");
  fireEvent.change(
    screen.getByLabelText("Buscar por nombre o correo ficticio"),
    { target: { value: " nueva " } },
  );
  fireEvent.change(screen.getByLabelText("Rol"), {
    target: { value: "parent" },
  });
  expect(read).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
  expect(Object.fromEntries(read.mock.calls[2]![0])).toEqual({
    offset: "0",
    limit: "25",
    q: "nueva",
    role: "parent",
  });
  await screen.findByText("37");
});

test("manual refresh shows newly registered account and clears stale data on failure, then retries", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ ...report, count: 0, results: [] })
    .mockRejectedValueOnce(new ApiError(500, "server_error", "Failed", {}))
    .mockResolvedValue(report);
  setup(read);
  await screen.findByText("Todavía no hay cuentas registradas.");
  fireEvent.click(screen.getByRole("button", { name: "Actualizar usuarios" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Todavía no hay cuentas registradas.")).toBeNull();
  expect(screen.queryByText("37")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar usuarios" }));
  await screen.findByText("profesora@example.test");
});

test("filtered empty state is different from an empty database", async () => {
  const { read } = setup();
  await screen.findByText("profesora@example.test");
  read.mockResolvedValue({ ...report, count: 0, results: [] });
  fireEvent.change(screen.getByLabelText("Rol"), {
    target: { value: "driver" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await screen.findByText("No hay cuentas que coincidan con los filtros.");
  expect(screen.queryByText("profesora@example.test")).toBeNull();
});

test.each([
  [
    new ApiError(403, "permission_denied", "Denied", {}),
    "Tu sesión no permite esta acción.",
  ],
  [
    new ApiError(403, "not_authenticated", "Expired", {}),
    "La sesión caducó. Vuelve a iniciar sesión.",
  ],
  [
    new TypeError("offline"),
    "No pudimos obtener una respuesta. Revisa tu conexión.",
  ],
])(
  "authorization and connection errors are explicit",
  async (cause, message) => {
    setup(vi.fn().mockRejectedValue(cause));
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(screen.queryByRole("table")).toBeNull();
  },
);

test("leaving a section discards late private data", async () => {
  let complete!: (value: Report) => void;
  const { unmount } = setup(
    vi.fn(
      () =>
        new Promise<Report>((resolve) => {
          complete = resolve;
        }),
    ),
  );
  unmount();
  setup(vi.fn().mockResolvedValue({ ...report, count: 0, results: [] }));
  await screen.findByText("Todavía no hay cuentas registradas.");
  await act(async () => complete(report));
  expect(screen.queryByText("profesora@example.test")).toBeNull();
});

test("refresh corrects a page that no longer exists", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ ...report, count: 26 })
    .mockResolvedValueOnce({ ...report, count: 26 })
    .mockResolvedValueOnce({ ...report, count: 1, results: [] })
    .mockResolvedValue(report);
  setup(read);
  await screen.findByText("profesora@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText(/Página 2 de 2/);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar usuarios" }));
  await screen.findByText(/Página 1 de 1/);
  expect(read.mock.calls[3]![0].get("offset")).toBe("0");
});
