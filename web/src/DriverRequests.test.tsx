import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ApiError, AuthApi } from "./api";
import { DriverRequests } from "./DriverRequests";
import type { DriverContactRequest } from "./api-types";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/style.css", "utf8");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
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
    driverContactRequest: vi.fn(async (_id: number) => row),
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

test.each(["pending", "accepted", "declined", "cancelled"] as const)(
  "%s detail preserves consented parent contact and accepted-only service contact explanation",
  async (status) => {
    const api = fakeApi();
    const row = { ...pending, status };
    api.driverContactRequests.mockResolvedValue({ results: [row] });
    api.driverContactRequest.mockResolvedValue(row);
    render(<DriverRequests api={api as unknown as AuthApi} />);
    const trigger = await screen.findByRole("button", { name: /Familia Demo/ });
    expect(screen.queryByText(row.message)).toBeNull();
    expect(screen.queryByText(row.parent_email)).toBeNull();
    fireEvent.click(trigger);
    const detail = await screen.findByRole("region", {
      name: "Solicitud de contacto",
    });
    expect(within(detail).getByText(row.message)).toBeTruthy();
    expect(
      within(detail)
        .getByRole("link", { name: row.parent_email })
        .getAttribute("href"),
    ).toBe(`mailto:${row.parent_email}`);
    expect(
      within(detail).getByText(/El apoderado autorizó compartir este correo/),
    ).toBeTruthy();
    expect(
      Boolean(
        within(detail).queryByText(
          /El apoderado puede consultar el correo de tu servicio/,
        ),
      ),
    ).toBe(status === "accepted");
    expect(
      Boolean(
        within(detail).queryByText(
          /Al aceptar, el apoderado podrá ver el correo/,
        ),
      ),
    ).toBe(status === "pending");
    for (const name of ["Aceptar", "Rechazar"]) {
      expect(Boolean(within(detail).queryByRole("button", { name }))).toBe(
        status === "pending",
      );
    }
    await waitFor(() => expect(trigger.hasAttribute("disabled")).toBe(false));
    fireEvent.click(trigger);
    expect(screen.queryByText(row.message)).toBeNull();
    expect(screen.queryByText(row.parent_email)).toBeNull();
    expect(api.decideContactRequest).not.toHaveBeenCalled();
  },
);

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

test("full-width request rows keep selected text and badge readable without inverse button styling", async () => {
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.append(style);
  try {
    const api = fakeApi();
    api.driverContactRequests.mockResolvedValue({
      results: [
        pending,
        ...requestRows(10).map((row) => ({ ...row, id: row.id + 100 })),
      ],
    });
    render(<DriverRequests api={api as unknown as AuthApi} />);
    const list = screen.getByRole("list", { name: "Solicitudes recibidas" });
    const row = await within(list).findByRole("button", {
      name: /Familia Demo/,
    });
    expect(row.className).toBe("request-row");
    expect(getComputedStyle(row).display).toBe("grid");
    expect(getComputedStyle(row).width).toBe("100%");
    expect(getComputedStyle(row).minHeight).toBe("48px");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(api.driverContactRequest).not.toHaveBeenCalled();
    expect(list.textContent).not.toContain(pending.message);
    expect(list.textContent).not.toContain(pending.parent_email);
    expect(
      screen.queryByRole("region", { name: "Solicitud de contacto" }),
    ).toBeNull();
    fireEvent.click(row);
    await screen.findByRole("region", { name: "Solicitud de contacto" });
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(within(row).getByText("Ocultar detalle ↑")).toBeTruthy();
    expect(
      document.getElementById(row.getAttribute("aria-controls")!)?.textContent,
    ).toContain(pending.message);
    // jsdom preserves custom-property references in computed colors. Verify the
    // actual cascade and the palette values rather than assuming it resolves them.
    expect(getComputedStyle(row).color).toBe("var(--ink)");
    expect(getComputedStyle(row).background).toBe("var(--brand-soft)");
    const palette = getComputedStyle(document.documentElement);
    expect(palette.getPropertyValue("--ink")).toBe("#202b3a");
    expect(palette.getPropertyValue("--brand-soft")).toBe("#eaf3ff");
    expect(
      getComputedStyle(within(row).getByText("Nueva · Por responder")).color,
    ).toBe("var(--ink)");
    for (const button of pagination().getAllByRole("button")) {
      expect(getComputedStyle(button).minHeight).toBe("48px");
      expect(getComputedStyle(button).minWidth).toBe("48px");
    }
    const panel = screen.getByRole("region", { name: "Solicitud de contacto" });
    expect(getComputedStyle(panel).width).toBe("100%");
    expect(getComputedStyle(panel).maxWidth).toBe("none");
    expect(getComputedStyle(panel).margin).toBe("0px");
    expect(getComputedStyle(panel).borderTopWidth).toBe("0px");
    expect(row.textContent).not.toContain(pending.message);
    expect(row.textContent).not.toContain(pending.parent_email);
    fireEvent.click(screen.getByRole("button", { name: /Ocultar detalle/ }));
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Ocultar detalle ↑")).toBeNull();
    expect(screen.queryByText(pending.message)).toBeNull();
  } finally {
    style.remove();
  }
});

function requestRows(count: number): DriverContactRequest[] {
  return Array.from({ length: count }, (_, index) => ({
    ...pending,
    id: index + 1,
    parent_display_name: `Familia sintética ${index + 1}`,
    message: `Mensaje privado ${index + 1}`,
  }));
}
function inbox() {
  return within(screen.getByRole("list", { name: "Solicitudes recibidas" }));
}
function pagination() {
  return within(
    screen.getByRole("navigation", { name: "Páginas de solicitudes" }),
  );
}

test("a single inline detail follows its expanded row and toggling never changes the page", async () => {
  const api = fakeApi();
  const rows = requestRows(13).map((row) => ({
    ...row,
    parent_email: `parent-${row.id}@example.test`,
  }));
  api.driverContactRequests.mockResolvedValue({ results: rows });
  api.driverContactRequest.mockImplementation(
    async (id) => rows.find((row) => row.id === id)!,
  );
  render(<DriverRequests api={api as unknown as AuthApi} />);
  await screen.findByText("Página 1 de 2");
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  await screen.findByText("Página 2 de 2");
  const row = (id: number) =>
    inbox().getByRole("button", {
      name: new RegExp(`Familia sintética ${id}\\D`),
    });
  const waitUntilIdle = () =>
    waitFor(() => expect(row(12).hasAttribute("disabled")).toBe(false));
  for (const id of [11, 12, 13]) {
    expect(row(id).getAttribute("aria-expanded")).toBe("false");
  }
  expect(inbox().queryByText(/Mensaje privado|parent-.*@/)).toBeNull();

  fireEvent.click(row(12));
  await screen.findByText("Mensaje privado 12");
  await waitUntilIdle();
  const detail = screen.getByRole("region", { name: "Solicitud de contacto" });
  expect(within(detail).queryByRole("button", { name: "Cerrar" })).toBeNull();
  const expansion = row(12).nextElementSibling;
  expect(expansion).toBe(
    document.getElementById(row(12).getAttribute("aria-controls")!),
  );
  expect(expansion?.firstElementChild).toBe(detail);
  expect(row(12).parentElement?.nextElementSibling).toBe(row(13).parentElement);
  expect(within(row(11).parentElement!).queryByRole("region")).toBeNull();
  expect(row(12).getAttribute("aria-expanded")).toBe("true");
  expect(within(row(12)).getByText("Ocultar detalle ↑")).toBeTruthy();
  expect(screen.queryByText(/Seleccionada/)).toBeNull();
  expect(screen.getByText("Página 2 de 2")).toBeTruthy();

  fireEvent.click(row(13));
  await screen.findByText("Mensaje privado 13");
  await waitUntilIdle();
  expect(
    screen.getAllByRole("region", { name: "Solicitud de contacto" }),
  ).toHaveLength(1);
  expect(row(13).nextElementSibling?.firstElementChild).toBe(
    screen.getByRole("region", { name: "Solicitud de contacto" }),
  );
  expect(row(12).nextElementSibling).toBeNull();
  expect(row(12).getAttribute("aria-expanded")).toBe("false");
  expect(within(row(12)).getByText("Ver solicitud →")).toBeTruthy();
  expect(screen.queryByText("Mensaje privado 12")).toBeNull();
  expect(screen.queryByText("parent-12@example.test")).toBeNull();
  for (const id of [11, 12, 13]) {
    expect(row(id).textContent).not.toMatch(/Mensaje privado|parent-.*@/);
  }

  fireEvent.click(screen.getByRole("button", { name: /Ocultar detalle/ }));
  expect(
    screen.queryByRole("region", { name: "Solicitud de contacto" }),
  ).toBeNull();
  expect(row(13).getAttribute("aria-expanded")).toBe("false");
  expect(inbox().queryByText(/Mensaje privado|parent-.*@/)).toBeNull();
  expect(screen.getByText("Página 2 de 2")).toBeTruthy();
  expect(api.driverContactRequest).toHaveBeenCalledTimes(2);
  expect(api.decideContactRequest).not.toHaveBeenCalled();
});

test.each([0, 1, 10])(
  "pagination is completely hidden for %i requests",
  async (count) => {
    const api = fakeApi();
    api.driverContactRequests.mockResolvedValue({
      results: requestRows(count),
    });
    render(<DriverRequests api={api as unknown as AuthApi} />);
    await screen.findByRole("button", { name: `Todas ${count}` });
    expect(
      screen.queryByRole("navigation", { name: "Páginas de solicitudes" }),
    ).toBeNull();
    expect(screen.queryByText(/Página \d+ de/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Anterior|Siguiente/ }),
    ).toBeNull();
  },
);

test("ten-row local pages and filter totals use only the complete existing server response", async () => {
  const rows = requestRows(24).map((row, index) => ({
    ...row,
    status:
      index < 12
        ? ("pending" as const)
        : index < 20
          ? ("accepted" as const)
          : index < 22
            ? ("declined" as const)
            : ("cancelled" as const),
  }));
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ results: rows }),
      }) as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<DriverRequests api={new AuthApi()} />);
  await screen.findByText("Página 1 de 3");
  expect(inbox().getAllByRole("listitem")).toHaveLength(10);
  expect(
    pagination()
      .getByRole("button", { name: "← Anterior" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(pagination().getByRole("status").getAttribute("aria-current")).toBe(
    "page",
  );
  expect(screen.getByRole("button", { name: "Todas 24" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Por responder 12" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Aceptadas 8" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cerradas 4" })).toBeTruthy();
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  expect(screen.getByText("Página 2 de 3")).toBeTruthy();
  expect(inbox().getAllByRole("listitem")).toHaveLength(10);
  expect(inbox().queryByText("Familia sintética 1")).toBeNull();
  expect(inbox().getByText("Familia sintética 11")).toBeTruthy();
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  expect(screen.getByText("Página 3 de 3")).toBeTruthy();
  expect(inbox().getAllByRole("listitem")).toHaveLength(4);
  expect(
    pagination()
      .getByRole("button", { name: "Siguiente →" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(pagination().getByRole("button", { name: "← Anterior" }));
  expect(screen.getByText("Página 2 de 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Por responder 12" }));
  expect(screen.getByText("Página 1 de 2")).toBeTruthy();
  expect(inbox().getAllByRole("listitem")).toHaveLength(10);
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  expect(inbox().getAllByRole("listitem")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Aceptadas 8" }));
  expect(
    screen.queryByRole("navigation", { name: "Páginas de solicitudes" }),
  ).toBeNull();
  expect(inbox().getAllByRole("listitem")).toHaveLength(8);
  fireEvent.click(screen.getByRole("button", { name: "Cerradas 4" }));
  expect(inbox().getAllByRole("listitem")).toHaveLength(4);
  expect(inbox().getAllByText("Rechazada")).toHaveLength(2);
  expect(inbox().getAllByText("Cancelada por el apoderado")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Todas 24" }));
  expect(screen.getByText("Página 1 de 3")).toBeTruthy();
  expect(inbox().queryByText(/Mensaje privado|parent@example/)).toBeNull();
  // No invented page/size/filter parameters, prefetch, detail reads or writes.
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/driver/contact-requests/",
    expect.objectContaining({ method: "GET" }),
  );
});

test("page and filter navigation clear on-demand private detail without replaying a decision", async () => {
  const api = fakeApi();
  const rows = requestRows(11);
  api.driverContactRequests.mockResolvedValue({ results: rows });
  api.driverContactRequest.mockImplementation(
    async (id) => rows.find((row) => row.id === id)!,
  );
  render(<DriverRequests api={api as unknown as AuthApi} />);
  await screen.findByText("Página 1 de 2");
  fireEvent.click(
    inbox().getByRole("button", { name: /Familia sintética 1\D/ }),
  );
  await screen.findByText("Mensaje privado 1");
  await waitFor(() =>
    expect(
      pagination()
        .getByRole("button", { name: "Siguiente →" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  expect(
    screen.queryByRole("region", { name: "Solicitud de contacto" }),
  ).toBeNull();
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  expect(screen.queryByText("Mensaje privado 1")).toBeNull();
  fireEvent.click(
    inbox().getByRole("button", { name: /Familia sintética 11/ }),
  );
  await screen.findByText("Mensaje privado 11");
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Aceptadas 0" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Aceptadas 0" }));
  expect(
    screen.queryByRole("region", { name: "Solicitud de contacto" }),
  ).toBeNull();
  expect(screen.queryByText("Mensaje privado 11")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de solicitudes" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Todas 11" }));
  expect(screen.getByText("Página 1 de 2")).toBeTruthy();
  expect(api.driverContactRequest).toHaveBeenCalledTimes(2);
  expect(api.driverContactRequests).toHaveBeenCalledTimes(3); // Initial read and refresh after each detail read.
  expect(api.decideContactRequest).not.toHaveBeenCalled();
});

test("authoritative post-decision refresh updates counts, removes hidden detail and clamps a vanished last page", async () => {
  const api = fakeApi();
  let rows = requestRows(11);
  api.driverContactRequests.mockImplementation(async () => ({ results: rows }));
  api.driverContactRequest.mockImplementation(
    async (id) => rows.find((row) => row.id === id)!,
  );
  api.decideContactRequest.mockImplementation(async (id) => {
    rows = rows.map((row) =>
      row.id === id ? { ...row, status: "accepted" } : row,
    );
    return rows.find((row) => row.id === id)!;
  });
  render(<DriverRequests api={api as unknown as AuthApi} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Por responder 11" }),
  );
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  fireEvent.click(
    inbox().getByRole("button", { name: /Familia sintética 11/ }),
  );
  await screen.findByText("Mensaje privado 11");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  await screen.findByRole("button", { name: "Por responder 10" });
  expect(
    screen.queryByRole("navigation", { name: "Páginas de solicitudes" }),
  ).toBeNull();
  expect(inbox().getAllByRole("listitem")).toHaveLength(10);
  expect(screen.queryByText("Mensaje privado 11")).toBeNull();
  expect(screen.queryByText(pending.parent_email)).toBeNull();
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Aceptadas 1" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Aceptadas 1" }));
  expect(inbox().getByText("Familia sintética 11")).toBeTruthy();
  expect(screen.queryByText("Mensaje privado 11")).toBeNull();
  expect(api.decideContactRequest).toHaveBeenCalledExactlyOnceWith(
    11,
    "accept",
  );
  expect(api.driverContactRequests).toHaveBeenCalledTimes(3);
});

test("in-flight detail reads disable page/filter navigation until the existing refresh finishes", async () => {
  const api = fakeApi();
  api.driverContactRequests.mockResolvedValue({ results: requestRows(11) });
  let finish!: (row: DriverContactRequest) => void;
  api.driverContactRequest.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<DriverRequests api={api as unknown as AuthApi} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Familia sintética 1\D/ }),
  );
  expect(
    pagination()
      .getByRole("button", { name: "Siguiente →" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Aceptadas 0" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(pagination().getByRole("button", { name: "Siguiente →" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceptadas 0" }));
  finish(requestRows(1)[0]!);
  await screen.findByText("Mensaje privado 1");
  await waitFor(() =>
    expect(
      pagination()
        .getByRole("button", { name: "Siguiente →" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.getByText("Página 1 de 2")).toBeTruthy();
  expect(api.driverContactRequest).toHaveBeenCalledOnce();
  expect(api.decideContactRequest).not.toHaveBeenCalled();
});

test("narrow row and pagination styles stack and wrap without a nested scrolling list", () => {
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet!.cssRules);
    const narrowRules = rules
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === "(max-width: 680px)",
      )
      .flatMap((rule) => Array.from(rule.cssRules));
    const declaration = (selector: string) =>
      (
        narrowRules.find(
          (rule) =>
            rule instanceof CSSStyleRule && rule.selectorText === selector,
        ) as CSSStyleRule
      ).style;
    expect(
      declaration(".driver-operations .request-row").getPropertyValue(
        "grid-template-columns",
      ),
    ).toBe("minmax(0, 1fr)");
    expect(
      declaration(".request-pagination > span").getPropertyValue("flex-basis"),
    ).toBe("100%");
    const listRules = rules.filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        [
          ".request-list",
          ".request-layout",
          ".driver-operations .request-expansion > .focus-panel",
        ].includes(rule.selectorText),
    );
    for (const rule of listRules) {
      expect(rule.style.getPropertyValue("height")).toBe("");
      expect(rule.style.getPropertyValue("max-height")).toBe("");
      expect(rule.style.getPropertyValue("overflow")).toBe("");
    }
  } finally {
    style.remove();
  }
});
