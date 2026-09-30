import { averageRating } from '../../models';
import { careerService } from '../../services/careerService';
import { el, fmt, fmtMoney, fmtWage } from '../dom';
import { badge, card, emptyState, kv } from '../components/card';
import type { ViewContext, ViewFactory } from './types';

/** Vista de historial de carrera y palmarés. */
export const historyView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const player = state.player;
  const career = player.careerStats;
  const careerAvg = averageRating(career);

  const totals = card({
    title: 'Totales de carrera',
    subtitle: `Comparado con ${state.history.length} temporada(s) registradas`,
    body: [
      el(
        'div',
        { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap' } },
        kv('Partidos', fmt(career.appearances)),
        kv('Titularidades', fmt(career.starts)),
        kv('Minutos', fmt(career.minutes)),
        kv('Goles', fmt(career.goals)),
        kv('Asistencias', fmt(career.assists)),
        kv('Nota media', careerAvg > 0 ? careerAvg.toFixed(2) : '—'),
        kv('MVP', fmt(career.motm)),
        kv('Porterías a cero', fmt(career.cleanSheets)),
        kv('Amarillas', fmt(career.yellowCards)),
        kv('Rojas', fmt(career.redCards)),
      ),
    ],
  });

  const contract = card({
    title: 'Situación contractual',
    body: [
      el(
        'div',
        { class: 'row row--between' },
        el(
          'div',
          { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap' } },
          kv('Club', careerService.currentTeam()?.name ?? '—'),
          kv('Salario', fmtWage(player.contract.wage)),
          kv('Años restantes', String(player.contract.years)),
          kv('Cláusula', fmtMoney(player.contract.releaseClause)),
          kv('Valor de mercado', fmtMoney(careerService.playerValue())),
        ),
        el('button', {
          class: 'btn',
          text: 'Ver mercado',
          on: { click: () => ctx.navigate('market') },
        }),
      ),
    ],
  });

  const trophyCard = card({
    title: '🏆 Palmarés',
    body:
      state.trophies.length === 0
        ? [emptyState('Todavía no has ganado ningún trofeo. La leyenda está por escribir.')]
        : [
            el(
              'div',
              { class: 'trophy-list' },
              ...state.trophies
                .slice()
                .reverse()
                .map((trophy) =>
                  el(
                    'div',
                    { class: 'trophy-item' },
                    el('span', { class: 'trophy-item__icon', text: trophy.kind === 'individual' ? '🥇' : '🏆' }),
                    el(
                      'div',
                      { class: 'stack', attrs: { style: 'gap:2px' } },
                      el('strong', { text: trophy.name }),
                      el('span', { class: 'text-dim', text: `${trophy.teamName} · Temporada ${trophy.season}` }),
                    ),
                  ),
                ),
            ),
          ],
  });

  const timeline = card({
    title: 'Temporada a temporada',
    body:
      state.history.length === 0
        ? [emptyState('Completa tu primera temporada para ver el historial.')]
        : [
            el(
              'div',
              { class: 'timeline' },
              ...state.history
                .slice()
                .reverse()
                .map((season) =>
                  el(
                    'div',
                    { class: 'timeline__row' },
                    el('span', { class: 'timeline__season', text: `T${season.season}` }),
                    el(
                      'div',
                      { class: 'stack', attrs: { style: 'gap:4px' } },
                      el(
                        'div',
                        { class: 'row row--tight' },
                        el('strong', { text: season.teamName }),
                        badge(`${season.position}º ${season.leagueName}`, season.position === 1 ? 'gold' : ''),
                        badge(`${season.ovr} OVR`, 'azure'),
                        badge(`${season.age} años`, ''),
                      ),
                      el('span', {
                        class: 'text-dim',
                        text: `${season.appearances} PJ · ${season.goals} G · ${season.assists} A · ${season.cleanSheets} porterías a cero · nota ${season.avgRating.toFixed(2)}`,
                      }),
                      season.trophies.length > 0
                        ? el(
                            'div',
                            { class: 'row row--tight' },
                            ...season.trophies.map((name) => badge(`🏆 ${name}`, 'gold')),
                          )
                        : null,
                    ),
                    el('span', { class: 'text-dim', text: `${season.minutes} min` }),
                  ),
                ),
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
        el('span', { class: 'page-head__eyebrow', text: 'Legado' }),
        el('h1', { text: `Carrera de ${player.name}` }),
        el('p', { class: 'text-muted', text: `${player.age} años · ${player.position} · ${player.nationality}` }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
    ),
    totals,
    contract,
    trophyCard,
    timeline,
  );
};
