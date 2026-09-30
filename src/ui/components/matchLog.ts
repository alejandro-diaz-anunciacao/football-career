import { MatchEventType } from '../../models';
import type { MatchEvent, TeamSide } from '../../models';
import { el } from '../dom';

/** Icono asociado a cada tipo de evento. */
const EVENT_ICONS: Record<MatchEventType, string> = {
  [MatchEventType.KickOff]: '🟢',
  [MatchEventType.Goal]: '⚽',
  [MatchEventType.Penalty]: '🎯',
  [MatchEventType.Assist]: '🅰️',
  [MatchEventType.Shot]: '🎯',
  [MatchEventType.Save]: '🧤',
  [MatchEventType.Tackle]: '🛡️',
  [MatchEventType.Interception]: '✋',
  [MatchEventType.KeyPass]: '🔑',
  [MatchEventType.Foul]: '⚠️',
  [MatchEventType.YellowCard]: '🟨',
  [MatchEventType.RedCard]: '🟥',
  [MatchEventType.Injury]: '🚑',
  [MatchEventType.Substitution]: '🔁',
  [MatchEventType.HalfTime]: '⏸️',
  [MatchEventType.FullTime]: '🏁',
};

/** Clase CSS del contenedor del evento. */
export function eventClass(event: MatchEvent, userSide: TeamSide): string {
  const classes = ['match-event'];

  if (event.type === MatchEventType.Goal || event.type === MatchEventType.Penalty) {
    classes.push('match-event--goal');
    if (event.side !== userSide) classes.push('match-event--against');
  }
  if (event.type === MatchEventType.YellowCard) classes.push('match-event--card');
  if (event.type === MatchEventType.RedCard) classes.push('match-event--red');
  if (event.type === MatchEventType.HalfTime || event.type === MatchEventType.FullTime) {
    classes.push('match-event--milestone');
  }
  if (event.isUserInvolved) classes.push('match-event--user');

  return classes.join(' ');
}

/** Elemento visual de un evento. */
export function renderMatchEvent(event: MatchEvent, userSide: TeamSide): HTMLElement {
  const isMilestone = event.type === MatchEventType.HalfTime || event.type === MatchEventType.FullTime;
  return el(
    'div',
    { class: eventClass(event, userSide) },
    isMilestone
      ? el('span', { class: 'match-event__minute', text: "45'" })
      : el('span', { class: 'match-event__minute', text: `${event.minute}'` }),
    el('span', { class: 'match-event__text' }, `${EVENT_ICONS[event.type]} ${event.description}`),
  );
}

/** Crea el contenedor del registro de eventos. */
export function createMatchLog(): HTMLElement {
  return el('div', { class: 'match-log', id: 'match-log' });
}

/** Añade un evento al registro y hace scroll hasta el final. */
export function appendMatchEvent(log: HTMLElement, event: MatchEvent, userSide: TeamSide): void {
  log.appendChild(renderMatchEvent(event, userSide));
  log.scrollTop = log.scrollHeight;
}
