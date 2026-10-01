import type { CareerState, KnockoutTie } from '../../models';
import { careerService } from '../../services/careerService';
import { el } from '../dom';
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

/** Vista de competiciones de copa. */
export const competitionsView: ViewFactory = (ctx: ViewContext, params: Record<string, string>) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const cups = Object.values(state.competitions).sort((a, b) => a.name.localeCompare(b.name));
  if (cups.length === 0) {
    return el('div', { class: 'page' }, card({ title: 'Competiciones', body: [emptyState('No hay copas esta temporada.')] }));
  }

  const selectedId = params['comp'] ?? careerService.userCup()?.id ?? cups[0].id;
  const selected = state.competitions[selectedId] ?? cups[0];

  const selector = el(
    'select',
    {},
    ...cups.map((cup) => el('option', { value: cup.id, text: cup.name, selected: cup.id === selected.id })),
  );
  selector.addEventListener('change', () => ctx.navigate('competitions', { comp: selector.value }));

  const rounds = [...new Set(selected.ties.map((tie) => tie.round))].sort((a, b) => a - b);
  const champion = selected.championId ? state.teams[selected.championId] : null;

  const bracket = card({
    title: `${selected.name} · ${selected.season}`,
    subtitle: champion
      ? `Campeón: ${champion.name}`
      : selected.round <= selected.totalRounds
        ? `Ronda ${selected.round} de ${selected.totalRounds}`
        : '',
    accent: Boolean(champion),
    body:
      selected.ties.length === 0
        ? [emptyState('El cuadro todavía no se ha sorteado.')]
        : [
            el(
              'div',
              { class: 'bracket' },
              ...rounds.map((round) =>
                el(
                  'div',
                  { class: 'bracket-round' },
                  el('strong', { class: 'text-dim', text: `Ronda ${round}` }),
                  el('div', { class: 'stack', attrs: { style: 'gap:6px' } }, ...selected.ties.filter((tie) => tie.round === round).map((tie) => tieCard(state, tie))),
                ),
              ),
            ),
          ],
  });

  const info = card({
    title: 'Formato',
    body: [
      el('p', {
        class: 'text-muted',
        text: `Copa nacional con todos los equipos del país. Cuadro con ronda preliminar; ${
          selected.twoLeggedRounds > 0 ? 'las últimas rondas se juegan a ida y vuelta y ' : ''
        }la final es a partido único en sede neutral.`,
      }),
      champion ? badge(`🏆 ${champion.name}`, 'gold') : badge(`Equipos: ${selected.teamIds.length}`, 'azure'),
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
        el('h1', { text: 'Copas nacionales' }),
        el('p', { class: 'text-muted', text: `${cups.length} competiciones` }),
      ),
      selector,
    ),
    bracket,
    info,
  );
};
