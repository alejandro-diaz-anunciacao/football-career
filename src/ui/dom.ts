/** Utilidades mínimas de construcción de DOM (sin frameworks). */

/** Hijos aceptados por `el`. */
export type Child = Node | string | number | null | undefined | false;

/** Propiedades declarativas de un elemento. */
export interface ElProps {
  class?: string;
  id?: string;
  text?: string;
  html?: string;
  title?: string;
  type?: string;
  value?: string | number;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean;
  href?: string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>;
}

/** Crea un elemento con propiedades y descendientes. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (props.class) node.className = props.class;
  if (props.id) node.id = props.id;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.title) node.title = props.title;

  const anyNode = node as unknown as Record<string, unknown>;
  if (props.type !== undefined) anyNode.type = props.type;
  if (props.value !== undefined) anyNode.value = props.value;
  if (props.placeholder !== undefined) anyNode.placeholder = props.placeholder;
  if (props.min !== undefined) anyNode.min = props.min;
  if (props.max !== undefined) anyNode.max = props.max;
  if (props.step !== undefined) anyNode.step = props.step;
  if (props.disabled !== undefined) anyNode.disabled = props.disabled;
  if (props.selected !== undefined) anyNode.selected = props.selected;
  if (props.checked !== undefined) anyNode.checked = props.checked;
  if (props.href !== undefined) (node as HTMLAnchorElement).href = props.href;

  if (props.dataset) {
    for (const [key, value] of Object.entries(props.dataset)) node.dataset[key] = value;
  }
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) node.setAttribute(key, value);
  }
  if (props.on) {
    for (const [event, handler] of Object.entries(props.on)) {
      if (handler) node.addEventListener(event, handler as EventListener);
    }
  }

  append(node, ...children);
  return node;
}

/** Añade hijos ignorando valores vacíos. */
export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

/** Vacía un nodo. */
export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Reemplaza el contenido de un nodo. */
export function replace(node: Element, ...children: Child[]): void {
  clear(node);
  append(node, ...children);
}

/** Busca un elemento y falla con un mensaje claro si no existe. */
export function requireElement<T extends Element>(selector: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`No se encontró el elemento requerido: ${selector}`);
  return found;
}

/** Formatea un número con decimales fijos. */
export function fmt(value: number, decimals = 0): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Formatea millones de euros. */
export function fmtMoney(millions: number): string {
  if (millions >= 1) return `${fmt(millions, 1)} M€`;
  return `${fmt(millions * 1000, 0)} mil €`;
}

/** Formatea miles de euros semanales. */
export function fmtWage(thousands: number): string {
  return `${fmt(thousands, 0)} mil €/sem`;
}

/** Tiempo relativo legible («hace 5 min»). */
export function fmtRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'hace unos segundos';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} día(s)`;
  return new Date(timestamp).toLocaleDateString('es-ES');
}
