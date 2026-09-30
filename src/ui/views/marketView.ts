import { marketValue, suggestedWage } from '../../engine/matchEngine';
import { interestedTeams } from '../../engine/marketEngine';
import { careerService } from '../../services/careerService';
import { el, fmt, fmtMoney, fmtWage } from '../dom';
import { badge, card, emptyState, kv } from '../components/card';
import type { ViewContext, ViewFactory } from './types';

/** Vista del mercado de fichajes. */
export const marketView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const player = state.player;
  const value = marketValue(player);
  const currentTeam = careerService.currentTeam();

  const offersCard = card({
    title: '💼 Ofertas recibidas',
    subtitle: state.offers.length > 0 ? 'Aceptar una oferta te traspasa de inmediato' : 'Sin ofertas por ahora',
    accent: state.offers.length > 0,
    body:
      state.offers.length === 0
        ? [
            emptyState(
              'Ningún club ha presentado una oferta. Sigue rindiendo y las propuestas llegarán al final de temporada.',
            ),
          ]
        : [
            el(
              'div',
              { class: 'grid grid--2' },
              ...state.offers.map((offer) =>
                el(
                  'article',
                  { class: 'offer-card' },
                  el(
                    'div',
                    { class: 'row row--between' },
                    el(
                      'div',
                      { class: 'stack', attrs: { style: 'gap:2px' } },
                      el('strong', { text: offer.teamName }),
                      el('span', { class: 'text-dim', text: `${offer.leagueName} · ${offer.tier}ª categoría · ${offer.continent}` }),
                    ),
                    badge(`${offer.years} años`, 'azure'),
                  ),
                  el(
                    'div',
                    { class: 'offer-card__terms' },
                    kv('Salario', fmtWage(offer.wage)),
                    kv('Prima', fmtMoney(offer.fee)),
                    kv('Diferencia OVR', `${state.teams[offer.teamId]?.overall ?? '—'}`),
                  ),
                  el('p', { class: 'text-muted', text: offer.pitch }),
                  el(
                    'div',
                    { class: 'row row--tight offer-card__actions' },
                    el('button', {
                      class: 'btn btn--primary btn--sm',
                      text: '✔ Aceptar',
                      on: {
                        click: () => {
                          careerService.acceptOffer(offer.id);
                          ctx.refresh();
                        },
                      },
                    }),
                    el('button', {
                      class: 'btn btn--ghost btn--sm',
                      text: 'Descartar',
                      on: {
                        click: () => {
                          state.offers = state.offers.filter((item) => item.id !== offer.id);
                          careerService.save();
                          ctx.refresh();
                        },
                      },
                    }),
                  ),
                ),
              ),
            ),
            el(
              'div',
              { class: 'row' },
              el('button', {
                class: 'btn btn--danger btn--sm',
                text: 'Rechazar todas',
                on: {
                  click: () => {
                    careerService.rejectOffers();
                    ctx.refresh();
                  },
                },
              }),
            ),
          ],
  });

  const interested = interestedTeams(state.teams, player).slice(0, 8);

  const interestCard = card({
    title: '🔎 Clubes atentos a tu progreso',
    subtitle: 'Equipos cuyo nivel encaja con tu media actual',
    body:
      interested.length === 0
        ? [emptyState('Ningún club sigue tu pista todavía.')]
        : [
            el(
              'div',
              { class: 'table-wrap' },
              el(
                'table',
                { class: 'data' },
                el('thead', {}, el('tr', {}, el('th', { text: 'Club' }), el('th', { text: 'Liga' }), el('th', { class: 'num', text: 'OVR' }), el('th', { class: 'num', text: 'Prestigio' }))),
                el(
                  'tbody',
                  {},
                  ...interested.map((team) =>
                    el(
                      'tr',
                      {},
                      el('td', { text: team.name }),
                      el('td', { text: state.leagues[team.leagueId]?.name ?? '—' }),
                      el('td', { class: 'num', text: String(team.overall) }),
                      el('td', { class: 'num', text: String(team.reputation) }),
                    ),
                  ),
                ),
              ),
            ),
          ],
  });

  const infoCard = card({
    title: 'Tu valoración',
    body: [
      el(
        'div',
        { class: 'row row--between' },
        el(
          'div',
          { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap' } },
          kv('Valor de mercado', fmtMoney(value)),
          kv('Salario sugerido', fmtWage(suggestedWage(player.ovr))),
          kv('Salario actual', fmtWage(player.contract.wage)),
          kv('Club actual', currentTeam?.name ?? '—'),
          kv('OVR', String(player.ovr)),
          kv('Edad', `${player.age} años`),
        ),
        el('button', { class: 'btn btn--ghost', text: 'Ver historial', on: { click: () => ctx.navigate('history') } }),
      ),
      el('p', {
        class: 'text-dim',
        text: 'El interés de los clubes depende de tu media global, tu potencial oculto, la categoría en la que juegas y la edad.',
      }),
      el(
        'div',
        { class: 'row row--tight' },
        badge(`Potencial ${player.potential >= 90 ? 'mundial' : player.potential >= 85 ? 'alto' : 'notable'}`, 'gold'),
        badge(`Forma ${player.form >= 0 ? '+' : ''}${fmt(player.form, 2)}`, player.form >= 0 ? 'accent' : 'danger'),
        badge(`Moral ${fmt(player.morale)}`, 'azure'),
      ),
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
        el('span', { class: 'page-head__eyebrow', text: 'Mercado de fichajes' }),
        el('h1', { text: 'Ventana de transferencias' }),
        el('p', { class: 'text-muted', text: `Temporada ${state.season} · ${state.offers.length} oferta(s) activas` }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
    ),
    offersCard,
    infoCard,
    interestCard,
  );
};
