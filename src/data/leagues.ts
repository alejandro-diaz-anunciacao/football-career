import { Continent } from '../models';
import type { LeagueDef } from '../models';

/**
 * Base de datos de ligas continentales.
 * Cada definición incluye el nombre de los clubes que la componen; el constructor
 * de mundo (`worldBuilder`) los transforma en entidades `Team` con atributos.
 * `topOverall` marca la fuerza del mejor club de la categoría y sirve para
 * calibrar la pirámide de cada país.
 */
export const LEAGUE_DEFS: readonly LeagueDef[] = [
  /* ------------------------------------------------------------------ España */
  {
    id: 'es.1',
    name: 'LaLiga EA Sports',
    country: 'España',
    countryCode: 'ES',
    continent: Continent.Europe,
    tier: 1,
    topOverall: 85,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Sevilla FC', 'Real Sociedad',
      'Athletic Club', 'Real Betis', 'Villarreal CF', 'Valencia CF', 'Girona FC',
      'CA Osasuna', 'RC Celta de Vigo', 'Rayo Vallecano', 'RCD Mallorca', 'Getafe CF',
      'Deportivo Alavés', 'UD Las Palmas', 'RCD Espanyol',
    ],
  },
  {
    id: 'es.2',
    name: 'LaLiga Hypermotion',
    country: 'España',
    countryCode: 'ES',
    continent: Continent.Europe,
    tier: 2,
    topOverall: 73,
    promotionSlots: 3,
    relegationSlots: 4,
    teams: [
      'Racing de Santander', 'UD Almería', 'Levante UD', 'SD Eibar', 'Granada CF',
      'Real Sporting de Gijón', 'Real Zaragoza', 'SD Huesca', 'Albacete Balompié', 'Burgos CF',
      'CD Leganés', 'CD Mirandés', 'Real Oviedo', 'Elche CF', 'Cádiz CF',
      'Deportivo de La Coruña', 'Málaga CF', 'Racing de Ferrol',
    ],
  },
  {
    id: 'es.3',
    name: 'Primera Federación',
    country: 'España',
    countryCode: 'ES',
    continent: Continent.Europe,
    tier: 3,
    topOverall: 63,
    promotionSlots: 4,
    relegationSlots: 5,
    teams: [
      'Cultural Leonesa', 'SD Ponferradina', 'Zamora CF', 'Unionistas de Salamanca', 'Sestao River',
      'SD Amorebieta', 'CD Arenteiro', 'Barakaldo CF', 'Bilbao Athletic', 'Real Unión Club',
      'Real Madrid Castilla', 'CD Lugo', 'CD Ourense', 'Osasuna Promesas', 'Gimnàstic de Tarragona',
      'Sevilla Atlético', 'Barça Atlètic', 'Celta Fortuna',
    ],
  },
  {
    id: 'es.4',
    name: 'Segunda Federación',
    country: 'España',
    countryCode: 'ES',
    continent: Continent.Europe,
    tier: 4,
    topOverall: 55,
    promotionSlots: 5,
    relegationSlots: 5,
    teams: [
      'Laredo', 'Rayo Cantabria', 'SD Tropezón', 'CD Escobedo', 'Atlético de Madrid B',
      'CD Cayón', 'Atlético Albericia', 'CD Colindres', 'CF Vimenor', 'SD Siete Villas',
      'CD Cartes', 'SD Revilla', 'CD Castro', 'CD Naval', 'Real Sociedad B',
      'CD Guarnizo', 'Textil Escudo', 'SD Selaya',
    ],
  },

  /* -------------------------------------------------------------- Inglaterra */
  {
    id: 'gb.1',
    name: 'Premier League',
    country: 'Inglaterra',
    countryCode: 'GB',
    continent: Continent.Europe,
    tier: 1,
    topOverall: 86,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Manchester City', 'Arsenal FC', 'Liverpool FC', 'Manchester United', 'Chelsea FC',
      'Tottenham Hotspur', 'Newcastle United', 'Aston Villa', 'Brighton & Hove Albion', 'West Ham United',
      'Everton FC', 'Fulham FC', 'Crystal Palace', 'Brentford FC', 'Nottingham Forest',
      'Wolverhampton Wanderers', 'AFC Bournemouth', 'Leicester City',
    ],
  },
  {
    id: 'gb.2',
    name: 'EFL Championship',
    country: 'Inglaterra',
    countryCode: 'GB',
    continent: Continent.Europe,
    tier: 2,
    topOverall: 74,
    promotionSlots: 3,
    relegationSlots: 3,
    teams: [
      'Leeds United', 'Burnley FC', 'Sheffield United', 'Sunderland AFC', 'Middlesbrough FC',
      'West Bromwich Albion', 'Norwich City', 'Hull City', 'Coventry City', 'Watford FC',
      'Bristol City', 'Swansea City', 'Cardiff City', 'Millwall FC', 'Preston North End',
      'Queens Park Rangers', 'Stoke City', 'Portsmouth FC',
    ],
  },
  {
    id: 'gb.3',
    name: 'EFL League One',
    country: 'Inglaterra',
    countryCode: 'GB',
    continent: Continent.Europe,
    tier: 3,
    topOverall: 65,
    promotionSlots: 3,
    relegationSlots: 4,
    teams: [
      'Birmingham City', 'Wrexham AFC', 'Stockport County', 'Peterborough United', 'Barnsley FC',
      'Huddersfield Town', 'Bolton Wanderers', 'Charlton Athletic', 'Reading FC', 'Rotherham United',
      'Blackpool FC', 'Wigan Athletic', 'Lincoln City', 'Wycombe Wanderers', 'Mansfield Town',
      'Exeter City', 'Leyton Orient', 'Stevenage FC',
    ],
  },
  {
    id: 'gb.4',
    name: 'EFL League Two',
    country: 'Inglaterra',
    countryCode: 'GB',
    continent: Continent.Europe,
    tier: 4,
    topOverall: 58,
    promotionSlots: 4,
    relegationSlots: 2,
    teams: [
      'Chesterfield FC', 'Notts County', 'AFC Wimbledon', 'Port Vale', 'Crewe Alexandra',
      'Grimsby Town', 'Salford City', 'Walsall FC', 'Bradford City', 'Doncaster Rovers',
      'Gillingham FC', 'Milton Keynes Dons', 'Swindon Town', 'Tranmere Rovers', 'Colchester United',
      'Accrington Stanley', 'Harrogate Town', 'Morecambe FC',
    ],
  },

  /* ---------------------------------------------------------------- Alemania */
  {
    id: 'de.1',
    name: 'Bundesliga',
    country: 'Alemania',
    countryCode: 'DE',
    continent: Continent.Europe,
    tier: 1,
    topOverall: 85,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Bayern Múnich', 'Bayer Leverkusen', 'VfB Stuttgart', 'RB Leipzig', 'Borussia Dortmund',
      'Eintracht Frankfurt', 'TSG Hoffenheim', 'SC Freiburg', 'FC Augsburgo', 'Werder Bremen',
      'VfL Wolfsburgo', 'Mainz 05', 'Union Berlín', 'VfL Bochum', 'Heidenheim',
      'FC St. Pauli', 'Holstein Kiel', 'Borussia Mönchengladbach',
    ],
  },
  {
    id: 'de.2',
    name: '2. Bundesliga',
    country: 'Alemania',
    countryCode: 'DE',
    continent: Continent.Europe,
    tier: 2,
    topOverall: 74,
    promotionSlots: 3,
    relegationSlots: 3,
    teams: [
      'Hamburgo SV', 'FC Colonia', 'Fortuna Düsseldorf', '1. FC Kaiserslautern', 'Hannover 96',
      'SC Paderborn', 'Karlsruher SC', '1. FC Núremberg', 'Schalke 04', 'SV Elversberg',
      '1. FC Magdeburgo', 'Hertha Berlín', 'Darmstadt 98', 'Greuther Fürth', 'Eintracht Braunschweig',
      'Preußen Münster', 'SSV Ulm', 'Jahn Regensburg',
    ],
  },
  {
    id: 'de.3',
    name: '3. Liga',
    country: 'Alemania',
    countryCode: 'DE',
    continent: Continent.Europe,
    tier: 3,
    topOverall: 64,
    promotionSlots: 3,
    relegationSlots: 4,
    teams: [
      'Dynamo Dresde', 'Rot-Weiss Essen', '1. FC Saarbrücken', 'Arminia Bielefeld', 'Alemannia Aachen',
      'MSV Duisburgo', 'TSV 1860 Múnich', 'Borussia Dortmund II', 'Wehen Wiesbaden', 'FC Ingolstadt',
      'Waldhof Mannheim', 'VfL Osnabrück', 'SC Verl', 'SV Sandhausen', 'SpVgg Unterhaching',
      'Hansa Rostock', 'Bayern Múnich II', 'Erzgebirge Aue',
    ],
  },

  /* -------------------------------------------------------------------- Italia */
  {
    id: 'it.1',
    name: 'Serie A',
    country: 'Italia',
    countryCode: 'IT',
    continent: Continent.Europe,
    tier: 1,
    topOverall: 85,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Inter de Milán', 'AC Milan', 'Juventus FC', 'SSC Nápoles', 'Atalanta BC',
      'AS Roma', 'SS Lazio', 'ACF Fiorentina', 'Bolonia FC', 'Torino FC',
      'Udinese Calcio', 'Genoa CFC', 'Empoli FC', 'Hellas Verona', 'US Lecce',
      'Cagliari Calcio', 'Parma Calcio', 'Como 1907',
    ],
  },
  {
    id: 'it.2',
    name: 'Serie B',
    country: 'Italia',
    countryCode: 'IT',
    continent: Continent.Europe,
    tier: 2,
    topOverall: 73,
    promotionSlots: 3,
    relegationSlots: 4,
    teams: [
      'US Sassuolo', 'Pisa SC', 'Spezia Calcio', 'US Cremonese', 'Palermo FC',
      'UC Sampdoria', 'SSC Bari', 'Brescia Calcio', 'US Catanzaro', 'Cesena FC',
      'Frosinone Calcio', 'Juve Stabia', 'Modena FC', 'AC Reggiana', 'US Salernitana',
      'FC Südtirol', 'AS Cittadella', 'Mantova 1911',
    ],
  },
  {
    id: 'it.3',
    name: 'Serie C',
    country: 'Italia',
    countryCode: 'IT',
    continent: Continent.Europe,
    tier: 3,
    topOverall: 63,
    promotionSlots: 4,
    relegationSlots: 5,
    teams: [
      'LR Vicenza', 'Calcio Padova', 'US Triestina', 'AC Renate', 'Alcione Milano',
      'Virtus Verona', 'Calcio Lecco', 'Aurora Pro Patria', 'Pergolettese', 'AlbinoLeffe',
      'FC Lumezzane', 'Union Clodiense', 'AC Trento', 'Arzignano Valchiampo', 'Giana Erminio',
      'Novara Calcio', 'Juventus Next Gen', 'AC Milan Futuro',
    ],
  },

  /* ------------------------------------------------------------------- Francia */
  {
    id: 'fr.1',
    name: 'Ligue 1',
    country: 'Francia',
    countryCode: 'FR',
    continent: Continent.Europe,
    tier: 1,
    topOverall: 84,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Paris Saint-Germain', 'AS Mónaco', 'Olympique de Marsella', 'Lille OSC', 'Olympique de Lyon',
      'OGC Niza', 'RC Lens', 'Stade Rennais', 'Stade Brestois', 'Toulouse FC',
      'FC Nantes', 'RC Estrasburgo', 'Stade de Reims', 'Montpellier HSC', 'AJ Auxerre',
      'Angers SCO', 'AS Saint-Étienne', 'Le Havre AC',
    ],
  },
  {
    id: 'fr.2',
    name: 'Ligue 2',
    country: 'Francia',
    countryCode: 'FR',
    continent: Continent.Europe,
    tier: 2,
    topOverall: 72,
    promotionSlots: 3,
    relegationSlots: 4,
    teams: [
      'FC Metz', 'FC Lorient', 'EA Guingamp', 'SC Bastia', 'SM Caen',
      'AC Ajaccio', 'Amiens SC', 'FC Annecy', 'Clermont Foot', 'USL Dunkerque',
      'Grenoble Foot', 'Stade Lavallois', 'FC Martigues', 'Paris FC', 'Pau FC',
      'Rodez AF', 'ES Troyes AC', 'Red Star FC',
    ],
  },

  /* ---------------------------------------------------------------- Argentina */
  {
    id: 'ar.1',
    name: 'Liga Profesional Argentina',
    country: 'Argentina',
    countryCode: 'AR',
    continent: Continent.SouthAmerica,
    tier: 1,
    topOverall: 77,
    promotionSlots: 0,
    relegationSlots: 2,
    teams: [
      'River Plate', 'Boca Juniors', 'Racing Club', 'Independiente', 'San Lorenzo',
      'Vélez Sarsfield', 'Estudiantes de La Plata', "Newell's Old Boys", 'Rosario Central', 'Talleres',
      'Argentinos Juniors', 'Lanús', 'Huracán', 'Defensa y Justicia', 'Godoy Cruz',
      'Instituto', 'Banfield', 'Gimnasia La Plata',
    ],
  },
  {
    id: 'ar.2',
    name: 'Primera Nacional',
    country: 'Argentina',
    countryCode: 'AR',
    continent: Continent.SouthAmerica,
    tier: 2,
    topOverall: 66,
    promotionSlots: 2,
    relegationSlots: 4,
    teams: [
      'Chacarita Juniors', 'Atlanta', 'Deportivo Madryn', 'San Martín de Tucumán', 'Gimnasia de Mendoza',
      'Alvarado', 'Agropecuario', 'Estudiantes de Río Cuarto', 'Defensores Unidos', 'Almagro',
      'Brown de Adrogué', 'Ferro Carril Oeste', 'Quilmes', 'Temperley', 'Nueva Chicago',
      'Deportivo Morón', 'Tristán Suárez', 'All Boys',
    ],
  },

  /* ------------------------------------------------------------------- Brasil */
  {
    id: 'br.1',
    name: 'Brasileirão Série A',
    country: 'Brasil',
    countryCode: 'BR',
    continent: Continent.SouthAmerica,
    tier: 1,
    topOverall: 80,
    promotionSlots: 0,
    relegationSlots: 4,
    teams: [
      'Flamengo', 'Palmeiras', 'Botafogo', 'Fluminense', 'Vasco da Gama',
      'São Paulo FC', 'Corinthians', 'Grêmio', 'Internacional', 'Cruzeiro',
      'Atlético Mineiro', 'Bahía', 'Fortaleza', 'Athletico Paranaense', 'RB Bragantino',
      'Juventude', 'Criciúma', 'Cuiabá',
    ],
  },
  {
    id: 'br.2',
    name: 'Brasileirão Série B',
    country: 'Brasil',
    countryCode: 'BR',
    continent: Continent.SouthAmerica,
    tier: 2,
    topOverall: 69,
    promotionSlots: 4,
    relegationSlots: 4,
    teams: [
      'Santos FC', 'Mirassol', 'Novorizontino', 'Sport Recife', 'Ceará SC',
      'Vila Nova', 'América Mineiro', 'Avaí', 'Goiás EC', 'Chapecoense',
      'Coritiba', 'Operário', 'Amazonas FC', 'Paysandu', 'CRB',
      'Brusque', 'Ituano', 'Ponte Preta',
    ],
  },

  /* ------------------------------------------------------------------ México */
  {
    id: 'mx.1',
    name: 'Liga MX',
    country: 'México',
    countryCode: 'MX',
    continent: Continent.NorthAmerica,
    tier: 1,
    topOverall: 76,
    promotionSlots: 0,
    relegationSlots: 0,
    teams: [
      'Club América', 'CF Monterrey', 'Tigres UANL', 'CD Guadalajara', 'Cruz Azul',
      'Pumas UNAM', 'Deportivo Toluca', 'Club León', 'CF Pachuca', 'Santos Laguna',
      'Atlas FC', 'Club Necaxa', 'Puebla FC', 'Club Tijuana', 'Mazatlán FC',
      'Querétaro FC', 'Atlético San Luis', 'FC Juárez',
    ],
  },

  /* ------------------------------------------------------------ Estados Unidos */
  {
    id: 'us.1',
    name: 'Major League Soccer',
    country: 'Estados Unidos',
    countryCode: 'US',
    continent: Continent.NorthAmerica,
    tier: 1,
    topOverall: 74,
    promotionSlots: 0,
    relegationSlots: 0,
    teams: [
      'Inter Miami CF', 'Los Angeles FC', 'LA Galaxy', 'Atlanta United', 'Seattle Sounders',
      'Portland Timbers', 'Austin FC', 'FC Cincinnati', 'Columbus Crew', 'Philadelphia Union',
      'New York Red Bulls', 'New York City FC', 'Nashville SC', 'Orlando City', 'FC Dallas',
      'Houston Dynamo', 'Real Salt Lake', 'Minnesota United',
    ],
  },

  /* ------------------------------------------------------------------- Japón */
  {
    id: 'jp.1',
    name: 'J1 League',
    country: 'Japón',
    countryCode: 'JP',
    continent: Continent.Asia,
    tier: 1,
    topOverall: 73,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Vissel Kobe', 'Sanfrecce Hiroshima', 'Kashima Antlers', 'Gamba Osaka', 'Cerezo Osaka',
      'Urawa Red Diamonds', 'Kawasaki Frontale', 'Yokohama F. Marinos', 'FC Tokyo', 'Avispa Fukuoka',
      'Machida Zelvia', 'Nagoya Grampus', 'Júbilo Iwata', 'Shonan Bellmare', 'Kyoto Sanga',
      'Albirex Niigata', 'Consadole Sapporo', 'Sagan Tosu',
    ],
  },

  /* ------------------------------------------------------------ Arabia Saudí */
  {
    id: 'sa.1',
    name: 'Saudi Pro League',
    country: 'Arabia Saudí',
    countryCode: 'SA',
    continent: Continent.Asia,
    tier: 1,
    topOverall: 78,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Al Hilal', 'Al Nassr', 'Al Ittihad', 'Al Ahli', 'Al Shabab',
      'Al Ettifaq', 'Al Taawoun', 'Al Fateh', 'Al Fayha', 'Al Khaleej',
      'Al Riyadh', 'Damac FC', 'Al Wehda', 'Al Raed', 'Al Okhdood',
      'Al Hazem', 'Al Qadsiah', 'Al Orobah',
    ],
  },

  /* ------------------------------------------------------------------ Egipto */
  {
    id: 'eg.1',
    name: 'Egyptian Premier League',
    country: 'Egipto',
    countryCode: 'EG',
    continent: Continent.Africa,
    tier: 1,
    topOverall: 71,
    promotionSlots: 0,
    relegationSlots: 3,
    teams: [
      'Al Ahly', 'Zamalek SC', 'Pyramids FC', 'Ismaily SC', 'Al Masry',
      'Smouha SC', 'Ceramica Cleopatra', 'Modern Future', 'ENPPI', 'National Bank',
      'Al Ittihad Alexandria', 'El Gouna', 'Zed FC', 'Pharco FC', 'Baladiyat El Mahalla',
      'Ghazl El Mahalla', 'Aswan SC', 'Tala’ea El Gaish',
    ],
  },

  /* ---------------------------------------------------------------- Marruecos */
  {
    id: 'ma.1',
    name: 'Botola Pro',
    country: 'Marruecos',
    countryCode: 'MA',
    continent: Continent.Africa,
    tier: 1,
    topOverall: 71,
    promotionSlots: 0,
    relegationSlots: 4,
    teams: [
      'Raja Casablanca', 'Wydad Casablanca', 'RS Berkane', 'FAR Rabat', 'FUS Rabat',
      'Maghreb de Fès', 'Hassania Agadir', 'Difaâ El Jadida', 'Ittihad Tanger', 'Renaissance Zemamra',
      'Olympique de Safi', 'MC Oujda', 'Chabab Mohammédia', 'Union Touarga', 'JS Soualem',
      'Moghreb Tétouan', 'COD Meknès', 'AS Salé',
    ],
  },
];

/** Índice por identificador para búsquedas O(1). */
export const LEAGUE_DEFS_BY_ID: Record<string, LeagueDef> = Object.fromEntries(
  LEAGUE_DEFS.map((league) => [league.id, league]),
);

/** Ligas de un país ordenadas de mayor a menor categoría. */
export function leagueDefsOfCountry(countryCode: string): LeagueDef[] {
  return LEAGUE_DEFS.filter((league) => league.countryCode === countryCode).sort(
    (a, b) => a.tier - b.tier,
  );
}

/** Categoría más baja (debut) de un país. */
export function bottomTierOf(countryCode: string): LeagueDef | undefined {
  const list = leagueDefsOfCountry(countryCode);
  return list[list.length - 1];
}
