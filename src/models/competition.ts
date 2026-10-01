import type { Fixture } from './league';

/** Tipo de competición adicional a las ligas. */
export type CompetitionKind = 'cup';

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

/**
 * Competición de eliminatoria (copa nacional; ampliable a continentales).
 * Reutiliza `Fixture` para las piernas y guarda el cuadro en `ties`.
 */
export interface Competition {
  id: string;
  name: string;
  season: number;
  kind: CompetitionKind;
  countryCode: string;
  /** Todos los equipos del país (de todas las categorías). */
  teamIds: string[];
  /** Ronda en curso (1-indexed). */
  round: number;
  /** Pierna en curso dentro de la ronda (1 o 2). */
  leg: number;
  totalRounds: number;
  ties: KnockoutTie[];
  championId: string | null;
  /** Equipos que entran exentos al terminar la primera ronda. */
  pendingByes: string[];
  /** Nº de rondas antes de la final que se juegan a doble partido. */
  twoLeggedRounds: number;
}
