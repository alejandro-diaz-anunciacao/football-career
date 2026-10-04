import { crestIdentity, flagColors, flagSvgInner, initialsOf } from '../../engine/crestEngine';
import { el } from '../dom';

/**
 * Componentes de identidad visual: escudos de club/liga (SVG generado con
 * colores reales cuando se conocen) y banderas de selección/país.
 */

let crestSeq = 0;

const SHIELD = 'M4 3 H36 V24 C36 33 28 39 20 42 C12 39 4 33 4 24 Z';

/** Escudo de un club (o de cualquier equipo con id y país). */
export function teamCrest(
  team: { id: string; short?: string; name?: string; countryCode?: string },
  size = 24,
): HTMLElement {
  const identity = crestIdentity(team.id, {
    name: team.name,
    countryCode: team.countryCode,
    initialsFrom: team.short ?? team.name ?? team.id,
  });
  const clip = `crest-${crestSeq++}`;
  const svg =
    `<svg viewBox="0 0 40 44" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false">` +
    `<defs><clipPath id="${clip}"><path d="${SHIELD}"/></clipPath></defs>` +
    `<path d="${SHIELD}" fill="${identity.primary}"/>` +
    `<g clip-path="url(#${clip})"><polygon points="0,44 40,2 40,44" fill="${identity.secondary}"/></g>` +
    `<rect x="4" y="3" width="32" height="5" fill="${identity.secondary}" clip-path="url(#${clip})"/>` +
    `<path d="${SHIELD}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>` +
    `<text x="20" y="30" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,0.45)" stroke-width="2" paint-order="stroke">${identity.initials}</text>` +
    `</svg>`;
  return el('span', { class: 'crest', title: team.name ?? team.short ?? '', html: svg });
}

/** Roundel de una liga, con los colores de la bandera de su país. */
export function leagueCrest(league: { id: string; name: string; countryCode: string }, size = 22): HTMLElement {
  const [primary, secondary] = flagColors(league.countryCode);
  const initials = initialsOf(league.name);
  const svg =
    `<svg viewBox="0 0 40 40" width="${size}" height="${size}" role="img" aria-hidden="true" focusable="false">` +
    `<circle cx="20" cy="20" r="18" fill="${primary}"/>` +
    `<circle cx="20" cy="20" r="14" fill="none" stroke="${secondary}" stroke-width="4"/>` +
    `<text x="20" y="25" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,0.45)" stroke-width="2" paint-order="stroke">${initials}</text>` +
    `</svg>`;
  return el('span', { class: 'crest', title: league.name, html: svg });
}

/** Escudo de club o bandera de selección (según el id `nat.*`). */
export function teamBadge(
  team: { id: string; short?: string; name?: string; countryCode?: string },
  size = 22,
): HTMLElement {
  return team.id.startsWith('nat.') ? nationFlag(team.id.slice(4), Math.round(size * 1.3)) : teamCrest(team, size);
}

/** Etiqueta con el escudo/bandera de un equipo y su nombre. */
export function crestLabel(
  team: { id: string; short?: string; name?: string; countryCode?: string } | undefined,
  fallback: string,
  size = 18,
): HTMLElement {
  if (!team) return el('span', { text: fallback });
  return el('span', { class: 'crest-label' }, teamBadge(team, size), el('span', { text: team.name ?? fallback }));
}

/** Bandera de un país o selección. */
export function nationFlag(code: string, size = 22): HTMLElement {
  const height = Math.round(size * (40 / 60));
  const svg =
    `<svg viewBox="0 0 60 40" width="${size}" height="${height}" role="img" aria-hidden="true" focusable="false">` +
    flagSvgInner(code) +
    `</svg>`;
  return el('span', { class: 'flag', title: code, html: svg });
}
