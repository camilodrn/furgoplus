import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const denied = () =>
  ({
    ok: false,
    status: 403,
    json: async () => ({
      code: "not_authenticated",
      message: "Session expired",
      fields: {},
    }),
  }) as Response;
const help = {
  version: "test",
  articles: [],
  assistant_modes: [],
  service_notice: "Servicio disponible sin garantía",
  privacy_notice: "Sin datos privados",
};
const ownTicket = {
  id: 8,
  subject: "Ticket privado A",
  severity: 3,
  state: "open",
  priority: "standard",
  priority_at_creation: "standard",
  version: 1,
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
  allowed_transitions: [],
  events: [
    {
      id: 1,
      author_id: 1,
      author_role: "parent",
      body: "Contenido privado A",
      from_state: "",
      to_state: "open",
      reason: "",
      occurred_at: "2026-10-19T12:00:00Z",
    },
  ],
};
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

for (const change of ["replacement", "expiry"] as const) {
  for (const operation of ["read", "write"] as const) {
    test(`support ${change} clears private history/drafts and rejects a late ${operation}`, async () => {
      let account = {
        id: 1,
        role: "parent",
        email: "a@example.test",
        display_name: "Account A",
      };
      let expired = false;
      const pending = deferred();
      let hold = false;
      const fetcher = vi
        .fn()
        .mockImplementation(async (path: string, options: RequestInit) => {
          if (path.endsWith("auth/csrf/"))
            return ok({ csrf_token: "synthetic" });
          if (path.endsWith("auth/me/"))
            return expired ? denied() : ok(account);
          if (path.endsWith("help/")) return ok(help);
          if (path.includes("support/tickets/?"))
            return ok({ results: [ownTicket], count: 1 });
          if (path.endsWith("support/tickets/8/")) {
            if (
              hold &&
              ((operation === "read" && options.method === "GET") ||
                options.method === "POST")
            )
              return pending.promise;
            return ok(ownTicket);
          }
          throw new Error(`Unexpected ${path}`);
        });
      vi.stubGlobal("fetch", fetcher);
      render(<App />);
      await screen.findByText("Account A");
      fireEvent.click(screen.getByRole("button", { name: "Ayuda y soporte" }));
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Consultas de soporte",
        }),
      );
      fireEvent.click(await screen.findByRole("button", { name: /#8/ }));
      await screen.findByText("Contenido privado A");
      fireEvent.change(screen.getByLabelText("Respuesta"), {
        target: { value: "Borrador privado A" },
      });
      hold = true;
      fireEvent.click(
        screen.getByRole("button", {
          name:
            operation === "read"
              ? "Actualizar esta consulta"
              : "Enviar respuesta",
        }),
      );
      await waitFor(() =>
        expect(
          fetcher.mock.calls.some(
            ([path, options]) =>
              path.endsWith("support/tickets/8/") &&
              options.method === (operation === "read" ? "GET" : "POST"),
          ),
        ).toBe(true),
      );
      if (change === "replacement")
        account = {
          ...account,
          id: 2,
          display_name: "Account B",
          email: "b@example.test",
        };
      else expired = true;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      fireEvent(document, new Event("visibilitychange"));
      if (change === "replacement") await screen.findByText("Account B");
      else await screen.findByRole("heading", { name: "Inicia sesión" });
      expect(document.body.textContent).not.toContain("Contenido privado A");
      expect(screen.queryByDisplayValue("Borrador privado A")).toBeNull();
      await act(async () => {
        pending.resolve(ok({ ...ownTicket, subject: "Resultado tardío A" }));
      });
      expect(document.body.textContent).not.toContain("Resultado tardío A");
      expect(document.body.textContent).not.toContain("Contenido privado A");
    });
  }
}
