import type { Confederation } from '../models';

/**
 * Torneos de selecciones. El tamaño se adapta al catálogo de selecciones
 * manteniendo la estructura real: fase de grupos (4 por grupo) y eliminatorias,
 * con mejores terceros donde corresponde.
 */
export interface NationalTournamentDef {
  id: string;
  name: string;
  cycle: 'world' | 'continental';
  /** Confederaciones que disputan la clasificación para este torneo. */
  confederations: Confederation[];
  groups: number;
  /** Equipos por grupo (siempre 4 para evitar grupos impares). */
  groupSize: number;
  /** Mejores terceros que pasan a la eliminatoria. */
  bestThirds: number;
  /** Plazas directas por confederación. */
  directSlots: Partial<Record<Confederation, number>>;
}

/** Copa del Mundo (cada cuatro temporadas). */
export const WORLD_CUP_DEF: NationalTournamentDef = {
  id: 'nat.wc',
  name: 'Copa del Mundo',
  cycle: 'world',
  confederations: ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'],
  groups: 12,
  groupSize: 4,
  bestThirds: 8,
  directSlots: { UEFA: 16, CONMEBOL: 6, CAF: 10, AFC: 9, CONCACAF: 6, OFC: 1 },
};

/** Torneos continentales (dos temporadas después de cada Mundial). */
export const CONTINENTAL_TOURNAMENTS: readonly NationalTournamentDef[] = [
  { id: 'nat.euro', name: 'Eurocopa', cycle: 'continental', confederations: ['UEFA'], groups: 4, groupSize: 4, bestThirds: 0, directSlots: { UEFA: 16 } },
  { id: 'nat.copa', name: 'Copa América', cycle: 'continental', confederations: ['CONMEBOL'], groups: 2, groupSize: 4, bestThirds: 0, directSlots: { CONMEBOL: 8 } },
  { id: 'nat.afcon', name: 'Copa África', cycle: 'continental', confederations: ['CAF'], groups: 4, groupSize: 4, bestThirds: 0, directSlots: { CAF: 16 } },
  { id: 'nat.asian', name: 'Copa Asiática', cycle: 'continental', confederations: ['AFC'], groups: 4, groupSize: 4, bestThirds: 0, directSlots: { AFC: 16 } },
  { id: 'nat.gold', name: 'Copa Oro', cycle: 'continental', confederations: ['CONCACAF'], groups: 3, groupSize: 4, bestThirds: 2, directSlots: { CONCACAF: 12 } },
];

/** Torneo de selecciones de una temporada (Mundial o continentales). */
export function nationalTournamentsFor(worldCup: boolean): NationalTournamentDef[] {
  return worldCup ? [WORLD_CUP_DEF] : [...CONTINENTAL_TOURNAMENTS];
}

/** Torneo por identificador. */
export function nationalTournamentDef(id: string): NationalTournamentDef | undefined {
  if (WORLD_CUP_DEF.id === id) return WORLD_CUP_DEF;
  return CONTINENTAL_TOURNAMENTS.find((def) => def.id === id);
}

/** Identificador de la clasificación de una confederación. */
export function qualifierId(confederation: Confederation): string {
  return `nat.qual.${confederation}`;
}
