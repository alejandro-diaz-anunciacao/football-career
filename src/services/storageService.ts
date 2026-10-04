import { CONFIG } from '../data/config';
import { SquadRole, emptySeasonGrowth, emptySeasonStats } from '../models';
import type { CareerState, Fixture, League, Player, Position } from '../models';
import { DEFAULT_FOCUS } from '../engine/progressionEngine';
import { roundDate } from '../engine/calendar';
import { buildSeasonSchedule } from '../engine/schedule';

/**
 * Fila compacta de un partido: `[jornada, local, visitante, jugado, gf, gc]`.
 * Los equipos se guardan como índice dentro de `league.teamIds` (o como id si no
 * se encuentra) para reducir drásticamente el tamaño del guardado.
 */
type CompactFixture = [number, number | string, number | string, 0 | 1, number, number];

/** Convierte `-1` en `null` (partido sin jugar). */
function goalsFromCompact(value: number): number | null {
  return value < 0 ? null : value;
}

/** Serializa el estado a un formato compacto apto para localStorage. */
function packState(state: CareerState): unknown {
  const leagues: Record<string, unknown> = {};
  for (const [id, league] of Object.entries(state.leagues)) {
    const index = new Map(league.teamIds.map((teamId, position) => [teamId, position]));
    leagues[id] = {
      ...league,
      fixtures: league.fixtures.map((fixture) => [
        fixture.round,
        index.get(fixture.homeId) ?? fixture.homeId,
        index.get(fixture.awayId) ?? fixture.awayId,
        fixture.played ? 1 : 0,
        fixture.homeGoals ?? -1,
        fixture.awayGoals ?? -1,
      ]),
    };
  }
  return { ...state, leagues };
}

/** Reconstruye el estado desde el formato compacto (tolera el formato extendido). */
function unpackState(raw: unknown): CareerState {
  const packed = raw as CareerState & {
    leagues: Record<string, Omit<League, 'fixtures'> & { fixtures: unknown[] }>;
  };

  const leagues: Record<string, League> = {};
  for (const [id, league] of Object.entries(packed.leagues)) {
    const teamIds = league.teamIds ?? [];
    const resolve = (value: number | string): string =>
      typeof value === 'number' ? teamIds[value] ?? '' : value;

    const fixtures: Fixture[] = (league.fixtures ?? []).map((entry) => {
      if (!Array.isArray(entry)) return entry as Fixture;
      const [round, home, away, played, homeGoals, awayGoals] = entry as unknown as CompactFixture;
      return {
        round,
        homeId: resolve(home),
        awayId: resolve(away),
        played: played === 1,
        homeGoals: goalsFromCompact(homeGoals),
        awayGoals: goalsFromCompact(awayGoals),
      };
    });

    leagues[id] = { ...(league as League), fixtures };
  }

  return { ...(raw as CareerState), leagues };
}

/**
 * Metadatos de una partida guardada.
 * Es deliberadamente ligero: el listado de partidas se pinta sin necesidad de
 * deserializar el estado completo (que puede ocupar varios cientos de KB), y
 * nunca incluye el potencial oculto del futbolista.
 */
export interface SaveSlot {
  id: string;
  createdAt: number;
  savedAt: number;
  playerName: string;
  countryCode: string;
  nationality: string;
  position: Position;
  age: number;
  ovr: number;
  teamId: string;
  teamName: string;
  leagueName: string;
  tier: number;
  season: number;
  trophies: number;
  seasonsPlayed: number;
}

/** Resultado de una operación de guardado. */
export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Motivo por el que no se pudo crear una partida. */
export type CreateSlotResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Cuota de almacenamiento ocupada aproximadamente, en bytes. */
function byteLength(value: string): number {
  return new Blob([value]).size;
}

/**
 * Persistencia multi-partida sobre localStorage.
 *
 *  - `footballer-sim:slots:v1`      → índice con los metadatos de cada partida.
 *  - `footballer-sim:slot:<id>:v1`  → estado completo de una partida.
 *
 * Se conserva la lectura de la clave antigua (`footballer-sim:save:v1`) para
 * migrar partidas creadas con la versión de guardado único.
 */
export const storageService = {
  /** Clave del índice de partidas. */
  indexKey(): string {
    return CONFIG.CAREER.SLOT_INDEX_KEY;
  },

  /** Clave del estado de una partida concreta. */
  slotKey(id: string): string {
    return `${CONFIG.CAREER.SLOT_KEY_PREFIX}${id}:v1`;
  },

  /** Lee el índice de partidas (tolerante a datos corruptos). */
  listSlots(): SaveSlot[] {
    try {
      const raw = globalThis.localStorage.getItem(this.indexKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SaveSlot[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((slot) => slot && typeof slot.id === 'string')
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch {
      return [];
    }
  },

  /** Sobrescribe el índice de partidas. */
  writeIndex(slots: SaveSlot[]): void {
    try {
      globalThis.localStorage.setItem(this.indexKey(), JSON.stringify(slots));
    } catch {
      /* almacenamiento no disponible */
    }
  },

  /** ¿Hay alguna partida guardada? */
  hasSlots(): boolean {
    return this.listSlots().length > 0;
  },

  /** Genera un identificador de partida libre. */
  newSlotId(): string {
    const existing = new Set(this.listSlots().map((slot) => slot.id));
    for (let i = 0; i < 200; i += 1) {
      const candidate = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
      if (!existing.has(candidate)) return candidate;
    }
    return `s${Date.now().toString(36)}`;
  },

  /** Crea la entrada de una partida nueva en el índice. */
  createSlot(state: CareerState): CreateSlotResult {
    const slots = this.listSlots();
    if (slots.length >= CONFIG.CAREER.MAX_SLOTS) {
      return { ok: false, error: `No puedes tener más de ${CONFIG.CAREER.MAX_SLOTS} partidas guardadas.` };
    }
    const id = this.newSlotId();
    const result = this.saveSlot(id, state);
    if (!result.ok) return { ok: false, error: result.error ?? 'No se pudo guardar la partida.' };
    return { ok: true, id };
  },

  /** Guarda (o actualiza) el estado de una partida y su entrada en el índice. */
  saveSlot(id: string, state: CareerState): SaveResult {
    try {
      const payload: CareerState = { ...state, savedAt: Date.now() };
      state.savedAt = payload.savedAt;
      globalThis.localStorage.setItem(this.slotKey(id), JSON.stringify(packState(payload)));

      const slot = this.metadataOf(id, state);
      const slots = this.listSlots().filter((entry) => entry.id !== id);
      slots.unshift(slot);
      this.writeIndex(slots.slice(0, CONFIG.CAREER.MAX_SLOTS));
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al guardar';
      const quota = /quota|exceeded/i.test(message);
      return {
        ok: false,
        error: quota
          ? 'Almacenamiento lleno. Elimina alguna partida antigua para continuar.'
          : message,
      };
    }
  },

  /** Construye los metadatos de una partida. */
  metadataOf(id: string, state: CareerState): SaveSlot {
    const team = state.teams[state.teamId];
    const league = team ? state.leagues[team.leagueId] : undefined;
    return {
      id,
      createdAt: state.createdAt,
      savedAt: Date.now(),
      playerName: state.player.name,
      countryCode: state.player.countryCode,
      nationality: state.player.nationality,
      position: state.player.position,
      age: state.player.age,
      ovr: state.player.ovr,
      teamId: state.teamId,
      teamName: team?.name ?? 'Sin equipo',
      leagueName: league?.name ?? 'Sin liga',
      tier: league?.tier ?? 1,
      season: state.season,
      trophies: state.trophies.length,
      seasonsPlayed: state.seasonsPlayed,
    };
  },

  /** Recupera el estado completo de una partida. */
  loadSlot(id: string): CareerState | null {
    try {
      const raw = globalThis.localStorage.getItem(this.slotKey(id));
      if (!raw) return null;
      const parsed = unpackState(JSON.parse(raw));
      if (!parsed || typeof parsed !== 'object' || !parsed.player || !parsed.leagues) return null;
      return this.migrate(parsed);
    } catch {
      return null;
    }
  },

  /** Elimina una partida y su entrada en el índice. */
  deleteSlot(id: string): void {
    try {
      globalThis.localStorage.removeItem(this.slotKey(id));
      this.writeIndex(this.listSlots().filter((slot) => slot.id !== id));
    } catch {
      /* almacenamiento no disponible */
    }
  },

  /** Borra todas las partidas. */
  clearAll(): void {
    for (const slot of this.listSlots()) {
      try {
        globalThis.localStorage.removeItem(this.slotKey(slot.id));
      } catch {
        /* ignorado */
      }
    }
    try {
      globalThis.localStorage.removeItem(this.indexKey());
      globalThis.localStorage.removeItem(CONFIG.CAREER.SAVE_KEY);
    } catch {
      /* ignorado */
    }
  },

  /**
   * Migra la partida de la versión de guardado único a una ranura.
   * Devuelve el identificador de la ranura creada, o null si no había nada.
   */
  migrateLegacySave(): string | null {
    try {
      const raw = globalThis.localStorage.getItem(CONFIG.CAREER.SAVE_KEY);
      if (!raw) return null;
      if (this.listSlots().length > 0) {
        globalThis.localStorage.removeItem(CONFIG.CAREER.SAVE_KEY);
        return null;
      }
      const parsed = JSON.parse(raw) as CareerState;
      if (!parsed || !parsed.player) {
        globalThis.localStorage.removeItem(CONFIG.CAREER.SAVE_KEY);
        return null;
      }
      const migrated = this.migrate(unpackState(parsed));
      const created = this.createSlot(migrated);
      globalThis.localStorage.removeItem(CONFIG.CAREER.SAVE_KEY);
      return created.ok ? created.id : null;
    } catch {
      return null;
    }
  },

  /** Comprueba si una partida concreta existe. */
  slotExists(id: string): boolean {
    try {
      return globalThis.localStorage.getItem(this.slotKey(id)) !== null;
    } catch {
      return false;
    }
  },

  /** Tamaño aproximado ocupado por una partida (KB). */
  slotSizeKb(id: string): number {
    try {
      const raw = globalThis.localStorage.getItem(this.slotKey(id));
      return raw ? Math.round(byteLength(raw) / 1024) : 0;
    } catch {
      return 0;
    }
  },

  /** Exporta una partida como texto (copia de seguridad). */
  exportToJson(state: CareerState): string {
    return JSON.stringify({ ...state, savedAt: Date.now() }, null, 2);
  },

  /** Importa una partida desde texto. */
  importFromJson(json: string): CareerState | null {
    try {
      const parsed = unpackState(JSON.parse(json));
      if (!parsed || !parsed.player || !parsed.leagues) return null;
      return this.migrate(parsed);
    } catch {
      return null;
    }
  },

  /** Aplica migraciones de versión al estado cargado. */
  migrate(state: CareerState): CareerState {
    const migrated = { ...state };
    if (!Array.isArray(migrated.recentResults)) migrated.recentResults = [];
    if (!Array.isArray(migrated.offers)) migrated.offers = [];
    if (!Array.isArray(migrated.inbox)) migrated.inbox = [];
    if (!Array.isArray(migrated.trophies)) migrated.trophies = [];
    if (!Array.isArray(migrated.history)) migrated.history = [];

    // Rellena los campos de mercado añadidos después de la versión inicial.
    migrated.offers = migrated.offers.map((offer) => ({
      ...offer,
      kind: offer.kind ?? 'transfer',
      projectedRole: offer.projectedRole ?? SquadRole.NotCalled,
    }));

    // Rellena los campos de desarrollo añadidos después de la versión inicial.
    const player = migrated.player as Player | undefined;
    if (player) {
      player.trainingFocus = player.trainingFocus ?? DEFAULT_FOCUS[player.position] ?? 'passing';
      player.seasonGrowth = player.seasonGrowth ?? emptySeasonGrowth(player.ovr);
      player.lastGrowth = player.lastGrowth ?? null;
      player.loan = player.loan ?? null;
      player.nationalStats = player.nationalStats ?? emptySeasonStats();
      player.rolePenalty = player.rolePenalty ?? null;
    }

    // Eventos aleatorios: las partidas antiguas no los tenían.
    migrated.pendingEvent = migrated.pendingEvent ?? null;
    migrated.lastEventRound = migrated.lastEventRound ?? 0;
    migrated.eventsThisSeason = migrated.eventsThisSeason ?? 0;
    migrated.eventHistory = migrated.eventHistory ?? {};

    // Calendario: en partidas antiguas se deriva de la jornada en curso.
    migrated.calendar = migrated.calendar ?? roundDate(migrated.season, migrated.currentRound);

    // Copas y tanda del calendario: las partidas antiguas no las tenían.
    migrated.competitions = migrated.competitions ?? {};
    for (const competition of Object.values(migrated.competitions)) {
      competition.format = competition.format ?? 'knockout';
      competition.stage = competition.stage ?? 'knockout';
      competition.tier = competition.tier ?? 1;
      competition.pendingEntrants = competition.pendingEntrants ?? [];
      competition.mainEntrants = competition.mainEntrants ?? competition.teamIds;
    }

    // Competiciones de selecciones y amistosos: las partidas antiguas no los tenían.
    migrated.nationalCompetitions = migrated.nationalCompetitions ?? {};
    for (const competition of Object.values(migrated.nationalCompetitions)) {
      competition.format = competition.format ?? 'groups';
      competition.stage = competition.stage ?? 'done';
      competition.tier = competition.tier ?? 1;
      competition.pendingEntrants = competition.pendingEntrants ?? [];
      competition.mainEntrants = competition.mainEntrants ?? competition.teamIds;
    }
    migrated.friendlies = migrated.friendlies ?? [];

    if (migrated.tick == null) {
      const round = Math.max(1, migrated.currentRound);
      const schedule = buildSeasonSchedule(migrated.season);
      const index = schedule.findIndex((tick) => tick.kind === 'league' && tick.round === round);
      migrated.tick = index >= 0 ? index : 0;
    }

    migrated.version = CONFIG.CAREER.SAVE_VERSION;
    return migrated;
  },
};
