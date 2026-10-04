import { formatGameDate, type GameDate } from '../../utils/date';
import { careerService, type CalendarDay } from '../../services/careerService';
import { el } from '../dom';
import { badge, card, emptyState } from '../components/card';
import { openModal } from '../components/modal';
import type { ViewContext, ViewFactory } from './types';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Etiqueta de mes y año de una fecha. */
function monthLabel(date: GameDate): string {
  return `${MONTHS[date.month - 1]} ${date.year}`;
}

/** Celda con el resultado (o el estado) de un partido. */
function resultCell(day: CalendarDay): HTMLElement {
  if (!day.played || day.userGoals === null || day.rivalGoals === null) {
    return el('span', { class: 'text-dim', text: day.isNext ? 'Próximo' : '—' });
  }
  const label = day.outcome === 'win' ? 'V' : day.outcome === 'draw' ? 'E' : 'D';
  const variant = day.outcome === 'win' ? 'accent' : day.outcome === 'draw' ? '' : 'danger';
  return el(
    'div',
    { class: 'row row--tight' },
    el('span', { class: 'mono', text: `${day.userGoals}-${day.rivalGoals}` }),
    badge(label, variant),
  );
}

/** Pide confirmación y simula en rápido hasta el partido indicado. */
function confirmSimulate(day: CalendarDay, ctx: ViewContext): void {
  openModal({
    title: `Simular hasta el ${formatGameDate(day.date)}`,
    body: [
      el('p', {
        class: 'text-muted',
        text: 'Se simularán en rápido todos tus partidos hasta esa fecha. Si ocurre un evento aleatorio, la simulación se detendrá para que decidas.',
      }),
    ],
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Simular',
        kind: 'primary',
        onClick: () => {
          careerService.simulateUntil(day.tick);
          ctx.refresh();
        },
      },
    ],
  });
}

/** Fila de un partido del calendario. */
function calendarRow(day: CalendarDay, ctx: ViewContext): HTMLElement {
  return el(
    'tr',
    { class: day.isNext ? 'is-user' : '' },
    el('td', { text: formatGameDate(day.date) }),
    el('td', { text: day.competitionName }),
    el(
      'td',
      {},
      el('span', { text: `${day.home ? 'vs' : '@'} ${day.opponentName}` }),
      el('small', { class: 'text-dim', text: ` · ${day.label}` }),
    ),
    el('td', {}, resultCell(day)),
    el(
      'td',
      { class: 'num' },
      day.played
        ? null
        : el('button', {
            class: 'btn btn--ghost btn--sm',
            text: 'Simular hasta aquí',
            on: { click: () => confirmSimulate(day, ctx) },
          }),
    ),
  );
}

/** Tarjeta de un mes con sus partidos. */
function monthCard(days: CalendarDay[], ctx: ViewContext): HTMLElement {
  return card({
    title: monthLabel(days[0].date),
    flush: true,
    body: [
      el(
        'div',
        { class: 'table-wrap' },
        el(
          'table',
          { class: 'data' },
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              el('th', { text: 'Fecha' }),
              el('th', { text: 'Competición' }),
              el('th', { text: 'Partido' }),
              el('th', { text: 'Resultado' }),
              el('th', { text: '' }),
            ),
          ),
          el('tbody', {}, ...days.map((day) => calendarRow(day, ctx))),
        ),
      ),
    ],
  });
}

/** Vista del calendario de la temporada. */
export const calendarView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const days = careerService.seasonCalendar();
  const groups = new Map<string, CalendarDay[]>();
  for (const day of days) {
    const key = `${day.date.year}-${day.date.month}`;
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: `Temporada ${state.season} · ${formatGameDate(state.calendar)}` }),
        el('h1', { text: 'Calendario' }),
        el('p', { class: 'text-muted', text: 'Todos tus partidos de la temporada. Simula hasta la fecha que quieras.' }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
    ),
    state.pendingEvent
      ? card({
          title: 'Decisión pendiente',
          body: [emptyState('Resuelve el evento aleatorio de la parte superior del vestuario para poder simular.')],
        })
      : null,
    days.length === 0
      ? card({ title: 'Calendario', body: [emptyState('No hay partidos programados.')] })
      : null,
    ...[...groups.values()].map((month) => monthCard(month, ctx)),
  );
};
