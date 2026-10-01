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

  /**
   * Rol en la plantilla. La banda de minutos es generosa a propósito: un
   * futbolista algo por debajo del mejor rival de su posición debe poder sumar
   * minutos de rotación en vez de quedar condenado al banquillo.
   */
  SQUAD: {
    /** Margen sobre el mejor rival de la posición para ser titular. */
    STARTER_GAP: 2,
    /** Margen para entrar en la rotación (tener minutos). */
    BENCH_GAP: 9,
    /** Edad máxima para sumar el bonus de promesa. */
    PROMISE_MAX_AGE: 21,
    /** Fracción del margen hasta el potencial que se suma a la confianza. */
    PROMISE_WEIGHT: 0.35,
    /** Tope del bonus de promesa. */
    PROMISE_CAP: 5,
    /** Condición física mínima para ser convocado. */
    MIN_FITNESS: 40,
    /** Minutos de rotación mínimos y máximos dentro de la banda de suplente. */
    ROTATION_MIN_MINUTES: 15,
    ROTATION_MAX_MINUTES: 60,
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
    /**
     * Fracción del avance parcial que progresa un jugador que entrena pero no
     * disputa minutos. Rompe el bucle «no juego → no crezco → no juego».
     */
    TRAINING_ONLY_FACTOR: 0.3,
  },

  /** Mercado de fichajes. */
  MARKET: {
    /** OVR mínimo para recibir ofertas de un club con reputación dada. */
    REPUTATION_TOLERANCE: 7,
    /** Número máximo de ofertas por ventana. */
    MAX_OFFERS: 4,
    /** Número máximo de ofertas de cesión. */
    MAX_LOAN_OFFERS: 2,
    /** Salario mínimo en miles de € semanales. */
    MIN_WAGE: 1,
    /** Probabilidad de que un club de interés presente oferta. */
    OFFER_CHANCE: 0.55,
    /** Salto máximo de nivel de un club respecto a tu media (ajustado por edad). */
    MAX_STEP_UP: 6,
    /** Hasta cuánto por debajo de tu media puede estar un club interesado. */
    FLOOR_GAP: 8,
    /** Reputación mínima para que un club cuente como candidato. */
    MIN_REPUTATION: 10,
    /** Probabilidad de una oferta ambiciosa (club por encima de tu techo). */
    WILDCARD_CHANCE: 0.12,
    /** Habilita las cesiones. */
    LOAN_ENABLED: true,
    /** Edad máxima para solicitar una cesión por falta de minutos. */
    LOAN_MAX_AGE: 24,
    /** Nº máximo de ofertas activas que puede acumular el jugador. */
    MAX_ACTIVE_OFFERS: 8,
    /** Rendimiento (0-100) a partir del cual hay al menos una oferta. */
    GOOD_PERFORMANCE: 60,
  },

  /** Calendario de la temporada y ventanas de fichajes. */
  CALENDAR: {
    /** Año en que arranca la temporada 1. */
    START_YEAR: 2026,
    START_MONTH: 8,
    START_DAY: 16,
    /** Días entre jornadas de liga. */
    ROUND_INTERVAL_DAYS: 7,
    /** Jornada tras la cual se abre el parón de invierno. */
    WINTER_BREAK_ROUND: 17,
    /** Duración del parón de invierno, en días. */
    WINTER_BREAK_DAYS: 21,
    /** Jornadas de liga por temporada. */
    LEAGUE_ROUNDS: 34,
    /** Tandas de copa: se insertan entre semana tras estas jornadas de liga. */
    CUP_TICKS_AFTER_ROUND: [3, 6, 9, 12, 15, 19, 23, 28],
    /** Tandas continentales: se insertan entre semana tras estas jornadas. */
    CONTINENTAL_TICKS_AFTER_ROUND: [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 31, 32],
    /** Ventanas internacionales (selecciones), tras estas jornadas. */
    NATIONAL_WINDOWS_AFTER_ROUND: [4, 8, 12, 16, 20, 24, 28],
    /** Tandas reservadas para el torneo de selecciones (al final de la temporada). */
    TOURNAMENT_TICKS: 8,
    /** Ventana de fichajes de verano (jornadas, ambas inclusive). */
    SUMMER_WINDOW: { FROM_ROUND: 1, TO_ROUND: 3 },
    /** Ventana de fichajes de invierno (jornadas, ambas inclusive). */
    WINTER_WINDOW: { FROM_ROUND: 18, TO_ROUND: 20 },
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
    /** Clubes candidatos que se ofrecen para elegir el debut. */
    DEBUT_OPTIONS: 4,
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
