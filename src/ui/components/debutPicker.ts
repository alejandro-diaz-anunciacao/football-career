import { SquadRole } from '../../models';
import { careerService, type DebutChoice, type DebutOption } from '../../services/careerService';
import type { PlayerCreationInput } from '../../services/playerFactory';
import { el, replace } from '../dom';
import { badge, kv } from './card';

/** Etiqueta y tono del rol previsto en un club. */
function roleMeta(role: SquadRole): { text: string; tone: string } {
  switch (role) {
    case SquadRole.Starter:
      return { text: 'Serías titular', tone: 'accent' };
    case SquadRole.Bench:
      return { text: 'Rotación', tone: 'flame' };
    default:
      return { text: 'Sin minutos', tone: 'danger' };
  }
}

/** Selector reutilizable del club de debut. */
export interface DebutPicker {
  element: HTMLElement;
  /** Regenera las opciones a partir de la ficha actual del jugador. */
  refresh(input: PlayerCreationInput): void;
  /** Elección actual, o null si todavía no hay opciones. */
  choice(): DebutChoice | null;
}

/** Crea un selector de club de debut con 4 candidatos y su rol previsto. */
export function debutPicker(): DebutPicker {
  let seed: number | null = null;
  let options: DebutOption[] = [];
  let selected: string | null = null;

  const host = el('div', { class: 'debut-picker' });

  const render = (): void => {
    if (options.length === 0) {
      replace(host, el('span', { class: 'text-dim', text: 'No hay clubes disponibles para esa nacionalidad.' }));
      return;
    }

    replace(
      host,
      el(
        'div',
        { class: 'debut-grid' },
        ...options.map((option) => {
          const meta = roleMeta(option.role);
          return el(
            'button',
            {
              class: `debut-option${option.teamId === selected ? ' is-selected' : ''}`,
              type: 'button',
              on: { click: () => { selected = option.teamId; render(); } },
            },
            el(
              'div',
              { class: 'row row--between' },
              el('strong', { text: option.teamName }),
              badge(meta.text, meta.tone),
            ),
            el('span', { class: 'text-dim', text: `${option.tier}ª categoría · ${option.leagueName}` }),
            el(
              'div',
              { class: 'debut-option__stats' },
              kv('OVR', String(option.overall)),
              kv('Prestigio', String(option.reputation)),
            ),
          );
        }),
      ),
    );
  };

  return {
    element: host,
    refresh(input: PlayerCreationInput): void {
      const result = careerService.debutOptions(input);
      seed = result.seed;
      options = result.options;
      if (!selected || !options.some((option) => option.teamId === selected)) {
        selected = options[0]?.teamId ?? null;
      }
      render();
    },
    choice(): DebutChoice | null {
      return seed !== null && selected ? { seed, teamId: selected } : null;
    },
  };
}
