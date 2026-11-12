import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChileanDateField } from "./ChileanDateField";
import { parseChileanDate } from "./dates";

function DateHarness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ChileanDateField
        id="expiry"
        value={value}
        onChange={setValue}
        error={!!value && !parseChileanDate(value)}
      />
      <output data-testid="iso">{parseChileanDate(value) ?? ""}</output>
    </>
  );
}

afterEach(cleanup);

test("calendar button opens a Monday-first Spanish calendar and selection stays Chilean", () => {
  render(<DateHarness initial="23/09/2026" />);
  const input = screen.getByLabelText(
    "Fecha de vencimiento",
  ) as HTMLInputElement;
  const trigger = screen.getByRole("button", { name: "Abrir calendario" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("septiembre 2026")).toBeTruthy();
  expect(
    screen
      .getAllByText(/^(lun|mar|mié|jue|vie|sáb|dom)$/)
      .map((day) => day.textContent),
  ).toEqual(["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]);
  expect(
    screen
      .getByRole("button", { name: "23 de septiembre de 2026" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "24 de septiembre de 2026" }),
  );
  expect(input.value).toBe("24/09/2026");
  expect(input.value).not.toBe("09/24/2026");
  expect(screen.getByTestId("iso").textContent).toBe("2026-09-24");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(input);
});

test("month navigation includes leap day but never shows impossible days", () => {
  render(<DateHarness initial="28/02/2028" />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
  expect(screen.getByText("febrero 2028")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "29 de febrero de 2028" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "30 de febrero de 2028" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
  expect(screen.getByText("marzo 2028")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
  fireEvent.click(
    screen.getByRole("button", { name: "29 de febrero de 2028" }),
  );
  expect(
    (screen.getByLabelText("Fecha de vencimiento") as HTMLInputElement).value,
  ).toBe("29/02/2028");
  expect(screen.getByTestId("iso").textContent).toBe("2028-02-29");
});

test("Escape and outside click close without changing the typed value", () => {
  render(<DateHarness initial="10/10/2026" />);
  const input = screen.getByLabelText(
    "Fecha de vencimiento",
  ) as HTMLInputElement;
  const trigger = screen.getByRole("button", { name: "Abrir calendario" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(input.value).toBe("10/10/2026");
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(input.value).toBe("10/10/2026");
});

test("manual DD/MM/YYYY entry stays strict, including leap years", () => {
  render(<DateHarness />);
  const input = screen.getByLabelText(
    "Fecha de vencimiento",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "31/02/2026" } });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByTestId("iso").textContent).toBe("");
  fireEvent.change(input, { target: { value: "29/02/2028" } });
  expect(input.getAttribute("aria-invalid")).toBe("false");
  expect(screen.getByTestId("iso").textContent).toBe("2028-02-29");
  fireEvent.change(input, { target: { value: "02/29/2028" } });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByTestId("iso").textContent).toBe("");
});

test("compact native date selection preserves the Chilean value and return focus", () => {
  render(<DateHarness initial="23/09/2026" />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
  fireEvent.change(screen.getByLabelText("Elegir fecha"), {
    target: { value: "2026-11-04" },
  });
  expect(
    (screen.getByLabelText("Fecha de vencimiento") as HTMLInputElement).value,
  ).toBe("04/11/2026");
  expect(screen.getByTestId("iso").textContent).toBe("2026-11-04");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByLabelText("Fecha de vencimiento"),
  );
});
