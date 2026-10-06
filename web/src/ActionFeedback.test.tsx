import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ActionFeedbackProvider, useActionFeedback } from "./ActionFeedback";

function Actions() {
  const { show } = useActionFeedback();
  return (
    <>
      <button
        onClick={() =>
          show({
            kind: "error",
            title: "No pudimos guardar",
            message: "Revisa los datos.",
          })
        }
      >
        Fallar
      </button>
      <button onClick={() => show({ kind: "success", title: "Ruta guardada" })}>
        Guardar
      </button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("action error persists, success expires without focus theft, and keyboard dismiss restores focus", () => {
  vi.useFakeTimers();
  render(
    <ActionFeedbackProvider>
      <Actions />
    </ActionFeedbackProvider>,
  );
  const fail = screen.getByRole("button", { name: "Fallar" });
  fail.focus();
  fireEvent.click(fail);
  const alert = screen.getByRole("alert");
  expect(alert.getAttribute("aria-live")).toBe("assertive");
  expect(alert.getAttribute("aria-atomic")).toBe("true");
  expect(within(alert).getByText("!").getAttribute("aria-hidden")).toBe("true");
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByRole("alert")).toBe(alert);
  const dismiss = screen.getByRole("button", { name: "Cerrar aviso" });
  dismiss.focus();
  fireEvent.click(dismiss);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.activeElement).toBe(fail);
  const save = screen.getByRole("button", { name: "Guardar" });
  save.focus();
  fireEvent.click(save);
  expect(screen.getByRole("status").textContent).toContain("Ruta guardada");
  expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  expect(document.activeElement).toBe(save);
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("one notice survives screen navigation; success timer pauses for hover and keyboard reading", () => {
  vi.useFakeTimers();
  const view = render(
    <ActionFeedbackProvider>
      <Actions />
    </ActionFeedbackProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Fallar" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getAllByRole("complementary")).toHaveLength(1);
  const notice = screen.getByRole("complementary");
  fireEvent.mouseEnter(notice);
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByRole("status")).toBeTruthy();
  act(() => screen.getByRole("button", { name: "Cerrar aviso" }).focus());
  fireEvent.mouseLeave(notice);
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.mouseEnter(notice);
  act(() => screen.getByRole("button", { name: "Guardar" }).focus());
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.mouseLeave(notice);
  act(() => vi.advanceTimersByTime(8000));
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  view.rerender(
    <ActionFeedbackProvider>
      <p>Otra pantalla</p>
    </ActionFeedbackProvider>,
  );
  expect(screen.getByRole("status").textContent).toContain("Ruta guardada");
});
