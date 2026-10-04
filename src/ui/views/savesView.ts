import { CONFIG } from '../../data/config';
import { Position, ROLE_LABELS } from '../../models';
import type { SaveSlot } from '../../services/storageService';
import { careerService } from '../../services/careerService';
import { el, fmt, fmtRelativeTime } from '../dom';
import { badge, card, emptyState } from '../components/card';
import { debutPicker } from '../components/debutPicker';
import { openModal } from '../components/modal';
import { notify } from '../../services/eventBus';
import type { ViewContext, ViewFactory } from './types';

/** Etiqueta corta de cada posición. */
const POSITION_LABEL: Record<Position, string> = {
  [Position.Goalkeeper]: 'Portero',
  [Position.Defender]: 'Defensa',
  [Position.Midfielder]: 'Centrocampista',
  [Position.Forward]: 'Delantero',
};

/** Tarjeta de una partida guardada. */
function slotCard(slot: SaveSlot, active: boolean, ctx: ViewContext): HTMLElement {
  const continueButton = el('button', {
    class: active ? 'btn btn--ghost btn--sm' : 'btn btn--primary btn--sm',
    text: active ? '⟳ Recargar' : '▶ Continuar',
    on: {
      click: () => {
        if (careerService.loadSlot(slot.id)) {
          notify(`Partida de ${slot.playerName} cargada`, 'success');
          ctx.navigate('dashboard');
        }
      },
    },
  });

  const restartButton = el('button', {
    class: 'btn btn--sm',
    text: '↺ Reiniciar',
    title: 'Empieza de cero conservando nombre, país, posición, dorsal y pie',
    on: {
      click: () => {
        const identity = careerService.restartIdentity(slot.id);
        if (!identity) {
          notify('No se pudo reiniciar: la partida no existe.', 'danger');
          return;
        }
        const picker = debutPicker();
        picker.refresh(identity);
        openModal({
          title: 'Reiniciar carrera',
          body: [
            el('p', {
              text: `Se borrará el progreso de ${slot.playerName} y empezará de cero con 16 años, una nueva media inicial y un nuevo potencial.`,
            }),
            el('p', { class: 'text-muted', text: 'Se conservan el nombre, la nacionalidad, la posición, el dorsal y el pie dominante.' }),
            el(
              'div',
              { class: 'field' },
              el('span', { class: 'field__label', text: 'Elige tu club de debut' }),
              picker.element,
            ),
          ],
          actions: [
            { label: 'Cancelar', kind: 'ghost' },
            {
              label: 'Reiniciar',
              kind: 'danger',
              onClick: () => {
                if (careerService.restartSlot(slot.id, picker.choice())) ctx.navigate('dashboard');
                else ctx.refresh();
              },
            },
          ],
        });
      },
    },
  });

  const deleteButton = el('button', {
    class: 'btn btn--danger btn--sm',
    text: '🗑 Eliminar',
    on: {
      click: () => {
        openModal({
          title: 'Eliminar partida',
          body: [
            el('p', {
              text: `¿Seguro que quieres eliminar la carrera de ${slot.playerName}? Esta acción no se puede deshacer.`,
            }),
            el('p', { class: 'text-muted', text: `${slot.teamName} · ${slot.leagueName} · Temporada ${slot.season}` }),
          ],
          actions: [
            { label: 'Cancelar', kind: 'ghost' },
            {
              label: 'Eliminar',
              kind: 'danger',
              onClick: () => {
                const wasActive = careerService.activeSlotId() === slot.id;
                careerService.deleteSlot(slot.id);
                if (wasActive) ctx.navigate('saves');
                else ctx.refresh();
              },
            },
          ],
        });
      },
    },
  });

  const sizeKb = careerService.slotSizeKb(slot.id);

  return el(
    'article',
    { class: `slot-card${active ? ' is-active' : ''}` },
    el(
      'div',
      { class: 'slot-card__head' },
      el('div', { class: `ovr-badge${active ? '' : ' ovr-badge--azure'}`, text: String(slot.ovr) }),
      el(
        'div',
        { class: 'stack', attrs: { style: 'gap:2px;min-width:0' } },
        el('span', { class: 'slot-card__name', text: slot.playerName }),
        el('span', {
          class: 'text-dim',
          text: `${slot.role ? ROLE_LABELS[slot.role] : POSITION_LABEL[slot.position]} · ${slot.age} años · ${slot.nationality}`,
        }),
      ),
      active ? badge('En juego', 'accent') : null,
    ),
    el(
      'div',
      { class: 'slot-card__meta' },
      el('div', {}, el('span', { class: 'kv__label', text: 'Club' }), el('span', { class: 'kv__value', text: slot.teamName })),
      el('div', {}, el('span', { class: 'kv__label', text: 'Liga' }), el('span', { class: 'kv__value', text: `${slot.tier}ª · ${slot.leagueName}` })),
      el('div', {}, el('span', { class: 'kv__label', text: 'Temporada' }), el('span', { class: 'kv__value', text: String(slot.season) })),
      el('div', {}, el('span', { class: 'kv__label', text: 'Trofeos' }), el('span', { class: 'kv__value', text: fmt(slot.trophies) })),
      el('div', {}, el('span', { class: 'kv__label', text: 'Temporadas jugadas' }), el('span', { class: 'kv__value', text: fmt(slot.seasonsPlayed) })),
      el('div', {}, el('span', { class: 'kv__label', text: 'Guardado' }), el('span', { class: 'kv__value', text: fmtRelativeTime(slot.savedAt) })),
    ),
    el(
      'div',
      { class: 'slot-card__actions' },
      continueButton,
      restartButton,
      deleteButton,
      el('span', { class: 'text-dim slot-card__size', text: `${sizeKb} KB` }),
    ),
  );
}

/** Vista de gestión de partidas guardadas. */
export const savesView: ViewFactory = (ctx: ViewContext) => {
  const slots = careerService.listSlots();
  const activeId = careerService.activeSlotId();

  const newGameButton = el('button', {
    class: 'btn btn--primary',
    text: '＋ Nueva partida',
    on: { click: () => ctx.navigate('creation') },
  });

  const clearAllButton =
    slots.length > 1
      ? el('button', {
          class: 'btn btn--danger btn--sm',
          text: 'Borrar todas',
          on: {
            click: () => {
              openModal({
                title: 'Borrar todas las partidas',
                body: [
                  el('p', { text: `Se eliminarán las ${slots.length} partidas guardadas. Esta acción no se puede deshacer.` }),
                ],
                actions: [
                  { label: 'Cancelar', kind: 'ghost' },
                  {
                    label: 'Borrar todo',
                    kind: 'danger',
                    onClick: () => {
                      careerService.clearAllSlots();
                      ctx.navigate('creation');
                    },
                  },
                ],
              });
            },
          },
        })
      : null;

  const body =
    slots.length === 0
      ? [
          el(
            'div',
            { class: 'stack' },
            emptyState('Todavía no hay ninguna partida guardada.'),
            el('div', { class: 'row', attrs: { style: 'justify-content:center' } }, newGameButton),
          ),
        ]
      : [
          el(
            'div',
            { class: 'slots-grid' },
            ...slots.map((slot) => slotCard(slot, slot.id === activeId, ctx)),
          ),
        ];

  return el(
    'div',
    { class: 'page' },
    el(
      'div',
      { class: 'page-head' },
      el(
        'div',
        {},
        el('span', { class: 'page-head__eyebrow', text: 'Tus carreras' }),
        el('h1', { text: 'Partidas guardadas' }),
        el('p', {
          class: 'text-muted',
          text: `${slots.length} partida(s) · máximo ${CONFIG.CAREER.MAX_SLOTS} · puedes tener varias carreras a la vez`,
        }),
      ),
      el('div', { class: 'row row--tight' }, clearAllButton, newGameButton),
    ),
    card({ body: body, accent: slots.length === 0 }),
  );
};
