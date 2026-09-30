import { clamp } from '../utils/math';
import type { Random } from '../utils/random';
import type { Fixture, League, StandingRow, Team } from '../models';
import { sortStandings, teamOverall } from '../models';

/** Crea la clasificación inicial (todo a cero). */
export function createStandings(teamIds: readonly string[]): StandingRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

/**
 * Genera un calendario de doble vuelta con el método del círculo.
 * Para n equipos produce n-1 jornadas de ida y n-1 de vuelta (n-1)*2 en total.
 */
export function generateFixtures(teamIds: readonly string[], rng: Random): Fixture[] {
  const teams = rng.shuffle(teamIds);
  const n = teams.length;
  if (n < 2 || n % 2 !== 0) return [];

  const roundsCount = n - 1;
  const half = n / 2;
  const rotation = teams.slice(1);
  const firstLeg: Fixture[][] = [];

  for (let round = 0; round < roundsCount; round += 1) {
    const ordered = [teams[0], ...rotation];
    const matches: Fixture[] = [];
    for (let i = 0; i < half; i += 1) {
      const a = ordered[i];
      const b = ordered[n - 1 - i];
      const swap = (round + i) % 2 === 0;
      matches.push({
        round: round + 1,
        homeId: swap ? a : b,
        awayId: swap ? b : a,
        played: false,
        homeGoals: null,
        awayGoals: null,
      });
    }
    firstLeg.push(matches);
    rotation.unshift(rotation.pop() as string);
  }

  const fixtures: Fixture[] = [...firstLeg.flat()];
  firstLeg.forEach((matches, index) => {
    for (const match of matches) {
      fixtures.push({
        round: index + 1 + roundsCount,
        homeId: match.awayId,
        awayId: match.homeId,
        played: false,
        homeGoals: null,
        awayGoals: null,
      });
    }
  });

  return fixtures;
}

/** Prepara una liga para una temporada nueva. */
export function resetLeagueForSeason(league: League, rng: Random): void {
  league.standings = createStandings(league.teamIds);
  league.fixtures = generateFixtures(league.teamIds, rng);
  league.currentRound = 1;
  league.totalRounds = (league.teamIds.length - 1) * 2;
}

/** Devuelve los partidos de una jornada concreta. */
export function fixturesOfRound(league: League, round: number): Fixture[] {
  return league.fixtures.filter((fixture) => fixture.round === round);
}

/** Encuentra el partido de un equipo en una jornada. */
export function fixtureForTeam(league: League, round: number, teamId: string): Fixture | undefined {
  return league.fixtures.find(
    (fixture) => fixture.round === round && (fixture.homeId === teamId || fixture.awayId === teamId),
  );
}

/** Actualiza la clasificación con el resultado de un partido. */
export function applyFixtureResult(league: League, fixture: Fixture, homeGoals: number, awayGoals: number): void {
  if (fixture.played) return;
  fixture.played = true;
  fixture.homeGoals = homeGoals;
  fixture.awayGoals = awayGoals;

  const home = league.standings.find((row) => row.teamId === fixture.homeId);
  const away = league.standings.find((row) => row.teamId === fixture.awayId);
  if (!home || !away) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (homeGoals < awayGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

/** Clasificación ordenada. */
export function currentStandings(league: League): StandingRow[] {
  return sortStandings(league.standings);
}

/** Posición (1-indexed) de un equipo en la clasificación actual. */
export function positionOf(league: League, teamId: string): number {
  const index = currentStandings(league).findIndex((row) => row.teamId === teamId);
  return index < 0 ? league.teamIds.length : index + 1;
}

/** Diferencia de goles de una fila. */
export function goalDifference(row: StandingRow): number {
  return row.goalsFor - row.goalsAgainst;
}

/** Resultado de un ascenso o descenso. */
export interface MovementLog {
  teamId: string;
  teamName: string;
  fromLeagueId: string;
  toLeagueId: string;
  kind: 'promotion' | 'relegation';
}

/**
 * Ejecuta ascensos y descensos entre una liga y la inmediatamente inferior.
 * Devuelve el registro de movimientos para poder informar al usuario.
 */
export function processPromotionRelegation(
  above: League,
  below: League,
  teams: Record<string, Team>,
): MovementLog[] {
  const movements: MovementLog[] = [];
  const relegated = currentStandings(above)
    .slice(Math.max(0, above.standings.length - above.relegationSlots))
    .map((row) => row.teamId);
  const promoted = currentStandings(below)
    .slice(0, below.promotionSlots)
    .map((row) => row.teamId);

  const count = Math.min(relegated.length, promoted.length);

  for (let i = 0; i < count; i += 1) {
    const downId = relegated[i];
    const upId = promoted[i];
    const downTeam = teams[downId];
    const upTeam = teams[upId];
    if (!downTeam || !upTeam) continue;

    above.teamIds = above.teamIds.filter((id) => id !== downId);
    above.teamIds.push(upId);
    below.teamIds = below.teamIds.filter((id) => id !== upId);
    below.teamIds.push(downId);

    downTeam.leagueId = below.id;
    upTeam.leagueId = above.id;

    // El cambio de categoría ajusta ligeramente la reputación y la plantilla:
    // un club que asciende invierte y se refuerza; el que baja se debilita.
    downTeam.reputation = clamp(downTeam.reputation - 3, 5, 100);
    upTeam.reputation = clamp(upTeam.reputation + 4, 5, 100);
    upTeam.attack = clamp(upTeam.attack + 3, 30, 96);
    upTeam.midfield = clamp(upTeam.midfield + 3, 30, 96);
    upTeam.defense = clamp(upTeam.defense + 3, 30, 96);
    upTeam.overall = teamOverall(upTeam);
    downTeam.attack = clamp(downTeam.attack - 2, 30, 96);
    downTeam.midfield = clamp(downTeam.midfield - 2, 30, 96);
    downTeam.defense = clamp(downTeam.defense - 2, 30, 96);
    downTeam.overall = teamOverall(downTeam);

    movements.push({
      teamId: downId,
      teamName: downTeam.name,
      fromLeagueId: above.id,
      toLeagueId: below.id,
      kind: 'relegation',
    });
    movements.push({
      teamId: upId,
      teamName: upTeam.name,
      fromLeagueId: below.id,
      toLeagueId: above.id,
      kind: 'promotion',
    });
  }

  return movements;
}

/** Aplica la pirámide completa de un país. */
export function processCountryPyramid(
  leagues: Record<string, League>,
  teams: Record<string, Team>,
  countryCode: string,
): MovementLog[] {
  const chain = Object.values(leagues)
    .filter((league) => league.countryCode === countryCode)
    .sort((a, b) => a.tier - b.tier);

  const movements: MovementLog[] = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    movements.push(...processPromotionRelegation(chain[i], chain[i + 1], teams));
  }
  return movements;
}
