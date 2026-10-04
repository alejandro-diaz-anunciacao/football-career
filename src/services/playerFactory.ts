import { CONFIG } from '../data/config';
import { findCountry } from '../data/continents';
import { randomName } from './nameService';
import { clamp, round } from '../utils/math';
import { ATTRIBUTE_KEYS, Foot, PlayerRole, Position, emptySeasonStats, ovrFromAttributes, roleGroup } from '../models';
import type { Attributes, Player } from '../models';
import type { Random } from '../utils/random';
import { deterministicId } from './idService';
import { DEFAULT_FOCUS, planSeasonGrowth } from '../engine/progressionEngine';

/** Datos introducidos por el usuario en la pantalla de creación. */
export interface PlayerCreationInput {
  firstName: string;
  lastName: string;
  countryCode: string;
  /** Grupo posicional (se deriva de `role` si hace falta). */
  position: Position;
  /** Subposición específica elegida por el jugador. */
  role: PlayerRole;
  number: number;
  foot: Foot;
}

/** Perfil base de atributos por grupo posicional respecto a la media global. */
const GROUP_PROFILE: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  [Position.Goalkeeper]: { goalkeeping: 8, physical: 2, pace: -6, passing: -4, dribbling: -8, defending: -3, shooting: -22 },
  [Position.Defender]: { defending: 8, physical: 5, pace: 0, passing: -3, dribbling: -5, shooting: -10, goalkeeping: -30 },
  [Position.Midfielder]: { passing: 7, dribbling: 4, defending: -1, physical: -1, pace: 1, shooting: 1, goalkeeping: -30 },
  [Position.Forward]: { shooting: 8, pace: 6, dribbling: 5, physical: -2, passing: -2, defending: -12, goalkeeping: -30 },
};

/** Ajuste de perfil por subposición sobre la base de su grupo. */
const ROLE_PROFILE_ADJUST: Partial<Record<PlayerRole, Partial<Record<keyof Attributes, number>>>> = {
  [PlayerRole.CentreBack]: { pace: -3, passing: -1, dribbling: -2, defending: 2, physical: 2, shooting: -2 },
  [PlayerRole.LeftBack]: { pace: 3, dribbling: 1, defending: -1, physical: -1, shooting: -1 },
  [PlayerRole.RightBack]: { pace: 3, dribbling: 1, defending: -1, physical: -1, shooting: -1 },
  [PlayerRole.LeftWingBack]: { pace: 5, dribbling: 2, passing: 1, defending: -2, physical: -2, shooting: -2 },
  [PlayerRole.RightWingBack]: { pace: 5, dribbling: 2, passing: 1, defending: -2, physical: -2, shooting: -2 },
  [PlayerRole.DefensiveMidfielder]: { defending: 4, physical: 2, passing: 1, shooting: -3, dribbling: -2 },
  [PlayerRole.AttackingMidfielder]: { passing: 2, shooting: 3, dribbling: 2, defending: -4, physical: -1 },
  [PlayerRole.LeftMidfielder]: { pace: 2, dribbling: 1, passing: 1, defending: -2, shooting: -2 },
  [PlayerRole.RightMidfielder]: { pace: 2, dribbling: 1, passing: 1, defending: -2, shooting: -2 },
  [PlayerRole.Striker]: { shooting: 4, physical: 1, passing: -2, defending: -2 },
  [PlayerRole.FalseNine]: { passing: 3, dribbling: 2, shooting: -1, physical: -3 },
  [PlayerRole.LeftWinger]: { pace: 5, dribbling: 4, passing: 1, shooting: -2, defending: -3 },
  [PlayerRole.RightWinger]: { pace: 5, dribbling: 4, passing: 1, shooting: -2, defending: -3 },
};

/** Perfil de atributos de una subposición: base del grupo + ajuste del rol. */
function roleProfile(role: PlayerRole): Partial<Record<keyof Attributes, number>> {
  const profile: Partial<Record<keyof Attributes, number>> = { ...GROUP_PROFILE[roleGroup(role)] };
  for (const [key, delta] of Object.entries(ROLE_PROFILE_ADJUST[role] ?? {}) as [keyof Attributes, number][]) {
    profile[key] = (profile[key] ?? 0) + delta;
  }
  return profile;
}

/** Genera atributos cuya media ponderada se aproxima al OVR objetivo. */
export function generateAttributes(role: PlayerRole, targetOvr: number, rng: Random): Attributes {
  const group = roleGroup(role);
  const profile = roleProfile(role);
  const attributes = {} as Attributes;

  for (const key of ATTRIBUTE_KEYS) {
    const offset = profile[key] ?? 0;
    const noise = rng.gauss(0, 3.4);
    const lowerBound = key === 'goalkeeping' && group !== Position.Goalkeeper ? 8 : 22;
    attributes[key] = clamp(round(targetOvr + offset + noise), lowerBound, 78);
  }

  // Ajuste fino: sube o baja atributos hasta clavar el OVR objetivo.
  let guard = 0;
  let current = ovrFromAttributes(role, attributes);
  while (current !== targetOvr && guard < 400) {
    guard += 1;
    const direction = current < targetOvr ? 1 : -1;
    const weights = ATTRIBUTE_KEYS.filter((key) => {
      const value = attributes[key];
      if (direction > 0) return value < 78 && (key !== 'goalkeeping' || group === Position.Goalkeeper);
      return value > 20;
    }).map((key) => ({ value: key, weight: 1 + (profile[key] ?? 0) * 0.1 }));
    if (weights.length === 0) break;
    const chosen = rng.weighted(weights);
    attributes[chosen] = clamp(attributes[chosen] + direction, 20, 78);
    current = ovrFromAttributes(role, attributes);
  }

  return attributes;
}

/** Crea la entidad completa del futbolista del usuario. */
export function createPlayer(input: PlayerCreationInput, rng: Random): Player {
  const country = findCountry(input.countryCode);
  const targetOvr = rng.int(CONFIG.OVR_MIN, CONFIG.OVR_MAX);
  const potential = rng.int(
    Math.max(targetOvr + 14, CONFIG.POTENTIAL_MIN),
    CONFIG.POTENTIAL_MAX,
  );
  const attributes = generateAttributes(input.role, targetOvr, rng);
  const firstName = input.firstName.trim() || randomName(input.countryCode, rng).firstName;
  const lastName = input.lastName.trim() || randomName(input.countryCode, rng).lastName;

  const player: Player = {
    id: deterministicId('player', `${firstName}.${lastName}.${input.countryCode}`),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    age: CONFIG.START_AGE,
    nationality: country?.nationality ?? 'Desconocida',
    countryCode: input.countryCode,
    position: input.position,
    role: input.role,
    number: clamp(Math.round(input.number), 1, 99),
    foot: input.foot,
    attributes,
    ovr: ovrFromAttributes(input.role, attributes),
    potential,
    form: 0,
    morale: clamp(rng.int(58, 76), 0, 100),
    fitness: clamp(rng.int(88, 100), 0, 100),
    injuryWeeks: 0,
    trainingFocus: DEFAULT_FOCUS[input.role],
    seasonGrowth: { startOvr: 0, targetPoints: 0, appliedPoints: 0, deltas: {} },
    lastGrowth: null,
    seasonStats: emptySeasonStats(),
    careerStats: emptySeasonStats(),
    nationalStats: emptySeasonStats(),
    contract: {
      teamId: '',
      wage: CONFIG.MARKET.MIN_WAGE,
      years: 3,
      signedSeason: 1,
      releaseClause: 0,
    },
    loan: null,
    rolePenalty: null,
    callUp: null,
    firstTeamTrust: 50,
  };

  // Plan de desarrollo del primer curso.
  player.seasonGrowth = planSeasonGrowth(player, rng);
  return player;
}
