import { CONFIG } from '../data/config';
import { clamp } from '../utils/math';
import { PlayerRole, Position, SquadRole, roleGroup } from '../models';
import type { Player, SquadMember, Team } from '../models';

/**
 * Motor del rol en la plantilla.
 *
 * Decide si el futbolista es titular, entra en la rotación o no cuenta, y
 * estima los minutos. Es la única fuente de verdad del rol: la usa tanto el
 * `careerService` (con la plantilla real) como el mercado (estimando a partir
 * de la media del club).
 */

/** Rol y minutos estimados de un futbolista en un club. */
export interface RoleProjection {
  role: SquadRole;
  /** Minutos estimados por partido (0-90). */
  minutes: number;
}

/** Confianza extra que el cuerpo técnico concede a una promesa joven. */
function promiseBonus(player: Player): number {
  if (player.age > CONFIG.SQUAD.PROMISE_MAX_AGE) return 0;
  const room = Math.max(0, player.potential - player.ovr);
  return Math.min(CONFIG.SQUAD.PROMISE_CAP, room * CONFIG.SQUAD.PROMISE_WEIGHT);
}

/**
 * Nivel del mejor rival de la posición estimado a partir del club.
 * El generador de plantillas da un plus a los titulares teóricos (porteros y
 * defensas, sobre todo); los delanteros de referencia quedan algo por debajo.
 */
/** Corrección del nivel de referencia según la subposición (ataque = más fácil). */
const ROLE_LEVEL_DELTA: Partial<Record<PlayerRole, number>> = {
  [PlayerRole.AttackingMidfielder]: -1.4,
  [PlayerRole.LeftWinger]: -1.8,
  [PlayerRole.RightWinger]: -1.8,
  [PlayerRole.FalseNine]: -1.8,
  [PlayerRole.Striker]: -1.4,
  [PlayerRole.LeftMidfielder]: -0.8,
  [PlayerRole.RightMidfielder]: -0.8,
  [PlayerRole.LeftWingBack]: -0.4,
  [PlayerRole.RightWingBack]: -0.4,
};

/** Nivel del mejor rival de la subposición estimado a partir del club. */
function estimatedRoleLevel(team: Team, role: PlayerRole): number {
  const base = roleGroup(role) === Position.Forward ? team.overall - 1.4 : team.overall + 1.6;
  return base + (ROLE_LEVEL_DELTA[role] ?? 0);
}

/**
 * Nivel de competencia por el puesto: mezcla el mejor rival de la **misma
 * subposición** con el mejor del **grupo**, para que un extremo compita con
 * extremos pero sin ignorar a los delanteros de la línea.
 */
export function squadCompetitionLevel(player: Player, squad: SquadMember[]): number {
  const rivals = squad.filter((member) => !member.isUser && member.id !== player.id);
  const sameRole = rivals.filter((member) => member.role === player.role);
  const sameGroup = rivals.filter((member) => member.position === player.position);

  const roleBest = sameRole.length > 0 ? Math.max(...sameRole.map((member) => member.ovr)) : null;
  const groupBest = sameGroup.length > 0 ? Math.max(...sameGroup.map((member) => member.ovr)) : null;

  if (roleBest === null && groupBest === null) return player.ovr;
  if (roleBest === null) return groupBest as number;
  if (groupBest === null) return roleBest;

  const weight = CONFIG.SQUAD.SUBROLE_WEIGHT;
  return roleBest * weight + groupBest * (1 - weight);
}

/**
 * Proyecta el rol del futbolista en un club. Con plantilla real usa el mejor
 * rival real; sin ella, estima el nivel a partir de la media global del equipo.
 */
export function projectRole(player: Player, team: Team, squad?: SquadMember[]): RoleProjection {
  if (player.injuryWeeks > 0 || player.fitness < CONFIG.SQUAD.MIN_FITNESS) {
    return { role: SquadRole.NotCalled, minutes: 0 };
  }

  const level =
    squad && squad.length > 0 ? squadCompetitionLevel(player, squad) : estimatedRoleLevel(team, player.role);
  const penalty = player.rolePenalty && player.rolePenalty.matches > 0 ? player.rolePenalty.ovr : 0;
  const effective = player.ovr + player.form * 2.2 + promiseBonus(player) - penalty;

  if (effective >= level - CONFIG.SQUAD.STARTER_GAP) {
    return { role: SquadRole.Starter, minutes: 90 };
  }

  if (effective >= level - CONFIG.SQUAD.BENCH_GAP) {
    const span = Math.max(1, CONFIG.SQUAD.BENCH_GAP - CONFIG.SQUAD.STARTER_GAP);
    const closeness = clamp((effective - (level - CONFIG.SQUAD.BENCH_GAP)) / span, 0, 1);
    const spread = CONFIG.SQUAD.ROTATION_MAX_MINUTES - CONFIG.SQUAD.ROTATION_MIN_MINUTES;
    return {
      role: SquadRole.Bench,
      minutes: Math.round(CONFIG.SQUAD.ROTATION_MIN_MINUTES + closeness * spread),
    };
  }

  return { role: SquadRole.NotCalled, minutes: 0 };
}
