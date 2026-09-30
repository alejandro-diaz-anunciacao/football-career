import { CONFIG } from '../data/config';
import { findCountry } from '../data/continents';
import { LEAGUE_DEFS, bottomTierOf } from '../data/leagues';
import { buildWorld } from '../data/worldBuilder';
import {
  MatchEventType,
  MessageKind,
  Position,
  SeasonPhase,
  SquadRole,
  addStats,
  averageRating,
  emptySeasonStats,
} from '../models';
import type {
  AttributeKey,
  CareerState,
  Fixture,
  League,
  MatchResult,
  Player,
  RoundSummary,
  SeasonHistory,
  SeasonSummary,
  StandingRow,
  TacticalApproach,
  Team,
  TransferOffer,
  Trophy,
} from '../models';
import { currentStandings, fixtureForTeam, fixturesOfRound, positionOf, processCountryPyramid, resetLeagueForSeason, applyFixtureResult, type MovementLog } from '../engine/leagueManager';
import { MatchSimulation, marketValue, simulateQuickMatch, suggestedWage } from '../engine/matchEngine';
import { generateOffers, chooseDebutTeam } from '../engine/marketEngine';
import {
  agePlayer,
  applyDevelopmentTick,
  applySeasonGrowth,
  developmentFocusOptions,
  mergeSeasonIntoCareer,
  planSeasonGrowth,
  recoverWeekly,
  updateForm,
} from '../engine/progressionEngine';
import { createPlayer, type PlayerCreationInput } from './playerFactory';
import { getSquad } from './squadService';
import { storageService, type SaveSlot } from './storageService';
import { uid } from './idService';
import { Random, randomSeed, rng } from './randomService';
import { bus, notify } from './eventBus';

/** Estado vivo de la carrera en memoria. */
let state: CareerState | null = null;

/** Ranura activa (null si no hay partida cargada). */
let activeSlotId: string | null = null;

/** Acceso controlado al estado (lanza si no hay carrera activa). */
function requireState(): CareerState {
  if (!state) throw new Error('No hay ninguna carrera activa.');
  return state;
}

/** Crea un mensaje en la bandeja de entrada. */
function pushMessage(
  kind: MessageKind,
  title: string,
  body: string,
  season: number,
  round: number,
  actions: { id: string; label: string; kind: 'accept' | 'reject' | 'ack' }[] = [],
): void {
  const current = requireState();
  current.inbox.unshift({
    id: uid('msg'),
    season,
    round,
    kind,
    title,
    body,
    read: false,
    actions,
  });
  current.inbox = current.inbox.slice(0, 60);
}

/** Sincroniza el estado del RNG en el guardado y persiste en la ranura activa. */
function persist(): void {
  const current = requireState();
  current.rngState = rng.state;

  if (!activeSlotId) {
    const created = storageService.createSlot(current);
    if (!created.ok) {
      notify(`No se pudo guardar: ${created.error}`, 'danger');
      return;
    }
    activeSlotId = created.id;
  } else {
    const result = storageService.saveSlot(activeSlotId, current);
    if (!result.ok) notify(`No se pudo guardar: ${result.error ?? 'error'}`, 'danger');
  }

  bus.emit('state:changed', current);
}

/* ------------------------------------------------------------------ Consultas */

/** Liga en la que compite actualmente el usuario. */
function currentLeague(): League | null {
  const current = state;
  if (!current) return null;
  const team = current.teams[current.teamId];
  return team ? current.leagues[team.leagueId] ?? null : null;
}

/** Equipo actual del usuario. */
function currentTeam(): Team | null {
  const current = state;
  if (!current) return null;
  return current.teams[current.teamId] ?? null;
}

/** Próximo partido del usuario en la jornada en curso. */
function nextFixture(): Fixture | null {
  const current = state;
  const league = currentLeague();
  if (!current || !league) return null;
  return fixtureForTeam(league, current.currentRound, current.teamId) ?? null;
}

/** Rival del próximo partido. */
function nextOpponent(): Team | null {
  const current = state;
  const fixture = nextFixture();
  if (!current || !fixture) return null;
  const rivalId = fixture.homeId === current.teamId ? fixture.awayId : fixture.homeId;
  return current.teams[rivalId] ?? null;
}

/**
 * Rol dinámico en la plantilla: se recalcula comparando la media del usuario
 * con la del mejor compañero de su posición y con su estado de forma.
 */
function squadRole(): SquadRole {
  const current = state;
  const team = currentTeam();
  if (!current || !team) return SquadRole.NotCalled;

  const player = current.player;
  if (player.injuryWeeks > 0 || player.fitness < 40) return SquadRole.NotCalled;

  const squad = getSquad(team);
  const rivals = squad
    .filter((member) => member.position === player.position)
    .sort((a, b) => b.ovr - a.ovr);
  const bestOvr = rivals[0]?.ovr ?? 42;

  const effective = player.ovr + player.form * 2.2;
  if (effective >= bestOvr - 1.5) return SquadRole.Starter;
  if (effective >= bestOvr - 6.5) return SquadRole.Bench;
  return SquadRole.NotCalled;
}

/* ---------------------------------------------------- Gestión de partidas */

/** Lista de partidas guardadas, con sus metadatos. */
function listSlots(): SaveSlot[] {
  return storageService.listSlots();
}

/** Carga una partida del disco y la convierte en la activa. */
function loadSlot(slotId: string): CareerState | null {
  const loaded = storageService.loadSlot(slotId);
  if (!loaded) {
    notify('No se pudo cargar la partida (está dañada o ha sido eliminada).', 'danger');
    return null;
  }
  state = loaded;
  activeSlotId = slotId;
  rng.state = loaded.rngState || loaded.seed;
  bus.emit('state:changed', loaded);
  return loaded;
}

/** Elimina una partida. Si era la activa, se cierra la sesión. */
function deleteSlot(slotId: string): void {
  storageService.deleteSlot(slotId);
  if (activeSlotId === slotId) {
    state = null;
    activeSlotId = null;
    bus.emit('state:cleared', null);
  }
  notify('Partida eliminada', 'info');
}

/**
 * Reinicia una partida conservando la identidad del futbolista (nombre, país,
 * posición, dorsal y pie) pero empezando de cero: nueva semilla, 16 años, nueva
 * media inicial, nuevo potencial oculto y nuevo club de debut.
 */
function restartSlot(slotId: string): CareerState | null {
  const previous = slotId === activeSlotId && state ? state : storageService.loadSlot(slotId);
  if (!previous) {
    notify('No se pudo reiniciar: la partida no existe.', 'danger');
    return null;
  }

  const input: PlayerCreationInput = {
    firstName: previous.player.firstName,
    lastName: previous.player.lastName,
    countryCode: previous.player.countryCode,
    position: previous.player.position,
    number: previous.player.number,
    foot: previous.player.foot,
  };

  const restarted = buildCareer(input, slotId);
  notify(`Nueva carrera de ${restarted.player.name}`, 'success');
  return restarted;
}

/** Elimina todas las partidas (y la legacy). */
function clearAllSlots(): void {
  storageService.clearAll();
  state = null;
  activeSlotId = null;
  bus.emit('state:cleared', null);
}

/** Lee el índice de partidas y aplica la migración del guardado antiguo. */
function initStorage(): void {
  storageService.migrateLegacySave();
}

/* -------------------------------------------------------------- Crear carrera */

/** Inicia una carrera nueva desde los datos del formulario. */
function createCareer(input: PlayerCreationInput): CareerState {
  return buildCareer(input, null);
}

/**
 * Construye una carrera completa. Si se pasa `slotId`, sobrescribe esa ranura
 * (usado por el reinicio); si no, reserva una nueva.
 */
function buildCareer(input: PlayerCreationInput, slotId: string | null): CareerState {
  const seed = randomSeed();
  const worldRng = new Random(seed);
  const world = buildWorld(worldRng);
  rng.state = seed;

  const player = createPlayer(input, rng);

  const debutDef = bottomTierOf(input.countryCode) ?? LEAGUE_DEFS[LEAGUE_DEFS.length - 1];
  const debutLeague = world.leagues[debutDef.id];
  const debutTeamId = chooseDebutTeam(debutLeague, rng);
  const debutTeam = world.teams[debutTeamId];

  player.contract = {
    teamId: debutTeamId,
    wage: suggestedWage(player.ovr),
    years: 3,
    signedSeason: 1,
    releaseClause: Math.max(1, Math.round(marketValue(player) * 2)),
  };

  for (const league of Object.values(world.leagues)) {
    resetLeagueForSeason(league, rng);
  }

  state = {
    version: CONFIG.CAREER.SAVE_VERSION,
    seed,
    rngState: rng.state,
    createdAt: Date.now(),
    savedAt: Date.now(),
    season: 1,
    phase: SeasonPhase.League,
    currentRound: 1,
    player,
    teamId: debutTeamId,
    leagues: world.leagues,
    teams: world.teams,
    history: [],
    trophies: [],
    inbox: [],
    offers: [],
    lastMatch: null,
    recentResults: [],
    seasonsPlayed: 0,
    previousFinish: null,
  };

  const country = findCountry(input.countryCode);
  pushMessage(
    MessageKind.Info,
    'Bienvenido al fútbol profesional',
    `${player.name} (${player.age} años, ${player.position}) firma su primer contrato con ${debutTeam.name} en ${debutLeague.name} (${country?.name ?? input.countryCode}). El cuerpo técnico seguirá de cerca su progreso.`,
    1,
    0,
  );

  if (slotId) {
    activeSlotId = slotId;
    const result = storageService.saveSlot(slotId, state);
    if (!result.ok) notify(`No se pudo guardar: ${result.error ?? 'error'}`, 'danger');
    bus.emit('state:changed', state);
  } else {
    activeSlotId = null;
    persist();
  }

  return state;
}

/* ----------------------------------------------------------- Simular jornada */

/** Construye la simulación interactiva del partido del usuario. */
function createUserMatch(approach: TacticalApproach): MatchSimulation | null {
  const current = requireState();
  const league = currentLeague();
  const team = currentTeam();
  const fixture = nextFixture();
  if (!league || !team || !fixture) return null;

  const homeTeam = current.teams[fixture.homeId];
  const awayTeam = current.teams[fixture.awayId];
  if (!homeTeam || !awayTeam) return null;

  const homeSquad = getSquad(homeTeam, homeTeam.id === team.id ? current.player : undefined);
  const awaySquad = getSquad(awayTeam, awayTeam.id === team.id ? current.player : undefined);

  return new MatchSimulation({
    home: { team: homeTeam, squad: homeSquad },
    away: { team: awayTeam, squad: awaySquad },
    userTeamId: team.id,
    userPlayer: current.player,
    userRole: squadRole(),
    approach,
    round: current.currentRound,
    rng,
  });
}

/** Aplica el resultado del partido del usuario a su expediente. */
function applyUserMatch(result: MatchResult): void {
  const current = requireState();
  const league = currentLeague();
  const player = current.player;

  if (league) {
    const fixture = fixtureForTeam(league, result.round, current.teamId);
    if (fixture) applyFixtureResult(league, fixture, result.homeGoals, result.awayGoals);
  }

  const stats = result.userStats;
  if (stats) {
    addStats(player.seasonStats, {
      appearances: 1,
      starts: stats.minutes >= 60 ? 1 : 0,
      minutes: stats.minutes,
      goals: stats.goals,
      assists: stats.assists,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      passes: stats.passes,
      keyPasses: stats.keyPasses,
      tackles: stats.tackles,
      interceptions: stats.interceptions,
      saves: stats.saves,
      goalsConceded: stats.goalsConceded,
      cleanSheets: stats.cleanSheet ? 1 : 0,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
      motm: result.userMotm ? 1 : 0,
    });
    player.seasonStats.ratingSum += result.userRating ?? 0;
    player.seasonStats.ratingCount += 1;
  }

  updateForm(player, result.userRating, Boolean(stats));

  const injured = result.events.some(
    (event) => event.isUserInvolved && event.type === MatchEventType.Injury,
  );
  if (injured) {
    player.injuryWeeks = rng.int(1, 8);
    pushMessage(
      MessageKind.Injury,
      'Parte médico',
      `${player.name} sufre una lesión muscular. Baja estimada: ${player.injuryWeeks} semana(s).`,
      current.season,
      result.round,
    );
  }

  player.morale = Math.max(0, Math.min(100, player.morale + (result.userMotm ? 5 : result.userOutcome === 'win' ? 2 : -1)));

  current.lastMatch = result;
  current.recentResults = [result, ...current.recentResults].slice(0, 5);
}

/** Simula el resto de la jornada en todas las ligas del mundo. */
function simulateRestOfRound(): number {
  const current = requireState();
  let goals = 0;

  for (const league of Object.values(current.leagues)) {
    for (const fixture of fixturesOfRound(league, current.currentRound)) {
      if (fixture.played) continue;
      const home = current.teams[fixture.homeId];
      const away = current.teams[fixture.awayId];
      if (!home || !away) continue;
      const { homeGoals, awayGoals } = simulateQuickMatch(home, away, rng);
      applyFixtureResult(league, fixture, homeGoals, awayGoals);
      goals += homeGoals + awayGoals;
    }
  }

  return goals;
}

/** Cierra la jornada en curso y avanza el calendario. */
function advanceRound(played: boolean, won: boolean): void {
  const current = requireState();
  const league = currentLeague();
  const player = current.player;

  recoverWeekly(player, played, won);

  // Avance de desarrollo cada pocas jornadas: el jugador ve crecer sus atributos.
  if ((current.currentRound - 1) % CONFIG.PROGRESSION.DEVELOPMENT_INTERVAL === 0) {
    const report = applyDevelopmentTick(player, player.seasonStats, current.season, rng);
    if (report && report.ovrDelta !== 0) {
      pushMessage(
        MessageKind.Info,
        'Informe de desarrollo',
        `${report.narrative} Media global: ${player.ovr}.`,
        current.season,
        current.currentRound,
      );
    }
  }

  current.currentRound += 1;

  if (league && current.currentRound > league.totalRounds) {
    current.phase = SeasonPhase.Offseason;
  }
}

/** Registra el resultado del partido del usuario y simula el resto de la jornada. */
function commitUserMatch(result: MatchResult | null): RoundSummary {
  const current = requireState();
  const round = current.currentRound;
  const knownIds = new Set(current.inbox.map((message) => message.id));

  if (result) {
    applyUserMatch(result);
  }

  const goalsScoredElsewhere = simulateRestOfRound();
  advanceRound(Boolean(result?.userStats), result?.userOutcome === 'win');
  estimateSquadSituation(round);

  persist();

  return {
    round,
    userFixture: result,
    goalsScoredElsewhere,
    messages: current.inbox.filter((message) => !knownIds.has(message.id)),
  };
}

/** Avisa al jugador si su rol en la plantilla cambia de forma relevante. */
function estimateSquadSituation(round: number): void {
  const current = requireState();
  const role = squadRole();
  const player = current.player;

  if (role === SquadRole.NotCalled && player.injuryWeeks === 0 && player.fitness >= 40) {
    const alreadyWarned = current.inbox.some(
      (message) => message.kind === MessageKind.Squad && message.round >= round,
    );
    if (!alreadyWarned) {
      pushMessage(
        MessageKind.Squad,
        'Decisión técnica',
        `${player.name} no entra en la convocatoria. El entrenador pide más en los entrenamientos.`,
        current.season,
        round,
      );
    }
  }
}

/** Simula el partido del usuario de golpe, sin visor interactivo. */
function simulateUserMatchQuick(approach: TacticalApproach): MatchResult | null {
  const simulation = createUserMatch(approach);
  if (!simulation) return null;
  const result = simulation.simulateAll();
  applyUserMatch(result);
  const current = requireState();
  simulateRestOfRound();
  advanceRound(Boolean(result.userStats), result.userOutcome === 'win');
  estimateSquadSituation(current.currentRound - 1);
  persist();
  return result;
}

/* --------------------------------------------------------- Fin de temporada */

/** Trofeo individual del máximo goleador según posición. */
function goalThreshold(position: Position): number {
  switch (position) {
    case Position.Forward:
      return 16;
    case Position.Midfielder:
      return 9;
    case Position.Defender:
      return 4;
    default:
      return 1;
  }
}

/** Cierra la temporada: ascensos, premios, progresión, mercado y nuevo calendario. */
function finishSeason(): SeasonSummary {
  const current = requireState();
  const player = current.player;
  const league = currentLeague();
  const team = currentTeam();

  const finalPosition = league ? positionOf(league, current.teamId) : 0;
  const champion = finalPosition === 1;
  const seasonStats = { ...player.seasonStats };
  const trophies: Trophy[] = [];

  // Ascensos y descensos de todas las pirámides nacionales.
  const countries = [...new Set(Object.values(current.leagues).map((item) => item.countryCode))];
  const movements: MovementLog[] = [];
  for (const code of countries) {
    movements.push(...processCountryPyramid(current.leagues, current.teams, code));
  }

  // Título de liga.
  if (champion && league && team) {
    const trophy: Trophy = {
      id: uid('trophy'),
      name: `Campeón de ${league.name}`,
      season: current.season,
      teamId: team.id,
      teamName: team.name,
      kind: 'league',
    };
    trophies.push(trophy);
    pushMessage(
      MessageKind.Trophy,
      '¡Campeón de liga!',
      `${team.name} conquista ${league.name}. ${player.name} entra en la historia del club.`,
      current.season,
      current.currentRound,
    );
  }

  // Premio individual de máximo goleador.
  const topScorer = seasonStats.goals >= goalThreshold(player.position) && seasonStats.appearances >= 12;
  if (topScorer && league && team) {
    const trophy: Trophy = {
      id: uid('trophy'),
      name: `Máximo goleador de ${league.name}`,
      season: current.season,
      teamId: team.id,
      teamName: team.name,
      kind: 'individual',
    };
    trophies.push(trophy);
    pushMessage(
      MessageKind.Trophy,
      'Pichichi de la categoría',
      `${player.name} termina la temporada con ${seasonStats.goals} goles y se lleva el trofeo de máximo goleador.`,
      current.season,
      current.currentRound,
    );
  }

  // Movimiento del club del jugador entre categorías.
  const teamMovement = movements.find((movement) => movement.teamId === current.teamId);
  if (teamMovement && team) {
    const climb = teamMovement.kind === 'promotion';
    pushMessage(
      MessageKind.Info,
      climb ? '¡Ascenso!' : 'Descenso',
      climb
        ? `${team.name} asciende a ${current.leagues[teamMovement.toLeagueId]?.name ?? 'una categoría superior'}.`
        : `${team.name} desciende a ${current.leagues[teamMovement.toLeagueId]?.name ?? 'una categoría inferior'}.`,
      current.season,
      current.currentRound,
    );
  }

  // Progresión: el informe cierra la planificación iniciada al empezar el curso.
  const growth = applySeasonGrowth(player, seasonStats, current.season, rng);

  const history: SeasonHistory = {
    season: current.season,
    age: player.age,
    ovr: player.ovr,
    teamId: current.teamId,
    teamName: team?.name ?? 'Sin equipo',
    leagueId: league?.id ?? '',
    leagueName: league?.name ?? 'Sin liga',
    tier: league?.tier ?? 1,
    position: finalPosition,
    appearances: seasonStats.appearances,
    starts: seasonStats.starts,
    minutes: seasonStats.minutes,
    goals: seasonStats.goals,
    assists: seasonStats.assists,
    avgRating: Math.round(averageRating(seasonStats) * 100) / 100,
    motm: seasonStats.motm,
    goalsConceded: seasonStats.goalsConceded,
    cleanSheets: seasonStats.cleanSheets,
    trophies: trophies.map((trophy) => trophy.name),
  };
  current.history.push(history);
  current.trophies.push(...trophies);
  current.previousFinish = finalPosition;

  pushMessage(
    MessageKind.Media,
    `Balance de la temporada ${current.season}`,
    `${growth.narrative} Media global: ${player.ovr} (${growth.ovrDelta >= 0 ? '+' : ''}${growth.ovrDelta}). Rendimiento valorado: ${growth.performanceScore}/100.`,
    current.season,
    current.currentRound,
  );

  // Mercado y contrato.
  const offers = generateOffers(current.teams, current.leagues, player, rng);
  current.offers = offers;
  player.contract.years -= 1;
  if (player.contract.years <= 0) {
    player.contract.years = 2;
    player.contract.wage = Math.max(player.contract.wage, suggestedWage(player.ovr));
    pushMessage(
      MessageKind.Info,
      'Renovación automática',
      `${team?.name ?? 'El club'} ejecuta la renovación por dos temporadas más.`,
      current.season,
      current.currentRound,
    );
  }
  if (offers.length > 0) {
    pushMessage(
      MessageKind.Offer,
      `${offers.length} oferta(s) sobre la mesa`,
      'Hay clubes interesados en tu fichaje. Revisa el mercado para decidir tu futuro.',
      current.season,
      current.currentRound,
      offers.map((offer) => ({ id: offer.id, label: `Aceptar ${offer.teamName}`, kind: 'accept' as const })),
    );
  }

  // Nuevo curso.
  agePlayer(player, rng);
  mergeSeasonIntoCareer(player);
  player.seasonStats = emptySeasonStats();
  player.fitness = Math.min(100, player.fitness + 25);
  player.injuryWeeks = 0;
  // Se planifica el desarrollo del nuevo curso con la edad ya actualizada.
  player.seasonGrowth = planSeasonGrowth(player, rng);
  player.lastGrowth = growth;

  current.season += 1;
  current.seasonsPlayed += 1;
  current.currentRound = 1;
  current.phase = SeasonPhase.League;
  current.lastMatch = null;
  current.recentResults = [];

  for (const item of Object.values(current.leagues)) {
    resetLeagueForSeason(item, rng);
  }

  persist();

  return {
    season: current.season - 1,
    finalPosition,
    promoted: movements.some((movement) => movement.teamId === current.teamId && movement.kind === 'promotion'),
    relegated: movements.some((movement) => movement.teamId === current.teamId && movement.kind === 'relegation'),
    champion,
    ovrDelta: growth.ovrDelta,
    newOvr: player.ovr,
    newAge: player.age,
    topScorer,
    trophies,
    offers,
  };
}

/* ---------------------------------------------------------------- Mercado */

/** Acepta una oferta de fichaje y cambia al jugador de club. */
function acceptOffer(offerId: string): boolean {
  const current = requireState();
  const offer = current.offers.find((item) => item.id === offerId);
  if (!offer) return false;
  const team = current.teams[offer.teamId];
  if (!team) return false;

  const player = current.player;
  const previousTeam = current.teams[current.teamId];

  current.teamId = team.id;
  player.contract = {
    teamId: team.id,
    wage: offer.wage,
    years: offer.years,
    signedSeason: current.season,
    releaseClause: Math.max(1, Math.round(marketValue(player) * 2)),
  };
  player.morale = Math.min(100, player.morale + 8);
  current.offers = current.offers.filter((item) => item.id !== offerId);

  pushMessage(
    MessageKind.Transfer,
    '¡Fichaje confirmado!',
    `${player.name} deja ${previousTeam?.name ?? 'su club'} para firmar por ${team.name} (${offer.leagueName}) durante ${offer.years} temporada(s).`,
    current.season,
    current.currentRound,
  );

  persist();
  notify(`Fichas por ${team.name}`, 'success');
  return true;
}

/** Descarta todas las ofertas disponibles. */
function rejectOffers(): void {
  const current = requireState();
  current.offers = [];
  persist();
  notify('Continuarás en tu club actual', 'info');
}

/** Marca los mensajes como leídos. */
function markAllMessagesRead(): void {
  const current = state;
  if (!current) return;
  current.inbox = current.inbox.map((message) => ({ ...message, read: true }));
  persist();
}

/** Cambia el foco de entrenamiento del futbolista. */
function setTrainingFocus(focus: AttributeKey): void {
  const current = state;
  if (!current) return;
  if (!developmentFocusOptions(current.player.position).includes(focus)) return;
  current.player.trainingFocus = focus;
  persist();
}

/* --------------------------------------------------------------- Fachada */

/** API pública del servicio de carrera. */
export const careerService = {
  getState(): CareerState | null {
    return state;
  },

  hasCareer(): boolean {
    return state !== null;
  },

  createCareer,

  /** Migra el guardado antiguo y lista las partidas disponibles. */
  listSlots,
  initStorage,
  hasSlots(): boolean {
    return storageService.hasSlots();
  },

  /** Carga la partida más reciente (arranque de la aplicación). */
  loadMostRecent(): CareerState | null {
    const [first] = storageService.listSlots();
    return first ? loadSlot(first.id) : null;
  },

  /** Carga una partida concreta. */
  loadSlot,

  /** Alias histórico. */
  load(): CareerState | null {
    return this.loadMostRecent();
  },

  /** Elimina una partida. */
  deleteSlot,

  /** Reinicia una partida conservando la identidad del futbolista. */
  restartSlot,

  /** Borra todas las partidas guardadas. */
  clearAllSlots,

  /** Ranura activa. */
  activeSlotId(): string | null {
    return activeSlotId;
  },

  /** Metadatos de la ranura activa. */
  activeSlot(): SaveSlot | null {
    const id = activeSlotId;
    return id ? listSlots().find((slot) => slot.id === id) ?? null : null;
  },

  /** Tamaño ocupado por una partida en KB. */
  slotSizeKb(slotId: string): number {
    return storageService.slotSizeKb(slotId);
  },

  save(): void {
    if (state) persist();
  },

  currentLeague,
  currentTeam,
  nextFixture,
  nextOpponent,
  squadRole,
  createUserMatch,
  commitUserMatch,
  simulateUserMatchQuick,
  finishSeason,
  acceptOffer,
  rejectOffers,
  markAllMessagesRead,
  setTrainingFocus,

  /** Atributos que el futbolista puede trabajar según su posición. */
  developmentOptions() {
    return state ? developmentFocusOptions(state.player.position) : [];
  },

  /** Clasificación actual de la liga del usuario. */
  standings(): StandingRow[] {
    const league = currentLeague();
    return league ? currentStandings(league) : [];
  },

  /** Clasificación de una liga concreta. */
  standingsOf(leagueId: string): StandingRow[] {
    const current = state;
    const league = current?.leagues[leagueId];
    return league ? currentStandings(league) : [];
  },

  /** Se llama al terminar la temporada si el calendario está agotado. */
  needsSeasonClose(): boolean {
    const current = state;
    const league = currentLeague();
    if (!current || !league) return false;
    return current.phase === SeasonPhase.Offseason;
  },

  /** Ofertas vigentes. */
  offers(): TransferOffer[] {
    return state?.offers ?? [];
  },

  /** Valor de mercado del jugador. */
  playerValue(): number {
    return state ? marketValue(state.player) : 0;
  },

  /** Busca un equipo por id. */
  team(teamId: string): Team | null {
    return state?.teams[teamId] ?? null;
  },

  /** Jugador actual. */
  player(): Player | null {
    return state?.player ?? null;
  },

  /** Plantilla de un equipo (con el usuario inyectado si corresponde). */
  squadOf(teamId: string) {
    const current = state;
    const team = current?.teams[teamId];
    if (!current || !team) return [];
    return getSquad(team, team.id === current.teamId ? current.player : undefined);
  },
};
