import { CONFIG } from '../data/config';
import { addGameDays, type GameDate } from '../utils/date';
import { roundDate } from './calendar';

/**
 * Calendario de la temporada como lista ordenada de tandas. Cada jornada de
 * liga va seguida, cuando toca, de una tanda de copa entre semana. Así liga y
 * copa conviven en la misma semana pero se juegan en tandas distintas.
 */
export type SeasonTick =
  | { kind: 'league'; round: number; date: GameDate }
  | { kind: 'cup'; date: GameDate }
  | { kind: 'continental'; date: GameDate };

/** Construye el calendario de una temporada de forma determinista. */
export function buildSeasonSchedule(season: number): SeasonTick[] {
  const cupAfter = new Set<number>(CONFIG.CALENDAR.CUP_TICKS_AFTER_ROUND);
  const continentalAfter = new Set<number>(CONFIG.CALENDAR.CONTINENTAL_TICKS_AFTER_ROUND);
  const ticks: SeasonTick[] = [];

  for (let round = 1; round <= CONFIG.CALENDAR.LEAGUE_ROUNDS; round += 1) {
    const leagueDate = roundDate(season, round);
    ticks.push({ kind: 'league', round, date: leagueDate });
    if (cupAfter.has(round)) {
      ticks.push({ kind: 'cup', date: addGameDays(leagueDate, 3) });
    }
    if (continentalAfter.has(round)) {
      ticks.push({ kind: 'continental', date: addGameDays(leagueDate, 5) });
    }
  }

  return ticks;
}
