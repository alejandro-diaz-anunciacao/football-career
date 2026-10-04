import { ROLE_LABELS } from '../../models';
import type { CareerState, SquadRole } from '../../models';
import { windowForRound } from '../../engine/calendar';
import { careerService } from '../../services/careerService';
import { formatGameDate } from '../../utils/date';
import { el } from '../dom';
import { badge } from './card';
import { closeModal, openModal } from './modal';
import { currentTheme, themeToggleMeta, toggleTheme } from '../theme';

/** Opciones de la cabecera. */
export interface HeaderOptions {
  state: CareerState | null;
  active: string;
  role: SquadRole | null;
  onNavigate: (path: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

/** Secciones mostradas en la barra inferior en móvil. */
const PRIMARY_NAV: readonly NavItem[] = [
  { id: 'dashboard', label: 'Vestuario', icon: '🏠' },
  { id: 'match', label: 'Partido', icon: '⚽' },
  { id: 'squad', label: 'Plantilla', icon: '👥' },
  { id: 'calendar', label: 'Calendario', icon: '📅' },
];

/** Resto de secciones, accesibles desde la hoja «Más». */
const MORE_NAV: readonly NavItem[] = [
  { id: 'table', label: 'Clasificación', icon: '📊' },
  { id: 'competitions', label: 'Competiciones', icon: '🏆' },
  { id: 'national', label: 'Selección', icon: '🌍' },
  { id: 'market', label: 'Mercado', icon: '💼' },
  { id: 'history', label: 'Historial', icon: '📜' },
  { id: 'saves', label: 'Partidas', icon: '💾' },
];

/** Todas las secciones, en orden de escritorio. */
const NAV_ITEMS: readonly (NavItem & { label: string })[] = [
  ...PRIMARY_NAV,
  ...MORE_NAV,
];

/** Rutas accesibles sin una carrera cargada. */
const ALWAYS_ENABLED: readonly string[] = ['saves', 'creation'];

/** Cabecera fija con identidad del jugador y navegación. */
export function renderHeader(options: HeaderOptions): HTMLElement {
  const { state, active, role, onNavigate } = options;

  const isEnabled = (id: string): boolean => Boolean(state) || ALWAYS_ENABLED.includes(id);
  const disabledTitle = (id: string): string =>
    !isEnabled(id) ? 'No hay ninguna carrera cargada' : id;

  /* --- Botón de tema ------------------------------------------------------- */
  const initialToggle = themeToggleMeta(currentTheme());
  const themeButton = el('button', {
    class: 'icon-btn',
    text: initialToggle.icon,
    title: initialToggle.label,
    attrs: { 'aria-label': initialToggle.label, type: 'button' },
    on: {
      click: (event) => {
        const meta = themeToggleMeta(toggleTheme());
        const target = event.currentTarget as HTMLButtonElement;
        target.textContent = meta.icon;
        target.title = meta.label;
        target.setAttribute('aria-label', meta.label);
      },
    },
  });

  /* --- Marca --------------------------------------------------------------- */
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

  /* --- Navegación de escritorio ------------------------------------------- */
  const desktopNav = el(
    'nav',
    { class: 'main-nav', attrs: { 'aria-label': 'Navegación principal' } },
    ...NAV_ITEMS.map((item) =>
      el('button', {
        class: `nav-link${item.id === active ? ' is-active' : ''}`,
        text: item.label,
        disabled: !isEnabled(item.id),
        title: disabledTitle(item.id),
        attrs: item.id === active ? { 'aria-current': 'page' } : {},
        on: { click: () => onNavigate(item.id) },
      }),
    ),
  );

  /* --- Meta del jugador ---------------------------------------------------- */
  const openWindow = state ? windowForRound(state.currentRound) : null;
  const badges = state
    ? [
        badge(ROLE_LABELS[state.player.role], 'accent'),
        badge(`OVR ${state.player.ovr}`, 'azure'),
        role ? badge(role, role === 'Titular' ? 'accent' : role === 'Suplente' ? 'flame' : '') : null,
        openWindow ? badge('Mercado abierto', 'gold') : null,
        careerService.isCalledUp() ? badge('Selección', 'gold') : null,
        el('span', { class: 'text-dim', text: `T${state.season} · ${formatGameDate(state.calendar)}` }),
      ]
    : [el('span', { class: 'text-dim', text: 'Sin partida activa' })];

  const meta = el(
    'div',
    { class: 'header-meta' },
    el('div', { class: 'header-meta__badges' }, ...badges),
    themeButton,
  );

  /* --- Navegación inferior (móvil) ---------------------------------------- */
  const moreButton = el('button', {
    class: `mobile-nav__item${MORE_NAV.some((item) => item.id === active) ? ' is-active' : ''}`,
    attrs: { type: 'button', 'aria-label': 'Más secciones' },
    on: { click: () => openMoreSheet(active, onNavigate) },
  });
  moreButton.append(
    el('span', { class: 'mobile-nav__icon', text: '⋯' }),
    el('span', { class: 'mobile-nav__label', text: 'Más' }),
  );

  const mobileNav = el(
    'nav',
    { class: 'mobile-nav', attrs: { 'aria-label': 'Navegación móvil' } },
    ...PRIMARY_NAV.map((item) => {
      const button = el('button', {
        class: `mobile-nav__item${item.id === active ? ' is-active' : ''}`,
        disabled: !isEnabled(item.id),
        title: disabledTitle(item.id),
        attrs: { type: 'button', ...(item.id === active ? { 'aria-current': 'page' } : {}) },
        on: { click: () => onNavigate(item.id) },
      });
      button.append(
        el('span', { class: 'mobile-nav__icon', text: item.icon }),
        el('span', { class: 'mobile-nav__label', text: item.label }),
      );
      return button;
    }),
    moreButton,
  );

  return el('header', { class: 'site-header' }, el('div', { class: 'site-header__inner' }, brand, desktopNav, meta), mobileNav);
}

/** Hoja con el resto de secciones, pensada para pantallas pequeñas. */
function openMoreSheet(active: string, onNavigate: (path: string) => void): void {
  const grid = el(
    'div',
    { class: 'more-grid' },
    ...MORE_NAV.map((item) => {
      const enabled = ALWAYS_ENABLED.includes(item.id) || Boolean(careerService.getState());
      return el(
        'button',
        {
          class: `more-sheet__item${item.id === active ? ' is-active' : ''}`,
          disabled: !enabled,
          attrs: { type: 'button' },
          on: {
            click: () => {
              if (!enabled) return;
              closeModal();
              onNavigate(item.id);
            },
          },
        },
        el('span', { class: 'more-sheet__icon', text: item.icon }),
        el('span', { class: 'more-sheet__label', text: item.label }),
      );
    }),
  );

  openModal({ title: 'Más secciones', body: [grid] });
}
