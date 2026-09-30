import { clear, el, type Child } from '../dom';

/** Acción del pie del modal. */
export interface ModalAction {
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  onClick?: () => void;
}

/** Opciones de apertura. */
export interface ModalOptions {
  title: string;
  body: Child[] | Child;
  actions?: ModalAction[];
  /** Permite cerrar pulsando fuera del diálogo. */
  dismissable?: boolean;
}

let rootReady = false;

/** Prepara el contenedor raíz una sola vez. */
function ensureRoot(): HTMLElement | null {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  if (!rootReady) {
    root.addEventListener('click', (event) => {
      if (event.target === root) closeModal();
    });
    rootReady = true;
  }
  return root;
}

/** Abre un diálogo modal. */
export function openModal(options: ModalOptions): void {
  const root = ensureRoot();
  if (!root) return;
  clear(root);

  const bodyChildren = Array.isArray(options.body) ? options.body : [options.body];
  const actions = options.actions ?? [];

  const modal = el(
    'div',
    { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true' } },
    el(
      'div',
      { class: 'modal__head' },
      el('h3', { text: options.title }),
      el('button', {
        class: 'btn btn--ghost btn--sm',
        text: '✕',
        title: 'Cerrar',
        on: { click: () => closeModal() },
      }),
    ),
    el('div', { class: 'modal__body' }, ...bodyChildren),
    actions.length > 0
      ? el(
          'div',
          { class: 'modal__foot' },
          ...actions.map((action) =>
            el('button', {
              class: `btn${action.kind ? ` btn--${action.kind}` : ''}`,
              text: action.label,
              on: {
                click: () => {
                  action.onClick?.();
                  closeModal();
                },
              },
            }),
          ),
        )
      : null,
  );

  root.appendChild(modal);
}

/** Cierra el modal activo. */
export function closeModal(): void {
  const root = document.getElementById('modal-root');
  if (root) clear(root);
}

/** Atajo para mostrar un aviso de una sola acción. */
export function alertModal(title: string, body: Child[], label = 'Entendido'): void {
  openModal({ title, body, actions: [{ label, kind: 'primary' }] });
}
