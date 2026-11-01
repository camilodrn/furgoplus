import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LegalAccess } from "./LegalAccess";
import { optionalTechnologies, storageTechnologies } from "./StoragePrivacy";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});
test("necessary-only storage information does not manufacture consent or alter authentication storage", () => {
  sessionStorage.setItem("furgoplus-signed-out", "1");
  const localWrite = vi.spyOn(localStorage, "setItem");
  const sessionWrite = vi.spyOn(sessionStorage, "setItem");
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<LegalAccess />);
  const trigger = screen.getByRole("button", {
    name: "Cookies y almacenamiento",
  });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", {
    name: "Cookies y almacenamiento",
  });
  expect(within(dialog).getByText("Solo tecnologías necesarias")).toBeTruthy();
  expect(optionalTechnologies).toHaveLength(0);
  expect(storageTechnologies).toHaveLength(3);
  expect(within(dialog).queryByRole("checkbox")).toBeNull();
  expect(
    within(dialog).queryByRole("button", {
      name: /aceptar|rechazar|guardar preferencias/i,
    }),
  ).toBeNull();
  expect(
    within(dialog).getByText("Hasta 12 horas desde el inicio de sesión"),
  ).toBeTruthy();
  expect(sessionStorage.getItem("furgoplus-signed-out")).toBe("1");
  expect(localWrite).not.toHaveBeenCalled();
  expect(sessionWrite).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(document.activeElement).toBe(trigger);
});
test("privacy is reachable from storage information and the public entry remains available after reopening", () => {
  const { unmount } = render(<LegalAccess />);
  fireEvent.click(
    screen.getByRole("button", { name: "Cookies y almacenamiento" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Leer Privacidad" }));
  expect(screen.getByRole("dialog", { name: "Privacidad" })).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Privacidad", level: 1 }),
  );
  expect(screen.getByText(/Aviso de Privacidad v0.2/)).toBeTruthy();
  unmount();
  render(<LegalAccess />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Cookies y almacenamiento" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Cookies y almacenamiento" }),
  ).toBeTruthy();
});
