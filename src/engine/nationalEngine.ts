import { NATIONS, nationsOf } from '../data/nations';
import { qualifierId, type NationalTournamentDef } from '../data/nationalTournaments';
import { Continent } from '../models';
import type { Competition, Confederation, NationalTeam, StandingRow, Team } from '../models';
import { clamp } from '../utils/math';
import type { Random } from '../utils/random';
import { buildBracketRound, countBracketRounds } from './cupEngine';
import { buildGroups } from './groupEngine';
import { currentStandings } from './leagueManager';

const CONTINENT_BY_CONFEDERATION: Record<Confederation, Continent> = {
  UEFA: Continent.Europe,
  CONMEBOL: Continent.SouthAmerica,
  CONCACAF: Continent.NorthAmerica,
  AFC: Continent.Asia,
  CAF: Continent.Africa,
  OFC: Continent.Asia,
};

/** Convierte una selección en un equipo jugable por el motor de partidos. */
export function nationAsTeam(nation: NationalTeam): Team {
  const strength = nation.strength;
  return {
    id: nation.id,
    name: nation.name,
    short: nation.code.slice(0, 3).toUpperCase(),
    leagueId: '',
    country: nation.name,
    countryCode: nation.code,
    continent: CONTINENT_BY_CONFEDERATION[nation.confederation],
    attack: clamp(strength + 2, 30, 96),
    midfield: clamp(strength, 30, 96),
    defense: clamp(strength - 1, 30, 96),
    overall: strength,
    reputation: strength,
  };
}

let teamsCache: Record<string, Team> | null = null;

/** Todas las selecciones como equipos (cacheado en memoria). */
export function nationTeams(): Record<string, Team> {
  if (!teamsCache) {
    teamsCache = Object.fromEntries(Object.values(NATIONS).map((nation) => [nation.id, nationAsTeam(nation)]));
  }
  return teamsCache;
}

/** Clasificación de una confederación: una liguilla con todas sus selecciones. */
export function buildQualifying(
  confederation: Confederation,
  season: number,
  rng: Random,
): Competition {
  const nations = nationsOf(confederation)
    .sort((a, b) => b.strength - a.strength)
    .map((nation) => nation.id);

  const competition: Competition = {
    id: qualifierId(confederation),
    name: `Clasificación · ${confederation}`,
    season,
    kind: 'national',
    format: 'league',
    stage: 'league',
    tier: 1,
    teamIds: nations,
    round: 1,
    leg: 1,
    totalRounds: 0,
    ties: [],
    championId: null,
    pendingByes: [],
    twoLeggedRounds: 0,
    pendingEntrants: [],
    mainEntrants: nations,
  };

  buildGroups(competition, 1, nationTeams(), rng, 7);
  return competition;
}

/** Equipos clasificados de una liguilla de clasificación. */
export function qualifiedFrom(qualifying: Competition, slots: number): string[] {
  const table = qualifying.groups?.[0];
  if (!table) return [];
  return currentStandings(table).slice(0, slots).map((row) => row.teamId);
}

/** Construye el torneo con los clasificados. */
export function buildTournament(
  def: NationalTournamentDef,
  qualified: string[],
  season: number,
  rng: Random,
): Competition {
  const competition: Competition = {
    id: def.id,
    name: def.name,
    season,
    kind: 'national',
    format: 'groups',
    stage: 'groups',
    tier: 1,
    teamIds: qualified,
    round: 1,
    leg: 1,
    totalRounds: 0,
    ties: [],
    championId: null,
    pendingByes: [],
    twoLeggedRounds: 0,
    pendingEntrants: [],
    mainEntrants: qualified,
  };

  buildGroups(competition, def.groups, nationTeams(), rng, def.groupSize - 1);
  return competition;
}

/** Cierra la fase de grupos del torneo y arranca la eliminatoria. */
export function finishTournamentGroups(
  competition: Competition,
  def: NationalTournamentDef,
  rng: Random,
): void {
  const winners: string[] = [];
  const runners: string[] = [];
  const thirds: StandingRow[] = [];

  for (const group of competition.groups ?? []) {
    const table = currentStandings(group);
    if (table[0]) winners.push(table[0].teamId);
    if (table[1]) runners.push(table[1].teamId);
    if (table[2]) thirds.push(table[2]);
  }

  let knockout = [...winners, ...runners];
  if (def.bestThirds > 0) {
    const best = [...thirds]
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor,
      )
      .slice(0, def.bestThirds)
      .map((row) => row.teamId);
    knockout = [...knockout, ...best];
  }

  competition.stage = 'knockout';
  competition.round = 1;
  competition.leg = 1;
  competition.pendingByes = [];
  competition.totalRounds = countBracketRounds(knockout.length, 0);
  competition.twoLeggedRounds = 0;
  competition.twoLeggedFinal = false;
  buildBracketRound(competition, knockout, 1, nationTeams(), rng);
}
