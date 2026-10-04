import { clamp } from '../utils/math';
import { Foot, Position } from './enums';
import type { RolePenalty } from './event';

/** Atributos técnico-físicos del jugador (1-99). */
export interface Attributes {
  /** Velocidad y aceleración. */
  pace: number;
  /** Definición y disparo. */
  shooting: number;
  /** Pase corto, largo y visión. */
  passing: number;
  /** Control, regate y conducción. */
  dribbling: number;
  /** Entrada, marcaje y colocación defensiva. */
  defending: number;
  /** Fuerza, aguante y juego aéreo. */
  physical: number;
  /** Reflejos, blocaje y juego con los pies (porteros). */
  goalkeeping: number;
}

/** Claves de atributo, útil para iteraciones tipadas. */
export const ATTRIBUTE_KEYS: readonly (keyof Attributes)[] = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'goalkeeping',
] as const;

/** Alias semántico de una clave de atributo. */
export type AttributeKey = keyof Attributes;

/** Informe de desarrollo de un futbolista (parcial o de temporada completa). */
export interface GrowthReport {
  season: number;
  /** Variación de media global en el periodo. */
  ovrDelta: number;
  /** Puntos repartidos por atributo. */
  deltas: Partial<Record<AttributeKey, number>>;
  narrative: string;
  performanceScore: number;
  focus: AttributeKey;
  /** true si es un avance dentro de la temporada, false si es el cierre de año. */
  partial: boolean;
}

/** Plan de desarrollo de la temporada en curso. */
export interface SeasonGrowth {
  /** Media global al comenzar la temporada, para medir el progreso real. */
  startOvr: number;
  /** Puntos de atributo objetivo para toda la temporada. */
  targetPoints: number;
  /** Puntos de atributo ya repartidos. */
  appliedPoints: number;
  /** Reparto acumulado por atributo durante la temporada. */
  deltas: Partial<Record<AttributeKey, number>>;
}

/** Plan de desarrollo vacío. */
export function emptySeasonGrowth(startOvr: number): SeasonGrowth {
  return { startOvr, targetPoints: 0, appliedPoints: 0, deltas: {} };
}

/** Progreso del plan de desarrollo, de 0 a 1. */
export function seasonGrowthProgress(growth: SeasonGrowth): number {
  if (growth.targetPoints <= 0) return 1;
  return Math.max(0, Math.min(1, growth.appliedPoints / growth.targetPoints));
}

/** Etiquetas legibles en castellano. */
export const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  pace: 'Ritmo',
  shooting: 'Tiro',
  passing: 'Pase',
  dribbling: 'Regate',
  defending: 'Defensa',
  physical: 'Físico',
  goalkeeping: 'Portería',
};

/** Pesos de cada atributo en la media global (OVR) según posición. */
const OVR_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  [Position.Goalkeeper]: {
    goalkeeping: 0.62,
    physical: 0.12,
    pace: 0.08,
    passing: 0.08,
    defending: 0.05,
    dribbling: 0.05,
  },
  [Position.Defender]: {
    defending: 0.42,
    physical: 0.22,
    pace: 0.15,
    passing: 0.11,
    dribbling: 0.06,
    shooting: 0.04,
  },
  [Position.Midfielder]: {
    passing: 0.3,
    dribbling: 0.18,
    defending: 0.16,
    physical: 0.12,
    pace: 0.12,
    shooting: 0.12,
  },
  [Position.Forward]: {
    shooting: 0.34,
    pace: 0.22,
    dribbling: 0.2,
    physical: 0.12,
    passing: 0.12,
  },
};

/** Calcula la media global ponderada por posición. */
export function ovrFromAttributes(position: Position, attributes: Attributes): number {
  const weights = OVR_WEIGHTS[position];
  let total = 0;
  for (const key of Object.keys(weights) as (keyof Attributes)[]) {
    total += attributes[key] * (weights[key] ?? 0);
  }
  return Math.round(clamp(total, 1, 99));
}

/** Acumuladores estadísticos de una temporada o de toda la carrera. */
export interface PlayerSeasonStats {
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  motm: number;
  ratingSum: number;
  ratingCount: number;
}

/** Crea un acumulador de estadísticas vacío. */
export function emptySeasonStats(): PlayerSeasonStats {
  return {
    appearances: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    keyPasses: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    goalsConceded: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    motm: 0,
    ratingSum: 0,
    ratingCount: 0,
  };
}

/** Suma un parcial a un acumulador. */
export function addStats(target: PlayerSeasonStats, partial: Partial<PlayerSeasonStats>): void {
  for (const key of Object.keys(partial) as (keyof PlayerSeasonStats)[]) {
    const value = partial[key];
    if (typeof value === 'number') target[key] += value;
  }
}

/** Media de calificación (0 si no hay partidos). */
export function averageRating(stats: PlayerSeasonStats): number {
  return stats.ratingCount === 0 ? 0 : stats.ratingSum / stats.ratingCount;
}

/** Contrato del jugador con un club. */
export interface Contract {
  teamId: string;
  /** Salario semanal en miles de euros. */
  wage: number;
  /** Años restantes. */
  years: number;
  /** Temporada en la que se firmó. */
  signedSeason: number;
  /** Cláusula de rescisión en millones. */
  releaseClause: number;
}

/**
 * Cesión temporal a otro club. Mientras está activa, `contract` apunta al club
 * cedente para el que juega el futbolista, y este objeto conserva el club
 * propietario y su salario para restaurarlos al terminar la temporada.
 */
export interface Loan {
  /** Club donde se juega la cesión. */
  teamId: string;
  /** Club propietario al que se regresa. */
  parentTeamId: string;
  /** Salario del contrato original, que se restaura al volver. */
  parentWage: number;
  /** Temporada en la que expira la cesión (inclusive). */
  endSeason: number;
}

/** Entidad central: el futbolista. */
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** Nombre completo ya compuesto para mostrar. */
  name: string;
  age: number;
  nationality: string;
  countryCode: string;
  position: Position;
  number: number;
  foot: Foot;
  attributes: Attributes;
  ovr: number;
  /** Potencial oculto: nunca se muestra al usuario directamente. */
  potential: number;
  /** Estado de forma: -1 (mal) a +1 (óptimo). */
  form: number;
  /** Moral: 0 a 100. */
  morale: number;
  /** Condición física: 0 a 100. */
  fitness: number;
  /** Semanas de baja por lesión (0 = disponible). */
  injuryWeeks: number;
  /** Atributo en el que el futbolista enfoca su entrenamiento. */
  trainingFocus: AttributeKey;
  /** Plan de desarrollo de la temporada en curso. */
  seasonGrowth: SeasonGrowth;
  /** Último informe de desarrollo (temporada o avance parcial). */
  lastGrowth: GrowthReport | null;
  seasonStats: PlayerSeasonStats;
  careerStats: PlayerSeasonStats;
  /** Estadísticas con la selección nacional (acumuladas de por vida). */
  nationalStats: PlayerSeasonStats;
  contract: Contract;
  /** Cesión activa, o null si el futbolista pertenece a su club actual. */
  loan: Loan | null;
  /** Penalizador temporal de minutos decidido por el cuerpo técnico. */
  rolePenalty: RolePenalty | null;
}

/** ¿Está disponible para jugar? */
export function isAvailable(player: Player): boolean {
  return player.injuryWeeks <= 0 && player.fitness > 35;
}

/** Etiqueta legible del potencial en forma de rango difuso (oculto). */
export function potentialHint(player: Player): string {
  const gap = player.potential - player.ovr;
  if (gap >= 18) return 'Promesa generacional';
  if (gap >= 12) return 'Techo muy alto';
  if (gap >= 7) return 'Margen de mejora amplio';
  if (gap >= 3) return 'Puede crecer algo más';
  return 'Cerca de su techo';
}
