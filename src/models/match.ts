import type { MatchEventType, MatchOutcome, TeamSide } from './enums';

/** Evento atómico registrado durante un partido. */
export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side: TeamSide;
  teamId: string;
  playerId: string | null;
  playerName: string;
  description: string;
  /** ¿Participa directamente el futbolista del usuario? */
  isUserInvolved: boolean;
}

/** Estadísticas individuales de un partido. */
export interface PlayerMatchStats {
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  rating: number;
}

/** Crea estadísticas de partido a cero. */
export function emptyMatchStats(): PlayerMatchStats {
  return {
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    keyPasses: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    goalsConceded: 0,
    cleanSheet: false,
    yellowCards: 0,
    redCards: 0,
    rating: 6,
  };
}

/** Resultado completo de un encuentro. */
export interface MatchResult {
  round: number;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  /** Lado del equipo del usuario. */
  userSide: TeamSide;
  /** Estadísticas del usuario (null si no disputó minutos). */
  userStats: PlayerMatchStats | null;
  /** Calificación final del usuario (null si no jugó). */
  userRating: number | null;
  /** Outcome desde la perspectiva del usuario. */
  userOutcome: MatchOutcome;
  /** ¿Fue MVP del partido? */
  userMotm: boolean;
}

/** Estado inicial del simulador antes del saque. */
export interface MatchSetup {
  homeTeamId: string;
  awayTeamId: string;
  userTeamId: string;
  userOnPitch: boolean;
  round: number;
}
