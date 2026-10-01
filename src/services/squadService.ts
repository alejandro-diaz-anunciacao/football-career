import { clamp, round } from '../utils/math';
import { Position } from '../models';
import type { Player, SquadMember, Team } from '../models';
import { randomName } from './nameService';
import { Random, hashString } from './randomService';

/** Hueco de plantilla: posición y dorsal. */
interface Slot {
  position: Position;
  number: number;
}

/** Reparto de dorsales de una plantilla de 22 (3 POR · 7 DEF · 7 MED · 5 DEL). */
const SQUAD_SLOTS: readonly Slot[] = [
  { position: Position.Goalkeeper, number: 1 },
  { position: Position.Goalkeeper, number: 13 },
  { position: Position.Goalkeeper, number: 25 },
  { position: Position.Defender, number: 2 },
  { position: Position.Defender, number: 3 },
  { position: Position.Defender, number: 4 },
  { position: Position.Defender, number: 5 },
  { position: Position.Defender, number: 12 },
  { position: Position.Defender, number: 15 },
  { position: Position.Defender, number: 22 },
  { position: Position.Midfielder, number: 6 },
  { position: Position.Midfielder, number: 8 },
  { position: Position.Midfielder, number: 10 },
  { position: Position.Midfielder, number: 14 },
  { position: Position.Midfielder, number: 16 },
  { position: Position.Midfielder, number: 18 },
  { position: Position.Midfielder, number: 20 },
  { position: Position.Forward, number: 7 },
  { position: Position.Forward, number: 9 },
  { position: Position.Forward, number: 11 },
  { position: Position.Forward, number: 17 },
  { position: Position.Forward, number: 19 },
];

/** Desplazamientos por posición respecto a la media global del jugador. */
const ATTRIBUTE_SHAPE: Record<Position, Record<'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'goalkeeping', number>> = {
  [Position.Goalkeeper]: { pace: -18, shooting: -38, passing: -12, dribbling: -18, defending: -10, goalkeeping: 5 },
  [Position.Defender]: { pace: -3, shooting: -16, passing: -7, dribbling: -10, defending: 7, goalkeeping: -45 },
  [Position.Midfielder]: { pace: -2, shooting: -6, passing: 6, dribbling: 4, defending: -3, goalkeeping: -45 },
  [Position.Forward]: { pace: 4, shooting: 7, passing: -5, dribbling: 5, defending: -18, goalkeeping: -45 },
};

/** Caché de plantillas: se regeneran de forma determinista a partir del id del club. */
const squadCache = new Map<string, SquadMember[]>();

/** Genera los atributos derivados de la media global y la posición. */
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
    const shape = ATTRIBUTE_SHAPE[slot.position];
    const identity = randomName(team.countryCode, rng);
    return {
      id: `p.${team.id}.${slot.number}`,
      name: identity.full,
      position: slot.position,
      number: slot.number,
      ovr,
      pace: shapedAttribute(ovr, shape.pace, rng),
      shooting: shapedAttribute(ovr, shape.shooting, rng),
      passing: shapedAttribute(ovr, shape.passing, rng),
      defending: shapedAttribute(ovr, shape.defending, rng),
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
 * Devuelve la plantilla de un equipo. Si se pasa el jugador del usuario y este
 * pertenece al club, se inyecta en la lista (sustituyendo al jugador de su
 * posición con menor media para mantener el tamaño realista).
 */
export function getSquad(team: Team, user?: Player): SquadMember[] {
  let base = squadCache.get(team.id);
  if (!base) {
    base = buildSquad(team);
    squadCache.set(team.id, base);
  }

  if (!user || user.contract.teamId !== team.id) return base;

  const member = userToSquadMember(user);
  const samePositionIndex = base.reduce(
    (weakest, current, index) =>
      current.position === user.position && current.ovr < base[weakest].ovr ? index : weakest,
    base.findIndex((entry) => entry.position === user.position),
  );

  const result = [...base];
  if (samePositionIndex >= 0) {
    result[samePositionIndex] = member;
  } else {
    result.push(member);
  }
  return result;
}

/**
 * Plantilla de una selección. Genera una base determinista a partir del id y,
 * si el jugador es convocado, lo inyecta en su posición.
 */
export function getNationalSquad(team: Team, user?: Player): SquadMember[] {
  let base = squadCache.get(team.id);
  if (!base) {
    base = buildSquad(team);
    squadCache.set(team.id, base);
  }

  if (!user) return base;

  const member = userToSquadMember(user);
  const samePositionIndex = base.reduce(
    (weakest, current, index) =>
      current.position === user.position && current.ovr < base[weakest].ovr ? index : weakest,
    base.findIndex((entry) => entry.position === user.position),
  );

  const result = [...base];
  if (samePositionIndex >= 0) result[samePositionIndex] = member;
  else result.push(member);
  return result;
}

/** Limpia la caché de plantillas (al iniciar una carrera nueva). */
export function clearSquadCache(): void {
  squadCache.clear();
}
