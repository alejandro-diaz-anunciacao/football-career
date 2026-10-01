import { MessageKind, SeasonPhase, SquadRole } from './enums';
import type { League } from './league';
import type { MatchResult } from './match';
import type { Player } from './player';
import type { Team } from './team';

/** Resumen de una temporada finalizada. */
export interface SeasonHistory {
  season: number;
  age: number;
  ovr: number;
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
  tier: number;
  position: number;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number;
  motm: number;
  goalsConceded: number;
  cleanSheets: number;
  trophies: string[];
}

/** Trofeo o distinción conseguida. */
export interface Trophy {
  id: string;
  name: string;
  season: number;
  teamId: string;
  teamName: string;
  kind: 'league' | 'individual' | 'promotion';
}

/** Acción adjunta a un mensaje de la bandeja. */
export interface MessageAction {
  id: string;
  label: string;
  kind: 'accept' | 'reject' | 'ack';
}

/** Mensaje del buzón del jugador. */
export interface InboxMessage {
  id: string;
  season: number;
  round: number;
  kind: MessageKind;
  title: string;
  body: string;
  read: boolean;
  actions: MessageAction[];
}

/** Oferta de fichaje de otro club. */
export interface TransferOffer {
  id: string;
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
  tier: number;
  continent: string;
  /** Salario semanal ofrecido (miles de €). */
  wage: number;
  /** Duración del contrato en años. */
  years: number;
  /** Prima de fichaje en millones. */
  fee: number;
  /** Valoración del club sobre el jugador (texto). */
  pitch: string;
  /** Traspaso definitivo o cesión temporal. */
  kind: 'transfer' | 'loan';
  /** Rol previsto en el club que presenta la oferta. */
  projectedRole: SquadRole;
}

/** Estado completo de la carrera, serializable en localStorage. */
export interface CareerState {
  version: number;
  seed: number;
  rngState: number;
  createdAt: number;
  savedAt: number;
  season: number;
  phase: SeasonPhase;
  /** Jornada global en curso (1-indexed). */
  currentRound: number;
  player: Player;
  teamId: string;
  leagues: Record<string, League>;
  teams: Record<string, Team>;
  history: SeasonHistory[];
  trophies: Trophy[];
  inbox: InboxMessage[];
  offers: TransferOffer[];
  /** Último partido disputado por el usuario. */
  lastMatch: MatchResult | null;
  /** Últimos resultados del usuario (para la vista de calendario). */
  recentResults: MatchResult[];
  /** Número de temporadas jugadas, usado para récords. */
  seasonsPlayed: number;
  /** Posición final del equipo en la temporada anterior. */
  previousFinish: number | null;
}

/** Resumen devuelto tras simular una jornada completa. */
export interface RoundSummary {
  round: number;
  userFixture: MatchResult | null;
  goalsScoredElsewhere: number;
  messages: InboxMessage[];
}

/** Resultado del cierre de temporada. */
export interface SeasonSummary {
  season: number;
  finalPosition: number;
  promoted: boolean;
  relegated: boolean;
  champion: boolean;
  ovrDelta: number;
  newOvr: number;
  newAge: number;
  topScorer: boolean;
  trophies: Trophy[];
  offers: TransferOffer[];
}
