/**
 * Enumeraciones y tipos base del dominio.
 * Todos los enums son de tipo string para que la serialización en localStorage
 * sea legible y estable entre versiones.
 */

/** Grupo posicional del futbolista (categoría amplia). */
export enum Position {
  Goalkeeper = 'POR',
  Defender = 'DEF',
  Midfielder = 'MED',
  Forward = 'DEL',
}

/**
 * Subposición específica del futbolista dentro de su grupo. El grupo se deriva
 * con `roleGroup()`; estos valores se serializan en el guardado, así que son
 * estables entre versiones.
 */
export enum PlayerRole {
  Goalkeeper = 'POR',

  CentreBack = 'DFC',
  LeftBack = 'LI',
  RightBack = 'LD',
  LeftWingBack = 'CAI',
  RightWingBack = 'CAD',

  DefensiveMidfielder = 'MCD',
  CentralMidfielder = 'MC',
  AttackingMidfielder = 'MP',
  LeftMidfielder = 'MI',
  RightMidfielder = 'MD',

  Striker = 'DC',
  FalseNine = 'FN',
  LeftWinger = 'EI',
  RightWinger = 'ED',
}

/** Pie dominante. */
export enum Foot {
  Left = 'Izquierdo',
  Right = 'Derecho',
  Both = 'Ambidiestro',
}

/** Continentes soportados por el mundo simulado. */
export enum Continent {
  Europe = 'Europa',
  SouthAmerica = 'Sudamérica',
  NorthAmerica = 'Norteamérica',
  Asia = 'Asia',
  Africa = 'África',
}

/** Rol del jugador en la plantilla de su equipo. */
export enum SquadRole {
  NotCalled = 'No convocado',
  Bench = 'Suplente',
  Starter = 'Titular',
}

/** Tipología de eventos registrados minuto a minuto. */
export enum MatchEventType {
  KickOff = 'kickoff',
  Goal = 'goal',
  Penalty = 'penalty',
  Assist = 'assist',
  Shot = 'shot',
  Save = 'save',
  Tackle = 'tackle',
  Interception = 'interception',
  KeyPass = 'keypass',
  Foul = 'foul',
  YellowCard = 'yellow',
  RedCard = 'red',
  Injury = 'injury',
  Substitution = 'substitution',
  HalfTime = 'halftime',
  FullTime = 'fulltime',
}

/** Fase de la temporada. */
export enum SeasonPhase {
  Preseason = 'preseason',
  League = 'league',
  Offseason = 'offseason',
}

/** Tipo de mensaje recibido en la bandeja de entrada. */
export enum MessageKind {
  Info = 'info',
  Offer = 'offer',
  Trophy = 'trophy',
  Injury = 'injury',
  Squad = 'squad',
  Media = 'media',
  Transfer = 'transfer',
  Event = 'event',
}

/** Planteamiento táctico elegido antes del partido. */
export enum TacticalApproach {
  Safe = 'Seguro',
  Balanced = 'Equilibrado',
  Aggressive = 'Agresivo',
}

/** Resultado de un encuentro desde la perspectiva del equipo del jugador. */
export type MatchOutcome = 'win' | 'draw' | 'loss';

/** Lado del campo. */
export type TeamSide = 'home' | 'away';
