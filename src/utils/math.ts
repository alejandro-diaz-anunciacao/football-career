/** Utilidades matemáticas compartidas por los motores de simulación. */

/** Restringe un valor a un intervalo. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Redondeo a un número fijo de decimales. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Interpolación lineal. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Suma de una lista. */
export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

/** Media de una lista (0 si está vacía). */
export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

/** Normaliza un conjunto de pesos a probabilidades. */
export function normalizeWeights(weights: number[]): number[] {
  const total = sum(weights);
  if (total <= 0) return weights.map(() => 1 / Math.max(1, weights.length));
  return weights.map((weight) => weight / total);
}

/** Convierte una probabilidad en cuota decimal. */
export function toDecimalOdds(probability: number): number {
  const safe = clamp(probability, 0.001, 0.999);
  return round(1 / safe, 2);
}
