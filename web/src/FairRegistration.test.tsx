import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("feria permite registrar conductor desde el formulario web", async () => {
  vi.stubEnv("VITE_FURGOPLUS_DEMO_MODE", "true");
  vi.stubEnv("VITE_FURGOPLUS_DEMO_REGISTRATION_ENABLED", "true");

  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (url === "/api/v1/auth/csrf/") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ csrf_token: "csrf-ficticio" }),
      };
    }

    if (url === "/api/v1/auth/me/") {
      return {
        ok: false,
        status: 403,
        json: async () => ({
          code: "not_authenticated",
          message: "Sin sesión",
          fields: {},
        }),
      };
    }

    if (url === "/api/v1/auth/register/") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 123,
          email: "conductor@example.test",
          role: "driver",
          display_name: "Conductor Feria",
        }),
      };
    }

    throw new Error(`Solicitud inesperada: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  fireEvent.click(await screen.findByText("Crear cuenta de conductor"));
  expect(screen.getByText("Crea tu cuenta de conductor")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Cómo te llamas"), {
    target: { value: "Conductor Feria" },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "conductor@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Clave-Feria-123!" },
  });

  fireEvent.click(screen.getByText("Crear cuenta"));

  expect(await screen.findByText("Cuenta creada. Inicia sesión.")).toBeTruthy();

  const registerCall = fetchMock.mock.calls.find(
    ([url]) => url === "/api/v1/auth/register/",
  );

  expect(registerCall).toBeDefined();
  expect(registerCall![1].method).toBe("POST");
  expect(registerCall![1].headers["X-CSRFToken"]).toBe("csrf-ficticio");

  const body = JSON.parse(registerCall![1].body);
  expect(body.role).toBe("driver");
  expect(body.email).toBe("conductor@example.test");
});
