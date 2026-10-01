import type { Confederation, NationalTeam } from '../models';

/** Identificador de una selección a partir de su código. */
export function nationId(code: string): string {
  return `nat.${code}`;
}

interface NationSeed {
  code: string;
  name: string;
  confederation: Confederation;
  strength: number;
}

/** Catálogo de selecciones (jugables y no jugables). */
const SEEDS: readonly NationSeed[] = [
  /* ------------------------------------------------------------------ UEFA */
  { code: 'ES', name: 'España', confederation: 'UEFA', strength: 88 },
  { code: 'GB', name: 'Inglaterra', confederation: 'UEFA', strength: 89 },
  { code: 'FR', name: 'Francia', confederation: 'UEFA', strength: 87 },
  { code: 'DE', name: 'Alemania', confederation: 'UEFA', strength: 85 },
  { code: 'IT', name: 'Italia', confederation: 'UEFA', strength: 84 },
  { code: 'PT', name: 'Portugal', confederation: 'UEFA', strength: 86 },
  { code: 'NL', name: 'Países Bajos', confederation: 'UEFA', strength: 84 },
  { code: 'BE', name: 'Bélgica', confederation: 'UEFA', strength: 83 },
  { code: 'HR', name: 'Croacia', confederation: 'UEFA', strength: 82 },
  { code: 'DK', name: 'Dinamarca', confederation: 'UEFA', strength: 80 },
  { code: 'CH', name: 'Suiza', confederation: 'UEFA', strength: 80 },
  { code: 'AT', name: 'Austria', confederation: 'UEFA', strength: 79 },
  { code: 'RS', name: 'Serbia', confederation: 'UEFA', strength: 78 },
  { code: 'TR', name: 'Turquía', confederation: 'UEFA', strength: 77 },
  { code: 'UA', name: 'Ucrania', confederation: 'UEFA', strength: 77 },
  { code: 'NO', name: 'Noruega', confederation: 'UEFA', strength: 77 },
  { code: 'SCT', name: 'Escocia', confederation: 'UEFA', strength: 76 },
  { code: 'PL', name: 'Polonia', confederation: 'UEFA', strength: 76 },
  { code: 'SE', name: 'Suecia', confederation: 'UEFA', strength: 75 },
  { code: 'HU', name: 'Hungría', confederation: 'UEFA', strength: 75 },
  { code: 'CZ', name: 'Chequia', confederation: 'UEFA', strength: 75 },
  { code: 'GR', name: 'Grecia', confederation: 'UEFA', strength: 74 },
  { code: 'WAL', name: 'Gales', confederation: 'UEFA', strength: 73 },
  { code: 'RO', name: 'Rumanía', confederation: 'UEFA', strength: 73 },
  { code: 'AL', name: 'Albania', confederation: 'UEFA', strength: 72 },
  { code: 'GE', name: 'Georgia', confederation: 'UEFA', strength: 72 },
  { code: 'IE', name: 'Irlanda', confederation: 'UEFA', strength: 72 },
  { code: 'IS', name: 'Islandia', confederation: 'UEFA', strength: 70 },

  /* -------------------------------------------------------------- CONMEBOL */
  { code: 'AR', name: 'Argentina', confederation: 'CONMEBOL', strength: 89 },
  { code: 'BR', name: 'Brasil', confederation: 'CONMEBOL', strength: 87 },
  { code: 'UY', name: 'Uruguay', confederation: 'CONMEBOL', strength: 82 },
  { code: 'CO', name: 'Colombia', confederation: 'CONMEBOL', strength: 81 },
  { code: 'EC', name: 'Ecuador', confederation: 'CONMEBOL', strength: 78 },
  { code: 'CL', name: 'Chile', confederation: 'CONMEBOL', strength: 75 },
  { code: 'PE', name: 'Perú', confederation: 'CONMEBOL', strength: 75 },
  { code: 'PY', name: 'Paraguay', confederation: 'CONMEBOL', strength: 74 },
  { code: 'VE', name: 'Venezuela', confederation: 'CONMEBOL', strength: 70 },
  { code: 'BO', name: 'Bolivia', confederation: 'CONMEBOL', strength: 68 },

  /* -------------------------------------------------------------- CONCACAF */
  { code: 'MX', name: 'México', confederation: 'CONCACAF', strength: 80 },
  { code: 'US', name: 'Estados Unidos', confederation: 'CONCACAF', strength: 79 },
  { code: 'CA', name: 'Canadá', confederation: 'CONCACAF', strength: 77 },
  { code: 'CR', name: 'Costa Rica', confederation: 'CONCACAF', strength: 73 },
  { code: 'PA', name: 'Panamá', confederation: 'CONCACAF', strength: 72 },
  { code: 'JM', name: 'Jamaica', confederation: 'CONCACAF', strength: 72 },
  { code: 'HN', name: 'Honduras', confederation: 'CONCACAF', strength: 70 },
  { code: 'GT', name: 'Guatemala', confederation: 'CONCACAF', strength: 68 },
  { code: 'HT', name: 'Haití', confederation: 'CONCACAF', strength: 68 },
  { code: 'SV', name: 'El Salvador', confederation: 'CONCACAF', strength: 67 },
  { code: 'TT', name: 'Trinidad y Tobago', confederation: 'CONCACAF', strength: 66 },
  { code: 'CU', name: 'Cuba', confederation: 'CONCACAF', strength: 65 },
  { code: 'CW', name: 'Curazao', confederation: 'CONCACAF', strength: 65 },
  { code: 'SR', name: 'Surinam', confederation: 'CONCACAF', strength: 64 },
  { code: 'GY', name: 'Guyana', confederation: 'CONCACAF', strength: 63 },
  { code: 'DO', name: 'República Dominicana', confederation: 'CONCACAF', strength: 63 },

  /* ------------------------------------------------------------------- AFC */
  { code: 'JP', name: 'Japón', confederation: 'AFC', strength: 80 },
  { code: 'KR', name: 'Corea del Sur', confederation: 'AFC', strength: 79 },
  { code: 'IR', name: 'Irán', confederation: 'AFC', strength: 78 },
  { code: 'AU', name: 'Australia', confederation: 'AFC', strength: 78 },
  { code: 'SA', name: 'Arabia Saudí', confederation: 'AFC', strength: 77 },
  { code: 'QA', name: 'Catar', confederation: 'AFC', strength: 75 },
  { code: 'IQ', name: 'Irak', confederation: 'AFC', strength: 73 },
  { code: 'UZ', name: 'Uzbekistán', confederation: 'AFC', strength: 73 },
  { code: 'AE', name: 'Emiratos Árabes Unidos', confederation: 'AFC', strength: 72 },
  { code: 'JO', name: 'Jordania', confederation: 'AFC', strength: 72 },
  { code: 'CN', name: 'China', confederation: 'AFC', strength: 70 },
  { code: 'OM', name: 'Omán', confederation: 'AFC', strength: 70 },
  { code: 'BH', name: 'Baréin', confederation: 'AFC', strength: 69 },
  { code: 'VN', name: 'Vietnam', confederation: 'AFC', strength: 69 },
  { code: 'SY', name: 'Siria', confederation: 'AFC', strength: 68 },
  { code: 'TH', name: 'Tailandia', confederation: 'AFC', strength: 68 },
  { code: 'LB', name: 'Líbano', confederation: 'AFC', strength: 67 },
  { code: 'ID', name: 'Indonesia', confederation: 'AFC', strength: 66 },
  { code: 'KP', name: 'Corea del Norte', confederation: 'AFC', strength: 66 },
  { code: 'KG', name: 'Kirguistán', confederation: 'AFC', strength: 65 },
  { code: 'IN', name: 'India', confederation: 'AFC', strength: 64 },
  { code: 'MY', name: 'Malasia', confederation: 'AFC', strength: 62 },
  { code: 'PH', name: 'Filipinas', confederation: 'AFC', strength: 62 },
  { code: 'HK', name: 'Hong Kong', confederation: 'AFC', strength: 61 },

  /* ------------------------------------------------------------------- CAF */
  { code: 'MA', name: 'Marruecos', confederation: 'CAF', strength: 82 },
  { code: 'SN', name: 'Senegal', confederation: 'CAF', strength: 80 },
  { code: 'NGA', name: 'Nigeria', confederation: 'CAF', strength: 79 },
  { code: 'DZ', name: 'Argelia', confederation: 'CAF', strength: 78 },
  { code: 'EG', name: 'Egipto', confederation: 'CAF', strength: 78 },
  { code: 'CI', name: 'Costa de Marfil', confederation: 'CAF', strength: 77 },
  { code: 'CM', name: 'Camerún', confederation: 'CAF', strength: 77 },
  { code: 'GH', name: 'Ghana', confederation: 'CAF', strength: 76 },
  { code: 'TN', name: 'Túnez', confederation: 'CAF', strength: 76 },
  { code: 'ML', name: 'Malí', confederation: 'CAF', strength: 75 },
  { code: 'COD', name: 'RD Congo', confederation: 'CAF', strength: 74 },
  { code: 'BF', name: 'Burkina Faso', confederation: 'CAF', strength: 74 },
  { code: 'ZA', name: 'Sudáfrica', confederation: 'CAF', strength: 73 },
  { code: 'GN', name: 'Guinea', confederation: 'CAF', strength: 72 },
  { code: 'GAB', name: 'Gabón', confederation: 'CAF', strength: 71 },
  { code: 'CV', name: 'Cabo Verde', confederation: 'CAF', strength: 70 },
  { code: 'ZM', name: 'Zambia', confederation: 'CAF', strength: 69 },
  { code: 'AO', name: 'Angola', confederation: 'CAF', strength: 69 },
  { code: 'BEN', name: 'Benín', confederation: 'CAF', strength: 68 },
  { code: 'UGA', name: 'Uganda', confederation: 'CAF', strength: 67 },
  { code: 'TAN', name: 'Tanzania', confederation: 'CAF', strength: 66 },
  { code: 'CGO', name: 'Congo', confederation: 'CAF', strength: 66 },
  { code: 'MOZ', name: 'Mozambique', confederation: 'CAF', strength: 65 },
  { code: 'KEN', name: 'Kenia', confederation: 'CAF', strength: 64 },

  /* ------------------------------------------------------------------- OFC */
  { code: 'NZ', name: 'Nueva Zelanda', confederation: 'OFC', strength: 68 },
  { code: 'NC', name: 'Nueva Caledonia', confederation: 'OFC', strength: 60 },
];

/** Catálogo de selecciones indexado por identificador. */
export const NATIONS: Record<string, NationalTeam> = Object.fromEntries(
  SEEDS.map((seed) => [
    nationId(seed.code),
    { id: nationId(seed.code), name: seed.name, code: seed.code, confederation: seed.confederation, strength: seed.strength },
  ]),
);

/** Selección por identificador. */
export function nationById(id: string): NationalTeam | undefined {
  return NATIONS[id];
}

/** Selección por código de país. */
export function nationByCode(code: string): NationalTeam | undefined {
  return NATIONS[nationId(code)];
}

/** Selecciones de una confederación. */
export function nationsOf(confederation: Confederation): NationalTeam[] {
  return Object.values(NATIONS).filter((nation) => nation.confederation === confederation);
}
