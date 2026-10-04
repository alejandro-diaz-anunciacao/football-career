/**
 * Preferencia de tema (oscuro / claro).
 *
 * Es una preferencia de interfaz, no de la partida: se guarda en `localStorage`
 * bajo su propia clave y no toca el estado de `careerService`. El tema se aplica
 * como `data-theme` en `<html>`, que es lo que consultan los tokens de CSS.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme:v1';
const THEME_COLOR: Record<Theme, string> = {
  dark: '#070b14',
  light: '#eaeff8',
};

/** Lee el tema guardado, o `null` si nunca se eligió. */
function storedTheme(): Theme | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Tema preferido por el sistema operativo. */
function systemTheme(): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
}

/** Tema efectivo actual (guardado o del sistema). */
export function currentTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** Aplica un tema al documento y actualiza el color de la barra del navegador. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[theme];
}

/** Resuelve y aplica el tema al arrancar (sin persistir la elección del sistema). */
export function initTheme(): void {
  applyTheme(currentTheme());
}

/** Alterna entre oscuro y claro, y persiste la elección. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    /* Sin almacenamiento: se aplica solo para esta sesión. */
  }
  applyTheme(next);
  return next;
}

/** Etiqueta e icono del botón de tema según el tema actual. */
export function themeToggleMeta(theme: Theme): { icon: string; label: string } {
  return theme === 'dark' ? { icon: '☀️', label: 'Tema claro' } : { icon: '🌙', label: 'Tema oscuro' };
}
