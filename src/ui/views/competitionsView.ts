import type { CareerState, Competition, CompetitionGroup, KnockoutTie } from '../../models';
import { careerService } from '../../services/careerService';
import { el, fmt } from '../dom';
import { badge, card, emptyState } from '../components/card';
import type { ViewContext, ViewFactory } from './types';

/** Nombre corto de un equipo. */
function short(state: CareerState, id: string): string {
  return state.teams[id]?.short ?? id;
}

/** Nombre de un equipo resaltando al usuario y al vencedor. */
function teamRow(state: CareerState, id: string, tie: KnockoutTie): HTMLElement {
  const classes = ['bracket-team'];
  if (tie.winnerId === id) classes.push('is-winner');
  if (id === state.teamId) classes.push('is-user');
  return el('span', { class: classes.join(' '), text: short(state, id) });
}

/** Tarjeta de una eliminatoria con sus piernas. */
function tieCard(state: CareerState, tie: KnockoutTie): HTMLElement {
  return el(
    'div',
    { class: 'bracket-tie' },
    el(
      'div',
      { class: 'row row--between' },
      teamRow(state, tie.homeId, tie),
      teamRow(state, tie.awayId, tie),
    ),
    el(
      'div',
      { class: 'stack', attrs: { style: 'gap:2px' } },
      ...tie.legs.map((leg, index) =>
        el('span', {
          class: 'text-dim',
          text: `${index + 1}ª: ${short(state, leg.homeId)} ${leg.homeGoals ?? '-'}-${leg.awayGoals ?? '-'} ${short(state, leg.awayId)}`,
        }),
      ),
    ),
  );
}

/** Tabla de un grupo. */
function groupTable(state: CareerState, group: CompetitionGroup): HTMLElement {
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
        el(
          'thead',
          {},
          el(
            'tr',
            {},
            el('th', { class: 'num', text: '#' }),
            el('th', { text: 'Equipo' }),
            el('th', { class: 'num', text: 'PJ' }),
            el('th', { class: 'num', text: 'DG' }),
            el('th', { class: 'num', text: 'Pts' }),
          ),
        ),
        el(
          'tbody',
          {},
          ...rows.map((row, index) =>
            el(
              'tr',
              { class: row.teamId === state.teamId ? 'is-user' : '' },
              el('td', { class: 'num', text: String(index + 1) }),
              el('td', { text: state.teams[row.teamId]?.name ?? row.teamId }),
              el('td', { class: 'num', text: fmt(row.played) }),
              el('td', { class: 'num', text: fmt(row.goalsFor - row.goalsAgainst) }),
              el('td', { class: 'num', text: fmt(row.points) }),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Cuadro eliminatorio de una competición. */
function bracket(state: CareerState, competition: Competition): HTMLElement {
  const rounds = [...new Set(competition.ties.map((tie) => tie.round))].sort((a, b) => a - b);
  return el(
    'div',
    { class: 'bracket' },
    ...rounds.map((round) =>
      el(
        'div',
        { class: 'bracket-round' },
        el('strong', { class: 'text-dim', text: `Ronda ${round}` }),
        el(
          'div',
          { class: 'stack', attrs: { style: 'gap:6px' } },
          ...competition.ties.filter((tie) => tie.round === round).map((tie) => tieCard(state, tie)),
        ),
      ),
    ),
  );
}

/** Vista de competiciones (copas y continentales). */
export const competitionsView: ViewFactory = (ctx: ViewContext, params: Record<string, string>) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const competitions = Object.values(state.competitions).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'continental' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (competitions.length === 0) {
    return el('div', { class: 'page' }, card({ title: 'Competiciones', body: [emptyState('No hay competiciones esta temporada.')] }));
  }

  const selectedId = params['comp'] ?? careerService.userCup()?.id ?? competitions[0].id;
  const selected = state.competitions[selectedId] ?? competitions[0];
  const champion = selected.championId ? state.teams[selected.championId] : null;

  const selector = el(
    'select',
    {},
    ...competitions.map((competition) =>
      el('option', {
        value: competition.id,
        text: `${competition.kind === 'continental' ? '🌍 ' : '🏆 '}${competition.name}`,
        selected: competition.id === selected.id,
      }),
    ),
  );
  selector.addEventListener('change', () => ctx.navigate('competitions', { comp: selector.value }));

  const inGroups =
    (selected.format === 'groups' && selected.stage === 'groups') ||
    (selected.format === 'league' && selected.stage === 'league');
  const body: HTMLElement[] = [];

  if (inGroups && selected.groups) {
    const multiple = selected.groups.length > 1;
    body.push(
      card({
        title: selected.format === 'league' ? 'Fase de liga' : 'Fase de grupos',
        subtitle: `Jornada ${selected.round} de ${selected.groupRounds ?? 0}`,
        body: [
          multiple
            ? el('div', { class: 'grid grid--2' }, ...selected.groups.map((group) => groupTable(state, group)))
            : groupTable(state, selected.groups[0]),
        ],
      }),
    );
  }

  if (selected.ties.length > 0) {
    body.push(
      card({
        title: 'Fase eliminatoria',
        subtitle: champion ? `Campeón: ${champion.name}` : '',
        accent: Boolean(champion),
        body: [bracket(state, selected)],
      }),
    );
  }

  if (body.length === 0) {
    body.push(card({ body: [emptyState('La competición todavía no ha comenzado.')] }));
  }

  const info = card({
    title: 'Formato',
    body: [
      el('p', {
        class: 'text-muted',
        text:
          selected.kind === 'continental'
            ? `Competición continental con ${selected.teamIds.length} equipos.${
                selected.stage === 'qualifying'
                  ? ' Fase de clasificación en curso.'
                  : inGroups
                    ? selected.format === 'league'
                      ? ' Fase de liga y eliminatorias.'
                      : ' Fase de grupos y eliminatorias.'
                    : ' Eliminatorias.'
              }`
            : `Copa nacional con todos los equipos del país. Cuadro con ronda preliminar; la final es a partido único en sede neutral.`,
      }),
      champion
        ? badge(`🏆 ${champion.name}`, 'gold')
        : badge(`Equipos: ${selected.teamIds.length}`, 'azure'),
    ],
  });

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: 'Competiciones' }),
        el('h1', { text: 'Copas y continentales' }),
        el('p', { class: 'text-muted', text: `${competitions.length} competiciones` }),
      ),
      selector,
    ),
    ...body,
    info,
  );
};
