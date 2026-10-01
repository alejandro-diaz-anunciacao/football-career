import { Continent } from '../models';

/**
 * Competiciones continentales. El tamaño se adapta al número de clubes del
 * mundo (pocos países por continente): se mantiene la estructura real
 * (previa, grupos o fase de liga, eliminatorias y repescas) con campos reducidos.
 */
export interface ContinentalDef {
  id: string;
  name: string;
  continent: Continent;
  /** 1 = principal, 2 = secundaria. */
  tier: 1 | 2;
  format: 'groups' | 'league' | 'knockout';
  /** Nº de equipos del cuadro principal. */
  mainSize: number;
  /** Nº de grupos de 4 (si `format === 'groups'`). */
  groups?: number;
  /** Jornadas por grupo (si la fase de grupos no es el round-robin completo). */
  groupRounds?: number;
  /** Jornadas de la fase de liga. */
  leagueRounds?: number;
  /** Clasificados directos a octavos y equipos del playoff en la fase de liga. */
  leagueDirect?: number;
  leaguePlayoff?: number;
  /** Clasificados directos por grupo. */
  qualifiersPerGroup: number;
  /** Equipos por grupo que entran en una ronda previa eliminatoria. */
  playoffPerGroup?: number;
  /** Rondas antes de la final que se juegan a ida y vuelta. */
  knockoutTwoLeggedRounds: number;
  /** Primeras rondas del KO a doble partido. */
  knockoutFirstTwoLegged?: number;
  /** La final se juega a ida y vuelta (CAF). */
  twoLeggedFinal?: boolean;
  /** Plazas directas por país. */
  slots: Record<string, number>;
  /** Plazas de previa por país (los perdedores caen a la secundaria). */
  qualifyingSlots?: Record<string, number>;
  /** Rondas de la previa. */
  qualifyingRounds?: number;
  /** Países cuyo campeón de copa entra en esta competición. */
  cupWinners?: string[];
  /** Competición desde la que recibe las repescas. */
  receivesDropsFrom?: string;
  /** Nº de equipos que recibe por repesca. */
  drops?: number;
  /** Comparte equipos con otras competiciones del continente (Leagues Cup). */
  shareTeams?: boolean;
}

export const CONTINENTAL_DEFS: readonly ContinentalDef[] = [
  /* ------------------------------------------------------------------ CONMEBOL */
  {
    id: 'cont.libertadores',
    name: 'Copa Libertadores',
    continent: Continent.SouthAmerica,
    tier: 1,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 2,
    knockoutTwoLeggedRounds: 2,
    slots: { AR: 8, BR: 8 },
  },
  {
    id: 'cont.sudamericana',
    name: 'Copa Sudamericana',
    continent: Continent.SouthAmerica,
    tier: 2,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 1,
    playoffPerGroup: 1,
    knockoutTwoLeggedRounds: 3,
    slots: { AR: 7, BR: 7 },
    cupWinners: ['AR', 'BR'],
    receivesDropsFrom: 'cont.libertadores',
    drops: 4,
  },

  /* --------------------------------------------------------------- Norteamérica */
  {
    id: 'cont.concacaf',
    name: 'Concacaf Champions Cup',
    continent: Continent.NorthAmerica,
    tier: 1,
    format: 'knockout',
    mainSize: 16,
    qualifiersPerGroup: 0,
    knockoutTwoLeggedRounds: 3,
    slots: { MX: 8, US: 8 },
  },
  {
    id: 'cont.leagues-cup',
    name: 'Leagues Cup',
    continent: Continent.NorthAmerica,
    tier: 2,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 2,
    knockoutTwoLeggedRounds: 0,
    slots: { MX: 8, US: 8 },
    shareTeams: true,
  },

  /* ---------------------------------------------------------------------- Asia */
  {
    id: 'cont.acl.elite',
    name: 'AFC Champions League Elite',
    continent: Continent.Asia,
    tier: 1,
    format: 'groups',
    mainSize: 16,
    groups: 2,
    groupRounds: 7,
    qualifiersPerGroup: 4,
    knockoutFirstTwoLegged: 1,
    knockoutTwoLeggedRounds: 0,
    slots: { JP: 6, SA: 6 },
    qualifyingSlots: { JP: 4, SA: 4 },
    qualifyingRounds: 1,
  },
  {
    id: 'cont.acl.two',
    name: 'AFC Champions League Two',
    continent: Continent.Asia,
    tier: 2,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 2,
    knockoutTwoLeggedRounds: 3,
    slots: { JP: 6, SA: 6 },
    receivesDropsFrom: 'cont.acl.elite',
    drops: 4,
  },

  /* -------------------------------------------------------------------- África */
  {
    id: 'cont.caf.cl',
    name: 'CAF Champions League',
    continent: Continent.Africa,
    tier: 1,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 2,
    knockoutTwoLeggedRounds: 3,
    twoLeggedFinal: true,
    slots: { EG: 6, MA: 6 },
    qualifyingSlots: { EG: 4, MA: 4 },
    qualifyingRounds: 1,
  },
  {
    id: 'cont.caf.conf',
    name: 'CAF Confederation Cup',
    continent: Continent.Africa,
    tier: 2,
    format: 'groups',
    mainSize: 16,
    groups: 4,
    qualifiersPerGroup: 2,
    knockoutTwoLeggedRounds: 3,
    twoLeggedFinal: true,
    slots: { EG: 6, MA: 6 },
    receivesDropsFrom: 'cont.caf.cl',
    drops: 4,
  },

  /* -------------------------------------------------------------------- Europa */
  {
    id: 'cont.ucl',
    name: 'UEFA Champions League',
    continent: Continent.Europe,
    tier: 1,
    format: 'league',
    mainSize: 32,
    leagueRounds: 8,
    leagueDirect: 8,
    leaguePlayoff: 16,
    qualifiersPerGroup: 0,
    knockoutTwoLeggedRounds: 4,
    slots: { ES: 7, GB: 6, DE: 5, IT: 5, FR: 5 },
    qualifyingSlots: { ES: 2, GB: 2, DE: 1, IT: 1, FR: 2 },
    qualifyingRounds: 1,
  },
  {
    id: 'cont.uel',
    name: 'UEFA Europa League',
    continent: Continent.Europe,
    tier: 2,
    format: 'league',
    mainSize: 32,
    leagueRounds: 8,
    leagueDirect: 8,
    leaguePlayoff: 16,
    qualifiersPerGroup: 0,
    knockoutTwoLeggedRounds: 4,
    slots: { ES: 6, GB: 5, DE: 4, IT: 4, FR: 4 },
    cupWinners: ['ES', 'GB', 'DE', 'IT', 'FR'],
    receivesDropsFrom: 'cont.ucl',
    drops: 4,
  },
];

/** Competición continental por identificador. */
export function continentalDef(id: string): ContinentalDef | undefined {
  return CONTINENTAL_DEFS.find((def) => def.id === id);
}

/** Competiciones de un continente, ordenadas por prioridad. */
export function continentalDefsOf(continent: Continent): ContinentalDef[] {
  return CONTINENTAL_DEFS.filter((def) => def.continent === continent).sort((a, b) => a.tier - b.tier);
}
