import { useEffect, useRef, useState } from "react";
import { formatChileanDate, parseChileanDate } from "./dates";

export const dateFormatError =
  "Ingresa una fecha válida en formato dd/mm/aaaa.";

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const weekdays = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function monthLength(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]!;
}

function firstWeekday(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, 1);
  return (date.getUTCDay() + 6) % 7;
}

function todayInChile(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const number = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day") };
}

export function ChileanDateField({
  value,
  onChange,
  error,
  id,
  label = "Fecha de vencimiento",
  errorMessage = dateFormatError,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error: boolean;
  id: string;
  label?: string;
  errorMessage?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = todayInChile();
    return { year: today.year, month: today.month };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);
  const firstDayRef = useRef<HTMLButtonElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const selected = parseChileanDate(value);

  useEffect(() => {
    if (!open) return;
    (selectedDayRef.current ?? firstDayRef.current)?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function openCalendar() {
    const today = todayInChile();
    const date =
      selected ??
      `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
    const [year, month] = date.split("-").map(Number);
    setVisibleMonth({ year: year!, month: month! });
    setOpen(true);
  }

  function moveMonth(delta: number) {
    setVisibleMonth(({ year, month }) => {
      const next = year * 12 + month - 1 + delta;
      return { year: Math.floor(next / 12), month: (next % 12) + 1 };
    });
  }

  const { year, month } = visibleMonth;
  const first = firstWeekday(year, month);
  const days = monthLength(year, month);

  return (
    <div
      className="expiry-field"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          calendarButtonRef.current?.focus();
        }
      }}
    >
      <label className="expiry-label" htmlFor={id}>
        {label}
      </label>
      <div className="expiry-input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={
            label === "Fecha de vencimiento" ? "dd/mm/aaaa" : "DD/MM/AAAA"
          }
          maxLength={10}
          value={value}
          aria-invalid={error}
          aria-required={required || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={calendarButtonRef}
          className="expiry-calendar-trigger"
          type="button"
          aria-label={
            label === "Fecha de vencimiento"
              ? "Abrir calendario"
              : `Abrir calendario de ${label.toLowerCase()}`
          }
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4M17 3v4M3 10h18" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="expiry-calendar"
          id={`${id}-calendar`}
          role="dialog"
          aria-label={`Calendario de ${label.toLowerCase()}`}
        >
          <div className="expiry-calendar-heading">
            <button
              type="button"
              aria-label="Mes anterior"
              disabled={year === 1 && month === 1}
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <strong aria-live="polite">
              {monthNames[month - 1]} {year}
            </strong>
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={year === 9999 && month === 12}
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <label className="expiry-native-date">
            Elegir fecha
            <input
              type="date"
              value={selected ?? ""}
              min="0001-01-01"
              max="9999-12-31"
              onChange={(event) => {
                if (!event.target.value) return;
                const formatted = formatChileanDate(event.target.value);
                if (!formatted) return;
                onChange(formatted);
                setOpen(false);
                inputRef.current?.focus();
              }}
            />
          </label>
          <div className="expiry-calendar-grid">
            {weekdays.map((weekday) => (
              <span className="expiry-calendar-weekday" key={weekday}>
                {weekday}
              </span>
            ))}
            {Array.from({ length: first }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const display = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
              const isSelected = parseChileanDate(display) === selected;
              return (
                <button
                  key={day}
                  ref={
                    isSelected
                      ? selectedDayRef
                      : day === 1
                        ? firstDayRef
                        : undefined
                  }
                  className={isSelected ? "is-selected" : undefined}
                  type="button"
                  aria-label={`${day} de ${monthNames[month - 1]} de ${year}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(display);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

export function visibleExpiry(value: string | null): string {
  return value ? (formatChileanDate(value) ?? "—") : "—";
}
