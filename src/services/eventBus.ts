import type { CareerState } from '../models';

/** Mapa de eventos de la aplicación. */
export interface AppEvents {
  'state:changed': CareerState;
  'state:cleared': null;
  'toast': { message: string; tone: 'info' | 'success' | 'warning' | 'danger' };
  'navigate': string;
}

type Handler<T> = (payload: T) => void;

/**
 * Bus de eventos tipado y minimalista.
 * Desacopla la lógica de dominio (servicios/engines) de la capa de presentación.
 */
export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Suscribe un manejador y devuelve la función para desuscribirse. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const set = this.handlers.get(event) ?? new Set<Handler<never>>();
    set.add(handler as Handler<never>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  /** Cancela una suscripción. */
  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  /** Emite un evento a todos los suscriptores. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      (handler as Handler<Events[K]>)(payload);
    }
  }

  /** Elimina todas las suscripciones (útil en tests). */
  clear(): void {
    this.handlers.clear();
  }
}

/** Bus global de la aplicación. */
export const bus = new EventBus<AppEvents>();

/** Atajo para notificaciones efímeras. */
export function notify(message: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info'): void {
  bus.emit('toast', { message, tone });
}
