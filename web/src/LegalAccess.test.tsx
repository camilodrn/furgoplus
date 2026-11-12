import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";
import { LegalAccess } from "./LegalAccess";
import privacy from "./legal/privacy.md?raw";
import terms from "./legal/terms.md?raw";

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
      expect(
        within(links)
          .getAllByRole("button")
          .map((button) => button.textContent),
      ).toEqual(["Privacidad", "Términos", "Cookies y almacenamiento"]);
      expect(
        within(links)
          .getAllByText("·")
          .every((node) => node.getAttribute("aria-hidden") === "true"),
      ).toBe(true);
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
      expect(dialog.textContent).toContain(
        name === "Privacidad" ? "v0.2 — 31-10-2026" : "v0.1 — 07-10-2026",
      );
      expect(dialog.textContent).toContain(
        name === "Privacidad"
          ? "Aviso de Privacidad v0.2"
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

test.each([
  ["Privacidad", privacy],
  ["Términos", terms],
])(
  "%s index navigates the complete unchanged document and restores focus without legal acceptance",
  (name, source) => {
    render(<LegalAccess />);
    const trigger = screen.getByRole("button", { name });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name });
    const article = within(dialog).getByRole("article", {
      name: `Documento íntegro de ${name}`,
    });
    const blocks = source
      .trim()
      .split(/\n\s*\n/)
      .slice(1);
    expect(
      Array.from(article.children).map((element) => element.textContent),
    ).toEqual(
      blocks.map((block) => block.replace(/^## /, "").replace(/\n/g, " ")),
    );
    const index = within(dialog).getByRole("navigation", {
      name: `Secciones de ${name}`,
    });
    const links = within(index).getAllByRole("link");
    expect(links).toHaveLength(
      blocks.filter((block) => block.startsWith("## ")).length + 1,
    );
    const last = links.at(-1)!;
    const hash = window.location.hash;
    fireEvent.click(last);
    expect(document.activeElement).toBe(
      within(article).getByRole("heading", { name: last.textContent! }),
    );
    expect(window.location.hash).toBe(hash);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar documento" }),
    );
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
    expect(screen.queryByRole("checkbox")).toBeNull();
  },
);

test("legal reader outlives a hidden sidebar and returns focus to visible content", () => {
  render(
    <>
      <aside>
        <LegalAccess />
      </aside>
      <main id="main-content" tabIndex={-1}>
        Contenido de trabajo
      </main>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Privacidad" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Privacidad" });
  expect(dialog.closest("aside")).toBeNull();
  Object.defineProperty(trigger, "checkVisibility", {
    value: () => false,
    configurable: true,
  });
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("main"));
});
