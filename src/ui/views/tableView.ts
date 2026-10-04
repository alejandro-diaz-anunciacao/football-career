import { CONTINENTS, COUNTRIES } from '../../data/continents';
import type { League, StandingRow, Team } from '../../models';
import { careerService } from '../../services/careerService';
import { el, fmt } from '../dom';
import { card, emptyState } from '../components/card';
import { crestLabel, leagueCrest } from '../components/crest';
import type { ViewContext, ViewFactory } from './types';

/** Determina la zona de clasificación de una fila. */
function zoneClass(league: League, index: number, total: number): string {
  if (league.promotionSlots > 0 && index < league.promotionSlots) return 'zone-promotion';
  if (league.promotionSlots > 0 && index < league.promotionSlots + 2) return 'zone-playoff';
  if (league.relegationSlots > 0 && index >= total - league.relegationSlots) return 'zone-relegation';
  return '';
}

/** Tabla de clasificación de una liga. */
function standingsTable(league: League, userId: string, teamFor: (id: string) => Team | undefined): HTMLElement {
  const rows = careerService.standingsOf(league.id);
  if (rows.length === 0) return emptyState('La liga todavía no ha comenzado.');

  return el(
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
          el('th', { class: 'num', text: 'G' }),
          el('th', { class: 'num', text: 'E' }),
          el('th', { class: 'num', text: 'P' }),
          el('th', { class: 'num', text: 'GF' }),
          el('th', { class: 'num', text: 'GC' }),
          el('th', { class: 'num', text: 'DG' }),
          el('th', { class: 'num', text: 'Pts' }),
        ),
      ),
      el(
        'tbody',
        {},
        ...rows.map((row: StandingRow, index: number) => {
          const isUser = row.teamId === userId;
          return el(
            'tr',
            { class: `${zoneClass(league, index, rows.length)}${isUser ? ' is-user' : ''}` },
            el('td', { class: 'num', text: String(index + 1) }),
            el('td', {}, crestLabel(teamFor(row.teamId), row.teamId)),
            el('td', { class: 'num', text: fmt(row.played) }),
            el('td', { class: 'num', text: fmt(row.won) }),
            el('td', { class: 'num', text: fmt(row.drawn) }),
            el('td', { class: 'num', text: fmt(row.lost) }),
            el('td', { class: 'num', text: fmt(row.goalsFor) }),
            el('td', { class: 'num', text: fmt(row.goalsAgainst) }),
            el('td', { class: 'num', text: fmt(row.goalsFor - row.goalsAgainst) }),
            el('td', { class: 'num', text: fmt(row.points) }),
          );
        }),
      ),
    ),
  );
}

/** Vista de clasificaciones. */
export const tableView: ViewFactory = (ctx: ViewContext, params: Record<string, string>) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const userLeague = careerService.currentLeague();
  const selectedId = params['league'] ?? userLeague?.id ?? Object.keys(state.leagues)[0] ?? '';
  const selected = state.leagues[selectedId];

  if (!selected) {
    return el('div', { class: 'page' }, card({ title: 'Liga no encontrada', body: [emptyState('Selecciona otra competición.')] }));
  }

  const teamFor = (id: string): Team | undefined => state.teams[id];

  /* --- Selector agrupado por continente y país --------------------------- */
  const options: HTMLElement[] = [];
  for (const continent of CONTINENTS) {
    const countries = COUNTRIES.filter((country) => country.continent === continent.id);
    const optgroup = el('optgroup', { attrs: { label: `${continent.icon} ${continent.name}` } });
    for (const country of countries) {
      const leagues = Object.values(state.leagues)
        .filter((league) => league.countryCode === country.code)
        .sort((a, b) => a.tier - b.tier);
      for (const league of leagues) {
        optgroup.appendChild(
          el('option', { value: league.id, text: `${country.name} · ${league.name} (${league.tier}ª)`, selected: league.id === selectedId }),
        );
      }
    }
    options.push(optgroup);
  }

  const selector = el('select', {}, ...options);
  selector.value = selectedId;
  selector.addEventListener('change', () => {
    ctx.navigate('table', { league: selector.value });
  });

  const quickTabs = userLeague
    ? [
        el('div', { class: 'row row--tight' },
          ...Object.values(state.leagues)
            .filter((league) => league.countryCode === userLeague.countryCode)
            .sort((a, b) => a.tier - b.tier)
            .map((league) =>
              el('button', {
                class: `btn btn--sm${league.id === selectedId ? ' btn--primary' : ' btn--ghost'}`,
                text: `${league.tier}ª`,
                title: league.name,
                on: { click: () => ctx.navigate('table', { league: league.id }) },
              }),
            ),
        ),
      ]
    : [];

  const legend = el(
    'div',
    { class: 'zone-legend' },
    selected.promotionSlots > 0
      ? el('span', {}, el('span', { class: 'zone-dot zone-dot--promotion' }), `Ascenso (${selected.promotionSlots})`)
      : null,
    selected.promotionSlots > 0 ? el('span', {}, el('span', { class: 'zone-dot zone-dot--playoff' }), 'Playoff') : null,
    selected.relegationSlots > 0
      ? el('span', {}, el('span', { class: 'zone-dot zone-dot--relegation' }), `Descenso (${selected.relegationSlots})`)
      : null,
  );

  const lastPlayed = Math.max(1, state.currentRound - 1);
  const roundFixtures = selected.fixtures.filter((fixture) => fixture.round === lastPlayed);

  const roundCard =
    roundFixtures.length > 0
      ? card({
          title: `Jornada ${lastPlayed} · resultados`,
          body: [
            el(
              'div',
              { class: 'stack' },
              ...roundFixtures.map((fixture) =>
                el(
                  'div',
                  { class: 'row row--between' },
                  el('span', { attrs: { style: 'flex:1' } }, crestLabel(teamFor(fixture.homeId), fixture.homeId)),
                  el('span', {
                    class: 'mono badge',
                    text: `${fixture.homeGoals ?? 0} - ${fixture.awayGoals ?? 0}`,
                  }),
                  el('span', { attrs: { style: 'flex:1;text-align:right;justify-content:flex-end' } }, crestLabel(teamFor(fixture.awayId), fixture.awayId)),
                ),
              ),
            ),
          ],
        })
      : null;

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: `${selected.country} · ${selected.tier}ª categoría` }),
        el('div', { class: 'crest-label' }, leagueCrest(selected, 28), el('h1', { text: selected.name })),
        el('p', { class: 'text-muted', text: `${selected.teamIds.length} equipos · ${selected.totalRounds} jornadas` }),
      ),
      el('div', { class: 'row row--tight' }, ...quickTabs, selector),
    ),
    legend,
    card({ title: 'Clasificación', body: [standingsTable(selected, state.teamId, teamFor)] }),
    roundCard,
  );
};
