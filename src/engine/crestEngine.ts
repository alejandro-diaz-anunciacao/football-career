import { clubColors } from '../data/clubColors';
import { FLAG_EXCEPTIONS, FLAG_SPECS, type FlagEmblem, type FlagSpec } from '../data/flags';
import { hashString } from '../utils/random';

/**
 * Motor de identidad visual (puro, sin DOM).
 *
 * Genera de forma determinista los colores y las iniciales de clubes, ligas y
 * selecciones, y el marcado interno de las banderas. No participa en la
 * simulación ni consume el `rng` de la partida: usa `hashString`.
 */

/** Paleta de respaldo para clubes sin color real asignado. */
const PALETTE: readonly (readonly [string, string])[] = [
  ['#1d4ed8', '#ffffff'],
  ['#dc2626', '#ffffff'],
  ['#111827', '#f59e0b'],
  ['#047857', '#ffffff'],
  ['#7c3aed', '#fde047'],
  ['#b91c1c', '#111827'],
  ['#0e7490', '#f8fafc'],
  ['#1e3a8a', '#ef4444'],
  ['#92400e', '#fef3c7'],
  ['#334155', '#38bdf8'],
  ['#be123c', '#fde68a'],
  ['#065f46', '#a7f3d0'],
];

/** Identidad visual de un equipo o liga. */
export interface CrestIdentity {
  primary: string;
  secondary: string;
  initials: string;
}

/** Iniciales (hasta tres) de un nombre. */
export function initialsOf(value: string): string {
  const words = value
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0] + (words[2]?.[0] ?? '')).toUpperCase();
}

/** Colores de un club o liga: reales si se conocen, derivados del id si no. */
export function crestIdentity(
  seed: string,
  options: { name?: string; countryCode?: string; initialsFrom?: string } = {},
): CrestIdentity {
  const known = options.name && options.countryCode ? clubColors(options.countryCode, options.name) : undefined;
  const colors = known ?? PALETTE[hashString(seed) % PALETTE.length];
  return { primary: colors[0], secondary: colors[1], initials: initialsOf(options.initialsFrom ?? options.name ?? seed) };
}

/** Colores principales derivados de la bandera de un país. */
export function flagColors(code: string): readonly [string, string] {
  const spec = FLAG_SPECS[code];
  if (spec && spec.stripes.length > 0) {
    const primary = spec.stripes[0];
    const secondary = spec.stripes.find((color) => color !== primary) ?? '#ffffff';
    return [primary, secondary];
  }
  return PALETTE[hashString(code) % PALETTE.length];
}

/** Estrella de cinco puntas centrada en (cx, cy). */
function starPoints(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return points.join(' ');
}

/** Marcado SVG de un emblema de bandera. */
function emblemSvg(emblem: FlagEmblem, background: string): string {
  const scale = emblem.scale ?? 1;
  switch (emblem.shape) {
    case 'circle':
      return `<circle cx="30" cy="20" r="${(9 * scale).toFixed(1)}" fill="${emblem.color}"/>`;
    case 'star':
      return `<polygon points="${starPoints(30, 20, 9 * scale)}" fill="${emblem.color}"/>`;
    case 'diamond':
      return `<polygon points="30,${(20 - 10 * scale).toFixed(1)} ${(30 + 12 * scale).toFixed(1)},20 30,${(20 + 10 * scale).toFixed(1)} ${(30 - 12 * scale).toFixed(1)},20" fill="${emblem.color}"/>`;
    case 'triangle':
    case 'triangleLeft':
      return `<polygon points="0,0 ${(24 * scale).toFixed(1)},20 0,40" fill="${emblem.color}"/>`;
    case 'cross':
      return (
        `<rect x="${(30 - 4 * scale).toFixed(1)}" y="0" width="${(8 * scale).toFixed(1)}" height="40" fill="${emblem.color}"/>` +
        `<rect x="0" y="${(20 - 4 * scale).toFixed(1)}" width="60" height="${(8 * scale).toFixed(1)}" fill="${emblem.color}"/>`
      );
    case 'crescent': {
      const r = 9 * scale;
      return (
        `<circle cx="30" cy="20" r="${r.toFixed(1)}" fill="${emblem.color}"/>` +
        `<circle cx="${(30 - r * 0.55).toFixed(1)}" cy="20" r="${(r * 0.85).toFixed(1)}" fill="${background}"/>`
      );
    }
  }
}

/** Franjas de una bandera. */
function stripesSvg(spec: FlagSpec): string {
  const count = Math.max(1, spec.stripes.length);
  if (spec.layout === 'vertical') {
    const width = 60 / count;
    return spec.stripes
      .map((color, index) => `<rect x="${(index * width).toFixed(2)}" y="0" width="${width.toFixed(2)}" height="40" fill="${color}"/>`)
      .join('');
  }
  const height = 40 / count;
  return spec.stripes
    .map((color, index) => `<rect x="0" y="${(index * height).toFixed(2)}" width="60" height="${height.toFixed(2)}" fill="${color}"/>`)
    .join('');
}

/**
 * Marcado interno de una bandera (viewBox 0 0 60 40). Cubre las banderas con
 * especificación propia, las excepciones a mano y, como reserva, un estandarte
 * generado con los colores derivados del código.
 */
export function flagSvgInner(code: string): string {
  const exception = FLAG_EXCEPTIONS[code];
  if (exception) return exception;

  const spec = FLAG_SPECS[code];
  if (spec) {
    const stripes = stripesSvg(spec);
    const emblem = spec.emblem ? emblemSvg(spec.emblem, spec.stripes[0]) : '';
    return stripes + emblem;
  }

  const [primary, secondary] = PALETTE[hashString(code) % PALETTE.length];
  return (
    `<rect width="60" height="40" fill="${primary}"/>` +
    `<rect y="20" width="60" height="20" fill="${secondary}"/>` +
    `<text x="30" y="25" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,0.35)" stroke-width="2" paint-order="stroke">${initialsOf(code)}</text>`
  );
}
