import { namePoolFor } from '../data/names';
import type { Random } from '../utils/random';

/** Genera un nombre completo coherente con el país indicado. */
export function randomName(countryCode: string, rng: Random): { firstName: string; lastName: string; full: string } {
  const pool = namePoolFor(countryCode);
  const firstName = rng.pick(pool.firstNames);
  const lastName = rng.pick(pool.lastNames);
  return { firstName, lastName, full: `${firstName} ${lastName}` };
}

/** Nombre corto para listados que no caben (inicial + apellido). */
export function shortPlayerName(full: string, extraInitial = false): string {
  const parts = full.split(' ').filter(Boolean);
  if (parts.length < 2) return full;
  const lastName = parts.slice(1).join(' ');
  return extraInitial ? `${parts[0][0]}. ${lastName}` : lastName;
}
