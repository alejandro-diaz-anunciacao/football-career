/**
 * Copas nacionales. Participan todos los equipos del país (todas las
 * categorías). El cuadro se reduce con una ronda preliminar a la potencia de
 * dos más cercana; Alemania mantiene el formato real de 64 con exentos.
 */
export interface CupDef {
  id: string;
  name: string;
  countryCode: string;
  /** Rondas antes de la final que se juegan a ida y vuelta. */
  twoLeggedRounds: number;
  /** Equipos de mayor nivel exentos de la primera ronda (DFB-Pokal). */
  byes: number;
}

export const CUP_DEFS: readonly CupDef[] = [
  { id: 'cup.es', name: 'Copa del Rey', countryCode: 'ES', twoLeggedRounds: 1, byes: 0 },
  { id: 'cup.gb', name: 'FA Cup', countryCode: 'GB', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.de', name: 'DFB-Pokal', countryCode: 'DE', twoLeggedRounds: 0, byes: 10 },
  { id: 'cup.it', name: 'Coppa Italia', countryCode: 'IT', twoLeggedRounds: 1, byes: 0 },
  { id: 'cup.fr', name: 'Coupe de France', countryCode: 'FR', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.ar', name: 'Copa Argentina', countryCode: 'AR', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.br', name: 'Copa do Brasil', countryCode: 'BR', twoLeggedRounds: 3, byes: 0 },
  { id: 'cup.mx', name: 'Copa MX', countryCode: 'MX', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.us', name: 'US Open Cup', countryCode: 'US', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.jp', name: "Emperor's Cup", countryCode: 'JP', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.sa', name: 'King Cup', countryCode: 'SA', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.eg', name: 'Egypt Cup', countryCode: 'EG', twoLeggedRounds: 0, byes: 0 },
  { id: 'cup.ma', name: 'Coupe du Trône', countryCode: 'MA', twoLeggedRounds: 0, byes: 0 },
];

/** Copa de un país, si existe. */
export function cupDefOfCountry(countryCode: string): CupDef | undefined {
  return CUP_DEFS.find((cup) => cup.countryCode === countryCode);
}
