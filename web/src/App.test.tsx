import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, code: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ code, message: code, fields: {} }),
  }) as Response;
const csrf = ok({ csrf_token: "masked" });
const driver = {
  id: 1,
  email: "sample@example.test",
  role: "driver",
  display_name: "Sample",
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

test("restores a driver through csrf then me", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(screen.getByText("Restaurando sesión…")).toBeTruthy();
  expect(await screen.findByText("Área del conductor")).toBeTruthy();
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/auth/csrf/",
    "/api/v1/auth/me/",
  ]);
  expect(fetchMock.mock.calls[1]![1].credentials).toBe("same-origin");
});

test("parent role is unsupported on web", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(csrf)
      .mockResolvedValueOnce(ok({ ...driver, role: "parent" })),
  );
  render(<App />);
  expect(await screen.findByText("Usa la aplicación móvil")).toBeTruthy();
  expect(screen.queryByText("Área del conductor")).toBeNull();
});

test("signed-out state follows failed restore and driver registration", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(fail(403, "not_authenticated"))
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByText("Registrar conductor"));
  fireEvent.change(screen.getByLabelText("Nombre visible"), {
    target: { value: "Sample" },
  });
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByText("Crear cuenta"));
  expect(await screen.findByText("Cuenta creada. Inicia sesión.")).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toMatchObject({
    role: "driver",
    display_name: "Sample",
  });
  expect(fetchMock.mock.calls[3]![1].headers["X-CSRFToken"]).toBe("masked");
  expect(sessionStorage.length).toBe(0);
});

test("logout clears UI and records unconfirmed server logout", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByText("Cerrar sesión"));
  expect(await screen.findByText("Iniciar sesión")).toBeTruthy();
  expect(
    await screen.findByText(/cierre en el servidor no está confirmado/),
  ).toBeTruthy();
  expect(sessionStorage.getItem("furgoplus-signed-out")).toBe("1");
  expect(fetchMock.mock.calls[2]![1].headers["X-CSRFToken"]).toBe("masked");
});

test("login uses rotated CSRF token for logout", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(fail(403, "not_authenticated"))
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok({ ...driver, csrf_token: "rotated" }))
    .mockResolvedValueOnce(ok({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Correo"), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Synthetic-Password" },
  });
  fireEvent.click(screen.getByText("Entrar"));
  fireEvent.click(await screen.findByText("Cerrar sesión"));
  expect(await screen.findByText("Iniciar sesión")).toBeTruthy();
  expect(fetchMock.mock.calls[4]![1].headers["X-CSRFToken"]).toBe("rotated");
  expect(sessionStorage.getItem("furgoplus-signed-out")).toBeNull();
});

test("a confirmed session expiry clears the authenticated shell", async () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(csrf)
    .mockResolvedValueOnce(ok(driver))
    .mockResolvedValueOnce(fail(403, "not_authenticated"));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(await screen.findByText("Área del conductor")).toBeTruthy();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(await screen.findByText("La sesión caducó.")).toBeTruthy();
  expect(screen.queryByText("Área del conductor")).toBeNull();
});
