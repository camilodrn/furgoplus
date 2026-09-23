import { expect, test } from "vitest";
import { formatChileanDate, humanChileanDate, parseChileanDate } from "./dates";

test("strict Chilean date conversion keeps the API in ISO format", () => {
  expect(parseChileanDate("23/09/2026")).toBe("2026-09-23");
  expect(formatChileanDate("2026-09-23")).toBe("23/09/2026");
  expect(humanChileanDate("2026-09-23", true)).toBe("23 sep 2026");
});

test("real leap days are accepted and impossible dates are rejected", () => {
  expect(parseChileanDate("31/02/2026")).toBeNull();
  expect(parseChileanDate("29/02/2028")).toBe("2028-02-29");
  expect(parseChileanDate("29/02/2027")).toBeNull();
  expect(formatChileanDate("2027-02-29")).toBeNull();
});

test("text and month-first assumptions are rejected", () => {
  expect(parseChileanDate("mañana")).toBeNull();
  expect(parseChileanDate("2026-09-23")).toBeNull();
  expect(parseChileanDate("09/23/2026")).toBeNull();
  expect(parseChileanDate("1/2/2026")).toBeNull();
  expect(parseChileanDate(" 23/09/2026")).toBeNull();
});
