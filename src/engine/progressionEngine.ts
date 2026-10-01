import { CONFIG, ageGrowthFactor } from '../data/config';
import { clamp, round } from '../utils/math';
import {
  ATTRIBUTE_KEYS,
  Position,
  averageRating,
  emptySeasonGrowth,
  ovrFromAttributes,
} from '../models';
import type {
  AttributeKey,
  Attributes,
  GrowthReport,
  Player,
  PlayerSeasonStats,
  SeasonGrowth,
} from '../models';
import type { Random } from '../utils/random';

/**
 * Motor de desarrollo del futbolista.
 *
 * El crecimiento de una temporada se planifica como un objetivo de puntos de
 * atributo (`targetPoints`) que se reparte de dos formas:
 *
 *  1. **Avances parciales** cada pocas jornadas (`applyDevelopmentTick`), para
 *     que el jugador note la evolución durante el curso.
 *  2. **Cierre de temporada** (`applySeasonGrowth`), que recalcula el objetivo
 *     con el rendimiento real y reparte lo que falte.
 *
 * El reparto no es uniforme: cada atributo pesa según la posición, el foco de
 * entrenamiento elegido por el usuario y las acciones que realmente realiza en
 * el campo (goles → tiro, asistencias → pase, robos → defensa, atajadas →
 * portería).
 */

/** Peso base de cada atributo en el desarrollo, según la posición. */
const DEVELOPMENT_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  [Position.Goalkeeper]: { goalkeeping: 5, physical: 2, pace: 1, passing: 1, defending: 0.5 },
  [Position.Defender]: { defending: 5, physical: 3, pace: 2, passing: 1.5, dribbling: 0.5 },
  [Position.Midfielder]: { passing: 4, dribbling: 3, defending: 2, physical: 2, pace: 2, shooting: 1.5 },
  [Position.Forward]: { shooting: 5, pace: 3, dribbling: 3, physical: 1.5, passing: 1.5, defending: 0.4 },
};

/** Foco de entrenamiento recomendado por defecto para cada posición. */
export const DEFAULT_FOCUS: Record<Position, AttributeKey> = {
  [Position.Goalkeeper]: 'goalkeeping',
  [Position.Defender]: 'defending',
  [Position.Midfielder]: 'passing',
  [Position.Forward]: 'shooting',
};

/** Atributos que un futbolista puede trabajar según su posición. */
export function developmentFocusOptions(position: Position): AttributeKey[] {
  const weights = DEVELOPMENT_WEIGHTS[position];
  return [...ATTRIBUTE_KEYS]
    .filter((key) => (weights[key] ?? 0) > 0)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
}

/** Puntuación de rendimiento de la temporada (0-100). */
export function performanceScore(stats: PlayerSeasonStats): number {
  const avg = averageRating(stats);
  const minutesFactor = clamp(stats.minutes / (CONFIG.PROGRESSION.FULL_SEASON_APPS * 75), 0, 1.1);
  const goalContribution =
    stats.goals * 3 + stats.assists * 2 + stats.cleanSheets * 1.5 + stats.saves * 0.15 + stats.motm * 2;
  const base = (avg - 5.2) * 16 + goalContribution;
  return clamp(round(base * (0.45 + minutesFactor * 0.75)), 0, 100);
}

/** Peso de cada atributo teniendo en cuenta posición, foco y acciones reales. */
function developmentWeights(
  player: Player,
  stats: PlayerSeasonStats,
  focus: AttributeKey,
): { value: AttributeKey; weight: number }[] {
  const base = DEVELOPMENT_WEIGHTS[player.position];
  const activity: Partial<Record<AttributeKey, number>> = {
    shooting: stats.goals * 2.0 + stats.shotsOnTarget * 0.25 + stats.shots * 0.08,
    passing: stats.assists * 2.0 + stats.keyPasses * 0.25 + stats.passes * 0.004,
    defending: stats.tackles * 0.5 + stats.interceptions * 0.5,
    goalkeeping: stats.saves * 0.35 + stats.cleanSheets * 1.2,
    pace: stats.minutes * 0.004,
    physical: stats.minutes * 0.003,
    dribbling: stats.goals * 0.5 + stats.assists * 0.5,
  };

  return ATTRIBUTE_KEYS.map((key) => {
    const weight = (base[key] ?? 0.2) + (activity[key] ?? 0);
    return {
      value: key,
      weight: key === focus ? weight * CONFIG.PROGRESSION.FOCUS_MULTIPLIER : weight,
    };
  });
}

/**
 * Recorta atributos si la media global superó el potencial oculto.
 * El potencial es un techo duro: al alcanzarlo el jugador deja de crecer.
 */
function enforcePotentialCeiling(player: Player, rng: Random): void {
  let guard = 0;
  while (player.ovr > player.potential && guard < 150) {
    guard += 1;
    const weights = DEVELOPMENT_WEIGHTS[player.position];
    const candidates = ATTRIBUTE_KEYS.filter(
      (key) => player.attributes[key] > CONFIG.ATTR_MIN && (weights[key] ?? 0) > 0,
    ).map((key) => ({ value: key, weight: weights[key] ?? 0.2 }));
    if (candidates.length === 0) break;
    const key = rng.weighted(candidates);
    player.attributes[key] = clamp(player.attributes[key] - 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
    player.ovr = ovrFromAttributes(player.position, player.attributes);
  }
}

/**
 * Reparte puntos de atributo (positivos o negativos) y devuelve el detalle.
 * La media global se recalcula siempre desde los atributos, de modo que nunca
 * se desincroniza.
 */
export function applyAttributePoints(
  player: Player,
  points: number,
  rng: Random,
  stats: PlayerSeasonStats,
  focus: AttributeKey,
): Partial<Record<AttributeKey, number>> {
  const deltas: Partial<Record<AttributeKey, number>> = {};
  if (points === 0) return deltas;

  const direction = points > 0 ? 1 : -1;
  const magnitude = Math.abs(points);
  const weights = developmentWeights(player, stats, focus);

  for (let i = 0; i < magnitude; i += 1) {
    const candidates =
      direction > 0
        ? weights.filter((entry) => player.attributes[entry.value] < CONFIG.ATTR_MAX)
        : weights;
    if (candidates.length === 0) break;

    const key = rng.weighted(candidates);

    if (direction > 0) {
      player.attributes[key] = clamp(player.attributes[key] + 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
      deltas[key] = (deltas[key] ?? 0) + 1;
    } else {
      // El declive castiga antes el físico que la técnica.
      const declineWeight = key === 'pace' || key === 'physical' ? 2 : 1;
      if (rng.chance(0.5 * declineWeight) && player.attributes[key] > CONFIG.ATTR_MIN) {
        player.attributes[key] = clamp(player.attributes[key] - 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
        deltas[key] = (deltas[key] ?? 0) - 1;
      }
    }
  }

  // La media se recalcula antes de validar el techo del potencial.
  player.ovr = ovrFromAttributes(player.position, player.attributes);
  if (direction > 0) enforcePotentialCeiling(player, rng);
  return deltas;
}

/** Objetivo nominal de puntos de atributo para una temporada completa. */
export function planSeasonGrowth(player: Player, rng: Random): SeasonGrowth {
  const p = CONFIG.PROGRESSION;
  const ageFactor = ageGrowthFactor(player.age);
  const room = clamp((player.potential - player.ovr) / 16, 0, 1.5);

  // Se planifica con un rendimiento neutro: el cierre de temporada lo ajustará.
  let ovrTarget = p.BASE_GROWTH * ageFactor * (0.35 + room * 0.7) * 1.1;
  ovrTarget += rng.gauss(0, 0.35);
  ovrTarget = clamp(ovrTarget, -p.MAX_DECLINE, p.MAX_GROWTH);

  return {
    startOvr: player.ovr,
    targetPoints: Math.round(ovrTarget * p.ATTRIBUTE_POINTS_PER_OVR),
    appliedPoints: 0,
    deltas: {},
  };
}

/** Texto explicativo de un tramo de desarrollo. */
function growthNarrative(delta: number, avg: number, age: number, partial: boolean): string {
  if (partial) {
    if (delta >= 1) return `Progreso visible: +${round(delta, 1)} en la media global.`;
    if (delta > 0) return 'Mejora continua en los entrenamientos.';
    if (delta === 0) return 'Atributos afinados: la media global todavía no se mueve.';
    return 'Rendimiento por debajo de lo esperado: pierde fuelle.';
  }
  if (delta >= 4) return `Explosión: temporadón con ${avg.toFixed(2)} de media a los ${age} años.`;
  if (delta >= 2) return `Progresión sólida gracias a su regularidad (${avg.toFixed(2)}).`;
  if (delta > 0.5) return 'Mejora discreta pero constante.';
  if (delta >= -0.2) return 'Temporada de estancamiento.';
  if (delta >= -1.5) return 'Ligero retroceso físico.';
  return 'Declive propio de la edad.';
}

/**
 * Avance parcial dentro de la temporada. Reparte una fracción del objetivo
 * modulada por el rendimiento acumulado. Devuelve `null` si no procede.
 */
export function applyDevelopmentTick(
  player: Player,
  stats: PlayerSeasonStats,
  season: number,
  rng: Random,
): GrowthReport | null {
  const p = CONFIG.PROGRESSION;
  const growth = player.seasonGrowth;
  const remaining = growth.targetPoints - growth.appliedPoints;

  if (remaining === 0) return null;
  if (remaining > 0 && player.ovr >= player.potential) return null;

  let chunk = Math.round(remaining * p.DEVELOPMENT_CHUNK);
  if (Math.abs(chunk) < 1) chunk = remaining > 0 ? 1 : -1;
  if (Math.abs(chunk) > Math.abs(remaining)) chunk = remaining;

  const avg = averageRating(stats);
  const performance = clamp(1 + (avg - p.NEUTRAL_RATING) * p.DEVELOPMENT_PERFORMANCE, 0.55, 1.45);
  let points = Math.round(chunk * performance);

  // Sin minutos el avance existe, pero es pequeño e intermitente: quien entrena
  // progresa despacio y puede acabar ganándose oportunidades.
  if (stats.appearances === 0) {
    points = Math.round(points * p.TRAINING_ONLY_FACTOR);
    if (points === 0 && rng.chance(p.TRAINING_ONLY_FACTOR)) points = remaining > 0 ? 1 : -1;
  }

  if (points === 0) return null;

  const before = player.ovr;
  const deltas = applyAttributePoints(player, points, rng, stats, player.trainingFocus);

  for (const [key, value] of Object.entries(deltas) as [AttributeKey, number][]) {
    growth.deltas[key] = (growth.deltas[key] ?? 0) + value;
  }
  growth.appliedPoints += points;

  const ovrDelta = player.ovr - before;
  const report: GrowthReport = {
    season,
    ovrDelta: round(ovrDelta, 1),
    deltas,
    narrative: growthNarrative(ovrDelta, avg, player.age, true),
    performanceScore: performanceScore(stats),
    focus: player.trainingFocus,
    partial: true,
  };
  player.lastGrowth = report;
  return report;
}

/**
 * Cierre de temporada: recalcula el objetivo con el rendimiento real, liquida
 * la diferencia respecto a los avances parciales y devuelve el informe anual.
 */
export function applySeasonGrowth(
  player: Player,
  stats: PlayerSeasonStats,
  season: number,
  rng: Random,
): GrowthReport {
  const p = CONFIG.PROGRESSION;
  const avg = averageRating(stats);
  const ageFactor = ageGrowthFactor(player.age);
  const activity = clamp(stats.appearances / p.FULL_SEASON_APPS, 1 - p.INACTIVITY_PENALTY, 1.15);
  const room = clamp((player.potential - player.ovr) / 16, 0, 1.5);
  const performance = clamp(1 + (avg - p.NEUTRAL_RATING) * p.RATING_SENSITIVITY, 0.35, 1.95);
  const score = performanceScore(stats);

  let ovrTarget = p.BASE_GROWTH * ageFactor * performance * activity * (0.35 + room * 0.7);
  if (ageFactor < 0 && avg >= 7.2) ovrTarget *= 0.4;
  if (stats.appearances === 0) ovrTarget -= 0.8;

  // Temporada de explosión: un joven con rendimiento sobresaliente acelera.
  if (score >= p.BREAKOUT_SCORE && player.age <= p.BREAKOUT_MAX_AGE) {
    ovrTarget *= 1 + p.BREAKOUT_BONUS;
  }

  ovrTarget = clamp(ovrTarget, -p.MAX_DECLINE, p.MAX_GROWTH);

  let remaining = Math.round(ovrTarget * p.ATTRIBUTE_POINTS_PER_OVR) - player.seasonGrowth.appliedPoints;
  if (remaining > 0 && player.ovr >= player.potential) remaining = 0;

  const deltas = applyAttributePoints(player, remaining, rng, stats, player.trainingFocus);

  // Informe anual: acumula lo repartido durante el curso más el cierre.
  const accumulated: Partial<Record<AttributeKey, number>> = { ...player.seasonGrowth.deltas };
  for (const [key, value] of Object.entries(deltas) as [AttributeKey, number][]) {
    accumulated[key] = (accumulated[key] ?? 0) + value;
  }

  // El punto de partida puede faltar en partidas antiguas: se usa el actual.
  const startOvr = player.seasonGrowth.startOvr > 0 ? player.seasonGrowth.startOvr : player.ovr;
  const ovrDelta = player.ovr - startOvr;
  const report: GrowthReport = {
    season,
    ovrDelta: round(ovrDelta, 1),
    deltas: accumulated,
    narrative: growthNarrative(ovrDelta, avg, player.age, false),
    performanceScore: score,
    focus: player.trainingFocus,
    partial: false,
  };
  player.lastGrowth = report;
  player.seasonGrowth = emptySeasonGrowth(player.ovr);
  return report;
}

/** Cumple un año y ajusta la curva física natural. */
export function agePlayer(player: Player, rng: Random): void {
  player.age += 1;
  const attributes: Attributes = { ...player.attributes };
  if (player.age >= 30) {
    const decline = 1 + Math.floor((player.age - 30) / 2);
    for (let i = 0; i < decline; i += 1) {
      const key: AttributeKey = rng.chance(0.5) ? 'pace' : 'physical';
      attributes[key] = clamp(attributes[key] - 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
    }
  } else if (player.age <= 20) {
    // El físico acompaña al desarrollo juvenil.
    if (rng.chance(0.6)) attributes.physical = clamp(attributes.physical + 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
    if (rng.chance(0.4)) attributes.pace = clamp(attributes.pace + 1, CONFIG.ATTR_MIN, CONFIG.ATTR_MAX);
  }
  player.attributes = attributes;
  player.ovr = ovrFromAttributes(player.position, attributes);
}

/** Recuperación semanal de condición física y moral. */
export function recoverWeekly(player: Player, played: boolean, won: boolean): void {
  const recovery = played ? 6 : 14;
  player.fitness = clamp(player.fitness + recovery, 0, 100);
  if (played) {
    player.fitness = clamp(player.fitness - 8, 0, 100);
  }
  player.morale = clamp(player.morale + (played ? (won ? 3 : -1) : -2), 0, 100);
  player.injuryWeeks = Math.max(0, player.injuryWeeks - 1);
}

/** Actualiza el estado de forma tras una actuación. */
export function updateForm(player: Player, rating: number | null, played: boolean): void {
  if (!played || rating === null) {
    player.form = clamp(player.form * 0.85, -1, 1);
    return;
  }
  const target = clamp((rating - 6.4) / 2.2, -1, 1);
  player.form = clamp(player.form * 0.55 + target * 0.45, -1, 1);
}

/** Convierte las estadísticas de la temporada en las de carrera. */
export function mergeSeasonIntoCareer(player: Player): void {
  const season = player.seasonStats;
  const career = player.careerStats;
  for (const key of Object.keys(career) as (keyof PlayerSeasonStats)[]) {
    career[key] += season[key];
  }
}
