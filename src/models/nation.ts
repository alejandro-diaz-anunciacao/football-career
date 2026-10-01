/** Confederaciones continentales de selecciones. */
export type Confederation = 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC';

/**
 * Selección nacional. Puede ser jugable (su país tiene ligas) o no; en ambos
 * casos compite en las ventanas internacionales y en los torneos.
 */
export interface NationalTeam {
  /** Identificador (`nat.<código>`). */
  id: string;
  name: string;
  code: string;
  confederation: Confederation;
  /** Fuerza de la selección (1-99). */
  strength: number;
}
