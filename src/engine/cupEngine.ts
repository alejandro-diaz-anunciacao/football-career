import type { CupDef } from '../data/cups';
import type { Competition, Fixture, KnockoutTie, Team } from '../models';
import type { Random } from '../utils/random';
import { simulateQuickMatch } from './matchEngine';

/**
 * Motor de copas: construye el cuadro (con ronda preliminar o exentos),
 * simula las piernas de cada ronda y resuelve las eliminatorias por agregado
 * (con desempate por penaltis).
 */

/** Piernas que se juegan en una ronda concreta (la final siempre a un partido). */
export function cupRoundLegs(competition: Competition, round: number): 1 | 2 {
  if (round >= competition.totalRounds) return 1;
  if (competition.twoLeggedRounds > 0 && round >= competition.totalRounds - competition.twoLeggedRounds) {
    return 2;
  }
  return 1;
}

/** Eliminatorias de una ronda. */
export function tiesOfRound(competition: Competition, round: number): KnockoutTie[] {
  return competition.ties.filter((tie) => tie.round === round);
}

/** Crea una pierna. */
function makeLeg(round: number, homeId: string, awayId: string, neutral: boolean): Fixture {
  return neutral
    ? { round, homeId, awayId, played: false, homeGoals: null, awayGoals: null, neutral: true }
    : { round, homeId, awayId, played: false, homeGoals: null, awayGoals: null };
}

/** Empareja a los participantes de una ronda. El equipo más débil actúa de local. */
function buildRound(
  competition: Competition,
  participants: string[],
  round: number,
  teams: Record<string, Team>,
  rng: Random,
): void {
  const pool = rng.shuffle(participants);
  const twoLegs = cupRoundLegs(competition, round) === 2;
  const neutral = round >= competition.totalRounds;

  for (let i = 0; i + 1 < pool.length; i += 2) {
    const first = pool[i];
    const second = pool[i + 1];
    const weaker = (teams[first]?.overall ?? 0) <= (teams[second]?.overall ?? 0) ? first : second;
    const stronger = weaker === first ? second : first;

    const legs = twoLegs
      ? [makeLeg(round, weaker, stronger, false), makeLeg(round, stronger, weaker, false)]
      : [makeLeg(round, weaker, stronger, neutral)];

    competition.ties.push({
      id: `tie.${competition.id}.${round}.${i / 2}`,
      round,
      homeId: weaker,
      awayId: stronger,
      legs,
      winnerId: null,
    });
  }
}

/** Nº total de rondas del cuadro. */
function countRounds(roundOneSize: number, byes: number): number {
  let rounds = 1;
  let next = byes + roundOneSize / 2;
  while (next > 1) {
    rounds += 1;
    next /= 2;
  }
  return rounds;
}

/** Construye la copa de un país para una temporada. */
export function buildCup(
  def: CupDef,
  teams: Record<string, Team>,
  season: number,
  rng: Random,
): Competition {
  const ranked = Object.values(teams)
    .filter((team) => team.countryCode === def.countryCode)
    .sort((a, b) => b.overall - a.overall)
    .map((team) => team.id);

  const total = ranked.length;
  let roundOne: string[];
  let pendingByes: string[];

  if (def.byes > 0) {
    pendingByes = ranked.slice(0, def.byes);
    roundOne = ranked.slice(def.byes);
  } else {
    const power = 1 << Math.floor(Math.log2(Math.max(2, total)));
    const excess = total - power;
    if (excess <= 0) {
      pendingByes = [];
      roundOne = ranked;
    } else {
      const playing = 2 * excess;
      pendingByes = ranked.slice(0, total - playing);
      roundOne = ranked.slice(total - playing);
    }
  }

  const competition: Competition = {
    id: def.id,
    name: def.name,
    season,
    kind: 'cup',
    countryCode: def.countryCode,
    teamIds: ranked,
    round: 1,
    leg: 1,
    totalRounds: countRounds(roundOne.length, pendingByes.length),
    ties: [],
    championId: null,
    pendingByes,
    twoLeggedRounds: def.twoLeggedRounds,
  };

  buildRound(competition, roundOne, 1, teams, rng);
  return competition;
}

/** Pierna del equipo en la ronda y pierna en curso, si sigue vivo. */
export function cupLegForTeam(competition: Competition, teamId: string): Fixture | null {
  if (competition.championId) return null;
  const tie = tiesOfRound(competition, competition.round).find(
    (item) => item.homeId === teamId || item.awayId === teamId,
  );
  if (!tie) return null;
  const leg = tie.legs[competition.leg - 1];
  return leg && !leg.played ? leg : null;
}

/** Vencedor de una eliminatoria (agregado y, si empata, penaltis). */
function resolveTie(tie: KnockoutTie, rng: Random): string {
  const [first, second] = tie.legs;
  const homeGoals = first.homeGoals ?? 0;
  const awayGoals = first.awayGoals ?? 0;

  if (tie.legs.length === 1) {
    if (homeGoals > awayGoals) return first.homeId;
    if (awayGoals > homeGoals) return first.awayId;
    return rng.chance(0.5) ? first.homeId : first.awayId;
  }

  const tieHomeGoals = homeGoals + (second.awayGoals ?? 0);
  const tieAwayGoals = awayGoals + (second.homeGoals ?? 0);
  if (tieHomeGoals > tieAwayGoals) return tie.homeId;
  if (tieAwayGoals > tieHomeGoals) return tie.awayId;
  return rng.chance(0.5) ? tie.homeId : tie.awayId;
}

/**
 * Juega la pierna en curso de la ronda actual (los partidos sin jugar) y, si
 * la ronda termina, resuelve las eliminatorias y construye la siguiente.
 */
export function simulateCupTick(competition: Competition, teams: Record<string, Team>, rng: Random): void {
  if (competition.championId) return;

  const round = competition.round;
  const ties = tiesOfRound(competition, round);

  for (const tie of ties) {
    const leg = tie.legs[competition.leg - 1];
    if (!leg || leg.played) continue;
    const home = teams[leg.homeId];
    const away = teams[leg.awayId];
    if (!home || !away) {
      leg.played = true;
      leg.homeGoals = 0;
      leg.awayGoals = 0;
      continue;
    }
    const { homeGoals, awayGoals } = simulateQuickMatch(home, away, rng, Boolean(leg.neutral));
    leg.played = true;
    leg.homeGoals = homeGoals;
    leg.awayGoals = awayGoals;
  }

  if (competition.leg < cupRoundLegs(competition, round)) {
    competition.leg += 1;
    return;
  }

  for (const tie of ties) tie.winnerId = resolveTie(tie, rng);

  if (round >= competition.totalRounds) {
    competition.championId = ties[0]?.winnerId ?? null;
    return;
  }

  const winners = ties.map((tie) => tie.winnerId).filter((id): id is string => Boolean(id));
  const participants = round === 1 && competition.pendingByes.length > 0
    ? [...winners, ...competition.pendingByes]
    : winners;

  competition.round = round + 1;
  competition.leg = 1;
  competition.pendingByes = [];
  buildRound(competition, participants, competition.round, teams, rng);
}

/** Construye todas las copas de una temporada. */
export function buildCups(
  defs: readonly CupDef[],
  teams: Record<string, Team>,
  season: number,
  rng: Random,
): Record<string, Competition> {
  const competitions: Record<string, Competition> = {};
  for (const def of defs) {
    competitions[def.id] = buildCup(def, teams, season, rng);
  }
  return competitions;
}
