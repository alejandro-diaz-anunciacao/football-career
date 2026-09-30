import { Random, randomSeed, hashString, type RandomSource } from '../utils/random';

export { Random, randomSeed, hashString };
export type { RandomSource };

/**
 * Generador global de la aplicación. Su estado se persiste dentro del guardado
 * para que la simulación sea reproducible bit a bit tras recargar la página.
 */
export const rng = new Random(randomSeed());

/** Reemplaza el estado del generador global. */
export function seedGlobal(seed: number): void {
  rng.state = seed >>> 0;
}

/** Serializa el estado actual del generador. */
export function captureRngState(): number {
  return rng.state;
}
