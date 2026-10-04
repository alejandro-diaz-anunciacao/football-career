import { clamp, round } from '../utils/math';
import { PlayerRole, Position, roleGroup } from '../models';
import type { Attributes, Player, SquadMember, Team } from '../models';
import { randomName } from './nameService';
import { Random, hashString } from './randomService';

/** Hueco de plantilla: subposición y dorsal. */
interface Slot {
  role: PlayerRole;
  number: number;
}

/**
 * Reparto de dorsales de una plantilla de 22 (3 POR · 7 DEF · 7 MED · 5 DEL),
 * con las 15 subposiciones representadas para que la competencia por el puesto
 * sea realista.
 */
const SQUAD_SLOTS: readonly Slot[] = [
  { role: PlayerRole.Goalkeeper, number: 1 },
  { role: PlayerRole.Goalkeeper, number: 13 },
  { role: PlayerRole.Goalkeeper, number: 25 },

  { role: PlayerRole.CentreBack, number: 4 },
  { role: PlayerRole.CentreBack, number: 5 },
  { role: PlayerRole.CentreBack, number: 3 },
  { role: PlayerRole.LeftBack, number: 2 },
  { role: PlayerRole.RightBack, number: 12 },
  { role: PlayerRole.LeftWingBack, number: 15 },
  { role: PlayerRole.RightWingBack, number: 22 },

  { role: PlayerRole.DefensiveMidfielder, number: 6 },
  { role: PlayerRole.CentralMidfielder, number: 8 },
  { role: PlayerRole.CentralMidfielder, number: 16 },
  { role: PlayerRole.CentralMidfielder, number: 20 },
  { role: PlayerRole.AttackingMidfielder, number: 10 },
  { role: PlayerRole.LeftMidfielder, number: 14 },
  { role: PlayerRole.RightMidfielder, number: 18 },

  { role: PlayerRole.Striker, number: 9 },
  { role: PlayerRole.Striker, number: 19 },
  { role: PlayerRole.FalseNine, number: 17 },
  { role: PlayerRole.LeftWinger, number: 7 },
  { role: PlayerRole.RightWinger, number: 11 },
];

/** Desplazamientos base por grupo respecto a la media global del jugador. */
type ShapeKey = keyof Pick<
  Attributes,
  'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'goalkeeping'
>;

const GROUP_SHAPE: Record<Position, Record<ShapeKey, number>> = {
  [Position.Goalkeeper]: { pace: -18, shooting: -38, passing: -12, dribbling: -18, defending: -10, physical: 2, goalkeeping: 5 },
  [Position.Defender]: { pace: -3, shooting: -16, passing: -7, dribbling: -10, defending: 7, physical: 5, goalkeeping: -45 },
  [Position.Midfielder]: { pace: -2, shooting: -6, passing: 6, dribbling: 4, defending: -3, physical: -1, goalkeeping: -45 },
  [Position.Forward]: { pace: 4, shooting: 7, passing: -5, dribbling: 5, defending: -18, physical: -2, goalkeeping: -45 },
};

/** Ajuste de atributos por subposición sobre la base de su grupo. */
const ROLE_SHAPE_ADJUST: Partial<Record<PlayerRole, Partial<Record<ShapeKey, number>>>> = {
  [PlayerRole.CentreBack]: { pace: -3, passing: -1, dribbling: -2, defending: 2, physical: 2, shooting: -2 },
  [PlayerRole.LeftBack]: { pace: 3, dribbling: 1, passing: 1, defending: -1 },
  [PlayerRole.RightBack]: { pace: 3, dribbling: 1, passing: 1, defending: -1 },
  [PlayerRole.LeftWingBack]: { pace: 5, dribbling: 2, passing: 2, defending: -3 },
  [PlayerRole.RightWingBack]: { pace: 5, dribbling: 2, passing: 2, defending: -3 },
  [PlayerRole.DefensiveMidfielder]: { defending: 5, passing: 1, physical: 2, shooting: -3, dribbling: -2 },
  [PlayerRole.AttackingMidfielder]: { passing: 2, shooting: 3, dribbling: 2, defending: -4, physical: -1 },
  [PlayerRole.LeftMidfielder]: { pace: 3, passing: 1, dribbling: 1, defending: -2, shooting: -1 },
  [PlayerRole.RightMidfielder]: { pace: 3, passing: 1, dribbling: 1, defending: -2, shooting: -1 },
  [PlayerRole.Striker]: { shooting: 4, pace: 1, passing: -2, defending: -2, physical: 1 },
  [PlayerRole.FalseNine]: { passing: 3, dribbling: 2, shooting: -1, physical: -2 },
  [PlayerRole.LeftWinger]: { pace: 5, dribbling: 4, passing: 1, shooting: -2, defending: -3, physical: -1 },
  [PlayerRole.RightWinger]: { pace: 5, dribbling: 4, passing: 1, shooting: -2, defending: -3, physical: -1 },
};

/** Atributos base de una subposición: del grupo + ajuste del rol. */
function roleShape(role: PlayerRole): Record<ShapeKey, number> {
  const shape = { ...GROUP_SHAPE[roleGroup(role)] };
  for (const [key, delta] of Object.entries(ROLE_SHAPE_ADJUST[role] ?? {}) as [ShapeKey, number][]) {
    shape[key] += delta;
  }
  return shape;
}

/** Caché de plantillas: se regeneran de forma determinista a partir del id del club. */
const squadCache = new Map<string, SquadMember[]>();

/** Genera los atributos derivados de la media global y la subposición. */
function shapedAttribute(base: number, offset: number, rng: Random): number {
  return clamp(round(base + offset + rng.gauss(0, 4.5)), 18, 95);
}

/** Construye la plantilla base de un club (sin el usuario). */
function buildSquad(team: Team): SquadMember[] {
  const rng = new Random(hashString(`squad:${team.id}`));
  return SQUAD_SLOTS.map((slot, index) => {
    // Los once primeros teóricos son algo mejores que los suplentes.
    const starterBonus = index < 11 ? 1.6 : -1.4;
    const ovr = clamp(round(team.overall + starterBonus + rng.gauss(0, 3.1)), 36, 92);
    const shape = roleShape(slot.role);
    const identity = randomName(team.countryCode, rng);
    return {
      id: `p.${team.id}.${slot.number}`,
      name: identity.full,
      position: roleGroup(slot.role),
      role: slot.role,
      number: slot.number,
      ovr,
      pace: shapedAttribute(ovr, shape.pace, rng),
      shooting: shapedAttribute(ovr, shape.shooting, rng),
      passing: shapedAttribute(ovr, shape.passing, rng),
      dribbling: shapedAttribute(ovr, shape.dribbling, rng),
      defending: shapedAttribute(ovr, shape.defending, rng),
      physical: shapedAttribute(ovr, shape.physical, rng),
      goalkeeping: shapedAttribute(ovr, shape.goalkeeping, rng),
      isUser: false,
    } satisfies SquadMember;
  });
}

/** Convierte el futbolista del usuario en un integrante de plantilla. */
export function userToSquadMember(player: Player): SquadMember {
  const attributes = player.attributes;
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    role: player.role,
    number: player.number,
    ovr: player.ovr,
    pace: attributes.pace,
    shooting: attributes.shooting,
    passing: attributes.passing,
    dribbling: attributes.dribbling,
    defending: attributes.defending,
    physical: attributes.physical,
    goalkeeping: attributes.goalkeeping,
    isUser: true,
  };
}

/**
 * Índice del compañero al que sustituye el usuario al entrar en la plantilla.
 * Se prioriza el más flojo de su misma subposición; si no hay, uno de su grupo.
 */
function replacementIndex(base: SquadMember[], player: Player): number {
  const weakestOf = (entries: { member: SquadMember; index: number }[]): number =>
    entries.reduce((weakest, entry) => (entry.member.ovr < weakest.member.ovr ? entry : weakest)).index;

  const sameRole = base.map((member, index) => ({ member, index })).filter((entry) => entry.member.role === player.role);
  if (sameRole.length > 0) return weakestOf(sameRole);

  const sameGroup = base
    .map((member, index) => ({ member, index }))
    .filter((entry) => entry.member.position === player.position);
  if (sameGroup.length > 0) return weakestOf(sameGroup);

  return -1;
}

/**
 * Devuelve la plantilla de un equipo. Si se pasa el jugador del usuario y este
 * pertenece al club, se inyecta en la lista (sustituyendo al jugador de su
 * subposición con menor media, o al de su grupo) para mantener el tamaño.
 */
export function getSquad(team: Team, user?: Player, force = false): SquadMember[] {
  let base = squadCache.get(team.id);
  if (!base) {
    base = buildSquad(team);
    squadCache.set(team.id, base);
  }

  // `force` permite inyectar al jugador aunque su contrato sea de otro club
  // (convocatorias con el primer equipo).
  if (!user || (!force && user.contract.teamId !== team.id)) return base;

  const member = userToSquadMember(user);
  const index = replacementIndex(base, user);
  const result = [...base];
  if (index >= 0) result[index] = member;
  else result.push(member);
  return result;
}

/**
 * Plantilla de una selección. Genera una base determinista a partir del id y,
 * si el jugador es convocado, lo inyecta en su subposición o grupo.
 */
export function getNationalSquad(team: Team, user?: Player): SquadMember[] {
  let base = squadCache.get(team.id);
  if (!base) {
    base = buildSquad(team);
    squadCache.set(team.id, base);
  }

  if (!user) return base;

  const member = userToSquadMember(user);
  const index = replacementIndex(base, user);
  const result = [...base];
  if (index >= 0) result[index] = member;
  else result.push(member);
  return result;
}

/** Limpia la caché de plantillas (al iniciar una carrera nueva). */
export function clearSquadCache(): void {
  squadCache.clear();
}
