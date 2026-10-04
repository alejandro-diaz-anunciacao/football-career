import { CAREER_EVENTS } from '../data/events';
import { ATTRIBUTE_LABELS, averageRating } from '../models';
import type {
  AttributeKey,
  CareerEventDef,
  CareerState,
  EventChange,
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
  /** Consecuencias concretas, listas para pintar como chips. */
  changes: EventChange[];
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

/** Registra un cambio numérico como chip (omite los que quedan a cero). */
function pushChange(changes: EventChange[], label: string, delta: number): void {
  if (delta === 0) return;
  changes.push({ label, value: `${delta > 0 ? '+' : ''}${delta}`, tone: delta > 0 ? 'up' : 'down' });
}

/** Aplica un efecto atómico al futbolista y registra su consecuencia. */
function applyEffect(
  player: Player,
  effect: EventEffect,
  rng: Random,
  changes: EventChange[],
  resolution: EventResolution,
): void {
  switch (effect.type) {
    case 'attribute': {
      const before = player.ovr;
      const deltas = applyAttributePoints(player, effect.points, rng, player.seasonStats, player.trainingFocus);
      for (const [key, value] of Object.entries(deltas) as [AttributeKey, number][]) {
        pushChange(changes, ATTRIBUTE_LABELS[key], value);
      }
      pushChange(changes, 'OVR', player.ovr - before);
      break;
    }
    case 'stat': {
      if (effect.stat === 'morale') {
        const before = player.morale;
        player.morale = clamp(player.morale + effect.delta, 0, 100);
        pushChange(changes, 'Moral', player.morale - before);
      } else if (effect.stat === 'fitness') {
        const before = player.fitness;
        player.fitness = clamp(player.fitness + effect.delta, 0, 100);
        pushChange(changes, 'Condición', player.fitness - before);
      } else {
        // La forma interna va de -1 a 1: se muestra cualitativa.
        const before = player.form;
        player.form = clamp(player.form + effect.delta, -1, 1);
        const delta = player.form - before;
        if (Math.abs(delta) >= 0.005) {
          changes.push({ label: 'Forma', value: delta > 0 ? '↑' : '↓', tone: delta > 0 ? 'up' : 'down' });
        }
      }
      break;
    }
    case 'injury': {
      const weeks = rng.int(effect.minWeeks, effect.maxWeeks);
      player.injuryWeeks = Math.max(player.injuryWeeks, weeks);
      changes.push({ label: 'Lesión', value: `${player.injuryWeeks} sem.`, tone: 'down' });
      break;
    }
    case 'rolePenalty': {
      player.rolePenalty = { matches: effect.matches, ovr: effect.ovr };
      changes.push({ label: 'Menos minutos', value: `${effect.matches} jornadas`, tone: 'down' });
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

  const resolution: EventResolution = { narrative: outcome.narrative, changes: [], loanOffers: 0, transferOffers: false };
  for (const effect of outcome.effects) {
    applyEffect(ctx.player, effect, rng, resolution.changes, resolution);
  }
  return resolution;
}
