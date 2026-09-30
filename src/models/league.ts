import { Continent } from './enums';

/** Fila de la clasificación de una liga. */
export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/** Encuentro programado dentro de una liga. */
export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

/** Competición liguera con su calendario y clasificación. */
export interface League {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  continent: Continent;
  /** 1 = máxima categoría del país. */
  tier: number;
  teamIds: string[];
  standings: StandingRow[];
  fixtures: Fixture[];
  /** Jornada que se jugará a continuación (1-indexed). */
  currentRound: number;
  totalRounds: number;
  promotionSlots: number;
  relegationSlots: number;
  /** Liga inmediatamente superior del mismo país, si existe. */
  aboveLeagueId: string | null;
  /** Liga inmediatamente inferior del mismo país, si existe. */
  belowLeagueId: string | null;
  /** Fuerza media de referencia de la categoría. */
  strength: number;
}

/** Definición estática usada para construir el mundo. */
export interface LeagueDef {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  continent: Continent;
  tier: number;
  /** Media global del mejor equipo de la categoría. */
  topOverall: number;
  promotionSlots: number;
  relegationSlots: number;
  teams: string[];
}

/** Ordena la clasificación aplicando los criterios oficiales. */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.goalsFor - a.goalsAgainst;
    const diffB = b.goalsFor - b.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });
}
