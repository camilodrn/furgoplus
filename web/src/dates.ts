const months = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function validDate(day: number, month: number, year: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

export function parseChileanDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  if (!validDate(Number(day), Number(month), Number(year))) return null;
  return `${year}-${month}-${day}`;
}

export function formatChileanDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!validDate(Number(day), Number(month), Number(year))) return null;
  return `${day}/${month}/${year}`;
}

export function humanChileanDate(
  value: string | null,
  dateOnly = false,
): string {
  if (!value) return "—";
  if (dateOnly) {
    const formatted = formatChileanDate(value);
    if (!formatted) return "—";
    const [day, month, year] = formatted.split("/");
    return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${Number(part("day"))} ${months[Number(part("month")) - 1]} ${part("year")} · ${part("hour")}:${part("minute")}`;
}
