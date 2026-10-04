import { clamp } from '../utils/math';
import { Continent, PlayerRole, Position } from './enums';

/** Ficha de un integrante de plantilla generado por el simulador. */
export interface SquadMember {
  id: string;
  name: string;
  position: Position;
  /** Subposición específica dentro del grupo. */
  role: PlayerRole;
  number: number;
  ovr: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeping: number;
  /** ¿Es el futbolista controlado por el usuario? */
  isUser: boolean;
}

/** Equipo del mundo simulado. */
export interface Team {
  id: string;
  name: string;
  short: string;
  leagueId: string;
  country: string;
  countryCode: string;
  continent: Continent;
  /** Fuerza ofensiva (1-99). */
  attack: number;
  /** Fuerza del mediocampo (1-99). */
  midfield: number;
  /** Fuerza defensiva, incluido portero (1-99). */
  defense: number;
  /** Media global de la plantilla (1-99). */
  overall: number;
  /** Prestigio del club (1-100), usado por el mercado. */
  reputation: number;
  /** Primer equipo al que pertenece este filial (si es un equipo filial). */
  parentTeamId?: string;
  /** Filial principal de este club (si tiene cantera). */
  reserveTeamId?: string;
}

/** Media global derivada de las tres líneas. */
export function teamOverall(team: Pick<Team, 'attack' | 'midfield' | 'defense'>): number {
  return Math.round(clamp(team.attack * 0.34 + team.midfield * 0.33 + team.defense * 0.33, 1, 99));
}
