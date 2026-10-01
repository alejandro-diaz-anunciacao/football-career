import { careerService } from '../services/careerService';
import { bus } from '../services/eventBus';
import { clear, el, replace } from './dom';
import { renderHeader as renderHeaderBar } from './components/header';
import { mountToasts } from './components/toast';
import { router, type Route, type RouteId } from './router';
import { creationView } from './views/creationView';
import { savesView } from './views/savesView';
import { dashboardView } from './views/dashboardView';
import { matchView } from './views/matchView';
import { tableView } from './views/tableView';
import { competitionsView } from './views/competitionsView';
import { nationalView } from './views/nationalView';
import { historyView } from './views/historyView';
import { marketView } from './views/marketView';
import type { ViewContext, ViewFactory } from './views/types';

/** Mapa de rutas a factorías de vista. */
const FACTORIES: Record<RouteId, ViewFactory> = {
  creation: creationView,
  saves: savesView,
  dashboard: dashboardView,
  match: matchView,
  table: tableView,
  competitions: competitionsView,
  national: nationalView,
  history: historyView,
  market: marketView,
};

/**
 * Arranca la aplicación: monta el contenedor, conecta el enrutador y
 * sincroniza la interfaz con el estado de la carrera.
 */
export function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('No se encontró el contenedor #app');

  mountToasts();

  // Migra el guardado antiguo de un solo hueco y reanuda la partida más reciente.
  careerService.initStorage();
  careerService.loadMostRecent();

  clear(root);
  const headerHost = el('div', { class: 'app-header-host' });
  const mainHost = el('main', { class: 'app-main' });
  root.append(headerHost, mainHost);

  const context: ViewContext = {
    navigate: (path, params) => router.go(path, params),
    refresh: () => render(),
  };

  const renderHeaderArea = (route: Route): void => {
    const state = careerService.getState();
    replace(
      headerHost,
      renderHeaderBar({
        state,
        active: route.id,
        role: state ? careerService.squadRole() : null,
        onNavigate: (path) => router.go(path),
      }),
    );
  };

  const renderViewArea = (route: Route): void => {
    const factory = FACTORIES[route.id];
    replace(mainHost, factory(context, route.params));
  };

  /** Render completo de la ruta activa. */
  function render(): void {
    const route = router.route;

    // Sin carrera activa: si hay partidas guardadas, se ofrece el gestor de partidas.
    if (!careerService.getState() && route.id !== 'creation' && route.id !== 'saves') {
      router.replace(careerService.hasSlots() ? 'saves' : 'creation');
      return;
    }

    renderHeaderArea(route);
    renderViewArea(route);
    globalThis.scrollTo(0, 0);
  }

  router.onChange(render);

  // El estado se guarda con frecuencia: solo refrescamos la cabecera para no
  // interrumpir una simulación en curso.
  bus.on('state:changed', () => renderHeaderArea(router.route));
  bus.on('state:cleared', () => router.go('creation'));

  router.start();
}
