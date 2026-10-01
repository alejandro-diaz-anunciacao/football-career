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
  Competition,
  Fixture,
  League,
  MatchResult,
  NationalTeam,
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
import { generateLoanOffers, generateOffers, chooseDebutTeam } from '../engine/marketEngine';
import { projectRole } from '../engine/roleEngine';
import {
  buildCups,
  countBracketRounds,
  cupLegForTeam,
  simulateCupTick,
  simulateQualifyingTick,
} from '../engine/cupEngine';
import { buildSeasonSchedule, isTournamentSeason, isWorldCupSeason, type SeasonTick } from '../engine/schedule';
import { buildContinentalCompetitions, buildMainStage } from '../engine/continentalEngine';
import {
  buildQualifying,
  buildTournament,
  finishTournamentGroups,
  nationTeams,
  qualifiedFrom,
} from '../engine/nationalEngine';
import { groupOfTeam, groupQualifiers, groupRange, simulateGroupRound, startKnockout } from '../engine/groupEngine';
import { CUP_DEFS, cupDefOfCountry } from '../data/cups';
import { CONTINENTAL_DEFS, continentalDef, continentalDefsOf } from '../data/continental';
import { COUNTRIES } from '../data/continents';
import { NATIONS, nationByCode } from '../data/nations';
import { nationalTournamentDef, nationalTournamentsFor, qualifierId } from '../data/nationalTournaments';
import { roundDate, windowForRound, type TransferWindow } from '../engine/calendar';
import {
  agePlayer,
  applyDevelopmentTick,
  applySeasonGrowth,
  developmentFocusOptions,
  mergeSeasonIntoCareer,
  performanceScore,
  planSeasonGrowth,
  recoverWeekly,
  updateForm,
} from '../engine/progressionEngine';
import { formatGameDate, type GameDate } from '../utils/date';
import { createPlayer, type PlayerCreationInput } from './playerFactory';
import { getNationalSquad, getSquad } from './squadService';
import { storageService, type SaveSlot } from './storageService';
import { uid } from './idService';
import { Random, randomSeed, rng } from './randomService';
import { bus, notify } from './eventBus';

/** Estado vivo de la carrera en memoria. */
let state: CareerState | null = null;

/** Ranura activa (null si no hay partida cargada). */
let activeSlotId: string | null = null;

/** Club candidato para empezar la carrera. */
export interface DebutOption {
  teamId: string;
  teamName: string;
  teamShort: string;
  leagueId: string;
  leagueName: string;
  tier: number;
  overall: number;
  reputation: number;
  /** Rol previsto en ese club con tu media inicial. */
  role: SquadRole;
}

/** Elección de club de debut (semilla + club) reutilizada al crear la carrera. */
export interface DebutChoice {
  seed: number;
  teamId: string;
}

/** Contexto del próximo partido del usuario. */
export interface NextUserFixture {
  fixture: Fixture;
  competitionId: string;
  competitionName: string;
  kind: 'league' | 'cup' | 'continental' | 'national';
}

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

/** Copa nacional del club del usuario. */
function userCup(): Competition | null {
  const current = state;
  const team = currentTeam();
  if (!current || !team) return null;
  const def = cupDefOfCountry(team.countryCode);
  return def ? current.competitions[def.id] ?? null : null;
}

/** Competiciones continentales del club del usuario. */
function userContinentalCompetitions(): Competition[] {
  const current = state;
  const team = currentTeam();
  if (!current || !team) return [];
  const continent = COUNTRIES.find((country) => country.code === team.countryCode)?.continent;
  if (!continent) return [];
  return continentalDefsOf(continent)
    .map((def) => current.competitions[def.id])
    .filter((competition): competition is Competition => Boolean(competition));
}

/** Número de ventana internacional (1-based) en la que está la tanda actual. */
function currentNationalWindow(schedule: SeasonTick[], tick: number): number {
  let count = 0;
  for (let i = 0; i <= tick && i < schedule.length; i += 1) {
    const item = schedule[i];
    if (item.kind === 'national' && item.phase === 'window') count += 1;
  }
  return count;
}

/** Próximo partido internacional (clasificación, amistoso o torneo). */
function nationalUserFixture(phase: 'window' | 'tournament'): NextUserFixture | null {
  const current = state;
  const nation = userNation();
  if (!current || !nation) return null;

  if (phase === 'window') {
    for (const competition of Object.values(current.nationalCompetitions)) {
      if (competition.stage !== 'league') continue;
      const group = groupOfTeam(competition, nation.id);
      const fixture = group?.fixtures.find(
        (item) =>
          item.round === competition.round &&
          !item.played &&
          (item.homeId === nation.id || item.awayId === nation.id),
      );
      if (fixture) {
        return { fixture, competitionId: competition.id, competitionName: competition.name, kind: 'national' };
      }
    }

    const schedule = buildSeasonSchedule(current.season);
    const windowNumber = currentNationalWindow(schedule, current.tick);
    const friendly = current.friendlies.find((item) => item.round === windowNumber && !item.played);
    return friendly
      ? { fixture: friendly, competitionId: 'nat.friendly', competitionName: 'Amistoso', kind: 'national' }
      : null;
  }

  for (const competition of Object.values(current.nationalCompetitions)) {
    if (competition.stage === 'groups' || competition.stage === 'league') {
      const group = groupOfTeam(competition, nation.id);
      const fixture = group?.fixtures.find(
        (item) =>
          item.round === competition.round &&
          !item.played &&
          (item.homeId === nation.id || item.awayId === nation.id),
      );
      if (fixture) {
        return { fixture, competitionId: competition.id, competitionName: competition.name, kind: 'national' };
      }
    } else if (competition.stage === 'knockout') {
      const leg = cupLegForTeam(competition, nation.id);
      if (leg) {
        return { fixture: leg, competitionId: competition.id, competitionName: competition.name, kind: 'national' };
      }
    }
  }

  return null;
}

/**
 * Próximo partido del usuario en la tanda en curso (liga, copa, continental o selección).
 * Devuelve null si la tanda no le corresponde (eliminado, descanso…).
 */
function nextUserFixture(): NextUserFixture | null {
  const current = state;
  if (!current) return null;

  const tick = buildSeasonSchedule(current.season)[current.tick];
  if (!tick) return null;

  if (tick.kind === 'league') {
    const league = currentLeague();
    if (!league) return null;
    const fixture = fixtureForTeam(league, tick.round, current.teamId);
    return fixture
      ? { fixture, competitionId: league.id, competitionName: league.name, kind: 'league' }
      : null;
  }

  if (tick.kind === 'cup') {
    const cup = userCup();
    if (!cup) return null;
    const leg = cupLegForTeam(cup, current.teamId);
    return leg ? { fixture: leg, competitionId: cup.id, competitionName: cup.name, kind: 'cup' } : null;
  }

  if (tick.kind === 'national') {
    return nationalUserFixture(tick.phase);
  }

  for (const competition of userContinentalCompetitions()) {
    if (competition.championId) continue;
    if (competition.stage === 'groups' || competition.stage === 'league') {
      const group = groupOfTeam(competition, current.teamId);
      const fixture = group?.fixtures.find(
        (item) =>
          item.round === competition.round &&
          !item.played &&
          (item.homeId === current.teamId || item.awayId === current.teamId),
      );
      if (fixture) {
        return {
          fixture,
          competitionId: competition.id,
          competitionName: competition.name,
          kind: 'continental',
        };
      }
    } else if (competition.stage === 'qualifying' || competition.stage === 'knockout') {
      const leg = cupLegForTeam(competition, current.teamId);
      if (leg) {
        return {
          fixture: leg,
          competitionId: competition.id,
          competitionName: competition.name,
          kind: 'continental',
        };
      }
    }
  }

  return null;
}

/** Próximo partido (liga o copa). */
function nextFixture(): Fixture | null {
  return nextUserFixture()?.fixture ?? null;
}

/** Rival del próximo partido. */
function nextOpponent(): Team | null {
  const current = state;
  const fixture = nextFixture();
  if (!current || !fixture) return null;
  const rivalId = fixture.homeId === current.teamId ? fixture.awayId : fixture.homeId;
  return current.teams[rivalId] ?? null;
}

/** Competición del próximo partido. */
function nextCompetition(): { id: string; name: string; kind: 'league' | 'cup' | 'continental' | 'national' } | null {
  const context = nextUserFixture();
  return context ? { id: context.competitionId, name: context.competitionName, kind: context.kind } : null;
}

/**
 * Rol dinámico en la plantilla: se recalcula comparando la media del usuario
 * con la del mejor compañero de su posición y con su estado de forma.
 */
function squadRole(): SquadRole {
  const current = state;
  const team = currentTeam();
  if (!current || !team) return SquadRole.NotCalled;

  const squad = getSquad(team);
  return projectRole(current.player, team, squad).role;
}

/* ------------------------------------------------- Selección nacional */

/** Selección nacional del jugador. */
function userNation(): NationalTeam | null {
  const current = state;
  if (!current) return null;
  return nationByCode(current.player.countryCode) ?? null;
}

/** Equipo por identificador: club (`t.*`) o selección (`nat.*`). */
function teamFor(id: string): Team | undefined {
  const current = state;
  if (!current) return undefined;
  if (id.startsWith('nat.')) return nationTeams()[id];
  return current.teams[id];
}

/** Confianza del seleccionador: media, forma y edad. */
function nationalEffective(player: Player): number {
  const ageBonus = player.age <= 21 ? 3 : player.age >= 34 ? -4 : 0;
  return player.ovr + player.form * 2 + ageBonus;
}

/** Mejor nivel de la selección en la posición del jugador. */
function nationalBestOvr(): number {
  const current = state;
  const nation = userNation();
  if (!current || !nation) return 60;
  const team = nationTeams()[nation.id];
  if (!team) return nation.strength;
  const rivals = getNationalSquad(team)
    .filter((member) => member.position === current.player.position)
    .sort((a, b) => b.ovr - a.ovr);
  return rivals[0]?.ovr ?? nation.strength;
}

/** ¿Está convocado con su selección? */
function isCalledUp(): boolean {
  const current = state;
  const nation = userNation();
  if (!current || !nation) return false;
  const player = current.player;
  if (player.injuryWeeks > 0 || player.fitness < 40) return false;
  const effective = nationalEffective(player);
  if (effective < nation.strength - 8) return false;
  return effective >= nationalBestOvr() - 5;
}

/** Rol del jugador en la selección. */
function nationalRole(): SquadRole {
  const current = state;
  const nation = userNation();
  if (!current || !nation) return SquadRole.NotCalled;
  const player = current.player;
  if (player.injuryWeeks > 0 || player.fitness < 40) return SquadRole.NotCalled;

  const effective = nationalEffective(player);
  const best = nationalBestOvr();
  if (effective >= best - 1.5) return SquadRole.Starter;
  if (effective >= best - 6) return SquadRole.Bench;
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
/** Identidad del futbolista de una partida, para reiniciarla conservándola. */
function restartIdentity(slotId: string): PlayerCreationInput | null {
  const previous = slotId === activeSlotId && state ? state : storageService.loadSlot(slotId);
  if (!previous) return null;
  return {
    firstName: previous.player.firstName,
    lastName: previous.player.lastName,
    countryCode: previous.player.countryCode,
    position: previous.player.position,
    number: previous.player.number,
    foot: previous.player.foot,
  };
}

function restartSlot(slotId: string, choice: DebutChoice | null = null): CareerState | null {
  const input = restartIdentity(slotId);
  if (!input) {
    notify('No se pudo reiniciar: la partida no existe.', 'danger');
    return null;
  }

  const restarted = buildCareer(input, slotId, choice);
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
function createCareer(input: PlayerCreationInput, choice: DebutChoice | null = null): CareerState {
  return buildCareer(input, null, choice);
}

/**
 * Clubes candidatos para empezar la carrera, con el rol previsto en cada uno.
 * Reutiliza una semilla concreta para que lo mostrado coincida con el mundo que
 * se crea después si el jugador elige uno de estos clubes.
 */
function debutOptions(input: PlayerCreationInput): { seed: number; options: DebutOption[] } {
  const seed = randomSeed();
  const world = buildWorld(new Random(seed));
  const previewPlayer = createPlayer(input, new Random(seed));

  const debutDef = bottomTierOf(input.countryCode) ?? LEAGUE_DEFS[LEAGUE_DEFS.length - 1];
  const league = world.leagues[debutDef.id];
  if (!league) return { seed, options: [] };

  // De más modesto a más fuerte, con el rol real calculado sobre la plantilla.
  const ordered = [...league.teamIds]
    .reverse()
    .map((id) => world.teams[id])
    .filter((team): team is Team => Boolean(team));
  const ranked = ordered.map((team) => ({
    team,
    role: projectRole(previewPlayer, team, getSquad(team)).role,
  }));

  const playable = ranked.filter((entry) => entry.role !== SquadRole.NotCalled);
  const source = playable.length >= CONFIG.CAREER.DEBUT_OPTIONS ? playable : ranked;

  const options = pickSpread(source, CONFIG.CAREER.DEBUT_OPTIONS).map(({ team, role }) => ({
    teamId: team.id,
    teamName: team.name,
    teamShort: team.short,
    leagueId: league.id,
    leagueName: league.name,
    tier: league.tier,
    overall: team.overall,
    reputation: team.reputation,
    role,
  }));

  return { seed, options };
}

/** Reparte `count` elementos a lo largo de una lista ordenada (sin repetir). */
function pickSpread<T>(items: T[], count: number): T[] {
  if (items.length === 0 || count <= 0) return [];
  if (items.length <= count) return [...items];

  const picked: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (items.length - 1)) / (count - 1));
    if (!used.has(index)) {
      used.add(index);
      picked.push(items[index]);
    }
  }
  return picked;
}

/**
 * Construye una carrera completa. Si se pasa `slotId`, sobrescribe esa ranura
 * (usado por el reinicio); si no, reserva una nueva. `choice` fija el club de
 * debut y la semilla elegidos en el selector.
 */
function buildCareer(
  input: PlayerCreationInput,
  slotId: string | null,
  choice: DebutChoice | null = null,
): CareerState {
  const seed = choice?.seed ?? randomSeed();
  const worldRng = new Random(seed);
  const world = buildWorld(worldRng);
  rng.state = seed;

  const player = createPlayer(input, rng);

  const debutDef = bottomTierOf(input.countryCode) ?? LEAGUE_DEFS[LEAGUE_DEFS.length - 1];
  const debutLeague = world.leagues[debutDef.id];
  const chosenTeamId = choice?.teamId;
  const debutTeamId =
    chosenTeamId && world.teams[chosenTeamId] ? chosenTeamId : chooseDebutTeam(debutLeague, rng);
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
    calendar: roundDate(1, 1),
    tick: 0,
    player,
    teamId: debutTeamId,
    leagues: world.leagues,
    teams: world.teams,
    competitions: buildSeasonCompetitions(1, world.teams, world.leagues, {}, true),
    nationalCompetitions: {},
    friendlies: [],
    history: [],
    trophies: [],
    inbox: [],
    offers: [],
    lastMatch: null,
    recentResults: [],
    seasonsPlayed: 0,
    previousFinish: null,
  };

  buildNationalSeason(1);

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
  const next = nextUserFixture();
  if (!next) return null;

  const national = next.kind === 'national';
  const nation = userNation();
  const team = currentTeam();
  const userTeamId = national ? nation?.id : team?.id;
  if (!userTeamId) return null;

  const fixture = next.fixture;
  const homeTeam = teamFor(fixture.homeId);
  const awayTeam = teamFor(fixture.awayId);
  if (!homeTeam || !awayTeam) return null;

  const injectAt = (id: string): Player | undefined =>
    id === userTeamId ? current.player : undefined;

  const homeSquad = national
    ? getNationalSquad(homeTeam, injectAt(homeTeam.id))
    : getSquad(homeTeam, injectAt(homeTeam.id));
  const awaySquad = national
    ? getNationalSquad(awayTeam, injectAt(awayTeam.id))
    : getSquad(awayTeam, injectAt(awayTeam.id));

  return new MatchSimulation({
    home: { team: homeTeam, squad: homeSquad },
    away: { team: awayTeam, squad: awaySquad },
    userTeamId,
    userPlayer: current.player,
    userRole: national ? nationalRole() : squadRole(),
    approach,
    round: fixture.round,
    competitionId: next.competitionId,
    neutral: fixture.neutral,
    rng,
  });
}

/** Aplica el resultado del partido del usuario a su expediente. */
function applyUserMatch(result: MatchResult): void {
  const current = requireState();
  const player = current.player;
  const national = result.competitionId.startsWith('nat.');
  const userTeamId = national ? userNation()?.id ?? '' : current.teamId;

  if (result.competitionId === 'nat.friendly') {
    const friendly = current.friendlies.find(
      (item) => item.round === result.round && item.homeId === result.homeId && item.awayId === result.awayId,
    );
    if (friendly) {
      friendly.played = true;
      friendly.homeGoals = result.homeGoals;
      friendly.awayGoals = result.awayGoals;
    }
  }

  const league = current.leagues[result.competitionId];
  if (league) {
    const fixture = fixtureForTeam(league, result.round, current.teamId);
    if (fixture) applyFixtureResult(league, fixture, result.homeGoals, result.awayGoals);
  } else {
    const competition =
      current.competitions[result.competitionId] ?? current.nationalCompetitions[result.competitionId];
    if (competition?.stage === 'groups' || competition?.stage === 'league') {
      const group = groupOfTeam(competition, userTeamId);
      const fixture = group?.fixtures.find(
        (item) => item.round === result.round && item.homeId === result.homeId && item.awayId === result.awayId,
      );
      if (group && fixture) applyFixtureResult(group, fixture, result.homeGoals, result.awayGoals);
    } else if (competition) {
      const leg = cupLegForTeam(competition, userTeamId);
      if (leg && leg.homeId === result.homeId && leg.awayId === result.awayId) {
        leg.played = true;
        leg.homeGoals = result.homeGoals;
        leg.awayGoals = result.awayGoals;
      }
    }
  }

  const stats = result.userStats;
  const accumulator = national ? player.nationalStats : player.seasonStats;
  if (stats) {
    addStats(accumulator, {
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
    accumulator.ratingSum += result.userRating ?? 0;
    accumulator.ratingCount += 1;
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

/** Simula el resto de una jornada de liga en todas las ligas del mundo. */
function simulateLeagueRound(round: number): number {
  const current = requireState();
  let goals = 0;

  for (const league of Object.values(current.leagues)) {
    for (const fixture of fixturesOfRound(league, round)) {
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

/** Ventana de fichajes activa según la jornada en curso (null = cerrada). */
function transferWindow(): TransferWindow | null {
  const current = state;
  if (!current) return null;
  return windowForRound(current.currentRound);
}

/** ¿Está abierto el mercado de fichajes? */
function windowOpen(): boolean {
  return transferWindow() !== null;
}

/** Próxima ventana de fichajes y su fecha de apertura. */
function nextWindow(): { window: TransferWindow; date: GameDate } | null {
  const current = state;
  if (!current || transferWindow()) return null;

  const winterStart = CONFIG.CALENDAR.WINTER_WINDOW.FROM_ROUND;
  if (current.currentRound < winterStart) {
    return { window: 'winter', date: roundDate(current.season, winterStart) };
  }
  return { window: 'summer', date: roundDate(current.season + 1, CONFIG.CALENDAR.SUMMER_WINDOW.FROM_ROUND) };
}

/** Abre una ventana: genera sus ofertas y avisa al jugador. */
function openWindow(window: TransferWindow): void {
  const current = requireState();
  const player = current.player;
  const range = window === 'winter' ? CONFIG.CALENDAR.WINTER_WINDOW : CONFIG.CALENDAR.SUMMER_WINDOW;
  const closeDate = roundDate(current.season, range.TO_ROUND);
  const label = window === 'winter' ? 'invierno' : 'verano';

  const offers = generateOffers(current.teams, current.leagues, player, rng, performanceScore(player.seasonStats));
  current.offers = offers;

  pushMessage(
    MessageKind.Offer,
    `Se abre el mercado de ${label}`,
    offers.length > 0
      ? `${offers.length} club(es) han presentado una oferta. Tienes hasta el ${formatGameDate(closeDate)} para decidir.`
      : `Ningún club ha presentado ofertas en esta ventana.`,
    current.season,
    current.currentRound,
    offers.map((offer) => ({ id: offer.id, label: `Aceptar ${offer.teamName}`, kind: 'accept' as const })),
  );
}

/** Construye copas y continentales de una temporada. */
function buildSeasonCompetitions(
  season: number,
  teams: Record<string, Team>,
  leagues: Record<string, League>,
  cupChampions: Record<string, string>,
  seasonOne: boolean,
): Record<string, Competition> {
  return {
    ...buildCups(CUP_DEFS, teams, season, rng),
    ...buildContinentalCompetitions(
      CONTINENTAL_DEFS,
      { teams, leagues, cupChampions, season, seasonOne },
      rng,
    ),
  };
}

/**
 * Avanza una competición continental una tanda: una jornada de grupos o una
 * pierna eliminatoria. Si la fase de grupos termina, arranca la eliminatoria y
 * devuelve los equipos que caen a la competición secundaria (repesca).
 */
function advanceContinental(competition: Competition, teams: Record<string, Team>): string[] {
  if (competition.championId) return [];

  if (competition.stage === 'groups' || competition.stage === 'league') {
    simulateGroupRound(competition, competition.round, teams, rng);

    const groupRounds = competition.groupRounds ?? 0;
    if (competition.round < groupRounds) {
      competition.round += 1;
      return [];
    }

    const def = continentalDef(competition.id);

    // Fase de liga: top-N a octavos y el resto al playoff.
    if (def?.format === 'league') {
      const standings = currentStandings(competition.groups?.[0] ?? { standings: [] });
      const directCount = def.leagueDirect ?? 8;
      const playoffCount = def.leaguePlayoff ?? 16;
      const direct = standings.slice(0, directCount).map((row) => row.teamId);
      const playoff = standings.slice(directCount, directCount + playoffCount).map((row) => row.teamId);
      startKnockout(competition, direct, playoff, countBracketRounds(playoff.length, direct.length), teams, rng);
      return [];
    }

    const perGroup = def?.qualifiersPerGroup ?? 1;
    const drops = groupRange(competition, perGroup, 1);

    if (def?.playoffPerGroup) {
      const direct = groupQualifiers(competition, perGroup);
      const playoff = groupRange(competition, perGroup, def.playoffPerGroup);
      const entrants = [...playoff, ...(competition.pendingEntrants ?? [])];
      startKnockout(competition, direct, entrants, countBracketRounds(entrants.length, direct.length), teams, rng);
    } else {
      const qualified = groupQualifiers(competition, perGroup);
      startKnockout(competition, [], qualified, countBracketRounds(qualified.length, 0), teams, rng);
    }

    return drops;
  }

  if (competition.stage === 'knockout') {
    simulateCupTick(competition, teams, rng);
  }
  return [];
}

/**
 * Procesa una tanda continental: previas (con repesca a la secundaria), arranque
 * de las fases principales pendientes y avance de las ya en marcha.
 */
function simulateContinentalTick(): void {
  const current = requireState();
  const defsById = new Map(CONTINENTAL_DEFS.map((def) => [def.id, def]));
  const drops = new Map<string, string[]>();
  const justBuilt = new Set<string>();

  // 1. Fase de clasificación (previa) de las principales.
  for (const competition of Object.values(current.competitions)) {
    if (competition.kind !== 'continental' || competition.stage !== 'qualifying') continue;
    const result = simulateQualifyingTick(competition, current.teams, rng);
    if (!result) continue;
    const def = defsById.get(competition.id);
    if (!def) continue;
    drops.set(competition.id, result.losers);
    buildMainStage(
      competition,
      def,
      [...(competition.mainEntrants ?? []), ...result.winners],
      current.teams,
      rng,
    );
    justBuilt.add(competition.id);
  }

  // 2. Secundarias pendientes de recibir las repescas.
  for (const competition of Object.values(current.competitions)) {
    if (competition.kind !== 'continental' || competition.stage !== 'pending') continue;
    const def = defsById.get(competition.id);
    if (!def?.receivesDropsFrom) continue;
    const incoming = drops.get(def.receivesDropsFrom);
    if (!incoming) continue;
    buildMainStage(
      competition,
      def,
      [...(competition.mainEntrants ?? []), ...incoming],
      current.teams,
      rng,
    );
    drops.delete(def.receivesDropsFrom);
    justBuilt.add(competition.id);
  }

  // 3. Fases principales: las principales primero, para poder repescar en los
  //    grupos (los terceros de la Libertadores caen a la Sudamericana).
  const running = Object.values(current.competitions)
    .filter((competition) => competition.kind === 'continental' && !justBuilt.has(competition.id))
    .sort((a, b) => a.tier - b.tier);

  for (const competition of running) {
    if (competition.stage === 'pending' || competition.stage === 'qualifying') continue;
    const def = defsById.get(competition.id);
    if (def?.receivesDropsFrom) {
      const incoming = drops.get(def.receivesDropsFrom);
      if (incoming) {
        competition.pendingEntrants = [...(competition.pendingEntrants ?? []), ...incoming];
        drops.delete(def.receivesDropsFrom);
      }
    }
    const produced = advanceContinental(competition, current.teams);
    if (produced.length > 0) drops.set(competition.id, produced);
  }
}

/* ---------------------------------------------------- Selección nacional */

/** Amistoso del jugador contra una selección. */
function makeFriendly(opponentId: string, round: number, home: boolean): Fixture {
  const user = userNation()?.id ?? '';
  return {
    round,
    homeId: home ? user : opponentId,
    awayId: home ? opponentId : user,
    played: false,
    homeGoals: null,
    awayGoals: null,
  };
}

/** Rival amistoso de nivel parecido. */
function friendlyOpponent(nation: NationalTeam): string {
  const pool = Object.values(NATIONS).filter(
    (other) => other.id !== nation.id && Math.abs(other.strength - nation.strength) <= 10,
  );
  const list = pool.length > 0 ? pool : Object.values(NATIONS).filter((other) => other.id !== nation.id);
  return rng.pick(list).id;
}

/** Prepara las competiciones de selecciones de una temporada. */
function buildNationalSeason(season: number): void {
  const current = requireState();
  current.nationalCompetitions = {};
  current.friendlies = [];

  const nation = userNation();
  if (isTournamentSeason(season)) {
    for (const def of nationalTournamentsFor(isWorldCupSeason(season))) {
      for (const confederation of def.confederations) {
        const id = qualifierId(confederation);
        if (!current.nationalCompetitions[id]) {
          current.nationalCompetitions[id] = buildQualifying(confederation, season, rng);
        }
      }
    }
  } else if (nation) {
    const windows = CONFIG.CALENDAR.NATIONAL_WINDOWS_AFTER_ROUND.length;
    for (let i = 0; i < windows; i += 1) {
      current.friendlies.push(makeFriendly(friendlyOpponent(nation), i + 1, i % 2 === 0));
    }
  }
}

/** Avanza una liguilla de clasificación una jornada. */
function advanceNationalQualifying(competition: Competition): void {
  simulateGroupRound(competition, competition.round, nationTeams(), rng);
  if (competition.round < (competition.groupRounds ?? 0)) competition.round += 1;
  else competition.stage = 'done';
}

/** Construye los torneos cuando la clasificación ha terminado. */
function maybeBuildTournaments(): void {
  const current = requireState();
  const defs = nationalTournamentsFor(isWorldCupSeason(current.season));
  const alreadyBuilt = defs.some((def) => {
    const competition = current.nationalCompetitions[def.id];
    return Boolean(competition && (competition.stage === 'groups' || competition.stage === 'knockout' || competition.championId));
  });
  if (alreadyBuilt) return;

  const allDone = defs.every((def) =>
    def.confederations.every(
      (confederation) => current.nationalCompetitions[qualifierId(confederation)]?.stage === 'done',
    ),
  );
  if (!allDone) return;

  for (const def of defs) {
    const qualified: string[] = [];
    for (const confederation of def.confederations) {
      const qualifying = current.nationalCompetitions[qualifierId(confederation)];
      if (qualifying) qualified.push(...qualifiedFrom(qualifying, def.directSlots[confederation] ?? 0));
    }
    current.nationalCompetitions[def.id] = buildTournament(def, qualified, current.season, rng);
  }
}

/** Avanza un torneo de selecciones una jornada o pierna. */
function advanceNationalTournament(competition: Competition): void {
  if (competition.championId) return;
  if (competition.stage === 'groups') {
    simulateGroupRound(competition, competition.round, nationTeams(), rng);
    if (competition.round < (competition.groupRounds ?? 0)) {
      competition.round += 1;
    } else {
      const def = nationalTournamentDef(competition.id);
      if (def) finishTournamentGroups(competition, def, rng);
    }
    return;
  }
  if (competition.stage === 'knockout') {
    simulateCupTick(competition, nationTeams(), rng);
  }
}

/** Procesa una tanda internacional (ventana o torneo). */
function simulateNationalTick(phase: 'window' | 'tournament'): void {
  const current = requireState();
  if (phase === 'window') {
    for (const competition of Object.values(current.nationalCompetitions)) {
      if (competition.stage === 'league') advanceNationalQualifying(competition);
    }
    maybeBuildTournaments();
    return;
  }

  for (const competition of Object.values(current.nationalCompetitions)) {
    if (competition.stage === 'groups' || competition.stage === 'knockout') {
      advanceNationalTournament(competition);
    }
  }
}

/** Efectos de haber jugado una jornada de liga: recuperación, desarrollo y avance. */
function advanceAfterLeague(round: number, played: boolean, won: boolean): void {
  const current = requireState();
  const league = currentLeague();
  const player = current.player;

  recoverWeekly(player, played, won);

  // Avance de desarrollo cada pocas jornadas: el jugador ve crecer sus atributos.
  if ((round - 1) % CONFIG.PROGRESSION.DEVELOPMENT_INTERVAL === 0) {
    const report = applyDevelopmentTick(player, player.seasonStats, current.season, rng);
    if (report && report.ovrDelta !== 0) {
      pushMessage(
        MessageKind.Info,
        'Informe de desarrollo',
        `${report.narrative} Media global: ${player.ovr}.`,
        current.season,
        round,
      );
    }
  }

  current.currentRound = round + 1;

  if (league && current.currentRound > league.totalRounds) {
    current.phase = SeasonPhase.Offseason;
  }

  // Apertura del mercado de invierno: llegan ofertas de mitad de temporada.
  if (current.currentRound === CONFIG.CALENDAR.WINTER_WINDOW.FROM_ROUND) {
    openWindow('winter');
  }
}

/**
 * Procesa la tanda en curso: aplica el partido del usuario (si lo hay),
 * simula el resto de la jornada (liga o copa) y avanza el calendario.
 */
function commitUserMatch(result: MatchResult | null): RoundSummary {
  const current = requireState();
  const schedule = buildSeasonSchedule(current.season);
  const tick = schedule[current.tick];
  const round = current.currentRound;
  const knownIds = new Set(current.inbox.map((message) => message.id));

  if (result) {
    applyUserMatch(result);
  }

  let goalsScoredElsewhere = 0;
  if (tick && tick.kind === 'league') {
    goalsScoredElsewhere = simulateLeagueRound(tick.round);
    advanceAfterLeague(tick.round, Boolean(result?.userStats), result?.userOutcome === 'win');
  } else if (tick && tick.kind === 'cup') {
    for (const cup of Object.values(current.competitions)) {
      if (cup.kind === 'cup') simulateCupTick(cup, current.teams, rng);
    }
  } else if (tick && tick.kind === 'continental') {
    simulateContinentalTick();
  } else if (tick && tick.kind === 'national') {
    simulateNationalTick(tick.phase);
  }

  current.tick += 1;
  const nextTick = schedule[current.tick];
  if (nextTick) current.calendar = nextTick.date;

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

/**
 * Simula el partido del usuario de golpe. Si la tanda no tiene partido suyo
 * (copa estando eliminado), avanza igualmente el calendario.
 */
function simulateUserMatchQuick(approach: TacticalApproach): MatchResult | null {
  const simulation = createUserMatch(approach);
  const result = simulation ? simulation.simulateAll() : null;
  commitUserMatch(result);
  return result;
}

/**
 * Avanza las tandas en las que el usuario no juega (copa estando eliminado,
 * descansos…) hasta su próximo partido o el cierre de la temporada.
 */
function skipToNextMatch(): void {
  requireState();
  let guard = 0;
  while (!nextUserFixture() && !isSeasonClosed() && guard < 30) {
    commitUserMatch(null);
    guard += 1;
  }
}

/** ¿Ha terminado la temporada? (se han consumido todas las tandas). */
function isSeasonClosed(): boolean {
  const current = state;
  if (!current) return false;
  return current.tick >= buildSeasonSchedule(current.season).length;
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

  // Trofeos de copa y continentales conquistados durante la temporada.
  for (const competition of Object.values(current.competitions)) {
    if (!competition.championId || competition.championId !== current.teamId || !team) continue;
    const continental = competition.kind === 'continental';
    trophies.push({
      id: uid('trophy'),
      name: `Campeón de ${competition.name}`,
      season: current.season,
      teamId: team.id,
      teamName: team.name,
      kind: continental ? 'continental' : 'cup',
    });
    pushMessage(
      MessageKind.Trophy,
      continental ? '¡Título continental!' : '¡Campeón de copa!',
      `${team.name} conquista ${competition.name}. ${player.name} suma un título más a su palmarés.`,
      current.season,
      current.currentRound,
    );
  }

  // Título con la selección nacional.
  const userNationTeam = userNation();
  if (userNationTeam) {
    for (const competition of Object.values(current.nationalCompetitions)) {
      const def = nationalTournamentDef(competition.id);
      if (def && competition.championId === userNationTeam.id) {
        trophies.push({
          id: uid('trophy'),
          name: def.name,
          season: current.season,
          teamId: userNationTeam.id,
          teamName: userNationTeam.name,
          kind: 'national',
        });
        pushMessage(
          MessageKind.Trophy,
          '¡Campeón con la selección!',
          `${userNationTeam.name} conquista ${def.name}.`,
          current.season,
          current.currentRound,
        );
      }
    }
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

  // Fin de cesión: el futbolista regresa a su club propietario antes del mercado.
  if (player.loan && current.season >= player.loan.endSeason) {
    const parent = current.teams[player.loan.parentTeamId];
    current.teamId = player.loan.parentTeamId;
    player.contract.teamId = player.loan.parentTeamId;
    player.contract.wage = player.loan.parentWage;
    pushMessage(
      MessageKind.Info,
      'Fin de la cesión',
      `${player.name} regresa a ${parent?.name ?? 'su club'} tras su cesión.`,
      current.season,
      current.currentRound,
    );
    player.loan = null;
  }

  // Mercado y contrato: las ofertas de verano se deciden con el rendimiento del curso.
  const offers = generateOffers(current.teams, current.leagues, player, rng, growth.performanceScore);
  current.offers = offers;
  player.contract.years -= 1;
  if (player.contract.years <= 0) {
    player.contract.years = 2;
    player.contract.wage = Math.max(player.contract.wage, suggestedWage(player.ovr));
    pushMessage(
      MessageKind.Info,
      'Renovación automática',
      `${currentTeam()?.name ?? 'El club'} ejecuta la renovación por dos temporadas más.`,
      current.season,
      current.currentRound,
    );
  }
  if (offers.length > 0) {
    pushMessage(
      MessageKind.Offer,
      `${offers.length} oferta(s) sobre la mesa`,
      'Hay clubes interesados en tu fichaje o en una cesión. Revisa el mercado para decidir tu futuro.',
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
  current.calendar = roundDate(current.season, 1);
  current.tick = 0;
  current.phase = SeasonPhase.League;
  current.lastMatch = null;
  current.recentResults = [];

  // Nuevas competiciones a partir de la clasificación del curso que acaba.
  const cupChampions: Record<string, string> = {};
  for (const competition of Object.values(current.competitions)) {
    if (competition.kind === 'cup' && competition.countryCode && competition.championId) {
      cupChampions[competition.countryCode] = competition.championId;
    }
  }
  const nextCompetitions = buildSeasonCompetitions(
    current.season,
    current.teams,
    current.leagues,
    cupChampions,
    false,
  );

  for (const item of Object.values(current.leagues)) {
    resetLeagueForSeason(item, rng);
  }

  current.competitions = nextCompetitions;
  buildNationalSeason(current.season);

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

/** Acepta una oferta de fichaje o de cesión y cambia al jugador de club. */
function acceptOffer(offerId: string): boolean {
  const current = requireState();
  if (!windowOpen()) {
    notify('El mercado está cerrado: solo puedes cambiar de club en las ventanas de verano e invierno.', 'warning');
    return false;
  }
  const offer = current.offers.find((item) => item.id === offerId);
  if (!offer) return false;
  const team = current.teams[offer.teamId];
  if (!team) return false;

  const player = current.player;
  const previousTeam = current.teams[current.teamId];

  if (offer.kind === 'loan') {
    // Cesión: se conserva el contrato original y se guarda el club propietario.
    const parentTeamId = current.teamId;
    player.loan = {
      teamId: team.id,
      parentTeamId,
      parentWage: player.contract.wage,
      endSeason: current.season + 1,
    };
    current.teamId = team.id;
    player.contract.teamId = team.id;
    player.contract.wage = offer.wage;
    player.morale = Math.min(100, player.morale + 5);
    current.offers = current.offers.filter((item) => item.id !== offerId);

    pushMessage(
      MessageKind.Transfer,
      'Cesión confirmada',
      `${player.name} se marcha cedido a ${team.name} (${offer.leagueName}) durante una temporada. Al terminar regresará a ${previousTeam?.name ?? 'su club'}.`,
      current.season,
      current.currentRound,
    );

    persist();
    notify(`Cedido a ${team.name}`, 'success');
    return true;
  }

  current.teamId = team.id;
  player.loan = null;
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

/**
 * Solicita ofertas de cesión a mitad de temporada. Pensado para un futbolista
 * sin minutos que busca jugar en un club donde sería titular.
 */
function requestLoan(): number {
  const current = requireState();
  const player = current.player;

  if (!windowOpen()) {
    notify('El mercado está cerrado: las cesiones solo se cierran en las ventanas de fichajes.', 'warning');
    return 0;
  }

  if (player.loan) {
    notify('Ya estás cedido esta temporada.', 'warning');
    return 0;
  }

  const generated = generateLoanOffers(current.teams, current.leagues, player, rng, CONFIG.MARKET.MAX_LOAN_OFFERS);
  const known = new Set(current.offers.map((item) => `${item.kind}:${item.teamId}`));
  const fresh = generated.filter((item) => !known.has(`${item.kind}:${item.teamId}`));

  current.offers = [...current.offers, ...fresh].slice(0, CONFIG.MARKET.MAX_ACTIVE_OFFERS);
  persist();

  if (fresh.length === 0) {
    notify('Ningún club ha pedido tu cesión por ahora.', 'info');
  } else {
    notify(`${fresh.length} club(es) te quieren cedido.`, 'success');
  }
  return fresh.length;
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

  /** Clubes candidatos para elegir dónde empezar la carrera. */
  debutOptions,

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

  /** Identidad guardada (nombre, país, posición, dorsal y pie) de una partida. */
  restartIdentity,

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
  nextCompetition,
  nextUserFixture,
  userCup,
  userNation,
  isCalledUp,
  nationalRole,
  squadRole,
  transferWindow,
  windowOpen,
  nextWindow,
  createUserMatch,
  commitUserMatch,
  simulateUserMatchQuick,
  skipToNextMatch,
  finishSeason,
  acceptOffer,
  rejectOffers,
  requestLoan,
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

  /** Clasificación de un grupo de competición. */
  standingsOfCompetitionGroup(group: { standings: StandingRow[] }): StandingRow[] {
    return currentStandings(group);
  },

  /** Se llama al terminar la temporada si el calendario está agotado. */
  needsSeasonClose(): boolean {
    return isSeasonClosed();
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
