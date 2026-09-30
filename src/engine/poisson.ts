import { CONFIG } from '../data/config';
import { clamp } from '../utils/math';
import type { RandomSource } from '../utils/random';

/**
 * Motor estadístico basado en la distribución de Poisson.
 * Modela los goles de un equipo como un proceso de Poisson cuyo parámetro
 * (lambda) se deriva de la relación de fuerzas entre ataque y defensa.
 */

/** Muestrea un entero de Poisson con el algoritmo de Knuth. */
export function samplePoisson(lambda: number, rng: RandomSource): number {
  const safeLambda = clamp(lambda, 0, 12);
  if (safeLambda <= 0) return 0;
  const limit = Math.exp(-safeLambda);
  let k = 0;
  let product = 1;
  do {
    k += 1;
    product *= rng.next();
  } while (product > limit && k < 20);
  return k - 1;
}

/** Función de masa de probabilidad de Poisson. */
export function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return (Math.exp(-lambda) * lambda ** k) / factorial;
}

/**
 * Goles esperados de un ataque contra una defensa concreta.
 * Usa la ratio suavizada (evita divisiones explosivas en valores bajos) y un
 * exponente que controla cuánto premia la superioridad.
 */
export function expectedGoals(attack: number, defense: number, factor: number): number {
  const ratio = (attack + 20) / (defense + 20);
  const base = CONFIG.MATCH.BASE_EXPECTED_GOALS * ratio ** CONFIG.MATCH.STRENGTH_EXPONENT;
  return clamp(base * factor, CONFIG.MATCH.MIN_LAMBDA, CONFIG.MATCH.MAX_LAMBDA);
}

/**
 * Ajusta el ataque propio según el dominio del mediocampo.
 * Un centro del campo superior incrementa la producción ofensiva y reduce la
 * del rival, reflejando el control territorial.
 */
export function midfieldAdjustment(ownMidfield: number, rivalMidfield: number): number {
  const ratio = (ownMidfield + 15) / (rivalMidfield + 15);
  return clamp(ratio ** (CONFIG.MATCH.MIDFIELD_WEIGHT - 1), 0.7, 1.4);
}

/** Lambdas de ambos equipos para un enfrentamiento concreto. */
export function matchLambdas(
  home: { attack: number; midfield: number; defense: number },
  away: { attack: number; midfield: number; defense: number },
  options: {
    homeAttackFactor?: number;
    awayAttackFactor?: number;
    homeDefenseFactor?: number;
    awayDefenseFactor?: number;
  } = {},
): { home: number; away: number } {
  const homeMid = midfieldAdjustment(home.midfield, away.midfield);
  const awayMid = midfieldAdjustment(away.midfield, home.midfield);

  const homeAttack = home.attack * homeMid * (options.homeAttackFactor ?? 1);
  const awayAttack = away.attack * awayMid * (options.awayAttackFactor ?? 1);
  const homeDefense = home.defense * (options.homeDefenseFactor ?? 1);
  const awayDefense = away.defense * (options.awayDefenseFactor ?? 1);

  return {
    home: expectedGoals(homeAttack, awayDefense, CONFIG.MATCH.HOME_FACTOR),
    away: expectedGoals(awayAttack, homeDefense, CONFIG.MATCH.AWAY_FACTOR),
  };
}

/** Probabilidad de cada signo (1, X, 2) por simulación Monte Carlo. */
export function outcomeProbabilities(
  lambdaHome: number,
  lambdaAway: number,
): { home: number; draw: number; away: number } {
  // Cálculo analítico mediante convolución de las funciones de masa truncadas.
  const maxGoals = 8;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away || 1;
  return { home: home / total, draw: draw / total, away: away / total };
}

/** Marcador más probable según la matriz de Poisson. */
export function mostLikelyScoreline(lambdaHome: number, lambdaAway: number): [number, number] {
  let best: [number, number] = [0, 0];
  let bestProbability = -1;
  for (let h = 0; h <= 6; h += 1) {
    for (let a = 0; a <= 6; a += 1) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      if (p > bestProbability) {
        bestProbability = p;
        best = [h, a];
      }
    }
  }
  return best;
}
