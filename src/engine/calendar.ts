import { CONFIG } from '../data/config';
import { addGameDays } from '../utils/date';
import type { GameDate } from '../utils/date';

/**
 * Calendario de la temporada. Cada jornada de liga se agenda en una fecha
 * semanal y el parón de invierno desplaza las jornadas posteriores. La unidad
 * de avance es la jornada («tanda»), aunque una misma semana pueda acoger una
 * jornada de liga y otra de competición continental.
 */

/** Ventanas de fichajes. */
export type TransferWindow = 'summer' | 'winter';

/** Fecha de una jornada concreta de una temporada. */
export function roundDate(season: number, round: number): GameDate {
  const c = CONFIG.CALENDAR;
  const year = c.START_YEAR + (season - 1);
  const start: GameDate = { year, month: c.START_MONTH, day: c.START_DAY };

  let days = (round - 1) * c.ROUND_INTERVAL_DAYS;
  if (round > c.WINTER_BREAK_ROUND) days += c.WINTER_BREAK_DAYS;

  return addGameDays(start, days);
}

/** Ventana a la que pertenece una jornada, o null si el mercado está cerrado. */
export function windowForRound(round: number): TransferWindow | null {
  const c = CONFIG.CALENDAR;
  if (round >= c.SUMMER_WINDOW.FROM_ROUND && round <= c.SUMMER_WINDOW.TO_ROUND) return 'summer';
  if (round >= c.WINTER_WINDOW.FROM_ROUND && round <= c.WINTER_WINDOW.TO_ROUND) return 'winter';
  return null;
}
