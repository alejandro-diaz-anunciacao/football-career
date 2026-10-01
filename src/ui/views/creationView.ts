import { COUNTRIES } from '../../data/continents';
import { bottomTierOf } from '../../data/leagues';
import { Foot, Position } from '../../models';
import type { PlayerCreationInput } from '../../services/playerFactory';
import { careerService } from '../../services/careerService';
import { el, replace } from '../dom';
import { card, kv } from '../components/card';
import { debutPicker } from '../components/debutPicker';
import type { ViewContext, ViewFactory } from './types';

/** Descripción de cada posición para el selector. */
const POSITIONS: readonly { id: Position; label: string; hint: string }[] = [
  { id: Position.Goalkeeper, label: 'POR', hint: 'Portero' },
  { id: Position.Defender, label: 'DEF', hint: 'Defensa' },
  { id: Position.Midfielder, label: 'MED', hint: 'Medio' },
  { id: Position.Forward, label: 'DEL', hint: 'Delantero' },
];

/** Vista de creación de carrera. */
export const creationView: ViewFactory = (ctx: ViewContext) => {
  let position: Position = Position.Midfielder;

  const firstNameInput = el('input', { type: 'text', placeholder: 'Ej. Marcos', value: '' });
  const lastNameInput = el('input', { type: 'text', placeholder: 'Ej. Vega Ruiz', value: '' });
  const numberInput = el('input', { type: 'number', value: 10, min: 1, max: 99 });

  const countrySelect = el(
    'select',
    {},
    ...COUNTRIES.map((country) => el('option', { value: country.code, text: `${country.name} · ${country.nationality}` })),
  );
  countrySelect.value = 'ES';

  const footSelect = el(
    'select',
    {},
    el('option', { value: Foot.Right, text: Foot.Right }),
    el('option', { value: Foot.Left, text: Foot.Left }),
    el('option', { value: Foot.Both, text: Foot.Both }),
  );

  const debutInfo = el('p', { class: 'text-muted' });

  const updateDebutInfo = (): void => {
    const tier = bottomTierOf(countrySelect.value);
    replace(
      debutInfo,
      tier
        ? `Debutarás en ${tier.name} (${tier.country}, ${tier.tier}ª categoría). Elige entre los clubes candidatos.`
        : 'Selecciona una nacionalidad para conocer tu liga de debut.',
    );
  };

  /** Ficha actual del formulario, usada para calcular los clubes candidatos. */
  const currentInput = (): PlayerCreationInput => ({
    firstName: firstNameInput.value,
    lastName: lastNameInput.value,
    countryCode: countrySelect.value,
    position,
    number: Number(numberInput.value) || 10,
    foot: footSelect.value as Foot,
  });

  const picker = debutPicker();

  const handleFormChange = (): void => {
    updateDebutInfo();
    picker.refresh(currentInput());
  };

  countrySelect.addEventListener('change', handleFormChange);
  updateDebutInfo();
  picker.refresh(currentInput());

  const positionRow = el('div', { class: 'position-picker' });
  const renderPositions = (): void => {
    replace(
      positionRow,
      ...POSITIONS.map((option) =>
        el(
          'button',
          {
            class: `position-option${option.id === position ? ' is-selected' : ''}`,
            type: 'button',
            on: {
              click: () => {
                position = option.id;
                renderPositions();
                picker.refresh(currentInput());
              },
            },
          },
          option.label,
          el('small', { text: option.hint }),
        ),
      ),
    );
  };
  renderPositions();

  const startButton = el('button', {
    class: 'btn btn--primary',
    text: '▶ Comenzar carrera',
    on: {
      click: () => {
        careerService.createCareer(currentInput(), picker.choice());
        ctx.navigate('dashboard');
      },
    },
  });

  const hasSlots = careerService.hasSlots();

  const hero = el(
    'div',
    { class: 'hero' },
    el(
      'div',
      { class: 'stack' },
      el('span', { class: 'page-head__eyebrow', text: 'Nueva partida' }),
      el('h1', { class: 'hero__title', text: 'De la Segunda Federación a la élite mundial' }),
      el('p', {
        class: 'hero__lead',
        text: 'Crea tu futbolista de 16 años, ficha por un club humilde y pelea temporada a temporada por ascender, crecer y levantar trofeos. Simulación minuto a minuto con progresión, mercado y ascensos entre 26 ligas de 5 continentes.',
      }),
      el(
        'div',
        { class: 'chip-row' },
        el('span', { class: 'badge badge--accent', text: '26 ligas' }),
        el('span', { class: 'badge badge--azure', text: '5 continentes' }),
        el('span', { class: 'badge', text: 'Varias partidas' }),
        el('span', { class: 'badge', text: 'Progresión por edad' }),
        el('span', { class: 'badge', text: 'Mercado de fichajes' }),
      ),
      hasSlots
        ? card({
            title: '¿Ya tienes una carrera en marcha?',
            body: [
              el(
                'div',
                { class: 'row row--between' },
                el('span', {
                  class: 'text-muted',
                  text: `Tienes ${careerService.listSlots().length} partida(s) guardada(s). Puedes continuar cualquiera de ellas sin perder esta.`,
                }),
                el('button', {
                  class: 'btn',
                  text: '🗂 Ver mis partidas',
                  on: { click: () => ctx.navigate('saves') },
                }),
              ),
            ],
          })
        : null,
      card({
        title: 'Cómo funciona el desarrollo',
        body: [
          el(
            'div',
            { class: 'stack' },
            el('p', {
              class: 'text-muted',
              text: 'Tu futbolista crece cada 4 jornadas según lo que hace en el campo: los goles desarrollan el tiro, las asistencias el pase, los robos la defensa y las atajadas la portería.',
            }),
            el('p', {
              class: 'text-muted',
              text: 'Elige un foco de entrenamiento desde el vestuario para acelerar el atributo que más te interese, y aprovecha la ventana de 16 a 21 años, cuando el crecimiento es más rápido.',
            }),
          ),
        ],
      }),
    ),
    card({
      title: 'Ficha del jugador',
      subtitle: 'Los atributos se generan a partir del perfil elegido',
      accent: true,
      body: [
        el(
          'div',
          { class: 'stack' },
          el(
            'div',
            { class: 'form-grid' },
            el('label', { class: 'field' }, el('span', { class: 'field__label', text: 'Nombre' }), firstNameInput),
            el('label', { class: 'field' }, el('span', { class: 'field__label', text: 'Apellidos' }), lastNameInput),
            el('label', { class: 'field' }, el('span', { class: 'field__label', text: 'Dorsal' }), numberInput),
          ),
          el(
            'label',
            { class: 'field' },
            el('span', { class: 'field__label', text: 'Nacionalidad (determina tu liga de debut)' }),
            countrySelect,
          ),
          el(
            'label',
            { class: 'field' },
            el('span', { class: 'field__label', text: 'Pie dominante' }),
            footSelect,
          ),
          el(
            'div',
            { class: 'field' },
            el('span', { class: 'field__label', text: 'Posición' }),
            positionRow,
          ),
          debutInfo,
          el(
            'div',
            { class: 'field' },
            el('span', { class: 'field__label', text: 'Elige tu club de debut' }),
            picker.element,
            el('span', {
              class: 'text-dim',
              text: 'Los clubes más modestos te garantizan minutos; los más fuertes, más prestigio y competencia.',
            }),
          ),
          el(
            'div',
            { class: 'row row--between' },
            el('div', { class: 'row row--tight' }, kv('OVR inicial', '48-58'), kv('Potencial', 'Oculto (80-95)')),
            startButton,
          ),
        ),
      ],
    }),
  );

  return el('div', { class: 'page' }, hero);
};
