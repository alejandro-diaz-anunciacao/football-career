import { MatchEventType, TacticalApproach } from '../../models';
import type { MatchResult } from '../../models';
import type { MatchSimulation } from '../../engine/matchEngine';
import { careerService } from '../../services/careerService';
import { notify } from '../../services/eventBus';
import { formatGameDate } from '../../utils/date';
import { el, fmt, replace } from '../dom';
import { badge, card, emptyState, kv } from '../components/card';
import { ratingChip, statBar } from '../components/statBar';
import { appendMatchEvent, createMatchLog } from '../components/matchLog';
import { segmented } from '../components/tabs';
import type { ViewContext, ViewFactory } from './types';

/** Velocidad de la reproducción automática (ms por minuto). */
const AUTO_DELAY = 520;

/** Planteamiento elegido, recordado entre re-renderizados de la vista. */
let selectedApproach: TacticalApproach = TacticalApproach.Balanced;

/** Panel de estadísticas en vivo del futbolista. */
function renderLiveStats(sim: MatchSimulation, container: HTMLElement): void {
  const stats = sim.userStats;
  if (stats.minutes === 0) {
    replace(container, el('p', { class: 'text-muted', text: 'Aún no has entrado al campo.' }));
    return;
  }

  replace(
    container,
    el(
      'div',
      { class: 'stack' },
      el(
        'div',
        { class: 'row row--tight' },
        ratingChip(stats.rating),
        badge(`${stats.minutes}'`, 'azure'),
        badge(`${stats.goals} G`, 'accent'),
        badge(`${stats.assists} A`, 'flame'),
      ),
      statBar('Tiros', stats.shots, 8, 'flame'),
      statBar('Pases', stats.passes, 90, ''),
      statBar('Robos', stats.tackles, 8, 'azure'),
      statBar('Intercep.', stats.interceptions, 8, 'azure'),
      stats.saves > 0 ? statBar('Atajadas', stats.saves, 10, 'gold') : null,
    ),
  );
}

/** Vista del partido en directo. */
export const matchView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const fixture = careerService.nextFixture();
  const team = careerService.currentTeam();
  const rival = careerService.nextOpponent();
  const league = careerService.currentLeague();
  const competition = careerService.nextCompetition();

  if (!fixture || !team || !rival || !league) {
    return el(
      'div',
      { class: 'page' },
      card({
        title: 'No hay partido en esta jornada',
        body: [
          emptyState('Tu equipo no tiene encuentro programado. Puedes avanzar la jornada desde el vestuario.'),
          el(
            'div',
            { class: 'row' },
            el('button', { class: 'btn btn--primary', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
          ),
        ],
      }),
    );
  }

  const homeTeam = state.teams[fixture.homeId] ?? team;
  const awayTeam = state.teams[fixture.awayId] ?? rival;
  const isHome = fixture.homeId === team.id;

  let approach: TacticalApproach = selectedApproach;
  let simulation: MatchSimulation | null = null;
  let autoTimer: number | null = null;

  /* --- Referencias del DOM ------------------------------------------------ */
  const homeScoreEl = el('div', { class: 'scoreboard__score', text: '0' });
  const awayScoreEl = el('div', { class: 'scoreboard__score', text: '0' });
  const clockEl = el('div', { class: 'scoreboard__clock', text: "0'" });
  const logEl = createMatchLog();
  const liveStatsEl = el('div', { class: 'card__body' });
  const controlsEl = el('div', { class: 'match-controls' });
  const statusEl = el('span', { class: 'text-dim' });
  let prematchCardEl: HTMLElement;

  const scoreboard = el(
    'div',
    { class: 'scoreboard' },
    el(
      'div',
      { class: 'scoreboard__team' },
      el('span', { class: 'scoreboard__short', text: homeTeam.short }),
      el('span', { class: 'text-dim', text: homeTeam.name }),
    ),
    el(
      'div',
      { class: 'stack', attrs: { style: 'align-items:center;gap:6px' } },
      el('div', { class: 'row row--tight' }, homeScoreEl, el('span', { class: 'text-dim', text: '-' }), awayScoreEl),
      clockEl,
    ),
    el(
      'div',
      { class: 'scoreboard__team scoreboard__team--away' },
      el('span', { class: 'scoreboard__short', text: awayTeam.short }),
      el('span', { class: 'text-dim', text: awayTeam.name }),
    ),
  );

  const liveArea = el(
    'div',
    { class: 'stack', attrs: { style: 'display:none' } },
    scoreboard,
    card({ title: 'Controles', body: [controlsEl, statusEl] }),
    el(
      'div',
      { class: 'grid grid--sidebar' },
      card({ title: 'Tu actuación', body: [liveStatsEl] }),
      card({ title: 'Retransmisión', body: [logEl] }),
    ),
  );

  const summaryArea = el('div', { class: 'stack' });

  /* --- Lógica de simulación ---------------------------------------------- */
  const stopAuto = (): void => {
    if (autoTimer !== null) {
      globalThis.clearTimeout(autoTimer);
      autoTimer = null;
    }
  };

  const refreshBoard = (): void => {
    if (!simulation) return;
    const sim = simulation;
    homeScoreEl.textContent = String(sim.homeGoals);
    awayScoreEl.textContent = String(sim.awayGoals);
    clockEl.textContent = sim.finished ? 'FINAL' : `${sim.minute}'`;
    renderLiveStats(sim, liveStatsEl);
  };

  const roundSummary = (result: MatchResult): HTMLElement => {
    const userGoals = result.userSide === 'home' ? result.homeGoals : result.awayGoals;
    const rivalGoals = result.userSide === 'home' ? result.awayGoals : result.homeGoals;
    const stats = result.userStats;

    return el(
      'div',
      { class: 'stack' },
      el(
        'div',
        { class: 'row row--between' },
        el(
          'div',
          {},
          el('h2', { text: `${userGoals} - ${rivalGoals} · ${result.userOutcome === 'win' ? 'Victoria' : result.userOutcome === 'draw' ? 'Empate' : 'Derrota'}` }),
          el('p', { class: 'text-muted', text: `${homeTeam.name} vs ${awayTeam.name}` }),
        ),
        stats ? ratingChip(result.userRating ?? 0) : badge('No jugaste'),
      ),
      result.userMotm ? el('span', { class: 'badge badge--gold', text: '⭐ MVP del partido' }) : null,
      stats
        ? el(
            'div',
            { class: 'row', attrs: { style: 'gap:20px;flex-wrap:wrap' } },
            kv('Minutos', fmt(stats.minutes)),
            kv('Goles', fmt(stats.goals)),
            kv('Asistencias', fmt(stats.assists)),
            kv('Tiros', stats.shotsOnTarget > 0 ? `${stats.shots}/${stats.shotsOnTarget}` : fmt(stats.shots)),
            kv('Pases', fmt(stats.passes)),
            kv('Robos', fmt(stats.tackles)),
            stats.saves > 0 ? kv('Atajadas', fmt(stats.saves)) : null,
            kv('Amarillas', fmt(stats.yellowCards)),
          )
        : el('p', { class: 'text-muted', text: 'El entrenador no te dio minutos en este partido.' }),
    );
  };

  const goToDashboardButton = (): HTMLElement =>
    el('button', {
      class: 'btn btn--primary',
      text: 'Volver al vestuario',
      on: { click: () => ctx.navigate('dashboard') },
    });

  const finishMatch = (): void => {
    if (!simulation) return;
    stopAuto();
    const result = simulation.getResult();
    refreshBoard();

    const commitButton = el('button', {
      class: 'btn btn--primary',
      text: '✔ Confirmar resultado y seguir',
      on: {
        click: () => {
          const summary = careerService.commitUserMatch(result);
          replace(
            summaryArea,
            card({
              title: `Jornada ${summary.round} completada`,
              accent: true,
              body: [
                el(
                  'div',
                  { class: 'stack' },
                  el('p', {
                    class: 'text-muted',
                    text: `${summary.goalsScoredElsewhere} goles en el resto de la jornada en todo el mundo.`,
                  }),
                  ...summary.messages.map((message) =>
                    el('div', { class: 'inbox-item is-unread' }, el('div', { class: 'stack', attrs: { style: 'gap:2px' } }, el('strong', { text: message.title }), el('span', { class: 'text-muted', text: message.body }))),
                  ),
                  el('div', { class: 'row' }, goToDashboardButton()),
                ),
              ],
            }),
          );
          summaryArea.scrollIntoView({ behavior: 'smooth' });
        },
      },
    });

    replace(
      summaryArea,
      card({
        title: 'Final del partido',
        accent: true,
        body: [roundSummary(result), el('div', { class: 'row' }, commitButton)],
      }),
    );
  };

  const advance = (minutes: number): void => {
    if (!simulation || simulation.finished) return;
    for (let i = 0; i < minutes; i += 1) {
      const events = simulation.step();
      for (const event of events) appendMatchEvent(logEl, event, simulation.userSide);
      if (simulation.finished) break;
    }
    refreshBoard();
    if (simulation.finished) finishMatch();
  };

  const startAuto = (): void => {
    if (!simulation || simulation.finished) return;
    stopAuto();
    autoTimer = globalThis.setTimeout(() => {
      if (!liveArea.isConnected) {
        stopAuto();
        return;
      }
      advance(1);
      if (simulation && !simulation.finished) startAuto();
    }, AUTO_DELAY) as unknown as number;
  };

  const renderControls = (): void => {
    replace(
      controlsEl,
      el('button', {
        class: 'btn btn--primary btn--sm',
        text: "▶ +1'",
        on: { click: () => advance(1) },
      }),
      el('button', { class: 'btn btn--sm', text: "⏩ +5'", on: { click: () => advance(5) } }),
      el('button', { class: 'btn btn--sm', text: "⏭ Final", on: { click: () => { stopAuto(); advance(90 - (simulation?.minute ?? 0)); } } }),
      el('button', {
        class: 'btn btn--sm',
        text: '🔄 Auto',
        on: {
          click: () => {
            if (autoTimer !== null) {
              stopAuto();
              notify('Reproducción pausada', 'info');
            } else {
              startAuto();
            }
          },
        },
      }),
    );
  };

  const startMatch = (): void => {
    const sim = careerService.createUserMatch(approach);
    if (!sim) {
      notify('No se pudo iniciar el partido', 'danger');
      return;
    }
    simulation = sim;
    const planned = sim.plannedMinutes();

    replace(
      summaryArea,
      card({
        title: 'Alineación confirmada',
        body: [
          el('p', {
            class: 'text-muted',
            text:
              planned > 0
                ? `Saldrás al campo con planteamiento ${approach.toLowerCase()}. Minutos previstos: ${planned}.`
                : 'El entrenador ha decidido no darte minutos en este encuentro. Puedes seguir el partido de tu equipo igualmente.',
          }),
        ],
      }),
    );

    prematchCardEl.style.display = 'none';
    liveArea.style.display = '';
    renderControls();
    refreshBoard();
    statusEl.textContent = 'El árbitro da la salida.';
    appendMatchEvent(
      logEl,
      {
        minute: 0,
        type: MatchEventType.KickOff,
        side: sim.userSide,
        teamId: team.id,
        playerId: null,
        playerName: '',
        description: `Comienza ${homeTeam.name} - ${awayTeam.name}.`,
        isUserInvolved: false,
      },
      sim.userSide,
    );
  };

  const competitionName = competition?.name ?? league.name;
  const competitionTitle =
    competition?.kind === 'league'
      ? `Jornada ${state.currentRound} · ${competitionName}`
      : `${competitionName} · Ronda ${fixture.round}`;

  const buildPrematchCard = (): HTMLElement =>
    card({
    title: competitionTitle,
    subtitle: `${homeTeam.name} vs ${awayTeam.name} · ${formatGameDate(state.calendar)}`,
    accent: true,
    body: [
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'row row--between' },
          el(
            'div',
            { class: 'stack', attrs: { style: 'gap:4px' } },
            kv('Condición', isHome ? 'Local' : 'Visitante'),
            kv('Tu rol', careerService.squadRole()),
            kv('Rival OVR', String((isHome ? awayTeam : homeTeam).overall)),
          ),
          el('div', { class: 'ovr-badge ovr-badge--azure', text: String(team.overall) }),
        ),
        el(
          'div',
          { class: 'field' },
          el('span', { class: 'field__label', text: 'Planteamiento táctico' }),
          segmented(
            [
              { id: TacticalApproach.Safe, label: '🛡️ Seguro' },
              { id: TacticalApproach.Balanced, label: '⚖️ Equilibrado' },
              { id: TacticalApproach.Aggressive, label: '🔥 Agresivo' },
            ],
            approach,
            (id) => {
              approach = id as TacticalApproach;
              selectedApproach = approach;
              ctx.refresh();
            },
          ),
          el('span', {
            class: 'text-dim',
            text: 'Más riesgo ofensivo implica más ocasiones a favor y en contra.',
          }),
        ),
        el(
          'div',
          { class: 'row row--between' },
          el('span', { class: 'text-muted', text: 'La simulación se calcula con Poisson sobre la diferencia de fuerzas y factor local.' }),
          el('button', { class: 'btn btn--primary', text: '▶ Iniciar partido', on: { click: startMatch } }),
        ),
      ),
    ],
  });

  prematchCardEl = buildPrematchCard();

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: 'Visor de partidos' }),
        el('h1', { text: `${homeTeam.short} vs ${awayTeam.short}` }),
        el('p', { class: 'text-muted', text: `${competitionName} · ${formatGameDate(state.calendar)}` }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Salir', on: { click: () => { stopAuto(); ctx.navigate('dashboard'); } } }),
    ),
    prematchCardEl,
    liveArea,
    summaryArea,
  );
};
