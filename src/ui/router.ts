/** Enrutador por hash, ligero y sin dependencias. */

/** Rutas disponibles en la aplicación. */
export type RouteId = 'creation' | 'saves' | 'dashboard' | 'match' | 'table' | 'competitions' | 'national' | 'history' | 'market';

/** Ruta resuelta. */
export interface Route {
  id: RouteId;
  hash: string;
  params: Record<string, string>;
}

const DEFAULT_ROUTE: RouteId = 'dashboard';

const VALID: readonly RouteId[] = ['creation', 'saves', 'dashboard', 'match', 'table', 'competitions', 'national', 'history', 'market'];

/** Convierte el hash actual en una ruta tipada. */
export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query = ''] = clean.split('?');
  const id = (VALID as readonly string[]).includes(path) ? (path as RouteId) : DEFAULT_ROUTE;
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const [key, value = ''] = part.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return { id, hash: `#/${id}`, params };
}

/** Enrutador observable basado en `location.hash`. */
export class Router {
  private current: Route = parseHash(typeof location === 'undefined' ? '' : location.hash);
  private listeners = new Set<(route: Route) => void>();
  private started = false;

  /** Ruta activa. */
  get route(): Route {
    return this.current;
  }

  /** Comienza a escuchar cambios de hash. */
  start(): void {
    if (this.started) return;
    this.started = true;
    globalThis.addEventListener('hashchange', () => this.handle());
    this.handle();
  }

  /** Navega a una ruta. */
  go(path: string, params: Record<string, string> = {}): void {
    const query = Object.entries(params)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const next = `#/${path}${query ? `?${query}` : ''}`;
    if (location.hash === next) {
      this.handle();
      return;
    }
    location.hash = next;
  }

  /** Sustituye la ruta sin dejar historial extra. */
  replace(path: string, params: Record<string, string> = {}): void {
    const query = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    history.replaceState(null, '', `#/${path}${query ? `?${query}` : ''}`);
    this.handle();
  }

  /** Suscribe un manejador de navegación. */
  onChange(handler: (route: Route) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private handle(): void {
    this.current = parseHash(location.hash);
    for (const listener of this.listeners) listener(this.current);
  }
}

/** Instancia única del enrutador. */
export const router = new Router();
