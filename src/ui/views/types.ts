/** Contrato común de todas las vistas de la aplicación. */

export interface ViewContext {
  /** Navega a otra ruta. */
  navigate(path: string, params?: Record<string, string>): void;
  /** Vuelve a montar la vista actual. */
  refresh(): void;
}

export type ViewFactory = (ctx: ViewContext, params: Record<string, string>) => HTMLElement;
