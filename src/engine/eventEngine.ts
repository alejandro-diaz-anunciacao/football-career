import { CAREER_EVENTS } from '../data/events';
import { ATTRIBUTE_LABELS, averageRating } from '../models';
import type {
  AttributeKey,
  CareerEventDef,
  CareerState,
  EventContext,
  EventEffect,
  PendingEvent,
  Player,
  SquadRole,
} from '../models';
import { clamp } from '../utils/math';
import type { Random } from '../utils/random';
import { applyAttributePoints } from './progressionEngine';

/**
 * Motor de eventos aleatorios de carrera.
 *
 * Selecciona un evento elegible con el RNG inyectado, lo empaqueta como
 * `PendingEvent` para que la UI lo muestre y aplica los efectos de la decisión.
 * Los efectos de mercado (ofertas) se devuelven al servicio, que es quien
 * conoce las ligas y los equipos.
 */

/** Resultado de resolver la decisión de un evento. */
export interface EventResolution {
  narrative: string;
  /** Ofertas de cesión que debe generar el servicio. */
  loanOffers: number;
  /** El servicio debe generar ofertas de traspaso. */
  transferOffers: boolean;
}

/** Construye la vista de solo lectura que consumen las definiciones. */
export function buildEventContext(state: CareerState, role: SquadRole): EventContext | null {
  const team = state.teams[state.teamId];
  if (!team) return null;
  const player = state.player;
  return {
    player,
    team,
    league: state.leagues[team.leagueId] ?? null,
    season: state.season,
    round: state.currentRound,
    role,
    lastRating: state.lastMatch?.userRating ?? null,
    seasonRating: averageRating(player.seasonStats),
    recentOutcomes: state.recentResults.slice(0, 3).map((result) => result.userOutcome),
  };
}

/** Elige un evento elegible de forma ponderada, o null si no hay ninguno. */
export function pickEvent(ctx: EventContext, state: CareerState, rng: Random): CareerEventDef | null {
  const eligible = CAREER_EVENTS.filter((def) => {
    if (def.minRound != null && ctx.round < def.minRound) return false;
    const lastSeason = state.eventHistory[def.id];
    if (lastSeason != null && def.cooldownSeasons != null && ctx.season - lastSeason < def.cooldownSeasons) {
      return false;
    }
    try {
      return def.when(ctx);
    } catch {
      return false;
    }
  });

  if (eligible.length === 0) return null;
  return rng.weighted(eligible.map((def) => ({ value: def, weight: def.weight })));
}

/** Empaqueta un evento para que la UI lo muestre como decisión pendiente. */
export function createPendingEvent(def: CareerEventDef, ctx: EventContext): PendingEvent {
  return {
    id: def.id,
    season: ctx.season,
    round: ctx.round,
    icon: def.icon,
    title: def.title(ctx),
    body: def.body(ctx),
    choices: def.choices.map((choice) => ({ id: choice.id, label: choice.label, hint: choice.hint })),
  };
}

/** Aplica un efecto atómico al futbolista. */
function applyEffect(
  player: Player,
  effect: EventEffect,
  rng: Random,
  extra: string[],
  resolution: EventResolution,
): void {
  switch (effect.type) {
    case 'attribute': {
      const before = player.ovr;
      const deltas = applyAttributePoints(player, effect.points, rng, player.seasonStats, player.trainingFocus);
      const parts = (Object.entries(deltas) as [AttributeKey, number][])
        .filter(([, value]) => value !== 0)
        .map(([key, value]) => `${ATTRIBUTE_LABELS[key]} ${value > 0 ? '+' : ''}${value}`);
      if (parts.length > 0) extra.push(parts.join(', '));
      const ovrDelta = player.ovr - before;
      if (ovrDelta !== 0) extra.push(`OVR ${ovrDelta > 0 ? '+' : ''}${ovrDelta}`);
      break;
    }
    case 'stat': {
      if (effect.stat === 'morale') player.morale = clamp(player.morale + effect.delta, 0, 100);
      else if (effect.stat === 'form') player.form = clamp(player.form + effect.delta, -1, 1);
      else player.fitness = clamp(player.fitness + effect.delta, 0, 100);
      break;
    }
    case 'injury': {
      const weeks = rng.int(effect.minWeeks, effect.maxWeeks);
      player.injuryWeeks = Math.max(player.injuryWeeks, weeks);
      extra.push(`${weeks} semana(s) de baja`);
      break;
    }
    case 'rolePenalty': {
      player.rolePenalty = { matches: effect.matches, ovr: effect.ovr };
      extra.push(`menos minutos durante ${effect.matches} jornadas`);
      break;
    }
    case 'loanOffers':
      resolution.loanOffers += effect.count;
      break;
    case 'transferOffers':
      resolution.transferOffers = true;
      break;
  }
}

/**
 * Resuelve la opción elegida: sortea la rama arriesgada si toca y aplica los
 * efectos al futbolista. Devuelve null si la opción no existe.
 */
export function resolveEvent(
  def: CareerEventDef,
  choiceId: string,
  ctx: EventContext,
  rng: Random,
): EventResolution | null {
  const choice = def.choices.find((item) => item.id === choiceId);
  if (!choice) return null;

  let outcome = choice.outcome ?? null;
  if (choice.risk) {
    const chance = typeof choice.risk.chance === 'function' ? choice.risk.chance(ctx) : choice.risk.chance;
    outcome = rng.chance(chance) ? choice.risk.success : choice.risk.failure;
  }
  if (!outcome) return null;

  const resolution: EventResolution = { narrative: outcome.narrative, loanOffers: 0, transferOffers: false };
  const extra: string[] = [];
  for (const effect of outcome.effects) {
    applyEffect(ctx.player, effect, rng, extra, resolution);
  }
  if (extra.length > 0) resolution.narrative += ` (${extra.join(', ')}).`;
  return resolution;
}
