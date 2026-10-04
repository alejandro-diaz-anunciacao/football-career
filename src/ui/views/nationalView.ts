import { ROLE_LABELS } from '../../models';
import type { Competition, CompetitionGroup } from '../../models';
import { nationById } from '../../data/nations';
import { careerService } from '../../services/careerService';
import { el, fmt } from '../dom';
import { badge, card, emptyState, kv } from '../components/card';
import { nationFlag } from '../components/crest';
import type { ViewContext, ViewFactory } from './types';

/** Nombre de una selección. */
function nationName(id: string): string {
  return nationById(id)?.name ?? id;
}

/** Tabla de un grupo o liguilla. */
function groupTable(group: CompetitionGroup, nationId: string): HTMLElement {
  const rows = careerService.standingsOfCompetitionGroup(group);
  return el(
    'div',
    { class: 'stack', attrs: { style: 'gap:4px' } },
    el('strong', { class: 'text-dim', text: `Grupo ${group.id}` }),
    el(
      'div',
      { class: 'table-wrap' },
      el(
        'table',
        { class: 'data' },
        el('thead', {}, el('tr', {}, el('th', { class: 'num', text: '#' }), el('th', { text: 'Selección' }), el('th', { class: 'num', text: 'PJ' }), el('th', { class: 'num', text: 'Pts' }))),
        el(
          'tbody',
          {},
          ...rows.map((row, index) =>
            el(
              'tr',
              { class: row.teamId === nationId ? 'is-user' : '' },
              el('td', { class: 'num', text: String(index + 1) }),
              el('td', { text: nationName(row.teamId) }),
              el('td', { class: 'num', text: fmt(row.played) }),
              el('td', { class: 'num', text: fmt(row.points) }),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Tarjeta de una competición de selecciones. */
function competitionCard(competition: Competition, nationId: string): HTMLElement {
  const champion = competition.championId ? nationName(competition.championId) : null;
  const body: HTMLElement[] = [];

  if (competition.groups && competition.groups.length > 0) {
    body.push(
      el(
        'div',
        { class: 'grid grid--2' },
        ...competition.groups.map((group) => groupTable(group, nationId)),
      ),
    );
  } else if (competition.ties.length > 0) {
    const userTies = competition.ties.filter((tie) => tie.homeId === nationId || tie.awayId === nationId);
    body.push(
      el(
        'div',
        { class: 'stack', attrs: { style: 'gap:4px' } },
        ...userTies.slice(-3).map((tie) =>
          el('span', {
            class: 'text-dim',
            text: `${nationName(tie.homeId)} vs ${nationName(tie.awayId)}`,
          }),
        ),
      ),
    );
  } else {
    body.push(emptyState('Sin datos todavía.'));
  }

  return card({
    title: competition.name,
    subtitle: champion ? `Campeón: ${champion}` : `Ronda ${competition.round}`,
    accent: Boolean(champion),
    body,
  });
}

/** Vista de la selección nacional del jugador. */
export const nationalView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const nation = careerService.userNation();
  if (!nation) {
    return el('div', { class: 'page' }, card({ title: 'Selección', body: [emptyState('No hay selección disponible.')] }));
  }

  const called = careerService.isCalledUp();
  const role = careerService.nationalRole();
  const player = state.player;
  const national = player.nationalStats;
  const avg = national.ratingCount > 0 ? national.ratingSum / national.ratingCount : 0;

  const header = card({
    title: nation.name,
    subtitle: `${nation.confederation} · fuerza ${nation.strength}`,
    accent: called,
    actions: [nationFlag(nation.code, 34)],
    body: [
      el(
        'div',
        { class: 'row row--tight' },
        called ? badge('Convocado', 'accent') : badge('No convocado', ''),
        called ? badge(role, role === 'Titular' ? 'accent' : role === 'Suplente' ? 'flame' : '') : null,
      ),
      el('p', {
        class: 'text-muted',
        text: called
          ? 'El seleccionador cuenta contigo para la próxima convocatoria.'
          : 'Todavía no entras en los planes de tu selección: sube media, forma y minutos.',
      }),
    ],
  });

  const stats = card({
    title: 'Con la selección',
    body: [
      el(
        'div',
        { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap' } },
        kv('Internacionalidades', fmt(national.appearances)),
        kv('Titularidades', fmt(national.starts)),
        kv('Minutos', fmt(national.minutes)),
        kv('Goles', fmt(national.goals)),
        kv('Asistencias', fmt(national.assists)),
        kv('Nota media', avg > 0 ? avg.toFixed(2) : '—'),
        kv('MVP', fmt(national.motm)),
      ),
    ],
  });

  const competitions = Object.values(state.nationalCompetitions);
  const cards = competitions.map((competition) => competitionCard(competition, nation.id));

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: 'Selección nacional' }),
        el('h1', { text: `${player.name} · ${nation.name}` }),
        el('p', { class: 'text-muted', text: `${player.age} años · ${ROLE_LABELS[player.role]} · ${player.ovr} OVR` }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
    ),
    header,
    stats,
    ...(cards.length > 0 ? cards : [card({ title: 'Calendario internacional', body: [emptyState('Sin competiciones internacionales esta temporada.')] })]),
  );
};
