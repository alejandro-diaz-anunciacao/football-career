/**
 * Vínculos entre equipos filiales (canteras) y sus primeros equipos.
 *
 * El nombre del filial debe existir en las ligas de `leagues.ts`; el constructor
 * de mundo (`worldBuilder`) resuelve los identificadores por país + nombre.
 */
export interface FilialDef {
  /** Nombre del filial tal y como aparece en la liga. */
  filial: string;
  /** Nombre del primer equipo al que pertenece. */
  parent: string;
  countryCode: string;
}

export const FILIAL_DEFS: readonly FilialDef[] = [
  /* ------------------------------------------------------------------ España */
  { filial: 'Real Madrid Castilla', parent: 'Real Madrid', countryCode: 'ES' },
  { filial: 'Barça Atlètic', parent: 'FC Barcelona', countryCode: 'ES' },
  { filial: 'Bilbao Athletic', parent: 'Athletic Club', countryCode: 'ES' },
  { filial: 'Osasuna Promesas', parent: 'CA Osasuna', countryCode: 'ES' },
  { filial: 'Sevilla Atlético', parent: 'Sevilla FC', countryCode: 'ES' },
  { filial: 'Celta Fortuna', parent: 'RC Celta de Vigo', countryCode: 'ES' },
  { filial: 'Atlético de Madrid B', parent: 'Atlético de Madrid', countryCode: 'ES' },
  { filial: 'Real Sociedad B', parent: 'Real Sociedad', countryCode: 'ES' },

  /* ----------------------------------------------------------------- Alemania */
  { filial: 'Borussia Dortmund II', parent: 'Borussia Dortmund', countryCode: 'DE' },
  { filial: 'Bayern Múnich II', parent: 'Bayern Múnich', countryCode: 'DE' },

  /* -------------------------------------------------------------------- Italia */
  { filial: 'Juventus Next Gen', parent: 'Juventus FC', countryCode: 'IT' },
  { filial: 'AC Milan Futuro', parent: 'AC Milan', countryCode: 'IT' },
];
