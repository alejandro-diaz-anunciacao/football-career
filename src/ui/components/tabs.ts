import { el } from '../dom';

/** Elemento de una barra de pestañas. */
export interface TabItem {
  id: string;
  label: string;
}

/** Barra de pestañas controlada externamente. */
export function tabs(items: TabItem[], activeId: string, onSelect: (id: string) => void): HTMLElement {
  return el(
    'div',
    { class: 'tabs' },
    ...items.map((item) =>
      el('button', {
        class: `tab${item.id === activeId ? ' is-active' : ''}`,
        text: item.label,
        on: { click: () => onSelect(item.id) },
      }),
    ),
  );
}

/** Selector segmentado de opciones. */
export function segmented(
  options: { id: string; label: string }[],
  activeId: string,
  onSelect: (id: string) => void,
): HTMLElement {
  return el(
    'div',
    { class: 'tactic-picker' },
    ...options.map((option) =>
      el('button', {
        class: `btn btn--sm${option.id === activeId ? ' btn--primary' : ' btn--ghost'}`,
        text: option.label,
        on: { click: () => onSelect(option.id) },
      }),
    ),
  );
}
