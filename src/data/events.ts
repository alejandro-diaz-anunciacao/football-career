import { SquadRole } from '../models';
import type { CareerEventDef } from '../models';
import { clamp } from '../utils/math';

/**
 * Catálogo de eventos aleatorios de carrera.
 *
 * Cada definición es pura (sin RNG): declara cuándo puede aparecer, el texto y
 * las opciones con sus efectos. El `eventEngine` se encarga de sortearlos y
 * aplicarlos de forma determinista.
 */
export const CAREER_EVENTS: readonly CareerEventDef[] = [
  {
    id: 'legend-training',
    icon: '🏆',
    weight: 3,
    minRound: 5,
    cooldownSeasons: 2,
    when: (ctx) => ctx.player.age <= 30 && ctx.player.ovr < ctx.player.potential && ctx.player.injuryWeeks === 0,
    title: () => 'Una leyenda en el entrenamiento',
    body: (ctx) =>
      `Un exjugador histórico del club se acerca a la ciudad deportiva y le propone a ${ctx.player.lastName} una sesión individual para pulir su técnica. La exigencia es brutal.`,
    choices: [
      {
        id: 'accept',
        label: 'Aceptar la sesión',
        hint: 'Con buen rendimiento reciente, más opciones de salir reforzado.',
        risk: {
          chance: (ctx) => clamp(0.42 + ctx.player.form * 0.25 + (ctx.seasonRating - 6.4) * 0.06, 0.2, 0.85),
          success: {
            effects: [
              { type: 'attribute', points: 3 },
              { type: 'stat', stat: 'morale', delta: 6 },
            ],
            narrative:
              'Aguantas el ritmo de la leyenda y terminas la sesión con la sensación de haber aprendido más que en meses. Tu juego da un salto.',
          },
          failure: {
            effects: [
              { type: 'attribute', points: -2 },
              { type: 'stat', stat: 'morale', delta: -6 },
            ],
            narrative:
              'La exigencia te supera: no aguantas la presión de la comparación y la sesión acaba pesándote en la cabeza. Pierdes confianza.',
          },
        },
      },
    ],
  },
  {
    id: 'coach-no-minutes',
    icon: '🧊',
    weight: 2,
    minRound: 6,
    cooldownSeasons: 2,
    when: (ctx) =>
      ctx.role !== SquadRole.Starter &&
      ctx.player.injuryWeeks === 0 &&
      ctx.player.fitness >= 40 &&
      (ctx.seasonRating === 0 || ctx.seasonRating < 6.8),
    title: (ctx) => `El entrenador no cuenta con ${ctx.player.lastName}`,
    body: () =>
      'El cuerpo técnico te comunica que, con el nivel actual de la plantilla, tendrás muy pocos minutos esta temporada. Puedes aceptar el reto desde el banquillo o buscar una salida.',
    choices: [
      {
        id: 'accept',
        label: 'Aceptar y pelear el puesto',
        hint: 'Menos minutos durante unas jornadas, pero sigues en el club.',
        outcome: {
          effects: [
            { type: 'rolePenalty', matches: 8, ovr: 4 },
            { type: 'stat', stat: 'morale', delta: -4 },
          ],
          narrative:
            'Aceptas la situación y prometes ganarte el puesto en cada entrenamiento. El camino será duro y el técnico no te regalará minutos.',
        },
      },
      {
        id: 'leave',
        label: 'Pedir una salida',
        hint: 'Tu agente buscará clubes donde puedas tener minutos.',
        outcome: {
          effects: [
            { type: 'loanOffers', count: 2 },
            { type: 'stat', stat: 'morale', delta: 2 },
          ],
          narrative: 'Pides al club que te busque una cesión donde puedas jugar y demostrar tu nivel.',
        },
      },
    ],
  },
  {
    id: 'veteran-advice',
    icon: '🧓',
    weight: 3,
    minRound: 4,
    cooldownSeasons: 1,
    when: (ctx) => ctx.player.age <= 23 && ctx.player.injuryWeeks === 0,
    title: () => 'El veterano del vestuario',
    body: (ctx) =>
      `Un compañero veterano, referente del vestuario, lleva aparte a ${ctx.player.lastName} para aconsejarle sobre cómo gestionar la presión y leer mejor los partidos.`,
    choices: [
      {
        id: 'listen',
        label: 'Escuchar con atención',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.08 },
            { type: 'stat', stat: 'morale', delta: 4 },
          ],
          narrative: 'Sus consejos calan hondo. Te sientes más seguro y con más recursos sobre el campo.',
        },
      },
    ],
  },
  {
    id: 'press-backpage',
    icon: '📰',
    weight: 2,
    minRound: 5,
    cooldownSeasons: 1,
    when: (ctx) => ctx.lastRating !== null,
    title: (ctx) => (ctx.lastRating && ctx.lastRating >= 6.8 ? 'La prensa te encumbra' : 'La prensa te señala'),
    body: (ctx) =>
      ctx.lastRating && ctx.lastRating >= 6.8
        ? `Los medios destacan la actuación de ${ctx.player.lastName}. En rueda de prensa te preguntan si estás listo para un reto mayor.`
        : `Tras tu último partido, la prensa cuestiona tu rendimiento y tu actitud. Las preguntas en rueda de prensa van con carga.`,
    choices: [
      {
        id: 'calm',
        label: 'Responder con calma',
        risk: {
          chance: 0.7,
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 4 },
              { type: 'stat', stat: 'form', delta: 0.04 },
            ],
            narrative: 'Tu mensaje sereno cae bien y refuerza tu imagen de profesional maduro.',
          },
          failure: {
            effects: [{ type: 'stat', stat: 'morale', delta: -3 }],
            narrative: 'Tus palabras se interpretan como conformismo y las críticas arrecian.',
          },
        },
      },
      {
        id: 'bold',
        label: 'Responder con ambición',
        hint: 'Más recompensa si sale bien, peor si sale mal.',
        risk: {
          chance: (ctx) => clamp(0.45 + ctx.player.form * 0.2, 0.2, 0.8),
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 6 },
              { type: 'stat', stat: 'form', delta: 0.06 },
            ],
            narrative: 'Tu descaro convence a todos. La afición se ilusiona contigo.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'morale', delta: -7 },
              { type: 'stat', stat: 'form', delta: -0.08 },
            ],
            narrative: 'Tus declaraciones suenan a exceso de confianza y la presión se te echa encima.',
          },
        },
      },
    ],
  },
  {
    id: 'scouts-watching',
    icon: '🔭',
    weight: 2,
    minRound: 8,
    cooldownSeasons: 2,
    when: (ctx) =>
      ctx.seasonRating >= 6.8 && ctx.player.seasonStats.appearances >= 6 && ctx.player.injuryWeeks === 0,
    title: () => 'Ojeadores en la grada',
    body: (ctx) =>
      `Varios ojeadores de clubes de categorías superiores han acudido a verte jugar. El rendimiento de ${ctx.player.lastName} no ha pasado desapercibido.`,
    choices: [
      {
        id: 'keep-working',
        label: 'Seguir trabajando en silencio',
        outcome: {
          effects: [{ type: 'transferOffers' }],
          narrative: 'Tu agente confirma que varios clubes han preguntado por ti. El interés es real.',
        },
      },
    ],
  },
  {
    id: 'physical-overload',
    icon: '⚡',
    weight: 2,
    minRound: 5,
    cooldownSeasons: 1,
    when: (ctx) => ctx.player.fitness < 55 && ctx.player.injuryWeeks === 0,
    title: () => 'Sobrecarga física',
    body: () =>
      'El preparador físico detecta sobrecarga en tus piernas. Si sigues forzando, el riesgo de lesión se dispara.',
    choices: [
      {
        id: 'rest',
        label: 'Bajar el ritmo unos días',
        outcome: {
          effects: [
            { type: 'stat', stat: 'fitness', delta: 18 },
            { type: 'stat', stat: 'form', delta: -0.05 },
          ],
          narrative: 'Dosificas las cargas y recuperas frescura, aunque pierdes algo de chispa competitiva.',
        },
      },
      {
        id: 'push',
        label: 'Aguantar y competir',
        hint: 'Puedes salir reforzado… o romperte.',
        risk: {
          chance: (ctx) => clamp(0.6 - (55 - ctx.player.fitness) * 0.015, 0.25, 0.7),
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 5 },
              { type: 'stat', stat: 'form', delta: 0.05 },
            ],
            narrative: 'Aprietas los dientes y el cuerpo responde. El técnico valora tu compromiso.',
          },
          failure: {
            effects: [{ type: 'injury', minWeeks: 1, maxWeeks: 3 }],
            narrative: 'El músculo dice basta. Notas un pinchazo y el cuerpo médico confirma una lesión.',
          },
        },
      },
    ],
  },
  {
    id: 'family-matter',
    icon: '🏠',
    weight: 2,
    minRound: 4,
    cooldownSeasons: 2,
    when: () => true,
    title: () => 'Asunto familiar',
    body: () =>
      'Un asunto familiar requiere tu atención justo en un momento clave de la temporada. Tienes que decidir cómo gestionarlo.',
    choices: [
      {
        id: 'ask-permission',
        label: 'Pedir permiso al club',
        outcome: {
          effects: [
            { type: 'stat', stat: 'morale', delta: 7 },
            { type: 'stat', stat: 'fitness', delta: 6 },
            { type: 'stat', stat: 'form', delta: -0.06 },
          ],
          narrative: 'El club te da unos días. Vuelves con la cabeza despejada, aunque algo falto de ritmo.',
        },
      },
      {
        id: 'focus',
        label: 'Concentrarte en el fútbol',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.07 },
            { type: 'stat', stat: 'morale', delta: -8 },
          ],
          narrative: 'Decides aparcar el asunto y volcarte en el equipo. El rendimiento sube, pero la carga personal te pesa.',
        },
      },
    ],
  },
  {
    id: 'sponsor-offer',
    icon: '💼',
    weight: 1,
    minRound: 6,
    cooldownSeasons: 3,
    when: (ctx) => ctx.seasonRating >= 6.5 && ctx.player.seasonStats.appearances >= 5,
    title: () => 'Oferta de patrocinio',
    body: (ctx) =>
      `Una marca deportiva quiere fichar a ${ctx.player.lastName} como imagen para su próxima campaña. La grabación chocará con algunos entrenamientos.`,
    choices: [
      {
        id: 'sign',
        label: 'Firmar el contrato',
        risk: {
          chance: 0.65,
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 8 },
              { type: 'stat', stat: 'form', delta: 0.03 },
            ],
            narrative: 'La campaña es un éxito y te convierte en un rostro conocido. Llegas a todo con energía.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'morale', delta: -3 },
              { type: 'stat', stat: 'form', delta: -0.07 },
            ],
            narrative: 'Las grabaciones te restan descanso y concentración. El cuerpo lo nota.',
          },
        },
      },
      {
        id: 'decline',
        label: 'Rechazar por ahora',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.05 },
            { type: 'stat', stat: 'morale', delta: -2 },
          ],
          narrative: 'Prefieres no distraerte. La decisión te da foco, aunque dejas escapar una oportunidad.',
        },
      },
    ],
  },
  {
    id: 'derby-hype',
    icon: '🔥',
    weight: 2,
    minRound: 10,
    cooldownSeasons: 1,
    when: (ctx) => ctx.player.injuryWeeks === 0 && ctx.role !== SquadRole.NotCalled,
    title: () => 'Derbi a la vista',
    body: (ctx) =>
      `Se acerca el derbi y la ciudad está revolucionada. La prensa pregunta a ${ctx.player.lastName} si el equipo está preparado para el gran día.`,
    choices: [
      {
        id: 'promise',
        label: 'Prometer una victoria',
        hint: 'Con la afición a favor si sale bien; presión si no.',
        risk: {
          chance: (ctx) => clamp(0.45 + ctx.player.form * 0.2, 0.2, 0.8),
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 7 },
              { type: 'stat', stat: 'form', delta: 0.05 },
            ],
            narrative: 'Tu promesa enciende a la afición y te sientes arropado para el derbi.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'morale', delta: -7 },
              { type: 'stat', stat: 'form', delta: -0.06 },
            ],
            narrative: 'La promesa se convierte en presión y la responsabilidad te pesa.',
          },
        },
      },
      {
        id: 'calm',
        label: 'Mantener la calma',
        outcome: {
          effects: [{ type: 'stat', stat: 'form', delta: 0.05 }],
          narrative: 'Optas por la mesura y llegas al derbi concentrado.',
        },
      },
    ],
  },
  {
    id: 'agent-interest',
    icon: '🤵',
    weight: 2,
    minRound: 7,
    cooldownSeasons: 2,
    when: (ctx) => ctx.seasonRating >= 6.3 && ctx.player.seasonStats.appearances >= 4,
    title: () => 'Llamada de tu agente',
    body: (ctx) =>
      `Tu agente llama: hay clubes siguiendo a ${ctx.player.lastName}. Quiere saber si estás abierto a escuchar propuestas.`,
    choices: [
      {
        id: 'listen',
        label: 'Escuchar propuestas',
        outcome: {
          effects: [{ type: 'transferOffers' }, { type: 'stat', stat: 'morale', delta: 2 }],
          narrative: 'Tu agente mueve hilos y empiezan a llegar sondeos de otros clubes.',
        },
      },
      {
        id: 'focus',
        label: 'Centrarte en tu club',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.06 },
            { type: 'stat', stat: 'morale', delta: -1 },
          ],
          narrative: 'Aparcas el mercado y te enfocas en el presente.',
        },
      },
    ],
  },
  {
    id: 'social-media',
    icon: '📱',
    weight: 2,
    minRound: 4,
    cooldownSeasons: 1,
    when: () => true,
    title: () => 'Viral en redes',
    body: (ctx) =>
      `Un vídeo de ${ctx.player.lastName} entrenando se hace viral. Marcas y aficionados llenan sus redes de mensajes.`,
    choices: [
      {
        id: 'engage',
        label: 'Aprovechar el momento',
        risk: {
          chance: 0.6,
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 6 },
              { type: 'stat', stat: 'form', delta: 0.03 },
            ],
            narrative: 'Gestionas bien la fama y tu confianza se dispara.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'morale', delta: -5 },
              { type: 'stat', stat: 'form', delta: -0.05 },
            ],
            narrative: 'La exposición te distrae y pierdes concentración.',
          },
        },
      },
      {
        id: 'lowprofile',
        label: 'Mantener un perfil bajo',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.05 },
            { type: 'stat', stat: 'morale', delta: -1 },
          ],
          narrative: 'Desconectas de las redes y te centras en el trabajo diario.',
        },
      },
    ],
  },
  {
    id: 'coach-praise',
    icon: '🌟',
    weight: 2,
    minRound: 4,
    cooldownSeasons: 1,
    when: (ctx) => ctx.lastRating !== null && ctx.lastRating >= 7,
    title: () => 'El entrenador te elogia',
    body: (ctx) =>
      `El técnico destaca públicamente el partido de ${ctx.player.lastName} y lo pone como ejemplo para el resto del grupo.`,
    choices: [
      {
        id: 'ack',
        label: 'Agradecer y seguir',
        outcome: {
          effects: [
            { type: 'stat', stat: 'morale', delta: 5 },
            { type: 'stat', stat: 'form', delta: 0.03 },
          ],
          narrative: 'La confianza del técnico te da alas para el siguiente partido.',
        },
      },
    ],
  },
  {
    id: 'coach-anger',
    icon: '😤',
    weight: 2,
    minRound: 5,
    cooldownSeasons: 1,
    when: (ctx) => ctx.lastRating !== null && ctx.lastRating <= 5.5,
    title: () => 'El entrenador estalla',
    body: (ctx) =>
      `Tras el último partido, el técnico señala en público la actuación de ${ctx.player.lastName}. El vestuario está tenso.`,
    choices: [
      {
        id: 'own',
        label: 'Asumir tu error',
        risk: {
          chance: 0.65,
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 3 },
              { type: 'stat', stat: 'form', delta: 0.05 },
            ],
            narrative: 'Tu autocrítica calma al técnico y refuerza tu liderazgo.',
          },
          failure: {
            effects: [{ type: 'stat', stat: 'morale', delta: -5 }],
            narrative: 'La disculpa no evita que la desconfianza del técnico crezca.',
          },
        },
      },
      {
        id: 'defend',
        label: 'Defender tu posición',
        hint: 'Puede salir bien… o dejarte señalado.',
        risk: {
          chance: 0.4,
          success: {
            effects: [{ type: 'stat', stat: 'morale', delta: 2 }],
            narrative: 'Tu defensa convence a parte del grupo y al cuerpo técnico.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'morale', delta: -8 },
              { type: 'stat', stat: 'form', delta: -0.06 },
            ],
            narrative: 'El pulso con el técnico te deja señalado ante el vestuario.',
          },
        },
      },
    ],
  },
  {
    id: 'nutrition-plan',
    icon: '🥗',
    weight: 2,
    minRound: 3,
    cooldownSeasons: 1,
    when: (ctx) => ctx.player.fitness < 85 && ctx.player.injuryWeeks === 0,
    title: () => 'Nuevo plan de nutrición',
    body: () =>
      'El nutricionista del club te propone un plan estricto para mejorar tu recuperación. Requiere disciplina total.',
    choices: [
      {
        id: 'follow',
        label: 'Seguir el plan',
        risk: {
          chance: 0.7,
          success: {
            effects: [
              { type: 'stat', stat: 'fitness', delta: 16 },
              { type: 'stat', stat: 'morale', delta: 2 },
            ],
            narrative: 'El plan funciona: recuperas mejor y te sientes más fuerte.',
          },
          failure: {
            effects: [
              { type: 'stat', stat: 'fitness', delta: 5 },
              { type: 'stat', stat: 'morale', delta: -4 },
            ],
            narrative: 'La disciplina se te hace cuesta arriba, aunque algo recuperas.',
          },
        },
      },
      {
        id: 'habits',
        label: 'Mantener tus hábitos',
        outcome: {
          effects: [{ type: 'stat', stat: 'morale', delta: 3 }],
          narrative: 'Prefieres no cambiar tu rutina; al menos te sientes cómodo.',
        },
      },
    ],
  },
  {
    id: 'charity-day',
    icon: '❤️',
    weight: 1,
    minRound: 4,
    cooldownSeasons: 2,
    when: () => true,
    title: () => 'Jornada solidaria',
    body: (ctx) =>
      `El club organiza una jornada solidaria y cuenta con ${ctx.player.lastName} para representarlo ante la afición.`,
    choices: [
      {
        id: 'help',
        label: 'Implicarte a fondo',
        risk: {
          chance: 0.75,
          success: {
            effects: [{ type: 'stat', stat: 'morale', delta: 6 }],
            narrative: 'La afición valora tu compromiso y te sientes querido.',
          },
          failure: {
            effects: [{ type: 'stat', stat: 'form', delta: -0.05 }],
            narrative: 'El acto te resta tiempo de descanso y lo notas en el entrenamiento.',
          },
        },
      },
      {
        id: 'skip',
        label: 'No acudir',
        outcome: {
          effects: [
            { type: 'stat', stat: 'form', delta: 0.04 },
            { type: 'stat', stat: 'morale', delta: -3 },
          ],
          narrative: 'Ganas descanso, pero tu ausencia no sienta del todo bien.',
        },
      },
    ],
  },
  {
    id: 'national-pride',
    icon: '🌍',
    weight: 2,
    minRound: 6,
    cooldownSeasons: 2,
    when: (ctx) => ctx.player.nationalStats.appearances > 0 && ctx.player.injuryWeeks === 0,
    title: () => 'Orgullo de selección',
    body: (ctx) =>
      `La selección vuelve a contar con ${ctx.player.lastName}. Sentir la camiseta de tu país te motiva especialmente.`,
    choices: [
      {
        id: 'embrace',
        label: 'Dejarte llevar por la emoción',
        risk: {
          chance: 0.6,
          success: {
            effects: [
              { type: 'stat', stat: 'morale', delta: 8 },
              { type: 'stat', stat: 'form', delta: 0.05 },
            ],
            narrative: 'La adrenalina internacional te hace jugar con un plus.',
          },
          failure: {
            effects: [{ type: 'stat', stat: 'form', delta: -0.06 }],
            narrative: 'La presión de representar a tu país te pasa factura.',
          },
        },
      },
      {
        id: 'steady',
        label: 'Mantener la concentración',
        outcome: {
          effects: [{ type: 'stat', stat: 'form', delta: 0.05 }],
          narrative: 'Gestionas la emoción y rindes con cabeza.',
        },
      },
    ],
  },
];
