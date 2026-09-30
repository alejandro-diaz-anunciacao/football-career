import { CONFIG } from '../data/config';
import { clamp, round } from '../utils/math';
import type { MatchOutcome, PlayerMatchStats, Position } from '../models';
import { Position as Pos } from '../models';

/**
 * Calcula la calificación (1.0 - 10.0) ponderando las acciones del partido
 * según el rol del futbolista. Un delantero que marca sube mucho; un portero
 * que encaja goles baja más; un defensa con portería a cero recibe bonus.
 */

/** Peso de cada acción según posición. */
const POSITION_WEIGHTS: Record<Position, Partial<Record<keyof PlayerMatchStats, number>>> = {
  [Pos.Goalkeeper]: {
    saves: 1.35,
    cleanSheet: 1.25,
    goalsConceded: 1.35,
    passes: 0.35,
  },
  [Pos.Defender]: {
    tackles: 1.35,
    interceptions: 1.3,
    cleanSheet: 1.2,
    goalsConceded: 1.1,
    goals: 1.15,
    assists: 1.05,
  },
  [Pos.Midfielder]: {
    keyPasses: 1.25,
    assists: 1.2,
    goals: 1.1,
    interceptions: 1.05,
    tackles: 1.05,
    passes: 0.6,
  },
  [Pos.Forward]: {
    goals: 1.28,
    shotsOnTarget: 1.15,
    assists: 1.15,
    shots: 0.55,
  },
};

/** Peso posicional de una acción concreta. */
function weightFor(position: Position, key: keyof PlayerMatchStats): number {
  return POSITION_WEIGHTS[position][key] ?? 1;
}

/** Contribución base de una acción, antes de aplicar el peso posicional. */
function contribution(key: keyof PlayerMatchStats, value: number): number {
  const r = CONFIG.RATING;
  switch (key) {
    case 'goals':
      return value * r.GOAL;
    case 'assists':
      return value * r.ASSIST;
    case 'saves':
      return value * r.SAVE;
    case 'cleanSheet':
      return value > 0 ? r.CLEAN_SHEET : 0;
    case 'goalsConceded':
      return value * r.GOAL_CONCEDED;
    case 'tackles':
      return value * r.TACKLE;
    case 'interceptions':
      return value * r.INTERCEPTION;
    case 'keyPasses':
      return value * r.KEY_PASS;
    case 'shotsOnTarget':
      return value * r.SHOT_ON_TARGET;
    case 'yellowCards':
      return value * r.YELLOW;
    case 'redCards':
      return value * r.RED;
    case 'passes':
      return (value / 40) * 0.1;
    default:
      return 0;
  }
}

/** Acciones que puntúan en la nota final. */
const SCORING_KEYS: readonly (keyof PlayerMatchStats)[] = [
  'goals',
  'assists',
  'saves',
  'cleanSheet',
  'goalsConceded',
  'tackles',
  'interceptions',
  'keyPasses',
  'shotsOnTarget',
  'yellowCards',
  'redCards',
  'passes',
];

/**
 * Nota final del partido.
 * `outcome` modula ligeramente la nota (ganar ayuda, perder resta) y el
 * tiempo jugado escala las desviaciones respecto a la base.
 */
export function computeRating(
  position: Position,
  stats: PlayerMatchStats,
  outcome: MatchOutcome,
): number {
  if (stats.minutes <= 0) return 0;

  const r = CONFIG.RATING;
  let score = r.BASE;

  score += outcome === 'win' ? r.WIN_BONUS : outcome === 'draw' ? r.DRAW_BONUS : r.LOSS_PENALTY;

  for (const key of SCORING_KEYS) {
    const raw = stats[key];
    const value = typeof raw === 'number' ? raw : raw ? 1 : 0;
    score += contribution(key, value) * weightFor(position, key);
  }

  // Un portero que no recibe goles pero apenas interviene no debe salir premiado en exceso.
  if (position === Pos.Goalkeeper && stats.saves === 0 && !stats.cleanSheet) {
    score -= 0.25;
  }

  // Penaliza tarjetas de forma adicional cuando son rojas (expulsión temprana).
  if (stats.redCards > 0) score -= 0.4;

  // Escalado por minutos: quien juega 20' no puede desviarse tanto de la base.
  const minutesFactor = clamp(stats.minutes / 90, 0.45, 1);
  const value = r.BASE + (score - r.BASE) * minutesFactor;

  return round(clamp(value, r.MIN, r.MAX), 1);
}

/** Etiqueta cualitativa de una nota. */
export function ratingLabel(rating: number): string {
  if (rating <= 0) return 'No jugó';
  if (rating < 4.5) return 'Desastre';
  if (rating < 5.5) return 'Flojo';
  if (rating < 6.5) return 'Correcto';
  if (rating < 7.5) return 'Buen partido';
  if (rating < 8.5) return 'Muy bueno';
  if (rating < 9.5) return 'Crack';
  return 'Histórico';
}

/** Clase CSS asociada a una nota, para colorear la interfaz. */
export function ratingTone(rating: number): 'bad' | 'poor' | 'ok' | 'good' | 'great' | 'elite' {
  if (rating < 4.5) return 'bad';
  if (rating < 5.5) return 'poor';
  if (rating < 6.5) return 'ok';
  if (rating < 7.5) return 'good';
  if (rating < 9) return 'great';
  return 'elite';
}
