// Datas no fuso de Brasília (o servidor roda em UTC). Módulo puro.

export interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
  /** YYYY-MM-DD */
  iso: string;
  /** YYYY-MM */
  period: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
}

export function localDate(now: Date, timeZone = "America/Sao_Paulo"): LocalDate {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  return { year, month, day, iso, period: iso.slice(0, 7), weekday };
}

/** Dias entre duas datas YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
