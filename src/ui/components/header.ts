import type { CareerState, SquadRole } from '../../models';
import { windowForRound } from '../../engine/calendar';
import { formatGameDate } from '../../utils/date';
import { el } from '../dom';
import { badge } from './card';

/** Opciones de la cabecera. */
export interface HeaderOptions {
  state: CareerState | null;
  active: string;
  role: SquadRole | null;
  onNavigate: (path: string) => void;
}

/** Ítems de navegación principal. */
const NAV_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Vestuario' },
  { id: 'match', label: 'Partido' },
  { id: 'table', label: 'Clasificación' },
  { id: 'competitions', label: 'Competiciones' },
  { id: 'market', label: 'Mercado' },
  { id: 'history', label: 'Historial' },
  { id: 'saves', label: 'Partidas' },
];

/** Rutas accesibles sin una carrera cargada. */
const ALWAYS_ENABLED: readonly string[] = ['saves', 'creation'];

/** Cabecera fija con identidad del jugador y navegación. */
export function renderHeader(options: HeaderOptions): HTMLElement {
  const { state, active, role, onNavigate } = options;

  const brand = el(
    'div',
    { class: 'brand' },
    el('div', { class: 'brand__mark', text: '⚽' }),
    el(
      'div',
      { class: 'brand__text' },
      el('span', { class: 'brand__title', text: 'Footballer Sim' }),
      el('span', { class: 'brand__subtitle', text: 'Carrera de leyenda' }),
    ),
  );

  const nav = el(
    'nav',
    { class: 'main-nav' },
    ...NAV_ITEMS.map((item) =>
      el('button', {
        class: `nav-link${item.id === active ? ' is-active' : ''}`,
        text: item.label,
        disabled: !state && !ALWAYS_ENABLED.includes(item.id),
        title: !state && !ALWAYS_ENABLED.includes(item.id) ? 'No hay ninguna carrera cargada' : item.label,
        on: { click: () => onNavigate(item.id) },
      }),
    ),
  );

  const openWindow = state ? windowForRound(state.currentRound) : null;

  const meta = el(
    'div',
    { class: 'header-meta' },
    state
      ? el(
          'div',
          { class: 'row row--tight' },
          badge(`${state.player.position}`, 'accent'),
          badge(`OVR ${state.player.ovr}`, 'azure'),
          role ? badge(role, role === 'Titular' ? 'accent' : role === 'Suplente' ? 'flame' : '') : null,
          openWindow ? badge('Mercado abierto', 'gold') : null,
          el('span', { class: 'text-dim', text: `T${state.season} · ${formatGameDate(state.calendar)}` }),
        )
      : el('span', { class: 'text-dim', text: 'Sin partida activa' }),
  );

  return el(
    'header',
    { class: 'site-header' },
    el('div', { class: 'site-header__inner' }, brand, nav, meta),
  );
}
