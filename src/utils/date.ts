/**
 * Fechas del juego. Se representan como un día sin hora ni zona horaria, y se
 * convierten a un número de día absoluto para operar de forma determinista.
 */

/** Fecha del calendario del juego. */
export interface GameDate {
  year: number;
  /** Mes 1-12. */
  month: number;
  /** Día 1-31. */
  day: number;
}

const DAY_MS = 86_400_000;

/** Número de día absoluto (época en días) de una fecha. */
export function gameDateToEpoch(date: GameDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

/** Reconstruye una fecha desde su número de día absoluto. */
export function gameDateFromEpoch(epoch: number): GameDate {
  const date = new Date(epoch * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Suma (o resta) días a una fecha. */
export function addGameDays(date: GameDate, days: number): GameDate {
  return gameDateFromEpoch(gameDateToEpoch(date) + days);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** Formatea una fecha de forma breve («16 ago 2026»). */
export function formatGameDate(date: GameDate): string {
  return `${date.day} ${MONTHS[date.month - 1]} ${date.year}`;
}
