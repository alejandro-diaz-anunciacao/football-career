import { CONFIG, tacticModifiers } from '../data/config';
import { clamp, round } from '../utils/math';
import {
  MatchEventType,
  Position,
  SquadRole,
  TacticalApproach,
} from '../models';
import type {
  MatchEvent,
  MatchOutcome,
  MatchResult,
  Player,
  PlayerMatchStats,
  SquadMember,
  Team,
  TeamSide,
} from '../models';
import { emptyMatchStats } from '../models';
import type { Random } from '../utils/random';
import { matchLambdas, outcomeProbabilities, mostLikelyScoreline, samplePoisson } from './poisson';
import { computeRating } from './ratingEngine';

/** Equipo listo para jugar: ficha + plantilla completa. */
export interface MatchSide {
  team: Team;
  squad: SquadMember[];
}

/** Opciones de construcción de una simulación. */
export interface MatchSimulationOptions {
  home: MatchSide;
  away: MatchSide;
  /** Equipo al que pertenece el usuario. */
  userTeamId: string;
  userPlayer: Player;
  userRole: SquadRole;
  approach: TacticalApproach;
  round: number;
  /** Competición del partido (liga o copa). */
  competitionId: string;
  /** Sede neutral (finales de copa). */
  neutral?: boolean;
  rng: Random;
}

/** Tipos de acción que pueden recaer sobre el usuario. */
type ActorKind = 'goal' | 'shot' | 'save' | 'tackle' | 'interception' | 'keypass' | 'foul';

/** Peso relativo base de cada acción por posición. */
const BASE_WEIGHT: Record<ActorKind, Record<Position, number>> = {
  goal: { [Position.Goalkeeper]: 0.01, [Position.Defender]: 0.6, [Position.Midfielder]: 2.2, [Position.Forward]: 5.0 },
  shot: { [Position.Goalkeeper]: 0.01, [Position.Defender]: 0.7, [Position.Midfielder]: 2.4, [Position.Forward]: 5.5 },
  save: { [Position.Goalkeeper]: 12, [Position.Defender]: 0, [Position.Midfielder]: 0, [Position.Forward]: 0 },
  tackle: { [Position.Goalkeeper]: 0.2, [Position.Defender]: 5.0, [Position.Midfielder]: 3.0, [Position.Forward]: 0.8 },
  interception: { [Position.Goalkeeper]: 0.4, [Position.Defender]: 5.0, [Position.Midfielder]: 3.4, [Position.Forward]: 0.9 },
  keypass: { [Position.Goalkeeper]: 0.1, [Position.Defender]: 1.6, [Position.Midfielder]: 4.6, [Position.Forward]: 3.4 },
  foul: { [Position.Goalkeeper]: 0.3, [Position.Defender]: 3.0, [Position.Midfielder]: 2.4, [Position.Forward]: 1.6 },
};

/** Multiplicador aplicado al peso del usuario para que el rol module su presencia. */
const USER_INVOLVEMENT: Record<ActorKind, Record<Position, number>> = {
  goal: { [Position.Goalkeeper]: 0.02, [Position.Defender]: 0.6, [Position.Midfielder]: 0.95, [Position.Forward]: 1.3 },
  shot: { [Position.Goalkeeper]: 0, [Position.Defender]: 0.32, [Position.Midfielder]: 0.85, [Position.Forward]: 1.35 },
  save: { [Position.Goalkeeper]: 1.1, [Position.Defender]: 0, [Position.Midfielder]: 0, [Position.Forward]: 0 },
  tackle: { [Position.Goalkeeper]: 0.08, [Position.Defender]: 1.25, [Position.Midfielder]: 0.95, [Position.Forward]: 0.35 },
  interception: { [Position.Goalkeeper]: 0.12, [Position.Defender]: 1.25, [Position.Midfielder]: 1.0, [Position.Forward]: 0.4 },
  keypass: { [Position.Goalkeeper]: 0.05, [Position.Defender]: 0.55, [Position.Midfielder]: 1.25, [Position.Forward]: 1.05 },
  foul: { [Position.Goalkeeper]: 0.1, [Position.Defender]: 1.1, [Position.Midfielder]: 1.0, [Position.Forward]: 0.9 },
};

/** Evento planificado internamente antes de revelarse minuto a minuto. */
interface PlannedEvent {
  minute: number;
  side: TeamSide;
  type: MatchEventType;
  playerId: string;
  playerName: string;
  description: string;
  involvesUser: boolean;
  /** Suma un gol al marcador. */
  scoring: boolean;
  /** Id del asistente (para contabilizar asistencias). */
  assistId?: string;
}

/** Ventana de participación del usuario en el partido. */
interface PlayWindow {
  start: number;
  end: number;
}

/**
 * Simulación interactiva de un partido.
 * Se planifica el guion completo (respetando Poisson y pesos por atributo) y
 * después se revela minuto a minuto mediante `step()`, de modo que la interfaz
 * puede animar el encuentro y aplicar intervenciones del entrenador.
 */
export class MatchSimulation {
  readonly round: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly userSide: TeamSide;

  minute = 0;
  homeGoals = 0;
  awayGoals = 0;
  events: MatchEvent[] = [];
  userStats: PlayerMatchStats = emptyMatchStats();
  userOnPitch = false;
  finished = false;

  private readonly options: MatchSimulationOptions;
  private readonly plan: PlannedEvent[];
  private readonly window: PlayWindow;
  private readonly lineups: Record<TeamSide, SquadMember[]>;

  constructor(options: MatchSimulationOptions) {
    this.options = options;
    this.round = options.round;
    this.homeTeamId = options.home.team.id;
    this.awayTeamId = options.away.team.id;
    this.userSide = options.userTeamId === options.home.team.id ? 'home' : 'away';

    this.lineups = {
      home: selectStartingEleven(options.home.squad, this.userSide === 'home' ? options.userPlayer.id : null, options.userRole),
      away: selectStartingEleven(options.away.squad, this.userSide === 'away' ? options.userPlayer.id : null, options.userRole),
    };

    this.window = this.planWindow();
    this.plan = this.buildPlan();
  }

  /** ¿Está el usuario disponible para jugar este partido? */
  private canPlay(): boolean {
    const { userPlayer, userRole } = this.options;
    return userRole !== SquadRole.NotCalled && userPlayer.injuryWeeks <= 0 && userPlayer.fitness >= 38;
  }

  /** Decide si el usuario es titular, sale desde el banquillo o no juega. */
  private planWindow(): PlayWindow {
    const { rng, userRole, userPlayer } = this.options;
    if (!this.canPlay()) return { start: 0, end: 0 };

    const trust = clamp(userPlayer.form * 0.35 + userPlayer.morale / 300, -0.2, 0.45);

    if (userRole === SquadRole.Starter) {
      const subProbability = clamp(0.42 - trust - userPlayer.fitness / 400, 0.05, 0.6);
      const end = rng.chance(subProbability) ? rng.int(58, 86) : 90;
      return { start: 1, end };
    }

    // Suplente: entra con el partido avanzado según forma y confianza.
    const enterProbability = clamp(0.5 + trust, 0.15, 0.9);
    if (!rng.chance(enterProbability)) return { start: 0, end: 0 };
    return { start: rng.int(54, 78), end: 90 };
  }

  /** Equipos que están sobre el césped en un minuto concreto. */
  private onPitch(side: TeamSide, minute: number): SquadMember[] {
    const lineup = [...this.lineups[side]];
    const userId = this.options.userPlayer.id;
    const user = this.options.userPlayer;
    const userSquadMember =
      side === this.userSide
        ? userOnPitchMember(user, this.lineups[side], minute, this.window)
        : null;

    const withoutUser = lineup.filter((member) => member.id !== userId);
    if (userSquadMember) withoutUser.push(userSquadMember);
    return withoutUser;
  }

  /** Peso de un actor para una acción concreta. */
  private actorWeight(member: SquadMember, kind: ActorKind): number {
    const base = BASE_WEIGHT[kind][member.position];
    if (base <= 0) return 0;

    const attribute =
      kind === 'save'
        ? member.goalkeeping
        : kind === 'keypass'
          ? member.passing
          : kind === 'tackle' || kind === 'interception' || kind === 'foul'
            ? member.defending
            : member.shooting;

    const attributeFactor = clamp(attribute / 62, 0.45, 1.75);
    const ovrFactor = 0.75 + member.ovr / 160;
    const weight = base * attributeFactor * ovrFactor;
    return member.isUser ? weight * USER_INVOLVEMENT[kind][member.position] : weight;
  }

  /** Selecciona un actor ponderado entre los que están en el campo. */
  private pickActor(side: TeamSide, minute: number, kind: ActorKind, excludeId?: string): SquadMember | null {
    const pool = this.onPitch(side, minute).filter((member) => member.id !== excludeId);
    const entries = pool
      .map((member) => ({ value: member, weight: this.actorWeight(member, kind) }))
      .filter((entry) => entry.weight > 0);
    if (entries.length === 0) return null;
    return this.options.rng.weighted(entries);
  }

  /** Minuto de un gol, con ligero sesgo hacia el tramo final. */
  private goalMinute(): number {
    const { rng } = this.options;
    const raw = 90 * rng.next() ** 0.82;
    return clamp(Math.round(raw), 1, 90);
  }

  /** Genera los goles de un lado según su lambda de Poisson. */
  private planGoals(side: TeamSide, lambda: number): PlannedEvent[] {
    const { rng } = this.options;
    const count = samplePoisson(lambda, rng);
    const events: PlannedEvent[] = [];

    for (let i = 0; i < count; i += 1) {
      const minute = this.goalMinute();
      const scorer = this.pickActor(side, minute, 'goal');
      if (!scorer) continue;
      const assist = rng.chance(0.62) ? this.pickActor(side, minute, 'keypass', scorer.id) : null;
      const teamName = this.teamName(side);

      events.push({
        minute,
        side,
        type: MatchEventType.Goal,
        playerId: scorer.id,
        playerName: scorer.name,
        description: `¡GOL de ${teamName}! ${scorer.name} define${assist ? ` tras pase de ${assist.name}` : ''}.`,
        involvesUser: scorer.isUser,
        scoring: true,
        ...(assist ? { assistId: assist.id } : {}),
      });

      if (assist && assist.isUser) {
        events.push({
          minute,
          side,
          type: MatchEventType.Assist,
          playerId: assist.id,
          playerName: assist.name,
          description: `${assist.name} firma la asistencia del gol.`,
          involvesUser: true,
          scoring: false,
        });
      }
    }

    return events;
  }

  /** Ocaciones, quites, paradas, tarjetas y lesiones. */
  private planNotableEvents(side: TeamSide, lambda: number): PlannedEvent[] {
    const { rng } = this.options;
    const events: PlannedEvent[] = [];
    const teamName = this.teamName(side);
    const rivalSide: TeamSide = side === 'home' ? 'away' : 'home';

    const shots = clamp(Math.round(lambda * 3.1 + rng.gauss(0, 1.4)), 1, 13);
    for (let i = 0; i < shots; i += 1) {
      const minute = rng.int(1, 90);
      const shooter = this.pickActor(side, minute, 'shot');
      if (!shooter) continue;
      const onTarget = rng.chance(0.44);
      if (onTarget) {
        const keeper = this.pickActor(rivalSide, minute, 'save');
        events.push({
          minute,
          side,
          type: MatchEventType.Shot,
          playerId: shooter.id,
          playerName: shooter.name,
          description: `${shooter.name} dispara a puerta.`,
          involvesUser: shooter.isUser,
          scoring: false,
        });
        if (keeper) {
          events.push({
            minute,
            side: rivalSide,
            type: MatchEventType.Save,
            playerId: keeper.id,
            playerName: keeper.name,
            description: `${keeper.name} despeja el remate de ${shooter.name}.`,
            involvesUser: keeper.isUser,
            scoring: false,
          });
        }
      } else {
        events.push({
          minute,
          side,
          type: MatchEventType.Shot,
          playerId: shooter.id,
          playerName: shooter.name,
          description: `${shooter.name} envía el balón fuera.`,
          involvesUser: shooter.isUser,
          scoring: false,
        });
      }
    }

    const tackles = rng.int(2, 6);
    for (let i = 0; i < tackles; i += 1) {
      const minute = rng.int(1, 90);
      const defender = this.pickActor(side, minute, 'tackle');
      if (!defender) continue;
      events.push({
        minute,
        side,
        type: MatchEventType.Tackle,
        playerId: defender.id,
        playerName: defender.name,
        description: `${defender.name} roba el balón con autoridad.`,
        involvesUser: defender.isUser,
        scoring: false,
      });
    }

    const interceptions = rng.int(2, 5);
    for (let i = 0; i < interceptions; i += 1) {
      const minute = rng.int(1, 90);
      const player = this.pickActor(side, minute, 'interception');
      if (!player) continue;
      events.push({
        minute,
        side,
        type: MatchEventType.Interception,
        playerId: player.id,
        playerName: player.name,
        description: `${player.name} corta una línea de pase.`,
        involvesUser: player.isUser,
        scoring: false,
      });
    }

    const keyPasses = rng.int(1, 4);
    for (let i = 0; i < keyPasses; i += 1) {
      const minute = rng.int(1, 90);
      const player = this.pickActor(side, minute, 'keypass');
      if (!player) continue;
      events.push({
        minute,
        side,
        type: MatchEventType.KeyPass,
        playerId: player.id,
        playerName: player.name,
        description: `${player.name} filtra un pase de gol.`,
        involvesUser: player.isUser,
        scoring: false,
      });
    }

    // Tarjetas: amarillas con reparto de Poisson, roja directa poco probable.
    const yellows = samplePoisson(1.5, rng);
    for (let i = 0; i < yellows; i += 1) {
      const minute = rng.int(10, 90);
      const player = this.pickActor(side, minute, 'foul');
      if (!player) continue;
      events.push({
        minute,
        side,
        type: MatchEventType.YellowCard,
        playerId: player.id,
        playerName: player.name,
        description: `${player.name} (${teamName}) ve la tarjeta amarilla.`,
        involvesUser: player.isUser,
        scoring: false,
      });
    }

    if (rng.chance(0.035)) {
      const minute = rng.int(20, 88);
      const player = this.pickActor(side, minute, 'foul');
      if (player) {
        events.push({
          minute,
          side,
          type: MatchEventType.RedCard,
          playerId: player.id,
          playerName: player.name,
          description: `¡ROJA DIRECTA! ${player.name} se va a la caseta.`,
          involvesUser: player.isUser,
          scoring: false,
        });
      }
    }

    return events;
  }

  /** Sustituciones del usuario y posible lesión. */
  private planUserWindowEvents(): PlannedEvent[] {
    const { userPlayer, rng } = this.options;
    const events: PlannedEvent[] = [];
    if (this.window.end === 0) return events;

    const side = this.userSide;
    const isStarter = this.options.userRole === SquadRole.Starter;

    if (!isStarter) {
      events.push({
        minute: this.window.start,
        side,
        type: MatchEventType.Substitution,
        playerId: userPlayer.id,
        playerName: userPlayer.name,
        description: `${userPlayer.name} salta al campo.`,
        involvesUser: true,
        scoring: false,
      });
    } else if (this.window.end < 90) {
      events.push({
        minute: this.window.end,
        side,
        type: MatchEventType.Substitution,
        playerId: userPlayer.id,
        playerName: userPlayer.name,
        description: `${userPlayer.name} es sustituido.`,
        involvesUser: true,
        scoring: false,
      });
    }

    // Riesgo de lesión proporcional a la fatiga.
    const injuryRisk = 0.012 + (100 - userPlayer.fitness) / 4200;
    if (rng.chance(injuryRisk) && this.window.end > 20) {
      const minute = rng.int(10, Math.max(11, this.window.end - 1));
      events.push({
        minute,
        side,
        type: MatchEventType.Injury,
        playerId: userPlayer.id,
        playerName: userPlayer.name,
        description: `${userPlayer.name} se duele y pide el cambio.`,
        involvesUser: true,
        scoring: false,
      });
    }

    return events;
  }

  /** Guion completo del partido ordenado por minuto. */
  private buildPlan(): PlannedEvent[] {
    const { home, approach, userTeamId } = this.options;
    const mods = tacticModifiers(approach);
    const userIsHome = userTeamId === home.team.id;

    const lambdas = matchLambdas(this.effectiveTeam('home'), this.effectiveTeam('away'), {
      homeAttackFactor: userIsHome ? mods.attack : 1,
      homeDefenseFactor: userIsHome ? mods.defense : 1,
      awayAttackFactor: userIsHome ? 1 : mods.attack,
      awayDefenseFactor: userIsHome ? 1 : mods.defense,
      neutral: this.options.neutral,
    });

    const plan: PlannedEvent[] = [
      ...this.planGoals('home', lambdas.home),
      ...this.planGoals('away', lambdas.away),
      ...this.planNotableEvents('home', lambdas.home),
      ...this.planNotableEvents('away', lambdas.away),
      ...this.planUserWindowEvents(),
    ];

    return plan.sort((a, b) => a.minute - b.minute);
  }

  private teamName(side: TeamSide): string {
    return side === 'home' ? this.options.home.team.name : this.options.away.team.name;
  }

  /**
   * Fuerzas efectivas del equipo, incorporando el peso del futbolista del
   * usuario. Un crack en una plantilla modesta eleva el nivel colectivo (y al
   * revés: sin él, el equipo vuelve a su media). El impacto depende de su rol.
   */
  private effectiveTeam(side: TeamSide): { attack: number; midfield: number; defense: number } {
    const team = side === 'home' ? this.options.home.team : this.options.away.team;
    if (team.id !== this.options.userTeamId) return team;

    const { userPlayer, userRole } = this.options;
    const involvement =
      userRole === SquadRole.Starter ? 1 : userRole === SquadRole.Bench ? 0.65 : 0.3;
    const surplus = Math.max(0, userPlayer.ovr - team.overall) * involvement;
    const deficit = Math.min(0, userPlayer.ovr - team.overall) * 0.35;

    return {
      attack: clamp(team.attack + clamp(surplus * 0.5, -6, 14) + deficit, 30, 96),
      midfield: clamp(team.midfield + clamp(surplus * 0.35, -5, 10) + deficit * 0.6, 30, 96),
      defense: clamp(team.defense + clamp(surplus * 0.25, -4, 7) + deficit * 0.4, 30, 96),
    };
  }

  private teamId(side: TeamSide): string {
    return side === 'home' ? this.options.home.team.id : this.options.away.team.id;
  }

  /** Convierte un evento planificado en evento público y actualiza estado. */
  private materialize(planned: PlannedEvent): MatchEvent {
    if (planned.scoring) {
      if (planned.side === 'home') this.homeGoals += 1;
      else this.awayGoals += 1;
    }

    const stats = this.userStats;
    const userId = this.options.userPlayer.id;

    if (planned.involvesUser) {
      switch (planned.type) {
        case MatchEventType.Goal:
          stats.goals += 1;
          stats.shots += 1;
          stats.shotsOnTarget += 1;
          break;
        case MatchEventType.Assist:
          stats.assists += 1;
          break;
        case MatchEventType.Shot:
          stats.shots += 1;
          if (planned.description.includes('dispara a puerta')) stats.shotsOnTarget += 1;
          break;
        case MatchEventType.Save:
          stats.saves += 1;
          break;
        case MatchEventType.Tackle:
          stats.tackles += 1;
          break;
        case MatchEventType.Interception:
          stats.interceptions += 1;
          break;
        case MatchEventType.KeyPass:
          stats.keyPasses += 1;
          break;
        case MatchEventType.YellowCard:
          stats.yellowCards += 1;
          break;
        case MatchEventType.RedCard:
          stats.redCards += 1;
          break;
        default:
          break;
      }
    }

    // Gol en propia meta del usuario: contabiliza gol encajado si es portero.
    if (planned.scoring && planned.side !== this.userSide) {
      const user = this.options.userPlayer;
      if (this.userOnPitch && user.position === Position.Goalkeeper) stats.goalsConceded += 1;
    }

    if (planned.assistId === userId && !planned.involvesUser) {
      stats.assists += 1;
    }

    return {
      minute: planned.minute,
      type: planned.type,
      side: planned.side,
      teamId: this.teamId(planned.side),
      playerId: planned.playerId,
      playerName: planned.playerName,
      description: planned.description,
      isUserInvolved: planned.involvesUser,
    };
  }

  /** Volumen de pases estimado para un número de minutos jugados. */
  private estimatePassVolume(minutes: number): number {
    const user = this.options.userPlayer;
    const passRate =
      user.position === Position.Midfielder
        ? 0.92
        : user.position === Position.Defender
          ? 0.74
          : user.position === Position.Forward
            ? 0.48
            : 0.62;
    return Math.round(minutes * passRate * (0.7 + user.attributes.passing / 150));
  }

  /** Refresca si el usuario está en el campo y sus minutos acumulados. */
  private refreshWindow(): void {
    const active = this.window.end > 0 && this.minute >= this.window.start && this.minute <= this.window.end;
    if (active && !this.userOnPitch) this.userOnPitch = true;
    if (this.minute > this.window.end) this.userOnPitch = false;
    if (active) {
      this.userStats.minutes = Math.min(90, this.minute - this.window.start + 1);
      this.userStats.passes = this.estimatePassVolume(this.userStats.minutes);
    }
  }

  /** Avanza un minuto y devuelve los eventos revelados. */
  step(): MatchEvent[] {
    if (this.finished) return [];
    this.minute += 1;
    this.refreshWindow();

    const revealed: MatchEvent[] = [];

    if (this.minute === 45) {
      revealed.push({
        minute: 45,
        type: MatchEventType.HalfTime,
        side: this.userSide,
        teamId: this.teamId(this.userSide),
        playerId: null,
        playerName: '',
        description: `Descanso: ${this.options.home.team.short} ${this.homeGoals} - ${this.awayGoals} ${this.options.away.team.short}`,
        isUserInvolved: false,
      });
    }

    for (const planned of this.plan) {
      if (planned.minute === this.minute) revealed.push(this.materialize(planned));
    }

    this.events.push(...revealed);
    if (this.minute >= 90) this.finish();
    return revealed;
  }

  /** Completa estadísticas de volumen, calcula nota y cierra el partido. */
  private finish(): void {
    this.finished = true;
    const stats = this.userStats;
    const user = this.options.userPlayer;

    if (stats.minutes > 0) {
      // Pases estimados por volumen de juego: minutos × ritmo posicional.
      stats.passes = this.estimatePassVolume(stats.minutes);

      const conceded = this.userSide === 'home' ? this.awayGoals : this.homeGoals;
      stats.goalsConceded = user.position === Position.Goalkeeper ? conceded : stats.goalsConceded;
      stats.cleanSheet =
        conceded === 0 &&
        stats.minutes >= 60 &&
        (user.position === Position.Goalkeeper || user.position === Position.Defender);

      stats.rating = computeRating(user.position, stats, this.outcome());
    }
  }

  /** Resultado desde la perspectiva del usuario. */
  outcome(): MatchOutcome {
    const userGoals = this.userSide === 'home' ? this.homeGoals : this.awayGoals;
    const rivalGoals = this.userSide === 'home' ? this.awayGoals : this.homeGoals;
    if (userGoals > rivalGoals) return 'win';
    if (userGoals === rivalGoals) return 'draw';
    return 'loss';
  }

  /** Minutos jugados previstos. */
  plannedMinutes(): number {
    return this.window.end === 0 ? 0 : this.window.end - this.window.start + 1;
  }

  /** Construye el resultado final (requiere que el partido haya terminado). */
  getResult(): MatchResult {
    const stats = this.userStats;
    const played = stats.minutes > 0;
    const bestTeammate = 6.9 + this.options.rng.float(0, 1.3);

    return {
      competitionId: this.options.competitionId,
      round: this.round,
      homeId: this.homeTeamId,
      awayId: this.awayTeamId,
      homeGoals: this.homeGoals,
      awayGoals: this.awayGoals,
      events: [...this.events],
      userSide: this.userSide,
      userStats: played ? { ...stats } : null,
      userRating: played ? stats.rating : null,
      userOutcome: this.outcome(),
      userMotm: played && stats.rating >= 8.4 && stats.rating > bestTeammate,
    };
  }

  /** Simula el partido entero de golpe. */
  simulateAll(): MatchResult {
    while (!this.finished) this.step();
    return this.getResult();
  }
}

/** Miembro del usuario si está en el campo en ese minuto. */
function userOnPitchMember(
  player: Player,
  lineup: SquadMember[],
  minute: number,
  window: PlayWindow,
): SquadMember | null {
  void lineup;
  if (window.end === 0 || minute < window.start || minute > window.end) return null;
  const attributes = player.attributes;
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    number: player.number,
    ovr: player.ovr,
    pace: attributes.pace,
    shooting: attributes.shooting,
    passing: attributes.passing,
    defending: attributes.defending,
    goalkeeping: attributes.goalkeeping,
    isUser: true,
  };
}

/**
 * Elige un once de 4-4-2 por calidad y garantiza la presencia del usuario
 * cuando su rol es de titular.
 */
export function selectStartingEleven(
  squad: SquadMember[],
  userId: string | null,
  role: SquadRole,
): SquadMember[] {
  const pick = (position: Position, count: number): SquadMember[] =>
    squad
      .filter((member) => member.position === position)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, count);

  const eleven: SquadMember[] = [
    ...pick(Position.Goalkeeper, 1),
    ...pick(Position.Defender, 4),
    ...pick(Position.Midfielder, 4),
    ...pick(Position.Forward, 2),
  ];

  const remaining = squad
    .filter((member) => !eleven.includes(member))
    .sort((a, b) => b.ovr - a.ovr);
  while (eleven.length < 11 && remaining.length > 0) {
    eleven.push(remaining.shift() as SquadMember);
  }

  if (userId && role === SquadRole.Starter) {
    const user = squad.find((member) => member.id === userId);
    if (user && !eleven.some((member) => member.id === userId)) {
      let index = eleven.findIndex((member) => member.position === user.position);
      if (index < 0) {
        index = eleven.reduce(
          (weakest, member, i) => (member.position !== Position.Goalkeeper && member.ovr < eleven[weakest].ovr ? i : weakest),
          eleven.findIndex((member) => member.position !== Position.Goalkeeper),
        );
      }
      eleven[index] = user;
    }
  }

  return eleven;
}

/** Simula un partido cualquiera de forma rápida (solo marcador). */
export function simulateQuickMatch(
  home: Team,
  away: Team,
  rng: Random,
  neutral = false,
): { homeGoals: number; awayGoals: number } {
  const lambdas = matchLambdas(home, away, { neutral });
  return {
    homeGoals: samplePoisson(lambdas.home, rng),
    awayGoals: samplePoisson(lambdas.away, rng),
  };
}

/** Datos de previa para la interfaz: probabilidades y marcador más probable. */
export function previewMatch(home: Team, away: Team): {
  probabilities: { home: number; draw: number; away: number };
  likelyScore: [number, number];
  lambdas: { home: number; away: number };
} {
  const lambdas = matchLambdas(home, away);
  return {
    probabilities: outcomeProbabilities(lambdas.home, lambdas.away),
    likelyScore: mostLikelyScoreline(lambdas.home, lambdas.away),
    lambdas,
  };
}

/** Valor de mercado estimado del futbolista en millones de euros. */
export function marketValue(player: Player): number {
  const ageFactor = player.age <= 21 ? 1.35 : player.age <= 25 ? 1.15 : player.age <= 29 ? 0.9 : 0.55;
  const potentialBonus = player.age <= 24 ? (player.potential - player.ovr) * 0.12 : 0;
  const base = Math.max(0.05, (player.ovr - 42) ** 2.35 / 62);
  return round((base + potentialBonus) * ageFactor, 2);
}

/** Sueldo semanal sugerido (miles de €) según media global. */
export function suggestedWage(ovr: number): number {
  return Math.max(CONFIG.MARKET.MIN_WAGE, Math.round((ovr - 40) ** 2.1 / 42));
}
