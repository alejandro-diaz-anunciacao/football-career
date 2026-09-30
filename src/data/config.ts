/**
 * Constantes de balance del simulador.
 * Centralizar aquí los números permite ajustar la dificultad sin tocar la lógica.
 */

export const CONFIG = {
  /** Edad y rango de creación del futbolista. */
  START_AGE: 16,
  OVR_MIN: 48,
  OVR_MAX: 58,
  POTENTIAL_MIN: 80,
  POTENTIAL_MAX: 95,

  /** Límites de atributos. */
  ATTR_MIN: 1,
  ATTR_MAX: 99,

  /** Motor de partidos. */
  MATCH: {
    /** Goles esperados base de un equipo medio. */
    BASE_EXPECTED_GOALS: 1.32,
    /** Exponente de la ventaja por diferencia de fuerzas. */
    STRENGTH_EXPONENT: 1.15,
    /** Multiplicador de local. */
    HOME_FACTOR: 1.18,
    /** Multiplicador de visitante. */
    AWAY_FACTOR: 0.87,
    /** Límites del lambda de Poisson. */
    MIN_LAMBDA: 0.12,
    MAX_LAMBDA: 4.6,
    /** Peso del mediocampo en el control del juego. */
    MIDFIELD_WEIGHT: 1.35,
    /** Modificadores por planteamiento táctico (ataque / defensa). */
    TACTICS: {
      Seguro: { attack: 0.9, defense: 1.14, involvement: 0.92 },
      Equilibrado: { attack: 1, defense: 1, involvement: 1 },
      Agresivo: { attack: 1.14, defense: 0.9, involvement: 1.12 },
    } as const,
  },

  /** Motor de progresión. */
  PROGRESSION: {
    /** Multiplicador de crecimiento por tramo de edad. */
    AGE_FACTOR: [
      { maxAge: 18, factor: 1.9 },
      { maxAge: 21, factor: 1.3 },
      { maxAge: 24, factor: 0.85 },
      { maxAge: 27, factor: 0.45 },
      { maxAge: 30, factor: 0.15 },
      { maxAge: 33, factor: -0.2 },
      { maxAge: 99, factor: -0.55 },
    ] as const,
    /** Nota media que separa crecimiento de estancamiento. */
    NEUTRAL_RATING: 6.4,
    /** Sensibilidad del crecimiento a la nota. */
    RATING_SENSITIVITY: 0.16,
    /** Crecimiento base en puntos de OVR. */
    BASE_GROWTH: 1.7,
    /** Puntos de OVR máximos por temporada. */
    MAX_GROWTH: 7,
    /** Caída máxima por temporada. */
    MAX_DECLINE: 5,
    /** Mínimo de partidos para considerar una temporada completa. */
    FULL_SEASON_APPS: 26,
    /** Penalización por inactividad. */
    INACTIVITY_PENALTY: 0.55,
    /** Puntos de atributo que equivalen, de media, a un punto de media global. */
    ATTRIBUTE_POINTS_PER_OVR: 3.5,
    /** Cada cuántas jornadas se aplica un avance de desarrollo. */
    DEVELOPMENT_INTERVAL: 4,
    /** Fracción del objetivo total que se reparte en cada avance. */
    DEVELOPMENT_CHUNK: 0.22,
    /** Sensibilidad del avance parcial al rendimiento reciente. */
    DEVELOPMENT_PERFORMANCE: 0.12,
    /** Multiplicador de peso del atributo elegido como foco de entrenamiento. */
    FOCUS_MULTIPLIER: 2.5,
    /** Nota de rendimiento que desbloquea una temporada de explosión. */
    BREAKOUT_SCORE: 85,
    /** Multiplicador extra de crecimiento en una temporada de explosión. */
    BREAKOUT_BONUS: 0.18,
    /** Edad máxima para beneficiarse de una explosión. */
    BREAKOUT_MAX_AGE: 21,
  },

  /** Mercado de fichajes. */
  MARKET: {
    /** OVR mínimo para recibir ofertas de un club con reputación dada. */
    REPUTATION_TOLERANCE: 7,
    /** Número máximo de ofertas por temporada. */
    MAX_OFFERS: 3,
    /** Salario mínimo en miles de € semanales. */
    MIN_WAGE: 1,
    /** Probabilidad de que un club de interés presente oferta. */
    OFFER_CHANCE: 0.55,
  },

  /** Carrera. */
  CAREER: {
    MAX_SEASONS: 22,
    /** Fichas de plantilla generadas por equipo. */
    SQUAD_SIZE: 22,
    /** Edad de retirada sugerida. */
    RETIREMENT_AGE: 39,
    /** Clave del guardado único de la versión anterior (migración). */
    SAVE_KEY: 'footballer-sim:save:v1',
    /** Índice con los metadatos de todas las partidas. */
    SLOT_INDEX_KEY: 'footballer-sim:slots:v1',
    /** Prefijo de la clave de cada ranura. */
    SLOT_KEY_PREFIX: 'footballer-sim:slot:',
    SAVE_VERSION: 1,
    /** Número máximo de partidas simultáneas. */
    MAX_SLOTS: 12,
  },

  /** Calificación (rating) por rol. */
  RATING: {
    BASE: 6.2,
    WIN_BONUS: 0.25,
    DRAW_BONUS: 0.05,
    LOSS_PENALTY: -0.15,
    GOAL: 0.85,
    ASSIST: 0.5,
    SAVE: 0.28,
    CLEAN_SHEET: 0.65,
    GOAL_CONCEDED: -0.32,
    TACKLE: 0.06,
    INTERCEPTION: 0.08,
    KEY_PASS: 0.1,
    SHOT_ON_TARGET: 0.05,
    YELLOW: -0.35,
    RED: -1.9,
    MIN: 1,
    MAX: 10,
  },
} as const;

/** Multiplicador de crecimiento por edad. */
export function ageGrowthFactor(age: number): number {
  for (const band of CONFIG.PROGRESSION.AGE_FACTOR) {
    if (age <= band.maxAge) return band.factor;
  }
  return CONFIG.PROGRESSION.AGE_FACTOR[CONFIG.PROGRESSION.AGE_FACTOR.length - 1].factor;
}

/** Modificadores tácticos según planteamiento. */
export function tacticModifiers(approach: keyof typeof CONFIG.MATCH.TACTICS) {
  return CONFIG.MATCH.TACTICS[approach];
}
