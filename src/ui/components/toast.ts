import { bus } from '../../services/eventBus';
import { el } from '../dom';

let mounted = false;

/** Conecta el bus de eventos con las notificaciones visuales. */
export function mountToasts(): void {
  if (mounted) return;
  mounted = true;
  bus.on('toast', ({ message, tone }) => showToast(message, tone));
}

/** Muestra una notificación efímera. */
export function showToast(message: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info'): void {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const toast = el('div', { class: `toast toast--${tone}`, text: message });
  root.appendChild(toast);

  globalThis.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(18px)';
    globalThis.setTimeout(() => toast.remove(), 220);
  }, 3200);
}
