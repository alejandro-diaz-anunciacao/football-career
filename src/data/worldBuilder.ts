import { clamp, round } from '../utils/math';
import type { Random } from '../utils/random';
import type { League, Team } from '../models';
import { LEAGUE_DEFS } from './leagues';
import { FILIAL_DEFS } from './filials';

/** Resultado de construir el mundo: ligas y equipos indexados por id. */
export interface World {
  leagues: Record<string, League>;
  teams: Record<string, Team>;
}

/** Identificador determinista de equipo. */
export function teamIdOf(leagueId: string, index: number): string {
  return `t.${leagueId}.${index}`;
}

/** Construye un nombre corto (tres letras) a partir del nombre completo. */
export function shortNameOf(name: string): string {
  const cleaned = name
    .replace(/\b(FC|CF|CD|SD|UD|RC|RCD|CA|AC|AS|SC|SV|VfB|VfL|TSV|US|SS|SSC|FK|HSC)\b/gi, '')
    .trim();
  const words = cleaned.split(/\s+/).filter((word) => word.length > 1);
  if (words.length >= 2) {
    return (words[0].slice(0, 1) + words[1].slice(0, 2)).toUpperCase();
  }
  const single = (words[0] ?? name).replace(/[^A-Za-zÀ-ÿ]/g, '');
  return single.slice(0, 3).toUpperCase();
}

/**
 * Genera los atributos de un equipo en función de su posición en la tabla
 * teórica de la categoría (`topOverall` menos una degradación lineal + ruido).
 */
function buildTeam(
  leagueId: string,
  country: string,
  countryCode: string,
  continent: Team['continent'],
  tier: number,
  index: number,
  total: number,
  topOverall: number,
  name: string,
  rng: Random,
): Team {
  const spread = 18.5;
  const base = topOverall - (index / Math.max(1, total - 1)) * spread;
  const overall = clamp(round(base + rng.gauss(0, 1.3)), 40, 92);

  const attack = clamp(round(overall + rng.gauss(0.8, 2.6)), 38, 95);
  const midfield = clamp(round(overall + rng.gauss(0, 2.2)), 38, 95);
  const defense = clamp(round(overall - rng.gauss(0.8, 2.4)), 38, 95);

  // El prestigio combina la categoría y la posición dentro de ella.
  const tierWeight = tier === 1 ? 42 : tier === 2 ? 26 : tier === 3 ? 14 : 6;
  const reputation = clamp(round(tierWeight + (1 - index / Math.max(1, total - 1)) * 34 + rng.gauss(0, 3)), 5, 100);

  const id = teamIdOf(leagueId, index);
  return {
    id,
    name,
    short: shortNameOf(name),
    leagueId,
    country,
    countryCode,
    continent,
    attack,
    midfield,
    defense,
    overall,
    reputation,
  };
}

/**
 * Construye el mundo completo a partir de las definiciones estáticas.
 * Los identificadores de equipo son deterministas, por lo que la misma semilla
 * produce exactamente el mismo universo de clubes.
 */
export function buildWorld(rng: Random): World {
  const teams: Record<string, Team> = {};
  const leagues: Record<string, League> = {};

  for (const def of LEAGUE_DEFS) {
    const total = def.teams.length;
    def.teams.forEach((name, index) => {
      const team = buildTeam(
        def.id,
        def.country,
        def.countryCode,
        def.continent,
        def.tier,
        index,
        total,
        def.topOverall,
        name,
        rng,
      );
      teams[team.id] = team;
    });

    const teamIds = def.teams.map((_, index) => teamIdOf(def.id, index));
    leagues[def.id] = {
      id: def.id,
      name: def.name,
      country: def.country,
      countryCode: def.countryCode,
      continent: def.continent,
      tier: def.tier,
      teamIds,
      standings: [],
      fixtures: [],
      currentRound: 1,
      totalRounds: (teamIds.length - 1) * 2,
      promotionSlots: def.promotionSlots,
      relegationSlots: def.relegationSlots,
      aboveLeagueId: null,
      belowLeagueId: null,
      strength: def.topOverall,
    };
  }

  // Encadenado de la pirámide dentro de cada país.
  const byCountry = new Map<string, League[]>();
  for (const league of Object.values(leagues)) {
    const list = byCountry.get(league.countryCode) ?? [];
    list.push(league);
    byCountry.set(league.countryCode, list);
  }
  for (const list of byCountry.values()) {
    list.sort((a, b) => a.tier - b.tier);
    list.forEach((league, index) => {
      league.aboveLeagueId = index > 0 ? list[index - 1].id : null;
      league.belowLeagueId = index < list.length - 1 ? list[index + 1].id : null;
    });
  }

  linkFilials(teams);

  return { leagues, teams };
}

/** Enlaza los equipos filiales con sus primeros equipos por país + nombre. */
function linkFilials(teams: Record<string, Team>): void {
  const byCountryName = new Map<string, Team>();
  for (const team of Object.values(teams)) {
    byCountryName.set(`${team.countryCode}:${team.name}`, team);
  }

  for (const def of FILIAL_DEFS) {
    const filial = byCountryName.get(`${def.countryCode}:${def.filial}`);
    const parent = byCountryName.get(`${def.countryCode}:${def.parent}`);
    if (!filial || !parent) continue;
    filial.parentTeamId = parent.id;
    parent.reserveTeamId = filial.id;
  }
}

/** Devuelve los equipos de una liga en el orden de su clasificación inicial. */
export function teamsOfLeague(world: World, leagueId: string): Team[] {
  const league = world.leagues[leagueId];
  if (!league) return [];
  return league.teamIds.map((id) => world.teams[id]).filter((team): team is Team => Boolean(team));
}
