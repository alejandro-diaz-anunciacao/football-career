/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Su estado es un único entero de 32 bits, lo que permite persistirlo en el
 * guardado y reconstruir exactamente la misma partida.
 */

/** Interfaz mínima que consumen los motores de simulación. */
export interface RandomSource {
  next(): number;
}

/** Generador determinista con utilidades de muestreo. */
export class Random implements RandomSource {
  private internalState: number;

  constructor(seed = Date.now()) {
    this.internalState = seed >>> 0 || 0x9e3779b9;
  }

  /** Estado serializable. */
  get state(): number {
    return this.internalState;
  }

  set state(value: number) {
    this.internalState = value >>> 0 || 0x9e3779b9;
  }

  /** Siguiente número uniforme en [0, 1). */
  next(): number {
    this.internalState = (this.internalState + 0x6d2b79f5) >>> 0;
    let t = this.internalState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniforme en [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entero uniforme en [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Verdadero con probabilidad `probability`. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Elemento aleatorio de una lista no vacía. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** n elementos distintos (o todos si n >= longitud). */
  pickMany<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)));
  }

  /** Selección ponderada; los pesos negativos se tratan como cero. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const positives = entries.map((entry) => ({ value: entry.value, weight: Math.max(0, entry.weight) }));
    const total = positives.reduce((acc, entry) => acc + entry.weight, 0);
    if (total <= 0) return positives[Math.floor(this.next() * positives.length)].value;
    let threshold = this.next() * total;
    for (const entry of positives) {
      threshold -= entry.weight;
      if (threshold <= 0) return entry.value;
    }
    return positives[positives.length - 1].value;
  }

  /** Copia barajada (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /** Distribución normal (Box-Muller). */
  gauss(mean = 0, standardDeviation = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + value * standardDeviation;
  }
}

/** Semilla aleatoria a partir de la hora actual. */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

/** Hash estable de cadena a entero sin signo (FNV-1a). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
