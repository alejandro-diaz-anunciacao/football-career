import { ratingTone } from '../../engine/ratingEngine';
import { el, fmt } from '../dom';

/** Barra de progreso etiquetada. */
export function statBar(label: string, value: number, max = 99, tone: '' | 'azure' | 'flame' | 'gold' = ''): HTMLElement {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return el(
    'div',
    { class: 'stat-line' },
    el('span', { class: 'text-muted', text: label }),
    el(
      'div',
      { class: 'bar' },
      el('div', { class: `bar__fill${tone ? ` bar__fill--${tone}` : ''}`, attrs: { style: `width:${percent}%` } }),
    ),
    el('span', { class: 'stat-line__value', text: fmt(value) }),
  );
}

/** Chip coloreado con una calificación. */
export function ratingChip(rating: number): HTMLElement {
  const tone = ratingTone(rating);
  const text = rating > 0 ? fmt(rating, 1) : '—';
  return el('span', { class: `rating-chip rating-chip--${tone}`, text });
}

/** Insignia grande con la media global. */
export function ovrBadge(ovr: number, tone: 'accent' | 'azure' = 'accent'): HTMLElement {
  return el('div', { class: `ovr-badge${tone === 'azure' ? ' ovr-badge--azure' : ''}`, text: String(ovr) });
}

/** Píldora de acción con icono. */
export function iconBadge(icon: string, text: string, variant = ''): HTMLElement {
  return el('span', { class: `badge${variant ? ` badge--${variant}` : ''}` }, `${icon} ${text}`);
}
