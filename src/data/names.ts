/**
 * Bancos de nombres por país usados para generar plantillas y rivales.
 * Datos puros, sin dependencias, para facilitar su sustitución.
 */

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
}

/** Nombres y apellidos por código de país. */
export const NAME_POOLS: Record<string, NamePool> = {
  ES: {
    firstNames: [
      'Álvaro', 'Pablo', 'Sergio', 'Iker', 'Javi', 'Marcos', 'Hugo', 'Diego', 'Adrián', 'Rubén',
      'Nico', 'Aitor', 'Unai', 'Bryan', 'Gonzalo', 'Iván', 'Mateo', 'Bruno',
    ],
    lastNames: [
      'García', 'Martínez', 'López', 'Sánchez', 'Rodríguez', 'Fernández', 'Gómez', 'Ruiz', 'Díaz',
      'Moreno', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Vega',
    ],
  },
  GB: {
    firstNames: [
      'Jack', 'Harry', 'Callum', 'Oliver', 'George', 'Charlie', 'Reece', 'Tyler', 'Jordan', 'Alfie',
      'Mason', 'Kieran', 'Liam', 'Finley', 'Lewis', 'Oscar', 'Rhys', 'Declan',
    ],
    lastNames: [
      'Smith', 'Johnson', 'Williams', 'Taylor', 'Brown', 'Walker', 'Wright', 'Robinson', 'Thompson',
      'Hughes', 'Green', 'Hall', 'Clarke', 'Baker', 'Turner', 'Foster', 'Ward', 'Bennett',
    ],
  },
  DE: {
    firstNames: [
      'Lukas', 'Jonas', 'Finn', 'Tim', 'Niklas', 'Maximilian', 'Julian', 'Leon', 'Noah', 'Paul',
      'Elias', 'Moritz', 'Fabian', 'Jannik', 'Til', 'Kilian', 'Marvin', 'Nico',
    ],
    lastNames: [
      'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz',
      'Hoffmann', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Krüger',
    ],
  },
  IT: {
    firstNames: [
      'Lorenzo', 'Francesco', 'Alessandro', 'Matteo', 'Andrea', 'Davide', 'Simone', 'Gabriele',
      'Riccardo', 'Tommaso', 'Federico', 'Marco', 'Luca', 'Nicolò', 'Giulio', 'Samuele', 'Pietro', 'Emanuele',
    ],
    lastNames: [
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino',
      'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo',
    ],
  },
  FR: {
    firstNames: [
      'Théo', 'Lucas', 'Enzo', 'Nathan', 'Hugo', 'Mathis', 'Noah', 'Léo', 'Ethan', 'Rayan',
      'Yanis', 'Tom', 'Gabriel', 'Maxime', 'Antoine', 'Bilal', 'Ilyes', 'Clément',
    ],
    lastNames: [
      'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy',
      'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux',
    ],
  },
  AR: {
    firstNames: [
      'Julián', 'Tomás', 'Facundo', 'Nicolás', 'Santiago', 'Franco', 'Valentín', 'Lautaro', 'Bautista',
      'Emiliano', 'Agustín', 'Máximo', 'Thiago', 'Ramiro', 'Ignacio', 'Bruno', 'Joaquín', 'Enzo',
    ],
    lastNames: [
      'González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'García', 'Romero', 'Silva',
      'Sosa', 'Molina', 'Ortiz', 'Rojas', 'Benítez', 'Medina', 'Herrera', 'Aguirre', 'Cabrera',
    ],
  },
  BR: {
    firstNames: [
      'João', 'Pedro', 'Lucas', 'Matheus', 'Gabriel', 'Rafael', 'Bruno', 'Thiago', 'Vitor', 'Caio',
      'Danilo', 'Igor', 'Kaio', 'Murilo', 'Renan', 'Wesley', 'Yuri', 'Éder',
    ],
    lastNames: [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida', 'Nascimento',
      'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Cardoso', 'Teixeira',
    ],
  },
  MX: {
    firstNames: [
      'Diego', 'Santiago', 'Kevin', 'Ángel', 'Luis', 'Emiliano', 'Rodrigo', 'Jonathan', 'Israel',
      'Brandon', 'Alexis', 'Fernando', 'César', 'Uriel', 'Omar', 'Andrés', 'Jesús', 'Gael',
    ],
    lastNames: [
      'Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez',
      'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Gutiérrez',
    ],
  },
  US: {
    firstNames: [
      'Tyler', 'Brandon', 'Austin', 'Cody', 'Ethan', 'Dylan', 'Jaden', 'Cole', 'Cameron', 'Hunter',
      'Logan', 'Mason', 'Kayden', 'Tristan', 'Devin', 'Elijah', 'Chase', 'Gavin',
    ],
    lastNames: [
      'Johnson', 'Williams', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Moore', 'Jackson',
      'White', 'Harris', 'Martin', 'Thompson', 'Clark', 'Lewis', 'Robinson', 'Young', 'Allen',
    ],
  },
  JP: {
    firstNames: [
      'Yuki', 'Ren', 'Sota', 'Haruto', 'Kaito', 'Riku', 'Asahi', 'Naoki', 'Takumi', 'Kenta',
      'Daiki', 'Sho', 'Ryota', 'Hiroki', 'Yuto', 'Kenji', 'Taiga', 'Reo',
    ],
    lastNames: [
      'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi',
      'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi',
    ],
  },
  SA: {
    firstNames: [
      'Mohammed', 'Abdullah', 'Faisal', 'Salem', 'Yasser', 'Nawaf', 'Turki', 'Bandar', 'Khalid',
      'Sultan', 'Ali', 'Omar', 'Hassan', 'Firas', 'Rakan', 'Ziyad', 'Majed', 'Nasser',
    ],
    lastNames: [
      'Al-Qahtani', 'Al-Dawsari', 'Al-Shehri', 'Al-Harbi', 'Al-Ghamdi', 'Al-Otaibi', 'Al-Zahrani',
      'Al-Mutairi', 'Al-Anazi', 'Al-Malki', 'Al-Subhi', 'Al-Johani', 'Al-Rashidi', 'Al-Amri',
      'Al-Yami', 'Al-Shamrani', 'Al-Bishi', 'Al-Harthi',
    ],
  },
  EG: {
    firstNames: [
      'Ahmed', 'Mohamed', 'Mahmoud', 'Omar', 'Mostafa', 'Youssef', 'Karim', 'Hussein', 'Amr',
      'Tarek', 'Ziad', 'Bilal', 'Ramy', 'Hassan', 'Sherif', 'Islam', 'Adham', 'Marwan',
    ],
    lastNames: [
      'Hassan', 'Ibrahim', 'Abdelrahman', 'El-Sayed', 'Fathy', 'Zaki', 'Salah', 'Farouk', 'Nasser',
      'Shawky', 'Gaber', 'Rashad', 'Hegazy', 'El-Nenny', 'Sobhi', 'Trezequet', 'Hamdi', 'Morsy',
    ],
  },
  MA: {
    firstNames: [
      'Youssef', 'Achraf', 'Anas', 'Hamza', 'Oussama', 'Ilias', 'Zakaria', 'Yassine', 'Bilal',
      'Sofiane', 'Adil', 'Ayoub', 'Adam', 'Omar', 'Reda', 'Nabil', 'Mehdi', 'Chadi',
    ],
    lastNames: [
      'El Amrani', 'Benali', 'El Idrissi', 'Bennani', 'Chafik', 'El Fassi', 'Ouazzani', 'Alaoui',
      'Bouzidi', 'Hakimi', 'Belhaj', 'El Khattabi', 'Sabri', 'Tazi', 'Berrada', 'Lahlou',
      'Zerouali', 'Amrabet',
    ],
  },
};

/** Códigos de país con banco de nombres disponible. */
export const NAME_COUNTRIES: readonly string[] = Object.keys(NAME_POOLS);

/** Devuelve el banco de nombres de un país, con respaldo en inglés. */
export function namePoolFor(countryCode: string): NamePool {
  return NAME_POOLS[countryCode] ?? NAME_POOLS.GB;
}
