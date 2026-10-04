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
  filialOf?: string,
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
    pitch: filialOf
      ? `Te formarás en el filial de ${filialOf} con opciones reales de dar el salto al primer equipo.`
      : rng.pick(PITCHES),
    kind,
    projectedRole: projection.role,
    filialOf,
  };
}

/** Nombre del primer equipo si el club es un filial. */
function parentNameOf(teams: Record<string, Team>, team: Team): string | undefined {
  return team.parentTeamId ? teams[team.parentTeamId]?.name : undefined;
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
    offers.push(
      makeOffer(pick.team, leagues[pick.team.leagueId], player, rng, 'loan', pick.projection, parentNameOf(teams, pick.team)),
    );
  }

  return offers.sort((a, b) => b.wage - a.wage);
}

/**
 * Cuántas ofertas habrá en una ventana (0-`MAX_OFFERS`). Depende del
 * rendimiento, de lo que destaca el jugador para su edad y de la suerte, así
 * que hay temporadas con muchas, pocas o ninguna.
 */
function desiredOffers(player: Player, performance: number, rng: Random): number {
  const m = CONFIG.MARKET;
  const perf = clamp(performance / 100, 0, 1);
  const ovrEdge = clamp((player.ovr - 45) / 30, 0, 1);
  const appetite = perf * 0.55 + ovrEdge * 0.35 + rng.next() * 0.45;
  return clamp(Math.round(appetite * m.MAX_OFFERS), 0, m.MAX_OFFERS);
}

/**
 * Genera las ofertas de una ventana de fichajes. `performance` (0-100) modula
 * cuántas llegan; con buen rendimiento siempre hay al menos una.
 */
export function generateOffers(
  teams: Record<string, Team>,
  leagues: Record<string, League>,
  player: Player,
  rng: Random,
  performance = 0,
): TransferOffer[] {
  const offers: TransferOffer[] = [];

  let target = desiredOffers(player, performance, rng);
  if (performance >= CONFIG.MARKET.GOOD_PERFORMANCE && target === 0) target = 1;

  if (target > 0) {
    const candidates = playableCandidates(teams, player);
    const reference = player.ovr + 1;
    const pool = candidates.map((candidate) => ({
      value: candidate,
      weight: 1 / (1 + Math.abs(candidate.team.overall - reference) * 0.25),
    }));

    while (pool.length > 0 && offers.length < target) {
      const pick = rng.weighted(pool);
      const index = pool.findIndex((entry) => entry.value === pick);
      if (index >= 0) pool.splice(index, 1);
      offers.push(
        makeOffer(pick.team, leagues[pick.team.leagueId], player, rng, 'transfer', pick.projection, parentNameOf(teams, pick.team)),
      );
    }

    // Oferta ambiciosa poco frecuente: un club grande donde competirás por el puesto.
    if (offers.length < target && rng.chance(CONFIG.MARKET.WILDCARD_CHANCE)) {
      const wildcard = pickWildcard(teams, player, rng);
      if (wildcard) {
        offers.push(
          makeOffer(
            wildcard.team,
            leagues[wildcard.team.leagueId],
            player,
            rng,
            'transfer',
            wildcard.projection,
            parentNameOf(teams, wildcard.team),
          ),
        );
      }
    }

    // Cesiones para completar la ventana (jugadores con pocos minutos).
    const remaining = Math.max(0, target - offers.length);
    if (remaining > 0) {
      offers.push(
        ...generateLoanOffers(teams, leagues, player, rng, Math.min(remaining, CONFIG.MARKET.MAX_LOAN_OFFERS)),
      );
    }
  }

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
