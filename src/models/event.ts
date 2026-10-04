import type { MatchOutcome, SquadRole } from './enums';
import type { League } from './league';
import type { Player } from './player';
import type { Team } from './team';

/**
 * Eventos aleatorios de carrera.
 *
 * Un evento es una situación con narrativa que aparece de vez en cuando y que
 * puede resolverse de forma pasiva (con una tirada de azar) o mediante una
 * decisión del jugador. Los efectos son declarativos para que el motor de
 * eventos los aplique de forma determinista con el `Random` inyectado.
 */

/** Estadísticas vitales que puede modificar un evento. */
export type EventStat = 'morale' | 'form' | 'fitness';

/** Efecto atómico que aplica un evento al futbolista. */
export type EventEffect =
  | { type: 'attribute'; points: number }
  | { type: 'stat'; stat: EventStat; delta: number }
  | { type: 'injury'; minWeeks: number; maxWeeks: number }
  | { type: 'rolePenalty'; matches: number; ovr: number }
  | { type: 'loanOffers'; count: number }
  | { type: 'transferOffers' };

/** Resultado narrativo de una rama de un evento. */
export interface EventOutcome {
  effects: EventEffect[];
  narrative: string;
}

/** Rama arriesgada: el resultado depende de una probabilidad. */
export interface EventRisk {
  /** Probabilidad de éxito (0-1), puede depender del contexto. */
  chance: number | ((ctx: EventContext) => number);
  success: EventOutcome;
  failure: EventOutcome;
}

/** Opción que el jugador puede elegir al resolver un evento. */
export interface CareerEventChoice {
  id: string;
  label: string;
  hint?: string;
  /** Resultado fijo. */
  outcome?: EventOutcome;
  /** Resultado probabilístico (alternativo a `outcome`). */
  risk?: EventRisk;
}

/** Vista de solo lectura del estado que necesitan las definiciones de evento. */
export interface EventContext {
  player: Player;
  team: Team;
  league: League | null;
  season: number;
  round: number;
  role: SquadRole;
  /** Calificación del último partido, o null si no jugó. */
  lastRating: number | null;
  /** Nota media de la temporada (0 si no hay datos). */
  seasonRating: number;
  /** Resultado de los últimos partidos (los más recientes primero). */
  recentOutcomes: MatchOutcome[];
}

/** Definición completa de un evento aleatorio. */
export interface CareerEventDef {
  id: string;
  /** Emoji que acompaña al título. */
  icon: string;
  /** Peso relativo en el sorteo. */
  weight: number;
  /** Jornada mínima de la temporada para que pueda aparecer. */
  minRound?: number;
  /** Temporadas que deben pasar antes de repetirlo. */
  cooldownSeasons?: number;
  /** Condición de elegibilidad. */
  when: (ctx: EventContext) => boolean;
  title: (ctx: EventContext) => string;
  body: (ctx: EventContext) => string;
  choices: CareerEventChoice[];
}

/** Evento pendiente de decisión, tal y como se serializa en el guardado. */
export interface PendingEvent {
  id: string;
  season: number;
  round: number;
  icon: string;
  title: string;
  body: string;
  choices: { id: string; label: string; hint?: string }[];
}

/** Penalizador temporal de rol: el entrenador te da menos minutos. */
export interface RolePenalty {
  /** Jornadas que quedan con el penalizador activo. */
  matches: number;
  /** Puntos de media que resta a la confianza del cuerpo técnico. */
  ovr: number;
}
