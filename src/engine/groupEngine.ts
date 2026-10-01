import type { Competition, CompetitionGroup, Team } from '../models';
import type { Random } from '../utils/random';
import { applyFixtureResult, createStandings, currentStandings, generateFixtures } from './leagueManager';
import { buildBracketRound } from './cupEngine';
import { simulateQuickMatch } from './matchEngine';

const GROUP_LETTERS = 'ABCDEFGH';

/** Construye la fase de grupos repartiendo por bombos. */
export function buildGroups(
  competition: Competition,
  groupCount: number,
  teams: Record<string, Team>,
  rng: Random,
  rounds?: number,
): void {
  const ranked = [...competition.teamIds].sort(
    (a, b) => (teams[b]?.overall ?? 0) - (teams[a]?.overall ?? 0),
  );

  const groupSize = Math.max(1, Math.floor(competition.teamIds.length / groupCount));
  const buckets: string[][] = Array.from({ length: groupCount }, () => []);
  for (let pot = 0; pot < groupSize; pot += 1) {
    const potTeams = rng.shuffle(ranked.slice(pot * groupCount, (pot + 1) * groupCount));
    potTeams.forEach((teamId, index) => {
      buckets[index]?.push(teamId);
    });
  }

  competition.groups = buckets.map((teamIds, index) => {
    const all = generateFixtures(teamIds, rng);
    const fixtures = rounds && rounds > 0 ? all.filter((fixture) => fixture.round <= rounds) : all;
    return {
      id: GROUP_LETTERS[index] ?? `G${index + 1}`,
      teamIds,
      standings: createStandings(teamIds),
      fixtures,
    } satisfies CompetitionGroup;
  });

  competition.groupRounds = competition.groups.reduce(
    (max, group) => Math.max(max, ...group.fixtures.map((fixture) => fixture.round)),
    0,
  );
}

/** Construye la fase de liga (tabla única) con `rounds` jornadas. */
export function buildLeaguePhase(
  competition: Competition,
  teams: Record<string, Team>,
  rng: Random,
  rounds: number,
): void {
  buildGroups(competition, 1, teams, rng, rounds);
  competition.stage = 'league';
  competition.groupRounds = rounds;
}

/** Grupo en el que juega un equipo. */
export function groupOfTeam(competition: Competition, teamId: string): CompetitionGroup | undefined {
  return competition.groups?.find((group) => group.teamIds.includes(teamId));
}

/** Simula una jornada de la fase de grupos en todos los grupos. */
export function simulateGroupRound(
  competition: Competition,
  round: number,
  teams: Record<string, Team>,
  rng: Random,
): void {
  for (const group of competition.groups ?? []) {
    for (const fixture of group.fixtures) {
      if (fixture.round !== round || fixture.played) continue;
      const home = teams[fixture.homeId];
      const away = teams[fixture.awayId];
      if (!home || !away) continue;
      const { homeGoals, awayGoals } = simulateQuickMatch(home, away, rng);
      applyFixtureResult(group, fixture, homeGoals, awayGoals);
    }
  }
}

/** Equipos clasificados por grupo (los `perGroup` primeros). */
export function groupQualifiers(competition: Competition, perGroup: number): string[] {
  const result: string[] = [];
  for (const group of competition.groups ?? []) {
    result.push(...currentStandings(group).slice(0, perGroup).map((row) => row.teamId));
  }
  return result;
}

/** Equipos de una franja de puestos por grupo (p. ej. los segundos). */
export function groupRange(competition: Competition, from: number, count: number): string[] {
  const result: string[] = [];
  for (const group of competition.groups ?? []) {
    result.push(...currentStandings(group).slice(from, from + count).map((row) => row.teamId));
  }
  return result;
}

/**
 * Cierra la fase de grupos y arranca la eliminatoria.
 * `direct` espera exento a la segunda ronda; `firstRound` juega la primera.
 */
export function startKnockout(
  competition: Competition,
  direct: string[],
  firstRound: string[],
  totalRounds: number,
  teams: Record<string, Team>,
  rng: Random,
): void {
  competition.stage = 'knockout';
  competition.round = 1;
  competition.leg = 1;
  competition.pendingByes = direct;
  competition.totalRounds = totalRounds;
  buildBracketRound(competition, firstRound, 1, teams, rng);
}
