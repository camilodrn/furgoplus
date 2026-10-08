import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const absent = () =>
  ({
    ok: false,
    status: 403,
    json: async () => ({ code: "not_authenticated", message: "", fields: {} }),
  }) as Response;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each(["Privacidad", "Términos"])(
  "%s is reachable from login and registration as a versioned draft without acceptance",
  async (name) => {
    const fetchMock = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("csrf/") ? ok({ csrf_token: "token" }) : absent(),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("heading", { name: "Inicia sesión" });
    for (const registration of [false, true]) {
      if (registration)
        fireEvent.click(
          screen.getByRole("button", { name: "Crear cuenta de conductor" }),
        );
      const calls = fetchMock.mock.calls.length;
      const links = screen.getByRole("navigation", {
        name: "Documentos legales",
      });
      expect(within(links).getAllByRole("button")).toHaveLength(2);
      expect(within(links).getByText("·").getAttribute("aria-hidden")).toBe(
        "true",
      );
      const trigger = within(links).getByRole("button", { name });
      expect(trigger.className).toBe("legal-link");
      expect(trigger.tabIndex).toBe(0);
      expect(trigger.getAttribute("type")).toBe("button");
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = screen.getByRole("dialog", { name });
      expect(
        within(dialog).getByText(
          "Borrador — requiere revisión legal antes de producción",
        ),
      ).toBeTruthy();
      expect(dialog.textContent).toContain("v0.1 — 07-10-2026");
      expect(dialog.textContent).toContain(
        name === "Privacidad"
          ? "Aviso de Privacidad v0.1"
          : "Términos de Uso v0.1",
      );
      expect(within(dialog).queryByRole("checkbox")).toBeNull();
      expect(within(dialog).queryByRole("textbox")).toBeNull();
      expect(fetchMock.mock.calls.length).toBe(calls);
      expect(document.activeElement).toBe(
        within(dialog).getByRole("heading", { name, level: 1 }),
      );
      if (registration)
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Cerrar documento" }),
        );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(screen.queryByRole("checkbox")).toBeNull();
    }
  },
);
