import { el, type Child } from '../dom';

/** Opciones de una tarjeta. */
export interface CardOptions {
  title?: string;
  subtitle?: string;
  actions?: Child[];
  body: Child[] | Child;
  /** Sin relleno interior (útil para tablas). */
  flush?: boolean;
  accent?: boolean;
  class?: string;
}

/** Tarjeta contenedora con cabecera opcional. */
export function card(options: CardOptions): HTMLElement {
  const children: Child[] = [];

  if (options.title || options.actions) {
    children.push(
      el(
        'div',
        { class: 'card__head' },
        el(
          'div',
          { class: 'stack', attrs: { style: 'gap:2px' } },
          el('h3', { class: 'card__title', text: options.title ?? '' }),
          options.subtitle ? el('span', { class: 'text-dim', text: options.subtitle }) : null,
        ),
        options.actions ? el('div', { class: 'row row--tight' }, ...options.actions) : null,
      ),
    );
  }

  const bodyChildren = Array.isArray(options.body) ? options.body : [options.body];
  children.push(el('div', { class: 'card__body' }, ...bodyChildren));

  const classes = ['card'];
  if (options.flush) classes.push('card--flush');
  if (options.accent) classes.push('card--accent');
  if (options.class) classes.push(options.class);

  return el('section', { class: classes.join(' ') }, ...children);
}

/** Sección de datos clave/valor. */
export function kv(label: string, value: Child): HTMLElement {
  return el('div', { class: 'kv' }, el('span', { class: 'kv__label', text: label }), el('span', { class: 'kv__value' }, value));
}

/** Insignia simple. */
export function badge(text: string, variant = ''): HTMLElement {
  return el('span', { class: `badge${variant ? ` badge--${variant}` : ''}`, text });
}

/** Estado vacío con mensaje. */
export function emptyState(message: string): HTMLElement {
  return el('div', { class: 'empty', text: message });
}
