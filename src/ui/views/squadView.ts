import { Position, ROLE_LABELS } from '../../models';
import type { SquadMember } from '../../models';
import { careerService, type SquadComparison } from '../../services/careerService';
import { el } from '../dom';
import { badge, card, emptyState } from '../components/card';
import type { ViewContext, ViewFactory } from './types';

/** Orden de las líneas en la plantilla. */
const GROUP_ORDER: Record<Position, number> = {
  [Position.Goalkeeper]: 0,
  [Position.Defender]: 1,
  [Position.Midfielder]: 2,
  [Position.Forward]: 3,
};

/** Chip de diferencia entre dos valores. */
function deltaChip(diff: number): HTMLElement {
  const tone = diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down';
  const cls = tone === 'down' ? ' delta-chip--down' : tone === 'flat' ? ' delta-chip--flat' : '';
  return el('span', { class: `delta-chip${cls}`, text: `${diff > 0 ? '+' : ''}${diff}` });
}

/** Cabecera de comparación contra el rival por el puesto. */
function comparisonHead(comparison: SquadComparison): HTMLElement {
  const { user, rivalRole, rivalGroup } = comparison;
  const rival = rivalRole ?? rivalGroup;
  const diff = rival ? user.ovr - rival.ovr : 0;

  const rivalTag = rivalRole ? 'Rival directo' : rivalGroup ? 'Mejor de tu línea' : 'Sin rival';

  return el(
    'div',
    { class: 'comparison' },
    el(
      'div',
      { class: 'comparison__side' },
      el('span', { class: 'text-dim', text: 'Tú' }),
      el('span', { class: 'comparison__ovr', text: String(user.ovr) }),
      el('span', { class: 'text-muted', text: `${ROLE_LABELS[user.role]} · ${comparison.projection.role}` }),
      el('span', { class: 'text-dim', text: comparison.projection.minutes > 0 ? `~${comparison.projection.minutes} min/partido` : 'Sin minutos previstos' }),
    ),
    el(
      'div',
      { class: 'comparison__vs' },
      rival ? deltaChip(diff) : null,
      el('span', { class: 'text-dim', text: 'vs' }),
    ),
    el(
      'div',
      { class: 'comparison__side comparison__side--away' },
      el('span', { class: 'text-dim', text: rival ? rival.name : 'Sin rival' }),
      el('span', { class: 'comparison__ovr', text: rival ? String(rival.ovr) : '—' }),
      rival ? el('span', { class: 'text-muted', text: `${ROLE_LABELS[rival.role]} · ${rivalTag}` }) : null,
      el('span', {
        class: 'text-dim',
        text: rival
          ? diff >= 0
            ? `Vas ${diff === 0 ? 'igual' : `${diff} por delante`} en la pelea por el puesto.`
            : `${Math.abs(diff)} de media por detrás.`
          : 'No hay nadie en tu puesto.',
      }),
    ),
  );
}

/** Tabla de atributos del jugador frente a su rival. */
function attributesTable(comparison: SquadComparison): HTMLElement {
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
          el('th', { text: 'Atributo' }),
          el('th', { class: 'num', text: 'Tú' }),
          el('th', { class: 'num', text: 'Rival' }),
          el('th', { class: 'num', text: 'Dif.' }),
        ),
      ),
      el(
        'tbody',
        {},
        ...comparison.attributes.map((attribute) =>
          el(
            'tr',
            {},
            el('td', { text: attribute.label }),
            el('td', { class: 'num', text: String(attribute.user) }),
            el('td', { class: 'num', text: String(attribute.rival) }),
            el('td', { class: 'num' }, deltaChip(attribute.diff)),
          ),
        ),
      ),
    ),
  );
}

/** Fila de la plantilla. */
function squadRow(comparison: SquadComparison, member: SquadMember): HTMLElement {
  const isRivalRole = comparison.rivalRole?.id === member.id;
  const isRivalGroup = comparison.rivalGroup?.id === member.id;
  return el(
    'tr',
    { class: member.isUser ? 'is-user' : '' },
    el('td', { class: 'num', text: String(member.number) }),
    el(
      'td',
      {},
      el('span', { text: member.name }),
      member.isUser ? badge('Tú', 'accent') : null,
      isRivalRole ? badge('Rival', 'flame') : isRivalGroup ? badge('Línea', 'azure') : null,
    ),
    el('td', { text: ROLE_LABELS[member.role] }),
    el('td', { class: 'num', text: String(member.ovr) }),
  );
}

/** Sección de una plantilla (club o selección) con su comparación. */
function squadSection(comparison: SquadComparison, ctx: ViewContext): HTMLElement {
  const sorted = [...comparison.squad].sort(
    (a, b) => GROUP_ORDER[a.position] - GROUP_ORDER[b.position] || b.ovr - a.ovr,
  );
  const isClub = comparison.scope === 'club';

  return card({
    title: isClub ? `Tu club · ${comparison.teamName}` : `Tu selección · ${comparison.teamName}`,
    subtitle: isClub
      ? 'Compara tu media y tus atributos con el jugador que ocupa tu puesto'
      : comparison.inSquad
        ? 'Convocado con tu selección'
        : 'Todavía no estás convocado: compara con el titular de tu puesto',
    accent: isClub,
    body: [
      comparisonHead(comparison),
      attributesTable(comparison),
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
              el('th', { text: 'Jugador' }),
              el('th', { text: 'Puesto' }),
              el('th', { class: 'num', text: 'OVR' }),
            ),
          ),
          el('tbody', {}, ...sorted.map((member) => squadRow(comparison, member))),
        ),
      ),
      el(
        'div',
        { class: 'row row--tight' },
        el('span', { class: 'text-dim', text: 'La media (OVR) es la valoración global del jugador.' }),
        el('button', { class: 'btn btn--ghost btn--sm', text: 'Ver clasificación', on: { click: () => ctx.navigate('table') } }),
      ),
    ],
  });
}

/** Vista de plantilla y comparación por el puesto. */
export const squadView: ViewFactory = (ctx: ViewContext) => {
  const state = careerService.getState();
  if (!state) {
    return el('div', { class: 'page' }, card({ title: 'Sin carrera', body: [emptyState('Crea una carrera primero.')] }));
  }

  const club = careerService.squadComparison('club');
  const national = careerService.squadComparison('national');

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: 'Plantilla y comparación' }),
        el('h1', { text: 'Tu puesto' }),
        el('p', { class: 'text-muted', text: `${state.player.name} · ${ROLE_LABELS[state.player.role]} · ${state.player.ovr} OVR` }),
      ),
      el('button', { class: 'btn btn--ghost', text: 'Volver al vestuario', on: { click: () => ctx.navigate('dashboard') } }),
    ),
    club ? squadSection(club, ctx) : card({ title: 'Tu club', body: [emptyState('Sin plantilla disponible.')] }),
    national
      ? squadSection(national, ctx)
      : card({ title: 'Tu selección', body: [emptyState('Todavía no tienes selección.')] }),
  );
};
