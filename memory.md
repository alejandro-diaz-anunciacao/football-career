# memory.md · Footballer Sim

Notas de contexto, decisiones técnicas y patrones del proyecto, pensadas para
retomar el trabajo en sesiones futuras sin releer todo el código.

> Generado el 2026-10-01 a partir del estado del repositorio. Este documento es
> descriptivo: no sustituye a `AGENTS.md` (instrucciones operativas) ni a
> `README.md` (visión de producto). Ante conflicto, mandan esos dos.

---

## 1. Qué es

Simulador de carrera de futbolista (SPA de una sola página). Empiezas con 16 años
en la categoría más baja de tu país y progresas por 26 ligas / 468 clubes (18 por
liga) repartidos en 5 continentes y 13 países. Incluye partido interactivo minuto
a minuto, progresión con potencial oculto, mercado de fichajes, ascensos/descensos
y guardado de hasta 12 partidas simultáneas.

- **Stack:** Vanilla TypeScript estricto + Vite. Sin frameworks, sin runtime de UI.
- **Dependencias de producción:** ninguna. Solo `devDependencies`:
  - `typescript ^5.6.3`
  - `vite ^5.4.11`
- No hay test runner, linter ni formatter. La verificación es `typecheck` + scripts
  ad-hoc (ver §8).

## 2. Comandos

```bash
npm run dev        # Vite en http://localhost:5173 (host: true)
npm run typecheck  # tsc --noEmit  ← la comprobación más rápida
npm run build      # tsc --noEmit && vite build (el build ya typechequea)
npm run preview    # sirve dist/
```

Configuración relevante:
- `tsconfig.json`: `strict`, `verbatimModuleSyntax`, `isolatedModules`,
  `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `moduleResolution: bundler`,
  `allowImportingTsExtensions`, `types: []`, `include: ["src", "vite.config.ts"]`.
- `vite.config.ts`: puerto 5173, `host: true`, build `target: es2022`,
  `sourcemap: true`, salida en `dist/`.

## 3. Arquitectura por capas

Dependencias en **una sola dirección**:

```
ui  →  services  →  engine  →  (models, data, utils)
```

- `models/` y `utils/` no dependen de nadie más (salvo `models → utils/math`).
- `data/` depende de `models` y `utils`.
- `engine/` depende de `data/config`, `models`, `utils` (y de `services/idService`,
  única excepción, ver §5).
- `services/` orquesta.
- `ui/` nunca es importado por otras capas; solo `main.ts` arranca `ui/app.ts`.

### Responsabilidad de cada carpeta

| Carpeta | Contenido |
|---|---|
| `src/models/` | Entidades y enums del dominio. `models/index.ts` es el único punto de import del dominio. |
| `src/data/` | Datos estáticos y construcción del mundo. `data/index.ts` reexporta todo. |
| `src/engine/` | Simulación pura e inyectable (recibe `Random`). Sin DOM. |
| `src/services/` | Orquestación, estado, persistencia, RNG global, bus de eventos. |
| `src/ui/` | Enrutador por hash, vistas (`HTMLElement`) y componentes. |
| `src/styles/` | CSS modular; se importa **solo** desde `src/main.ts`. |

`src/main.ts` son 5 líneas: importa `styles/main.css` y llama a `bootstrap()`.

## 4. Decisiones técnicas clave

1. **Sin frameworks.** El DOM se construye con el helper `el(tag, props, ...children)`
   de `ui/dom.ts` (`append`, `clear`, `replace`, `requireElement`, formateadores
   `fmt`, `fmtMoney`, `fmtWage`, `fmtRelativeTime`). Las vistas devuelven `HTMLElement`.
2. **TypeScript estricto de verdad.** `import type` obligatorio con
   `verbatimModuleSyntax`; cualquier import sin usar rompe el build.
3. **Enums string.** (`Position.Midfielder === 'MED'`, `Foot.Left === 'Izquierdo'`).
   Se serializan legibles en disco y son estables entre versiones.
4. **Determinismo total en la simulación.** RNG propio `mulberry32` en
   `utils/random.ts` (`Random`), con estado de 32 bits serializable. Se inyecta en
   los motores; **nunca `Math.random()`** dentro de un motor. `rngState` se persiste
   para reproducir la partida bit a bit tras recargar.
5. **Potencial oculto.** `Player.potential` es un techo duro: no se pinta nunca en
   la UI ni entra en los metadatos de partidas guardadas. La UI usa `potentialHint()`
   (rango difuso). `enforcePotentialCeiling()` recorta atributos si el OVR lo supera.
6. **Todas las constantes de balance viven en `data/config.ts`.** No inventar
   números mágicos en los motores; ajustar dificultad = tocar `CONFIG`.
7. **Persistencia multi-partida en `localStorage`** con estado compactado (§6).
8. **Idioma:** comentarios, textos de UI y dominio en **español**; identificadores
   y APIs en **inglés**.

## 5. Patrones de diseño adoptados

- **Facade / única fuente de verdad:** `services/careerService.ts` es la fachada
  pública de todo el dominio. Mantiene un singleton `state: CareerState | null`
  y `activeSlotId` a nivel de módulo. Cualquier mutación relevante termina en
  `persist()`, que guarda en la ranura activa y emite `state:changed`.
- **Singleton:** `state`, `activeSlotId`, `rng` (global), `router`, `bus`,
  `squadCache`, y el contador de `uid`.
- **Observer / pub-sub:** `services/eventBus.ts` (`EventBus<AppEvents>` tipado).
  Eventos: `state:changed`, `state:cleared`, `toast`, `navigate`. `notify()` es un
  atajo para toasts. Desacopla engine/servicios de la UI.
- **Inyección de dependencias:** los motores reciben `Random` por parámetro; la
  simulación no conoce `localStorage` ni el DOM.
- **Factory:** `playerFactory.createPlayer`, `buildWorld`, y el mapa
  `FACTORIES: Record<RouteId, ViewFactory>` en `ui/app.ts` (una función por ruta).
- **Estrategia / tablas ponderadas:** pesos por posición en `BASE_WEIGHT`,
  `OVR_WEIGHTS`, `POSITION_WEIGHTS`, `DEVELOPMENT_WEIGHTS`… El reparto aleatorio
  usa `rng.weighted()`.
- **Cache en memoria:** `squadService` cachea plantillas por `team.id` (no se
  persisten); `clearSquadCache()` al empezar carrera nueva.
- **Optimistic UI desacoplada:** `ui/app.ts` **solo repinta la cabecera** ante
  `state:changed`, a propósito, para no destruir un partido en directo. Las vistas
  que necesitan refrescar llaman a `ctx.refresh()`.
- **Idempotencia:** `applyFixtureResult` hace `if (fixture.played) return`, lo que
  evita duplicar resultados si se aplica dos veces.

**Única violación de capas:** `engine/marketEngine.ts` importa `uid` de
`services/idService`. Es deliberada y ampliamente conocida; no “arreglar” sin
acordarlo.

## 6. Estado, guardado y determinismo

- Claves de `localStorage` (en `CONFIG.CAREER`):
  - `footballer-sim:slots:v1` → índice ligero con metadatos (`SaveSlot[]`).
  - `footballer-sim:slot:<id>:v1` → estado completo de una partida.
  - `footballer-sim:save:v1` → guardado antiguo de hueco único; se **migra
    automáticamente** a una ranura en `migrateLegacySave()`.
- **`MAX_SLOTS = 12`.** `SaveSlot` es deliberadamente ligero (el listado se pinta
  sin deserializar el estado completo) y **no incluye `potential`**.
- **Compactación:** `packState` serializa los calendarios como tuplas
  `[jornada, local, visita, jugado, gf, gc]` con **índices** de `league.teamIds`
  (o el id si no se encuentra). `unpackState` lo revierte tolerando también el
  formato extendido. Reduce cada partida de ~950 KB a ~300 KB.
  - ⚠️ Si cambias la forma de `League` o `Fixture`, actualiza **ambas** funciones.
- **Migración de campos:** `storageService.migrate(state)` rellena campos nuevos
  (`recentResults`, `offers`, `inbox`, `trophies`, `history`, `trainingFocus`,
  `seasonGrowth`, `lastGrowth`, `player.loan`) y normaliza
  `TransferOffer.kind`/`projectedRole`; además actualiza `version`. Al añadir un
  campo a `Player` o `CareerState`, **añádelo también aquí**.
- **Robustez:** en Node sin shim de `localStorage`, `storageService` traga errores
  y `loadSlot()` devuelve `null` en silencio. Para probar persistencia, define un
  shim primero.
- `persist()` sincroniza `state.rngState = rng.state` antes de guardar.

### Invariantes de la simulación

- Todas las ligas tienen **18 equipos → 34 jornadas** (doble vuelta, método del
  círculo). `generateFixtures` devuelve `[]` si el número de equipos es **impar**;
  mantener siempre un número par por liga.
- **Orden de jornada:** primero el partido del usuario (`applyUserMatch`) y después
  `simulateRestOfRound()`. No duplicar ni invertir el orden.
- El mundo se recorre entero en cada jornada (todas las ligas).
- `MatchSimulation` es interactivo: se avanza con `step()` (1 minuto por llamada);
  `getResult()` solo es válido con `finished === true`. `simulateAll()` es el atajo.
- El equipo del usuario se simula con **fuerzas efectivas** (`effectiveTeam`):
  ajusta ataque/medio/defensa según el OVR del jugador y su rol (`Starter` 1.0,
  `Bench` 0.65, `NotCalled` 0.3). No simular su equipo con las fuerzas base.
- `resetLeagueForSeason` regenera calendario y clasificación; se llama al crear
  carrera y al cerrar temporada para todas las ligas.
- **Rol con banda de rotación:** `CONFIG.SQUAD` fija márgenes generosos
  (`STARTER_GAP`, `BENCH_GAP`) y un **bonus de promesa** (edad y margen hasta el
  potencial). Un jugador algo por debajo del club sigue entrando en la rotación.
- **Crecimiento sin minutos:** `applyDevelopmentTick` ya no exige
  `appearances > 0`; sin minutos reparte una fracción reducida e intermitente
  (`CONFIG.PROGRESSION.TRAINING_ONLY_FACTOR`). Rompe el bucle
  «no juego → no crezco → no juego».
- **Mercado jugable:** las ofertas salen solo de clubes donde el rol previsto es
  `Starter`/`Bench`, con techo de nivel según edad (`CONFIG.MARKET.MAX_STEP_UP`).
  La oferta ambiciosa (`WILDCARD_CHANCE`) es rara. Nunca vuelven a aparecer
  clubes desproporcionados.
- **Cesiones:** `Player.loan` guarda club cedente, propietario y salario original.
  Mientras está activa, `state.teamId` y `contract.teamId` apuntan al club cedente;
  `finishSeason` restaura al propietario y su salario antes de generar el mercado.
  `careerService.requestLoan()` añade cesiones a mitad de temporada si no juegas.
- **Elección de club de debut:** `careerService.debutOptions(input)` devuelve
  `{ seed, options }` (4 clubes jugables, con rol real). `createCareer` /
  `restartSlot` aceptan `{ seed, teamId }`; al reutilizar la semilla, lo mostrado
  coincide con el mundo creado.

## 7. Modelo de dominio (resumen)

- **`Player`**: atributos (7: pace, shooting, passing, dribbling, defending,
  physical, goalkeeping), `ovr` recalculado siempre desde atributos con
  `ovrFromAttributes` (pesos por posición), `potential` oculto, `form` (−1..1),
  `morale`/`fitness` (0..100), `injuryWeeks`, `trainingFocus`, `seasonGrowth`,
  `lastGrowth`, `seasonStats`/`careerStats`, `contract`, `loan` (`Loan | null`).
- **`Team`**: `attack`/`midfield`/`defense`/`overall` (1-99) y `reputation` (1-100).
  `teamOverall()` pondera 0.34/0.33/0.33.
- **`League`/`Fixture`/`StandingRow`**: `sortStandings` aplica puntos → diferencia
  de goles → goles a favor → id. `tier` 1 = máxima categoría.
- **`CareerState`**: todo el estado serializable (seed, rngState, season, phase,
  currentRound, player, teamId, leagues, teams, history, trophies, inbox, offers,
  lastMatch, recentResults, seasonsPlayed, previousFinish).
- **Enums string**: `Position`, `Foot`, `Continent`, `SquadRole`, `MatchEventType`,
  `SeasonPhase`, `MessageKind`, `TacticalApproach`. Tipos: `MatchOutcome`, `TeamSide`.

### Motores

| Motor | Rol |
|---|---|
| `poisson.ts` | `samplePoisson` (Knuth), `poissonPmf`, `expectedGoals`, `midfieldAdjustment`, `matchLambdas`, `outcomeProbabilities`, `mostLikelyScoreline`. |
| `matchEngine.ts` | `MatchSimulation` (plan completo + revelado con `step()`), `selectStartingEleven` (4-4-2), `simulateQuickMatch`, `previewMatch`, `marketValue`, `suggestedWage`. |
| `ratingEngine.ts` | `computeRating` (1.0-10.0 ponderada por posición y resultado), `ratingLabel`, `ratingTone`. |
| `roleEngine.ts` | `projectRole(player, team, squad?)`: rol (`Starter`/`Bench`/`NotCalled`) y minutos estimados. Banda de rotación amplia + bonus de promesa. **Fuente única del rol** (la usan `careerService` con plantilla real y el mercado con la media del club). |
| `progressionEngine.ts` | Plan de temporada, avances parciales (`applyDevelopmentTick`), cierre (`applySeasonGrowth`), `agePlayer`, `recoverWeekly`, `updateForm`, `mergeSeasonIntoCareer`. |
| `leagueManager.ts` | Calendario (círculo), clasificación, ascensos/descensos (`processPromotionRelegation`, `processCountryPyramid`). |
| `marketEngine.ts` | `interestedTeams`, `generateOffers`, `chooseDebutTeam`. |

## 8. Recetas de verificación (sin test runner)

**Motor / dominio en Node** (esbuild + script con rutas absolutas al `src/` y shim
de `localStorage`):

```bash
npx esbuild /tmp/opencode/smoke.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/opencode/smoke.mjs && node /tmp/opencode/smoke.mjs
```

**Interfaz real sobre jsdom** (el outfile debe quedar dentro del proyecto para que
Node resuelva `jsdom`):

```bash
npm install --no-save jsdom
npx esbuild /tmp/opencode/ui-smoke.ts --bundle --platform=node --format=esm \
  --packages=external --outfile=.tmp-ui-smoke.mjs && node .tmp-ui-smoke.mjs && rm .tmp-ui-smoke.mjs
```

Inyectar en `globalThis`: `window`, `document`, `location`, `history`,
`localStorage`, `addEventListener`, un `scrollTo` no-op y
`Element.prototype.scrollIntoView`.

**Chrome headless por CDP** (capturas y flujos reales, con dev server en 5173):

```bash
google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 \
  --user-data-dir=/tmp/opencode/chrome-profile about:blank
```

- Para código contra módulos **ya cargados** por la app, resuelve la URL real con
  `performance.getEntriesByType('resource')`: con HMR, Vite sirve
  `.../careerService.ts?t=...` y un `import('/src/services/careerService.ts')`
  crearía **una segunda instancia** con `state = null`.
- Haz `localStorage.clear()` + recarga antes de cada pasada (el perfil conserva la
  partida anterior).
- `innerText` devuelve el texto con `text-transform` aplicado: compara en minúsculas.

## 9. UI y estilos

- **Enrutador por hash** propio (`ui/router.ts`): rutas tipadas `creation`, `saves`,
  `dashboard`, `match`, `table`, `history`, `market`. Soporta query params;
  `parseHash` cae a `dashboard` si la ruta no es válida.
- **Bootstrap (`ui/app.ts`):** monta cabecera + main, conecta `router.onChange`,
  escucha `state:changed` (solo cabecera) y `state:cleared` (vuelve a `creation`).
  Sin carrera activa redirige a `saves` si hay ranuras o a `creation` si no.
- **Componentes:** card, header, statBar, matchLog, modal, toast, tabs, debutPicker
  (selector de club de debut reutilizado por creación y reinicio).
- **Estilos:** `src/styles/main.css` importa en cascada `variables.css`, `base.css`,
  `layout.css`, `components.css`, `views.css`. Tema oscuro deportivo con variables
  CSS. **Ningún CSS se importa fuera de `main.ts`.**

## 10. Notas y trampas para futuras sesiones

- ⚠️ **`AGENTS.md` dice que no es un repositorio git, pero sí lo es:** hay un commit
  inicial (`2a121c5`) y `git status` funciona. Existen `dist/` (ignorado) y los
  untracked `.agents/` y `skills-lock.json`.
- ⚠️ `verbatimModuleSyntax` + `noUnusedLocals/Parameters`: usa `import type` para
  tipos y **elimina cualquier import que no uses** o el build falla.
- ⚠️ No pongas **números mágicos** en los motores: van a `data/config.ts`.
- ⚠️ Nunca pintes `potential` ni lo metas en `SaveSlot`/metadatos.
- ⚠️ No uses `Math.random()` en la lógica de simulación. (Las únicas excepciones
  legítimas son la generación de semilla `randomSeed()` y `newSlotId()`.)
- ⚠️ Al cambiar `League`/`Fixture`, actualiza `packState`/`unpackState`; al añadir
  campos, actualiza `storageService.migrate`.
- ⚠️ Mantén **18 equipos por liga** (número par): `generateFixtures` devuelve `[]`
  con un número impar.
- `CONFIG.CAREER.MAX_SEASONS = 22`, `RETIREMENT_AGE = 39`, `SQUAD_SIZE = 22`
  (3 POR · 7 DEF · 7 MED · 5 DEL).
- Fuerzas del mundo: `base = topOverall − (index/(total−1))·18.5` + ruido; los
  atributos y reputación se derivan de ahí. `topOverall` por tier (p. ej. ES:
  85/73/63/55).
- Los clubes por liga y su pirámide (`aboveLeagueId`/`belowLeagueId`) se encadenan
  por país en `buildWorld`.
- El estado del RNG global es una pieza más del guardado: cualquier operación que
  consuma `rng` afecta a la reproducibilidad.

## 11. Mapa de archivos

```
src/
├── main.ts                     # importa main.css + bootstrap()
├── models/                     # enums, player, team, league, match, career, index
├── data/                       # config, continents, names, leagues, worldBuilder, index
├── engine/                     # poisson, matchEngine, ratingEngine, roleEngine,
│                               # progressionEngine, leagueManager, marketEngine
├── services/                   # careerService (fachada), storageService, squadService,
│                               # playerFactory, randomService, nameService, idService, eventBus
├── utils/                      # math, random
├── styles/                     # variables, base, layout, components, views, main
└── ui/
    ├── app.ts, router.ts, dom.ts
    ├── components/             # card, header, statBar, matchLog, modal, toast, tabs, debutPicker
    └── views/                  # creation, saves, dashboard, match, table, history, market, types
```
