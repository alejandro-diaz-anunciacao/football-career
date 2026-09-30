import { hashString } from '../utils/random';

let counter = 0;

/** Identificador único y legible, con prefijo semántico. */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** Identificador determinista a partir de una clave (mismos datos → mismo id). */
export function deterministicId(prefix: string, key: string): string {
  return `${prefix}_${hashString(key).toString(36)}`;
}
