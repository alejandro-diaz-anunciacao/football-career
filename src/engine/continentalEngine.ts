import { COUNTRIES } from '../data/continents';
import type { ContinentalDef } from '../data/continental';
import type { Competition, League, Team } from '../models';
import type { Random } from '../utils/random';
import { currentStandings } from './leagueManager';
import { buildGroups, buildLeaguePhase } from './groupEngine';
import { buildBracketRound, countBracketRounds } from './cupEngine';

/** Datos para calcular los clasificados continentales de una temporada. */
export interface QualificationInput {
  teams: Record<string, Team>;
  leagues: Record<string, League>;
  /** Campeón de copa por país. */
  cupChampions: Record<string, string>;
  season: number;
  /** En la primera temporada no hay clasificación y se ordena por nivel. */
  seasonOne: boolean;
}

/** Ranking de un país: por clasificación final o, en el primer año, por nivel. */
function countryRanking(countryCode: string, input: QualificationInput): string[] {
  if (input.seasonOne) {
    return Object.values(input.teams)
      .filter((team) => team.countryCode === countryCode)
      .sort((a, b) => b.overall - a.overall)
      .map((team) => team.id);
  }

  const leagues = Object.values(input.leagues)
    .filter((league) => league.countryCode === countryCode)
    .sort((a, b) => a.tier - b.tier);

  const ranked: string[] = [];
  for (const league of leagues) {
    for (const row of currentStandings(league)) ranked.push(row.teamId);
  }
  return ranked;
}

/** Construye el cuadro principal (fase de liga, grupos o eliminatoria directa). */
export function buildMainStage(
  competition: Competition,
  def: ContinentalDef,
  participants: string[],
  teams: Record<string, Team>,
  rng: Random,
): void {
  competition.teamIds = participants;
  competition.mainEntrants = participants;
  competition.round = 1;
  competition.leg = 1;
  competition.ties = [];
  competition.pendingByes = [];

  if (def.format === 'league') {
    competition.format = 'league';
    competition.stage = 'league';
    buildLeaguePhase(competition, teams, rng, def.leagueRounds ?? 8);
  } else if (def.format === 'groups') {
    competition.format = 'groups';
    competition.stage = 'groups';
    buildGroups(competition, def.groups ?? 4, teams, rng, def.groupRounds);
  } else {
    competition.format = 'knockout';
    competition.stage = 'knockout';
    competition.totalRounds = countBracketRounds(participants.length, 0);
    buildBracketRound(competition, participants, 1, teams, rng);
  }
}

/** Crea una competición continental (con previa o en espera de repescas). */
function buildCompetition(
  def: ContinentalDef,
  direct: string[],
  qualifying: string[],
  deferred: boolean,
  season: number,
  teams: Record<string, Team>,
  rng: Random,
): Competition {
  const competition: Competition = {
    id: def.id,
    name: def.name,
    season,
    kind: 'continental',
    format: def.format === 'league' ? 'league' : def.format === 'groups' ? 'groups' : 'knockout',
    stage: 'done',
    continent: def.continent,
    tier: def.tier,
    teamIds: direct,
    round: 1,
    leg: 1,
    totalRounds: 0,
    ties: [],
    championId: null,
    pendingByes: [],
    twoLeggedRounds: def.knockoutTwoLeggedRounds,
    pendingEntrants: [],
    mainEntrants: direct,
    knockoutFirstTwoLegged: def.knockoutFirstTwoLegged,
    twoLeggedFinal: def.twoLeggedFinal,
  };

  if (def.qualifyingSlots && qualifying.length > 0) {
    competition.stage = 'qualifying';
    competition.teamIds = [...direct, ...qualifying];
    competition.totalRounds = def.qualifyingRounds ?? 1;
    competition.twoLeggedRounds = competition.totalRounds;
    competition.twoLeggedFinal = true;
    buildBracketRound(competition, qualifying, 1, teams, rng);
  } else if (deferred) {
    competition.stage = 'pending';
  } else {
    buildMainStage(competition, def, direct, teams, rng);
  }

  return competition;
}

/**
 * Calcula los participantes de cada competición continental por puesto de liga,
 * campeón de copa y evitando que un club juegue dos competiciones del continente
 * (salvo las que comparten equipos, como la Leagues Cup).
 */
export function buildContinentalCompetitions(
  defs: readonly ContinentalDef[],
  input: QualificationInput,
  rng: Random,
): Record<string, Competition> {
  const result: Record<string, Competition> = {};
  const used = new Set<string>();
  const defsById = new Map(defs.map((def) => [def.id, def]));
  const continents = [...new Set(defs.map((def) => def.continent))];

  for (const continent of continents) {
    const continentDefs = defs.filter((def) => def.continent === continent).sort((a, b) => a.tier - b.tier);
    const countries = COUNTRIES.filter((country) => country.continent === continent).map((country) => country.code);

    for (const def of continentDefs) {
      const share = Boolean(def.shareTeams);
      const picked = new Set<string>();

      const collect = (slots: Record<string, number>): string[] => {
        const out: string[] = [];
        for (const code of countries) {
          const ranking = countryRanking(code, input).filter(
            (id) => (share || !used.has(id)) && !picked.has(id),
          );
          for (const id of ranking.slice(0, slots[code] ?? 0)) {
            out.push(id);
            picked.add(id);
          }
        }
        return out;
      };

      const direct = collect(def.slots);
      const qualifying = def.qualifyingSlots ? collect(def.qualifyingSlots) : [];

      for (const code of def.cupWinners ?? []) {
        const champion = input.cupChampions[code];
        if (champion && !picked.has(champion)) {
          direct.push(champion);
          picked.add(champion);
        }
      }

      // Solo se difiere la secundaria si la principal reparte en la previa;
      // si la repesca llega al terminar los grupos (CONMEBOL), se construye ya.
      const source = def.receivesDropsFrom ? defsById.get(def.receivesDropsFrom) : undefined;
      const deferred = Boolean(source?.qualifyingSlots);

      const targetDirect =
        def.mainSize - Math.floor(qualifying.length / 2) - (deferred ? (def.drops ?? 0) : 0);
      if (direct.length < targetDirect) {
        for (const code of countries) {
          if (direct.length >= targetDirect) break;
          const ranking = countryRanking(code, input).filter(
            (id) => (share || !used.has(id)) && !picked.has(id),
          );
          for (const id of ranking) {
            if (direct.length >= targetDirect) break;
            direct.push(id);
            picked.add(id);
          }
        }
      }
      direct.length = Math.min(direct.length, targetDirect);

      if (!share) {
        for (const id of [...direct, ...qualifying]) used.add(id);
      }

      result[def.id] = buildCompetition(def, direct, qualifying, deferred, input.season, input.teams, rng);
    }
  }

  return result;
}
