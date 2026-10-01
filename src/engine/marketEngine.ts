import { CONFIG } from '../data/config';
import { clamp, round } from '../utils/math';
import { SquadRole } from '../models';
import type { League, Player, Team, TransferOffer } from '../models';
import type { Random } from '../utils/random';
import { uid } from '../services/idService';
import { projectRole, type RoleProjection } from './roleEngine';
import { marketValue, suggestedWage } from './matchEngine';

/** Frases de presentación de una oferta. */
const PITCHES = [
  'Tendrás minutos desde el primer día.',
  'Buscamos un proyecto de futuro y cuentas con nuestra confianza.',
  'El entrenador te quiere como pieza clave de la rotación.',
  'Ven a crecer con nosotros: competimos por ascender.',
  'Aquí encontrarás escaparate para dar el salto.',
  'Apuestas fuertes por tu progresión a medio plazo.',
] as const;

/** Candidato de mercado: club + rol que tendrías allí. */
interface Candidate {
  team: Team;
  projection: RoleProjection;
}

/** Salto de nivel permitido respecto a tu media, más generoso cuanto más joven. */
function stepUpFor(player: Player): number {
  if (player.age <= 21) return CONFIG.MARKET.MAX_STEP_UP + 2;
  if (player.age <= 25) return CONFIG.MARKET.MAX_STEP_UP;
  return Math.max(2, CONFIG.MARKET.MAX_STEP_UP - 2);
}

/** Clubes en los que el futbolista jugaría (titular o rotación). */
function playableCandidates(teams: Record<string, Team>, player: Player): Candidate[] {
  const currentId = player.contract.teamId;
  const floor = Math.max(30, player.ovr - CONFIG.MARKET.FLOOR_GAP);
  const ceiling = player.ovr + stepUpFor(player);

  return Object.values(teams)
    .filter((team) => team.id !== currentId)
    .filter((team) => team.overall >= floor && team.overall <= ceiling)
    .filter((team) => team.reputation >= CONFIG.MARKET.MIN_REPUTATION)
    .map((team) => ({ team, projection: projectRole(player, team) }))
    .filter((entry) => entry.projection.role !== SquadRole.NotCalled);
}

/** Club donde competirás por el puesto aunque esté por encima de tu techo. */
function pickWildcard(teams: Record<string, Team>, player: Player, rng: Random): Candidate | null {
  const step = stepUpFor(player);
  const floor = player.ovr + step;
  const ceiling = player.ovr + step + 5;

  const list = Object.values(teams)
    .filter((team) => team.id !== player.contract.teamId)
    .filter((team) => team.overall >= floor && team.overall <= ceiling)
    .filter((team) => team.reputation >= CONFIG.MARKET.MIN_REPUTATION)
    .map((team) => ({ team, projection: projectRole(player, team) }))
    .filter((entry) => entry.projection.role === SquadRole.Bench);

  return list.length > 0 ? rng.pick(list) : null;
}

/** Clubes cuyo nivel encaja con tu media (donde jugarías), por cercanía. */
export function interestedTeams(teams: Record<string, Team>, player: Player): Team[] {
  const target = player.ovr;
  return playableCandidates(teams, player)
    .sort((a, b) => Math.abs(a.team.overall - target) - Math.abs(b.team.overall - target))
    .map((entry) => entry.team);
}

/** Construye una oferta con sus términos. */
function makeOffer(
  team: Team,
  league: League | undefined,
  player: Player,
  rng: Random,
  kind: 'transfer' | 'loan',
  projection: RoleProjection,
): TransferOffer {
  const fee = kind === 'loan' ? 0 : round(marketValue(player) * rng.float(1.05, 1.85), 2);
  const wage = Math.round(
    suggestedWage((player.ovr + team.overall) / 2) * (1 + team.reputation / 220) * rng.float(0.9, 1.25),
  );

  return {
    id: uid('offer'),
    teamId: team.id,
    teamName: team.name,
    leagueId: team.leagueId,
    leagueName: league?.name ?? 'Liga desconocida',
    tier: league?.tier ?? 1,
    continent: team.continent,
    wage: Math.max(CONFIG.MARKET.MIN_WAGE, wage),
    years: kind === 'loan' ? 1 : rng.int(2, 5),
    fee,
    pitch: rng.pick(PITCHES),
    kind,
    projectedRole: projection.role,
  };
}

/**
 * Ofertas de cesión: clubes donde serías titular y de nivel igual o inferior al
 * de tu equipo, pensadas para jugadores jóvenes o sin minutos.
 */
export function generateLoanOffers(
  teams: Record<string, Team>,
  leagues: Record<string, League>,
  player: Player,
  rng: Random,
  count: number,
): TransferOffer[] {
  if (!CONFIG.MARKET.LOAN_ENABLED || count <= 0 || player.loan) return [];

  const parent = teams[player.contract.teamId];
  const parentOverall = parent?.overall ?? player.ovr;
  const parentRole = parent ? projectRole(player, parent).role : SquadRole.NotCalled;
  const eligible = player.age <= CONFIG.MARKET.LOAN_MAX_AGE || parentRole !== SquadRole.Starter;
  if (!eligible) return [];

  const candidates = playableCandidates(teams, player)
    .filter((entry) => entry.projection.role === SquadRole.Starter)
    .filter((entry) => entry.team.overall <= parentOverall);

  const offers: TransferOffer[] = [];
  const pool = [...candidates];
  while (pool.length > 0 && offers.length < count) {
    const pick = rng.pick(pool);
    pool.splice(pool.indexOf(pick), 1);
    offers.push(makeOffer(pick.team, leagues[pick.team.leagueId], player, rng, 'loan', pick.projection));
  }

  return offers.sort((a, b) => b.wage - a.wage);
}

/** Genera las ofertas disponibles al cierre de temporada (traspasos y cesiones). */
export function generateOffers(
  teams: Record<string, Team>,
  leagues: Record<string, League>,
  player: Player,
  rng: Random,
): TransferOffer[] {
  const candidates = playableCandidates(teams, player);
  const offers: TransferOffer[] = [];

  if (candidates.length > 0) {
    const target = player.ovr + 1;
    const pool = candidates.map((candidate) => ({
      value: candidate,
      weight: 1 / (1 + Math.abs(candidate.team.overall - target) * 0.25),
    }));

    let attempts = 0;
    while (pool.length > 0 && offers.length < CONFIG.MARKET.MAX_OFFERS && attempts < 40) {
      attempts += 1;
      const pick = rng.weighted(pool);
      pool.splice(pool.findIndex((entry) => entry.value === pick), 1);

      const affinity = 1 / (1 + Math.abs(pick.team.overall - target) * 0.15);
      if (!rng.chance(clamp(CONFIG.MARKET.OFFER_CHANCE * affinity, 0.08, 0.92))) continue;

      offers.push(makeOffer(pick.team, leagues[pick.team.leagueId], player, rng, 'transfer', pick.projection));
    }
  }

  // Oferta ambiciosa poco frecuente: un club grande donde competirás por el puesto.
  if (offers.length < CONFIG.MARKET.MAX_OFFERS && rng.chance(CONFIG.MARKET.WILDCARD_CHANCE)) {
    const wildcard = pickWildcard(teams, player, rng);
    if (wildcard) {
      offers.push(
        makeOffer(wildcard.team, leagues[wildcard.team.leagueId], player, rng, 'transfer', wildcard.projection),
      );
    }
  }

  offers.push(...generateLoanOffers(teams, leagues, player, rng, CONFIG.MARKET.MAX_LOAN_OFFERS));

  return offers.sort((a, b) => b.wage - a.wage);
}

/**
 * Elige el club de debut por defecto (fallback del selector): un equipo modesto
 * de la categoría más baja, con más probabilidad de recalar en los menos fuertes.
 */
export function chooseDebutTeam(league: League, rng: Random): string {
  const weights = league.teamIds.map((teamId, index) => ({
    value: teamId,
    weight: index + 1.5,
  }));
  return rng.weighted(weights);
}

/** Valor de mercado del jugador (fachada del motor de partidos). */
export { marketValue };

/** Salario sugerido para una media global. */
export { suggestedWage };
