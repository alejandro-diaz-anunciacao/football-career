import { Continent } from '../models';

/** Información descriptiva de un continente y sus federaciones. */
export interface ContinentInfo {
  id: Continent;
  name: string;
  /** Códigos de país con ligas jugables. */
  countryCodes: string[];
  /** Emoji decorativo para la interfaz. */
  icon: string;
}

/** Mapa de continentes soportados. */
export const CONTINENTS: readonly ContinentInfo[] = [
  {
    id: Continent.Europe,
    name: 'Europa',
    countryCodes: ['ES', 'GB', 'DE', 'IT', 'FR'],
    icon: '🇪🇺',
  },
  {
    id: Continent.SouthAmerica,
    name: 'Sudamérica',
    countryCodes: ['AR', 'BR'],
    icon: '🌎',
  },
  {
    id: Continent.NorthAmerica,
    name: 'Norteamérica',
    countryCodes: ['MX', 'US'],
    icon: '🌎',
  },
  {
    id: Continent.Asia,
    name: 'Asia',
    countryCodes: ['JP', 'SA'],
    icon: '🌏',
  },
  {
    id: Continent.Africa,
    name: 'África',
    countryCodes: ['EG', 'MA'],
    icon: '🌍',
  },
];

/** Información de un país con ligas. */
export interface CountryInfo {
  code: string;
  name: string;
  continent: Continent;
  /** Nacionalidad en castellano. */
  nationality: string;
  /** Número de categorías con liga simulada. */
  tiers: number;
}

/** Catálogo de países jugables. */
export const COUNTRIES: readonly CountryInfo[] = [
  { code: 'ES', name: 'España', continent: Continent.Europe, nationality: 'Española', tiers: 4 },
  { code: 'GB', name: 'Inglaterra', continent: Continent.Europe, nationality: 'Inglesa', tiers: 4 },
  { code: 'DE', name: 'Alemania', continent: Continent.Europe, nationality: 'Alemana', tiers: 3 },
  { code: 'IT', name: 'Italia', continent: Continent.Europe, nationality: 'Italiana', tiers: 3 },
  { code: 'FR', name: 'Francia', continent: Continent.Europe, nationality: 'Francesa', tiers: 2 },
  { code: 'AR', name: 'Argentina', continent: Continent.SouthAmerica, nationality: 'Argentina', tiers: 2 },
  { code: 'BR', name: 'Brasil', continent: Continent.SouthAmerica, nationality: 'Brasileña', tiers: 2 },
  { code: 'MX', name: 'México', continent: Continent.NorthAmerica, nationality: 'Mexicana', tiers: 1 },
  { code: 'US', name: 'Estados Unidos', continent: Continent.NorthAmerica, nationality: 'Estadounidense', tiers: 1 },
  { code: 'JP', name: 'Japón', continent: Continent.Asia, nationality: 'Japonesa', tiers: 1 },
  { code: 'SA', name: 'Arabia Saudí', continent: Continent.Asia, nationality: 'Saudí', tiers: 1 },
  { code: 'EG', name: 'Egipto', continent: Continent.Africa, nationality: 'Egipcia', tiers: 1 },
  { code: 'MA', name: 'Marruecos', continent: Continent.Africa, nationality: 'Marroquí', tiers: 1 },
];

/** Busca un país por código. */
export function findCountry(code: string): CountryInfo | undefined {
  return COUNTRIES.find((country) => country.code === code);
}

/** Devuelve la lista de países de un continente. */
export function countriesOf(continent: Continent): CountryInfo[] {
  return COUNTRIES.filter((country) => country.continent === continent);
}
