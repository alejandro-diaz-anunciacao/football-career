import { CONFIG } from '../data/config';
import { clamp } from '../utils/math';
import { Position, SquadRole } from '../models';
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
function estimatedPositionLevel(team: Team, position: Position): number {
  return position === Position.Forward ? team.overall - 1.4 : team.overall + 1.6;
}

/** Nivel del mejor compañero de la posición en una plantilla real. */
function squadPositionLevel(player: Player, squad: SquadMember[]): number {
  const rivals = squad
    .filter((member) => !member.isUser && member.id !== player.id && member.position === player.position)
    .sort((a, b) => b.ovr - a.ovr);
  return rivals[0]?.ovr ?? player.ovr;
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
    squad && squad.length > 0 ? squadPositionLevel(player, squad) : estimatedPositionLevel(team, player.position);
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
