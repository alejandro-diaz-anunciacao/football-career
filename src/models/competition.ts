import type { Continent } from './enums';
import type { Fixture, StandingRow } from './league';

/** Tipo de competición adicional a las ligas. */
export type CompetitionKind = 'cup' | 'continental';

/** Formato de la competición. */
export type CompetitionFormat = 'knockout' | 'groups' | 'league';

/** Fase en la que se encuentra la competición. */
export type CompetitionStage = 'qualifying' | 'pending' | 'groups' | 'league' | 'knockout' | 'done';

/** Eliminatoria a uno o dos partidos. */
export interface KnockoutTie {
  id: string;
  round: number;
  /** Equipo que juega en casa la primera pierna. */
  homeId: string;
  awayId: string;
  /** Piernas del cruce (1 o 2); la primera en casa de `homeId`. */
  legs: Fixture[];
  /** Vencedor del cruce, o null mientras no se resuelva. */
  winnerId: string | null;
}

/** Grupo de una fase de grupos con su clasificación y calendario. */
export interface CompetitionGroup {
  id: string;
  teamIds: string[];
  standings: StandingRow[];
  fixtures: Fixture[];
}

/**
 * Competición de eliminatoria y/o grupos (copa nacional o continental).
 * Reutiliza `Fixture` para las piernas y `StandingRow` para las tablas.
 */
export interface Competition {
  id: string;
  name: string;
  season: number;
  kind: CompetitionKind;
  format: CompetitionFormat;
  stage: CompetitionStage;
  /** País de la copa nacional, si es una copa. */
  countryCode?: string;
  /** Continente de la competición continental, si lo es. */
  continent?: Continent;
  /** Prioridad dentro del continente: 1 principal, 2 secundaria. */
  tier: number;
  /** Todos los participantes. */
  teamIds: string[];
  /** Ronda en curso (grupos o eliminatoria). */
  round: number;
  /** Pierna en curso dentro de la ronda eliminatoria (1 o 2). */
  leg: number;
  /** Rondas de la fase eliminatoria. */
  totalRounds: number;
  /** Ties de la fase eliminatoria. */
  ties: KnockoutTie[];
  championId: string | null;
  /** Equipos que entran exentos al terminar la primera ronda eliminatoria. */
  pendingByes: string[];
  /** Nº de rondas antes de la final que se juegan a doble partido. */
  twoLeggedRounds: number;
  /** Grupos de la fase de grupos (o la tabla única de la fase de liga). */
  groups?: CompetitionGroup[];
  /** Jornadas de la fase de grupos o de liga. */
  groupRounds?: number;
  /** Equipos que se incorporan al KO (repescas de otra competición). */
  pendingEntrants?: string[];
  /** Equipos ya clasificados al cuadro principal (los ganadores de la previa se suman). */
  mainEntrants?: string[];
  /** Primeras rondas del KO a doble partido (además de las últimas). */
  knockoutFirstTwoLegged?: number;
  /** La ronda final se juega a ida y vuelta (final de la CAF). */
  twoLeggedFinal?: boolean;
}
