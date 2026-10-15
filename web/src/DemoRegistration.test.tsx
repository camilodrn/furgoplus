import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { AuthApi } from "./api";
import { demoRegistrationNotice, isDemoMode } from "./demo";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("demo form stays visible, explains, clears all fields and sends/stores nothing", async () => {
  vi.stubEnv("VITE_FURGOPLUS_DEMO_MODE", "true");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrf_token: "masked" }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "not_authenticated",
        message: "Signed out",
        fields: {},
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  const store = vi.spyOn(Storage.prototype, "setItem");
  render(<App />);
  fireEvent.click(await screen.findByText("Crear cuenta de conductor"));
  expect(screen.getByText("Registro ilustrativo de conductor")).toBeTruthy();
  for (const [label, value] of [
    ["Cómo te llamas", "Persona Demo"],
    ["Correo electrónico", "driver@example.test"],
    ["Contraseña", "Only-Illustrative-123!"],
  ]) {
    fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  }
  const before = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByText("Crear cuenta"));
  expect(screen.getByText(demoRegistrationNotice)).toBeTruthy();
  expect(screen.queryByText("Cuenta creada. Inicia sesión.")).toBeNull();
  for (const label of ["Cómo te llamas", "Correo electrónico", "Contraseña"]) {
    const input = screen.getByLabelText(label) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.autocomplete).toBe("off");
  }
  // Even an empty illustrative form never goes through account validation/network.
  fireEvent.click(screen.getByText("Crear cuenta"));
  expect(fetchMock.mock.calls.length).toBe(before);
  expect(store).not.toHaveBeenCalled();
  expect(
    screen.getByRole("form", { name: "Registro de conductor" }),
  ).toBeTruthy();
});

test("client API rejects demo registration before even fetching CSRF", async () => {
  vi.stubEnv("VITE_FURGOPLUS_DEMO_MODE", "true");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    new AuthApi().register({
      role: "driver",
      email: "driver@example.test",
      password: "Only-Illustrative-123!",
      display_name: "Persona Demo",
    }),
  ).rejects.toMatchObject({ code: "registration_disabled" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("dedicated demo hostname is illustrative even without flag; future app is normal", () => {
  vi.stubEnv("VITE_FURGOPLUS_DEMO_MODE", "false");
  expect(isDemoMode("demo.furgoplus.cl")).toBe(true);
  expect(isDemoMode("app.furgoplus.cl")).toBe(false);
  expect(isDemoMode("localhost")).toBe(false);
});

test("server registration_disabled never suggests success in a mismatched normal client", async () => {
  vi.stubEnv("VITE_FURGOPLUS_DEMO_MODE", "false");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrf_token: "masked" }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "not_authenticated",
        message: "Signed out",
        fields: {},
      }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "registration_disabled",
        message: "Closed",
        fields: {},
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByText("Crear cuenta de conductor"));
  for (const [label, value] of [
    ["Cómo te llamas", "Persona Demo"],
    ["Correo electrónico", "driver@example.test"],
    ["Contraseña", "Only-Illustrative-123!"],
  ]) {
    fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  }
  fireEvent.click(screen.getByText("Crear cuenta"));
  await waitFor(() =>
    expect(screen.getByText(demoRegistrationNotice)).toBeTruthy(),
  );
  expect(screen.queryByText("Cuenta creada. Inicia sesión.")).toBeNull();
  expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe(
    "",
  );
});
