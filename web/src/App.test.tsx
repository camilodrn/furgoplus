import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows loading then success", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(screen.getByText("Comprobando conexión…")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/health/",
    expect.objectContaining({ method: "GET", credentials: "same-origin" }),
  );
  finish({ ok: true, json: async () => ({ status: "ok" }) } as Response);
  expect(
    await screen.findByText("La API responde correctamente."),
  ).toBeTruthy();
});

test("shows network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<App />);
  expect(
    await screen.findByText("No se pudo conectar con la API."),
  ).toBeTruthy();
});

test("shows invalid response as failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "unknown" }),
    }),
  );
  render(<App />);
  expect(
    await screen.findByText("No se pudo conectar con la API."),
  ).toBeTruthy();
});
