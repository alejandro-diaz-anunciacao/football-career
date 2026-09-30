import { CONFIG } from '../data/config';
import { clamp, round } from '../utils/math';
import type { League, Player, Team, TransferOffer } from '../models';
import type { Random } from '../utils/random';
import { uid } from '../services/idService';
import { marketValue, suggestedWage } from './matchEngine';

/** Frases de presentación de una oferta. */
const PITCHES = [
  'Tendrás minutos desde el primer día.',
  'Buscamos un proyecto de futuro y cuentas con nuestra confianza.',
  'El entrenador te quiere como pieza clave de la rotación.',
  'Ven a crecer con nosotros: competimos por ascender.',
  'Aquí encontrarás escaparate para dar el salto.',
  'Apuestas fuertes por tu progresión a medio plazo.',
] as const;

/** Clubes potencialmente interesados en el jugador. */
export function interestedTeams(teams: Record<string, Team>, player: Player): Team[] {
  const currentTeamId = player.contract.teamId;
  const ceiling = player.ovr + 13;
  const floor = Math.max(30, player.ovr - 5);

  return Object.values(teams)
    .filter((team) => team.id !== currentTeamId)
    .filter((team) => team.overall <= ceiling && team.overall >= floor)
    .filter((team) => team.reputation >= 12)
    .sort((a, b) => b.reputation - a.reputation);
}

/** Genera las ofertas de fichaje disponibles al cierre de temporada. */
export function generateOffers(teams: Record<string, Team>, leagues: Record<string, League>, player: Player, rng: Random): TransferOffer[] {
  const candidates = interestedTeams(teams, player);
  if (candidates.length === 0) return [];

  const target = player.ovr + 4;
  const offers: TransferOffer[] = [];

  const sampleSize = Math.min(candidates.length, CONFIG.MARKET.MAX_OFFERS * 3);
  for (const team of candidates.slice(0, sampleSize)) {
    if (offers.length >= CONFIG.MARKET.MAX_OFFERS) break;

    // Preferencia por clubs cercanos al objetivo de progresión.
    const affinity = 1 / (1 + Math.abs(team.overall - target) * 0.35);
    const probability = clamp(CONFIG.MARKET.OFFER_CHANCE * affinity * 1.4, 0.05, 0.92);
    if (!rng.chance(probability)) continue;

    const league = leagues[team.leagueId];
    const fee = round(marketValue(player) * rng.float(1.05, 1.85), 2);
    const wage = Math.round(
      suggestedWage((player.ovr + team.overall) / 2) * (1 + team.reputation / 220) * rng.float(0.9, 1.25),
    );

    offers.push({
      id: uid('offer'),
      teamId: team.id,
      teamName: team.name,
      leagueId: team.leagueId,
      leagueName: league?.name ?? 'Liga desconocida',
      tier: league?.tier ?? 1,
      continent: team.continent,
      wage: Math.max(CONFIG.MARKET.MIN_WAGE, wage),
      years: rng.int(2, 5),
      fee,
      pitch: rng.pick(PITCHES),
    });
  }

  return offers.sort((a, b) => b.wage - a.wage);
}

/**
 * Elige el club de debut: un equipo modesto de la categoría más baja del país,
 * con más probabilidad de recalar en los clubes de menor potencial.
 */
export function chooseDebutTeam(league: League, rng: Random): string {
  const weights = league.teamIds.map((teamId, index) => ({
    value: teamId,
    weight: index + 1.5,
  }));
  return rng.weighted(weights);
}

/** Valor de mercado del jugador (fachada del motor de partidos). */
export { marketValue };

/** Salario sugerido para una media global. */
export { suggestedWage };
