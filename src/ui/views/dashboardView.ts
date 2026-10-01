import { findCountry } from '../../data/continents';
import { CONFIG } from '../../data/config';
import {
  ATTRIBUTE_LABELS,
  MessageKind,
  TacticalApproach,
  averageRating,
  potentialHint,
  seasonGrowthProgress,
} from '../../models';
import type { AttributeKey, CareerState, MatchResult, Team } from '../../models';
import { previewMatch } from '../../engine/matchEngine';
import { careerService } from '../../services/careerService';
import { formatGameDate } from '../../utils/date';
import { el, fmt, fmtMoney, fmtRelativeTime, fmtWage } from '../dom';
import { card, badge, emptyState, kv } from '../components/card';
import { ovrBadge, ratingChip, statBar } from '../components/statBar';
import { alertModal, openModal } from '../components/modal';
import { notify } from '../../services/eventBus';
import type { ViewContext, ViewFactory } from './types';

/** Iconos por tipo de mensaje. */
const MESSAGE_ICONS: Record<MessageKind, string> = {
  [MessageKind.Info]: '📰',
  [MessageKind.Offer]: '💼',
  [MessageKind.Trophy]: '🏆',
  [MessageKind.Injury]: '🚑',
  [MessageKind.Squad]: '📋',
  [MessageKind.Media]: '📊',
  [MessageKind.Transfer]: '✍️',
};

/** Ficha resumida del próximo partido con probabilidades. */
function nextMatchCard(state: CareerState, ctx: ViewContext): HTMLElement {
  const team = careerService.currentTeam();
  const rival = careerService.nextOpponent();
  const fixture = careerService.nextFixture();
  const league = careerService.currentLeague();

  if (!team || !rival || !fixture || !league) {
    return card({
      title: 'Sin partido programado',
      body: [emptyState('No hay encuentros pendientes en esta jornada.')],
    });
  }

  const isHome = fixture.homeId === team.id;
  const preview = previewMatch(
    state.teams[fixture.homeId] ?? team,
    state.teams[fixture.awayId] ?? rival,
  );

  const userProbability = isHome ? preview.probabilities.home : preview.probabilities.away;
  const drawProbability = preview.probabilities.draw;
  const rivalProbability = isHome ? preview.probabilities.away : preview.probabilities.home;

  const playButton = el('button', {
    class: 'btn btn--primary',
    text: '▶ Jugar en directo',
    on: { click: () => ctx.navigate('match') },
  });

  const quickButton = el('button', {
    class: 'btn',
    text: '⚡ Simular rápido',
    on: {
      click: () => {
        const result = careerService.simulateUserMatchQuick(TacticalApproach.Balanced);
        if (!result) {
          notify('No hay partido que simular', 'warning');
          return;
        }
        openModal({
          title: 'Resultado de la jornada',
          body: [resultSummary(result, state)],
          actions: [{ label: 'Continuar', kind: 'primary', onClick: () => ctx.refresh() }],
        });
      },
    },
  });

  return card({
    title: `Jornada ${state.currentRound} · ${league.name}`,
    subtitle: `${isHome ? 'Juegas en casa' : 'Juegas a domicilio'} · ${formatGameDate(state.calendar)}`,
    accent: true,
    body: [
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'next-match' },
          el(
            'div',
            { class: 'next-match__team' },
            el('span', { class: 'next-match__name', text: isHome ? team.name : rival.name }),
            el('span', { class: 'text-dim', text: `OVR ${(isHome ? team : rival).overall}` }),
          ),
          el('span', { class: 'next-match__vs', text: 'vs' }),
          el(
            'div',
            { class: 'next-match__team next-match__team--away' },
            el('span', { class: 'next-match__name', text: isHome ? rival.name : team.name }),
            el('span', { class: 'text-dim', text: `OVR ${(isHome ? rival : team).overall}` }),
          ),
        ),
        el(
          'div',
          { class: 'stack' },
          statBar('Victoria', Math.round(userProbability * 100), 100, ''),
          statBar('Empate', Math.round(drawProbability * 100), 100, 'azure'),
          statBar('Derrota', Math.round(rivalProbability * 100), 100, 'flame'),
        ),
        el(
          'div',
          { class: 'row row--between' },
          el('span', { class: 'text-dim', text: `Marcador más probable: ${preview.likelyScore[0]}-${preview.likelyScore[1]}` }),
          el('div', { class: 'row row--tight' }, playButton, quickButton),
        ),
      ),
    ],
  });
}

/** Resumen compacto de un resultado. */
function resultSummary(result: MatchResult, state: CareerState): HTMLElement {
  const team = state.teams[state.teamId];
  const rival = state.teams[result.homeId === state.teamId ? result.awayId : result.homeId];
  const userGoals = result.userSide === 'home' ? result.homeGoals : result.awayGoals;
  const rivalGoals = result.userSide === 'home' ? result.awayGoals : result.homeGoals;
  const stats = result.userStats;

  const cells: HTMLElement[] = [
    el(
      'div',
      { class: 'match-summary__cell' },
      el('div', { class: 'match-summary__value', text: `${userGoals} - ${rivalGoals}` }),
      el('div', { class: 'text-dim', text: `${team?.short ?? 'TÚ'} vs ${rival?.short ?? 'RIV'}` }),
    ),
    el(
      'div',
      { class: 'match-summary__cell' },
      el('div', { class: 'match-summary__value' }, ratingChip(result.userRating ?? 0)),
      el('div', { class: 'text-dim', text: 'Calificación' }),
    ),
    el(
      'div',
      { class: 'match-summary__cell' },
      el('div', { class: 'match-summary__value', text: stats ? fmt(stats.minutes) : '0' }),
      el('div', { class: 'text-dim', text: 'Minutos' }),
    ),
    el(
      'div',
      { class: 'match-summary__cell' },
      el('div', { class: 'match-summary__value', text: stats ? `${stats.goals}/${stats.assists}` : '—' }),
      el('div', { class: 'text-dim', text: 'Goles/Asist.' }),
    ),
  ];

  return el(
    'div',
    { class: 'stack' },
    result.userMotm ? el('span', { class: 'badge badge--gold', text: '⭐ MVP del partido' }) : null,
    !stats ? el('p', { class: 'text-muted', text: 'No disputaste minutos en este encuentro.' }) : null,
    el('div', { class: 'match-summary' }, ...cells),
  );
}

/** Vista principal de la carrera. */
export const dashboardView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el(
      'div',
      { class: 'page' },
      card({
        title: 'Sin carrera activa',
        body: [
          emptyState('Todavía no has creado un futbolista.'),
          el('div', { class: 'row' }, el('button', { class: 'btn btn--primary', text: 'Crear carrera', on: { click: () => ctx.navigate('creation') } })),
        ],
      }),
    );
  }

  const player = state.player;
  const team = careerService.currentTeam();
  const league = careerService.currentLeague();
  const role = careerService.squadRole();
  const country = findCountry(player.countryCode);
  const seasonStats = player.seasonStats;
  const avg = averageRating(seasonStats);

  /* --- Ficha del jugador -------------------------------------------------- */
  const heroCard = card({
    body: [
      el(
        'div',
        { class: 'grid grid--2' },
        el(
          'div',
          { class: 'player-hero' },
          ovrBadge(player.ovr),
          el(
            'div',
            { class: 'player-hero__identity' },
            el('span', { class: 'player-hero__name', text: `${player.number}. ${player.name}` }),
            el('span', {
              class: 'player-hero__meta',
              text: `${player.age} años · ${player.position} · ${player.nationality} · ${player.foot}`,
            }),
            el(
              'div',
              { class: 'row row--tight' },
              badge(role, role === 'Titular' ? 'accent' : role === 'Suplente' ? 'flame' : ''),
              player.injuryWeeks > 0 ? badge(`Baja ${player.injuryWeeks} sem`, 'danger') : null,
              player.loan ? badge('Cedido', 'flame') : null,
              careerService.windowOpen() ? badge('Mercado abierto', 'gold') : null,
              badge(potentialHint(player), 'azure'),
            ),
          ),
          el(
            'div',
            { class: 'stack', attrs: { style: 'flex:1;min-width:200px' } },
            statBar('Forma', Math.round((player.form + 1) * 50), 100, 'azure'),
            statBar('Moral', Math.round(player.morale), 100, 'gold'),
            statBar('Condición', Math.round(player.fitness), 100, ''),
          ),
        ),
        el(
          'div',
          { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap;align-content:flex-start' } },
          kv('Club', team?.name ?? 'Sin equipo'),
          player.loan ? kv('Propietario', state.teams[player.loan.parentTeamId]?.name ?? '—') : null,
          kv('Categoría', league ? `${league.tier}ª · ${league.name}` : '—'),
          kv('País', country?.name ?? player.countryCode),
          kv('Salario', fmtWage(player.contract.wage)),
          kv('Contrato', `${player.contract.years} año(s)`),
          kv('Valor', fmtMoney(careerService.playerValue())),
          kv('Pos. anterior', state.previousFinish ? `${state.previousFinish}º` : '—'),
        ),
      ),
    ],
  });

  /* --- Atributos ---------------------------------------------------------- */
  const attributesCard = card({
    title: 'Atributos',
    body: [
      el(
        'div',
        { class: 'stack' },
        statBar('Ritmo', player.attributes.pace, 99, 'azure'),
        statBar('Tiro', player.attributes.shooting, 99, 'flame'),
        statBar('Pase', player.attributes.passing, 99, ''),
        statBar('Regate', player.attributes.dribbling, 99, 'azure'),
        statBar('Defensa', player.attributes.defending, 99, ''),
        statBar('Físico', player.attributes.physical, 99, 'flame'),
        statBar('Portería', player.attributes.goalkeeping, 99, 'gold'),
      ),
    ],
  });

  /* --- Desarrollo del futbolista ------------------------------------------ */
  const growth = player.seasonGrowth;
  const progress = seasonGrowthProgress(growth);
  const lastGrowth = player.lastGrowth;
  const focusOptions = careerService.developmentOptions();

  const deltas = lastGrowth
    ? (Object.entries(lastGrowth.deltas) as [AttributeKey, number][])
        .filter(([, value]) => value !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    : [];

  const developmentCard = card({
    title: 'Desarrollo',
    subtitle: `Foco actual: ${ATTRIBUTE_LABELS[player.trainingFocus]}`,
    accent: true,
    body: [
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'stack', attrs: { style: 'gap:6px' } },
          el(
            'div',
            { class: 'row row--between' },
            el('span', { class: 'text-muted', text: `Progreso de la temporada ${state.season}` }),
            el('span', {
              class: 'mono text-dim',
              text: `+${fmt(growth.appliedPoints / CONFIG.PROGRESSION.ATTRIBUTE_POINTS_PER_OVR, 1)} / +${fmt(growth.targetPoints / CONFIG.PROGRESSION.ATTRIBUTE_POINTS_PER_OVR, 1)} OVR`,
            }),
          ),
          el('div', { class: 'bar bar--tall' }, el('div', { class: 'bar__fill', attrs: { style: `width:${Math.round(progress * 100)}%` } })),
          el('span', {
            class: 'text-dim',
            text: `Media al empezar el curso: ${growth.startOvr} · actual: ${player.ovr} · atributos repartidos: ${growth.appliedPoints}`,
          }),
        ),
        el(
          'div',
          { class: 'field' },
          el('span', { class: 'field__label', text: 'Foco de entrenamiento' }),
          el(
            'div',
            { class: 'focus-picker' },
            ...focusOptions.map((key) =>
              el('button', {
                class: `focus-option${key === player.trainingFocus ? ' is-selected' : ''}`,
                text: ATTRIBUTE_LABELS[key],
                on: {
                  click: () => {
                    careerService.setTrainingFocus(key);
                    notify(`Entrenamiento enfocado en ${ATTRIBUTE_LABELS[key]}`, 'info');
                    ctx.refresh();
                  },
                },
              }),
            ),
          ),
          el('span', {
            class: 'text-dim',
            text: 'El atributo elegido recibe mucho más peso en cada avance de desarrollo.',
          }),
        ),
        lastGrowth
          ? el(
              'div',
              { class: 'stack', attrs: { style: 'gap:6px' } },
              el(
                'div',
                { class: 'row row--between' },
                el('strong', {
                  text: lastGrowth.partial ? `Último informe (parcial)` : `Informe de la temporada ${lastGrowth.season}`,
                }),
                badge(
                  `${lastGrowth.ovrDelta >= 0 ? '+' : ''}${lastGrowth.ovrDelta} OVR`,
                  lastGrowth.ovrDelta >= 0 ? 'accent' : 'danger',
                ),
              ),
              el('span', { class: 'text-muted', text: lastGrowth.narrative }),
              deltas.length > 0
                ? el(
                    'div',
                    { class: 'delta-list' },
                    ...deltas.map(([key, value]) =>
                      el('span', {
                        class: `delta-chip${value < 0 ? ' delta-chip--down' : ''}`,
                        text: `${ATTRIBUTE_LABELS[key]} ${value > 0 ? '+' : ''}${value}`,
                      }),
                    ),
                  )
                : el('span', { class: 'text-dim', text: 'Sin cambios de atributos todavía.' }),
            )
          : el('span', {
              class: 'text-dim',
              text: 'Juega partidos para empezar a generar informes de desarrollo.',
            }),
      ),
    ],
  });

  /* --- Estadísticas de temporada ----------------------------------------- */
  const statsCard = card({
    title: `Temporada ${state.season}`,
    subtitle: league ? league.name : '',
    body: [
      el(
        'div',
        { class: 'row', attrs: { style: 'gap:24px;flex-wrap:wrap' } },
        kv('Partidos', fmt(seasonStats.appearances)),
        kv('Titularidades', fmt(seasonStats.starts)),
        kv('Minutos', fmt(seasonStats.minutes)),
        kv('Goles', fmt(seasonStats.goals)),
        kv('Asistencias', fmt(seasonStats.assists)),
        kv('Nota media', avg > 0 ? avg.toFixed(2) : '—'),
        kv('MVP', fmt(seasonStats.motm)),
        seasonStats.saves > 0 ? kv('Atajadas', fmt(seasonStats.saves)) : null,
        seasonStats.cleanSheets > 0 ? kv('Porterías a cero', fmt(seasonStats.cleanSheets)) : null,
      ),
    ],
  });

  /* --- Bandeja de entrada ------------------------------------------------ */
  const inboxCard = card({
    title: 'Bandeja de entrada',
    subtitle: `${state.inbox.filter((message) => !message.read).length} sin leer`,
    actions:
      state.inbox.length > 0
        ? [
            el('button', {
              class: 'btn btn--ghost btn--sm',
              text: 'Marcar leídas',
              on: {
                click: () => {
                  careerService.markAllMessagesRead();
                  ctx.refresh();
                },
              },
            }),
          ]
        : [],
    body:
      state.inbox.length === 0
        ? [emptyState('Sin novedades.')]
        : state.inbox
            .slice(0, 5)
            .map((message) =>
              el(
                'div',
                { class: `inbox-item${message.read ? '' : ' is-unread'}` },
                el('span', { class: 'inbox-item__kind', text: MESSAGE_ICONS[message.kind] }),
                el(
                  'div',
                  { class: 'stack', attrs: { style: 'gap:2px' } },
                  el('strong', { text: message.title }),
                  el('span', { class: 'text-muted', text: message.body }),
                ),
              ),
            ),
  });

  /* --- Últimos resultados ------------------------------------------------- */
  const recentCard = card({
    title: 'Últimos partidos',
    body:
      state.recentResults.length === 0
        ? [emptyState('Todavía no has jugado ningún partido.')]
        : state.recentResults.map((result) => {
            const rival: Team | undefined = state.teams[result.homeId === state.teamId ? result.awayId : result.homeId];
            const userGoals = result.userSide === 'home' ? result.homeGoals : result.awayGoals;
            const rivalGoals = result.userSide === 'home' ? result.awayGoals : result.homeGoals;
            const outcome = result.userOutcome;
            return el(
              'div',
              { class: 'inbox-item' },
              ratingChip(result.userRating ?? 0),
              el(
                'div',
                { class: 'stack', attrs: { style: 'gap:2px;flex:1' } },
                el('strong', { text: `${userGoals} - ${rivalGoals} vs ${rival?.short ?? 'RIV'}` }),
                el('span', { class: 'text-dim', text: `Jornada ${result.round}` }),
              ),
              badge(
                outcome === 'win' ? 'Victoria' : outcome === 'draw' ? 'Empate' : 'Derrota',
                outcome === 'win' ? 'accent' : outcome === 'draw' ? '' : 'danger',
              ),
            );
          }),
  });

  /* --- Cierre de temporada ----------------------------------------------- */
  const seasonCloseCard = careerService.needsSeasonClose()
    ? card({
        title: '🏁 Temporada finalizada',
        subtitle: 'Es momento de hacer balance y afrontar el mercado',
        accent: true,
        body: [
          el(
            'div',
            { class: 'row row--between' },
            el('span', { class: 'text-muted', text: 'Revisa tus ascensos, premios y ofertas antes de empezar el nuevo curso.' }),
            el('button', {
              class: 'btn btn--primary',
              text: 'Cerrar temporada',
              on: {
                click: () => {
                  const summary = careerService.finishSeason();
                  const report = careerService.getState()?.player.lastGrowth ?? null;
                  const deltaChips = report
                    ? (Object.entries(report.deltas) as [AttributeKey, number][])
                        .filter(([, value]) => value !== 0)
                        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                        .map(([key, value]) =>
                          el('span', {
                            class: `delta-chip${value < 0 ? ' delta-chip--down' : ''}`,
                            text: `${ATTRIBUTE_LABELS[key]} ${value > 0 ? '+' : ''}${value}`,
                          }),
                        )
                    : [];
                  const lines = [
                    `Posición final: ${summary.finalPosition}º${summary.champion ? ' (¡campeón!)' : ''}`,
                    summary.promoted ? '⬆️ Ascenso de categoría' : null,
                    summary.relegated ? '⬇️ Descenso de categoría' : null,
                    `OVR ${summary.ovrDelta >= 0 ? '+' : ''}${summary.ovrDelta} → ${summary.newOvr} (${summary.newAge} años)`,
                    report ? report.narrative : null,
                    report ? `Rendimiento valorado: ${report.performanceScore}/100` : null,
                    summary.topScorer ? '🥇 Máximo goleador de la categoría' : null,
                    summary.offers.length > 0 ? `💼 ${summary.offers.length} oferta(s) de fichaje` : null,
                  ].filter((line): line is string => Boolean(line));
                  openModal({
                    title: `Balance de la temporada ${summary.season}`,
                    body: [
                      el(
                        'div',
                        { class: 'stack' },
                        ...lines.map((line) => el('p', { text: line })),
                        deltaChips.length > 0
                          ? el('div', { class: 'delta-list' }, ...deltaChips)
                          : null,
                        el('span', {
                          class: 'text-dim',
                          text: 'Ya está en marcha el desarrollo de la nueva temporada.',
                        }),
                      ),
                    ],
                    actions: [
                      { label: 'Ver mercado', onClick: () => ctx.navigate('market') },
                      { label: 'Continuar', kind: 'primary', onClick: () => ctx.refresh() },
                    ],
                  });
                },
              },
            }),
          ),
        ],
      })
    : null;

  /* --- Ofertas ------------------------------------------------------------ */
  const offersCard =
    state.offers.length > 0
      ? card({
          title: '💼 Ofertas de fichaje',
          accent: true,
          body: [
            el(
              'div',
              { class: 'row row--between' },
              el('span', { class: 'text-muted', text: `${state.offers.length} club(es) quieren contar contigo.` }),
              el('button', {
                class: 'btn btn--primary btn--sm',
                text: 'Ir al mercado',
                on: { click: () => ctx.navigate('market') },
              }),
            ),
          ],
        })
      : null;

  const grid = el(
    'div',
    { class: 'grid grid--2' },
    nextMatchCard(state, ctx),
    statsCard,
    developmentCard,
    attributesCard,
    recentCard,
    inboxCard,
    seasonCloseCard,
    offersCard,
  );

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', {
          class: 'page-head__eyebrow',
          text: `Temporada ${state.season} · Jornada ${state.currentRound} · ${formatGameDate(state.calendar)}`,
        }),
        el('h1', { text: 'Vestuario' }),
        el('p', { class: 'text-muted', text: `${team?.name ?? 'Sin club'} · ${league?.name ?? 'Sin liga'}` }),
      ),
      el('button', {
        class: 'btn btn--ghost',
        text: 'Guardar partida',
        title: `Último guardado ${fmtRelativeTime(state.savedAt)}`,
        on: {
          click: () => {
            careerService.save();
            alertModal('Partida guardada', [
              el('p', { text: 'El progreso se ha almacenado en tu navegador.' }),
              el('p', {
                class: 'text-muted',
                text: 'Puedes tener varias carreras en marcha: gestiónalas desde «Partidas».',
              }),
            ]);
          },
        },
      }),
    ),
    heroCard,
    grid,
  );
};
