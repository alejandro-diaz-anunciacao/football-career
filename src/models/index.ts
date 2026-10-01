/**
 * Punto único de acceso al modelo de dominio.
 * El resto de capas importa siempre desde aquí para mantener el acoplamiento bajo.
 */

export * from './enums';
export * from './player';
export * from './team';
export * from './league';
export * from './competition';
export * from './match';
export * from './career';
