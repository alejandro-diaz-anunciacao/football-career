# memory.md · Footballer Sim

Notas de contexto, decisiones técnicas y patrones del proyecto, pensadas para
retomar el trabajo en sesiones futuras sin releer todo el código.

> Última revisión: **2026-10-04**. Este documento es descriptivo: no sustituye a
> `AGENTS.md` (instrucciones operativas) ni a `README.md` (visión de producto).
> Ante conflicto, mandan esos dos.

> ⚠️ **Regla obligatoria:** este archivo se actualiza **SIEMPRE** con cada cambio
> (código, datos, UI, config, arquitectura o bug), en el mismo turno y antes de dar
> la tarea por terminada. Refleja qué cambió, archivos/campos/tipos nuevos, su
> migración, invariantes/trampas y la fecha de revisión. Lo exige `AGENTS.md` y la
> skill `feature`; no es opcional.

---

## 1. Qué es

Simulador de carrera de futbolista (SPA de una sola página). Empiezas con 16 años
en la categoría más baja de tu país y progresas por 26 ligas / 468 clubes (18 por
liga) repartidos en 5 continentes y 13 países. Incluye partido interactivo minuto
a minuto, progresión con potencial oculto, mercado de fichajes, copas y continentales,
selecciones nacionales, **eventos aleatorios de carrera** con decisiones, **15
subposiciones** (grupo + rol específico), **equipos filiales con ascenso al primer
equipo** por rendimiento, **vista de plantilla con comparación por el puesto**,
**calendario de temporada con simulación hasta una fecha**, **escudos de club/liga y
banderas de selección** generados, **interfaz responsive con tema claro/oscuro** y
guardado de hasta 12 partidas simultáneas.

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
  `seasonGrowth`, `lastGrowth`, `player.loan`, `player.nationalStats`,
  `player.rolePenalty`, `player.role`, `player.callUp`, `player.firstTeamTrust`,
  `calendar`, `competitions`, `nationalCompetitions`,
  `friendlies`, `tick`, `pendingEvent`, `lastEventRound`, `eventsThisSeason`,
  `eventHistory`, `lastEventResult`, `seasonCalendar`) y normaliza `TransferOffer.kind`/`projectedRole` y los campos de
  las `Competition` (`format`/`stage`/`tier`/`mainEntrants`); además actualiza
  `version`. Al añadir un campo a `Player` o `CareerState`, **añádelo también
  aquí**. `tick` se deriva de `currentRound` en partidas antiguas.
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
- **Filiales (cantera):** `Team.parentTeamId` (en el filial) y `Team.reserveTeamId`
  (en el primer equipo), enlazados por `data/filials.ts` + `worldBuilder.linkFilials`.
  `Player.callUp` guarda una convocatoria temporal con el primer equipo y
  `Player.firstTeamTrust` (0-100) la confianza del primer equipo. Con una
  convocatoria activa, `userFixtureAt()` devuelve la jornada del **padre** (override),
  `createUserMatch` inyecta al jugador con `getSquad(..., force)` y `applyUserMatch`
  localiza la jornada por `homeId/awayId/round` (no por `current.teamId`) y consume la
  convocatoria. Dos eventos, `filial-callup`/`filial-promotion`, con los efectos
  `callUp`, `promoteToParent` y `trust`; el ascenso lo ejecuta `promoteToParentTeam()`.
- **Subposiciones:** `PlayerRole` (15 roles) con `roleGroup()`; `Position` sigue
  siendo el grupo (`POR/DEF/MED/DEL`). La competencia por el puesto **mezcla** el
  mejor rival de la misma subposición y del grupo (`CONFIG.SQUAD.SUBROLE_WEIGHT`,
  `roleEngine.squadCompetitionLevel`). Las plantillas generan las 15 subposiciones
  con atributos propios; el rol ajusta OVR (`ROLE_OVR_ADJUST`), generación
  (`ROLE_PROFILE_ADJUST`/`ROLE_SHAPE_ADJUST`), acciones de partido
  (`ROLE_ACTION_ADJUST`), volumen de pase (`ROLE_PASS_ADJUST`), nota
  (`ROLE_RATING_ADJUST`), desarrollo (`ROLE_DEVELOPMENT_ADJUST`), foco por defecto
  (`DEFAULT_FOCUS`) y umbral de goles.
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
- **Calendario:** `CareerState.calendar` es la fecha de la jornada en curso;
  `engine/calendar.roundDate(season, round)` la calcula (arranque 16 ago, parón de
  invierno). Se actualiza en `advanceRound` y al resetear en `finishSeason`.
- **Ventanas de fichajes:** `windowForRound(currentRound)` decide si el mercado
  está abierto. `acceptOffer`/`requestLoan` lo comprueban y la UI deshabilita el
  botón fuera de ventana. Las ofertas se generan **al abrir** cada ventana
  (`openWindow` en invierno, `finishSeason` en verano).
- **Ofertas variables:** `generateOffers(..., performance)` calcula 0-`MAX_OFFERS`
  según rendimiento, OVR y azar; con `performance >= GOOD_PERFORMANCE` garantiza
  al menos una. Puede haber ventanas sin ninguna oferta.
- **Calendario de tandas:** `CareerState.tick` indexa `buildSeasonSchedule(season)`
  (jornadas de liga + tandas de copa entre semana). Un avance = una tanda; el
  usuario juega como máximo un partido por tanda. `currentRound` solo avanza en
  las tandas de liga (lo usan ventanas y desarrollo).
- **Próximo partido y auto-avance:** `careerService.nextUpcomingFixture()` recorre
  el calendario hacia delante y devuelve el primer partido del usuario
  (`{ context, ticksAhead }`), no solo la tanda en curso. El vestuario muestra ese
  partido y sus botones llaman antes a `skipToNextMatch()` para consumir las tandas
  intermedias; así desaparece el caso «no juega en esta tanda». `userFixtureAt(tick)`
  resuelve liga, copa, continental y selección, y `resolveTeam()` mezcla clubes
  (`state.teams`) y selecciones (`nationTeams()`).
- **Copas y continentales:** `CareerState.competitions` guarda las `Competition` de
  copa (por país) y continental (por continente). `simulateCupTick` juega la pierna en
  curso (KO); `simulateGroupRound` la jornada de grupos; `applyUserMatch` aplica a liga,
  grupo (tabla) o KO según `result.competitionId` y la fase. Si el usuario no juega la
  tanda, `skipToNextMatch` avanza.
- **Selección nacional:** `data/nations.ts` (~100 selecciones) y `data/nationalTournaments.ts`.
  `CareerState.nationalCompetitions` guarda la clasificación (liguilla por confederación,
  7 jornadas) y los torneos; `friendlies` los amistosos del jugador. Las ventanas
  internacionales y los torneos son tandas `'national'` en el calendario
  (`buildSeasonSchedule`). La convocatoria (`isCalledUp`) pesa media, forma, edad y
  competencia; las estadísticas van a `player.nationalStats`. **Una tanda de selección
  solo cuenta como partido del usuario si está convocado**; si no, se simula sin él
  (`simulateNationalTick`) y el calendario continúa. Ciclos: **Mundial** en las
  temporadas 4/8/12… y **continentales** en 2/6/10…. La temporada cierra al consumir todas
  las tandas (`tick >= schedule.length`), no por la jornada de liga.
- **Continentales:** `buildSeasonCompetitions` crea copas + continentales al empezar
  temporada. En la primera se clasifica por nivel; después, por puesto de liga y campeón
  de copa, sin que un club juegue dos competiciones del continente (salvo `shareTeams`,
  como la Leagues Cup). Los cinco continentes están implementados:
  - **Previa** (`stage: 'qualifying'`): cuadro a doble partido; ganadores → cuadro principal,
    perdedores → secundaria.
  - **Fase de liga** (`stage: 'league'`): tabla única (8 jornadas); top-`leagueDirect` a
    octavos y `leaguePlayoff` al playoff.
  - **Repescas:** las de la previa (UEFA/AFC/CAF) construyen la secundaria en diferido
    (`stage: 'pending'`); las de grupos (CONMEBOL) entran al KO de la secundaria vía
    `pendingEntrants`. Se procesan por tandas ordenadas por `tier` (`simulateContinentalTick`).
  - **Finales:** a partido único salvo `twoLeggedFinal` (CAF). `knockoutFirstTwoLegged`
    marca las primeras rondas a doble partido (AFC Elite, Concacaf).

### Eventos aleatorios (subsistema)

- Catálogo en `data/events.ts` (16 eventos): definiciones puras con `when`,
  `title`, `body` y `choices`. Cada opción tiene `outcome` fijo o `risk` (probabilidad
  dinámica según forma/nota). Ejemplos: leyenda que entrena, entrenador que no da
  minutos (decisión), prensa, ojeadores, sobrecarga, asunto familiar, patrocinio,
  derbi, agente, redes, nutrición, selección…
- `engine/eventEngine.ts` es puro y recibe `Random`. Efectos soportados: `attribute`
  (vía `applyAttributePoints`, **respeta el techo de potencial**), `stat`
  (morale/form/fitness), `injury`, `rolePenalty`, `loanOffers` y `transferOffers`
  (estos dos los materializa el servicio, que conoce ligas y equipos).
- **Disparo:** `careerService.maybeTriggerEvent(round)` al cerrar cada jornada de
  liga (`advanceAfterLeague`). Condiciones en `CONFIG.EVENTS` (probabilidad,
  cooldown entre eventos, tope por temporada y ronda mínima). Determinista: todo con
  `rng`; `rngState` se persiste.
- **Decisión pendiente:** `CareerState.pendingEvent` + mensaje `MessageKind.Event`.
  Mientras exista, el vestuario y el visor **bloquean el partido** hasta resolverlo
  (`careerService.resolveEvent(id, choiceId)`). El desenlace se escribe en la bandeja
  y `eventHistory[id]` guarda la temporada para el cooldown.
- `rolePenalty` lo resta `projectRole` (menos minutos) y se decrementa cada jornada
  de liga; se limpia al cerrar la temporada.
- **Filiales:** `filial-callup` (convocatoria de un partido; aceptar activa `callUp`
  y suma confianza, rechazar la resta) y `filial-promotion` (ascenso definitivo con
  nuevo contrato). `finishSeason` fuerza la oferta de ascenso al curso siguiente si
  el rendimiento y la confianza lo merecen. `firstTeamTrust` sube/baja según la
  actuación en las convocatorias.
- **Desenlace visible:** `resolveEvent` devuelve un `EventResolutionSummary` con
  `changes: EventChange[]` (`up`/`down`/`neutral`; la forma se muestra cualitativa
  `↑`/`↓`). El vestuario abre un **modal** al resolver y guarda
  `CareerState.lastEventResult` para pintar la tarjeta **«Último evento»** con la
  narrativa y los chips. Persiste hasta el siguiente desenlace y se limpia al cerrar
  la temporada.

## 7. Modelo de dominio (resumen)

- **`Player`**: atributos (7: pace, shooting, passing, dribbling, defending,
  physical, goalkeeping), `ovr` recalculado siempre desde atributos con
  `ovrFromAttributes` (pesos por subposición), `potential` oculto, `form` (−1..1),
  `morale`/`fitness` (0..100), `injuryWeeks`, `trainingFocus`, `seasonGrowth`,
  `lastGrowth`, `seasonStats`/`careerStats`/`nationalStats`, `contract`,
  `loan` (`Loan | null`), `rolePenalty` (`RolePenalty | null`, penalizador
  temporal de minutos que consume `projectRole`), `position` (grupo),
  `role` (`PlayerRole`, subposición específica), `callUp`
  (`PlayerCallUp | null`, convocatoria con el primer equipo) y `firstTeamTrust`
  (0-100, confianza del primer equipo). `ROLE_LABELS` traduce a español.
- **`NationalTeam`** (`models/nation.ts`): `id` (`nat.<código>`), `name`, `code`,
  `confederation`, `strength`. `nationAsTeam` lo convierte en `Team` para el motor.
- **`Team`** y **`SquadMember`**: `attack`/`midfield`/`defense`/`overall` (1-99) y
  `reputation` (1-100). `teamOverall()` pondera 0.34/0.33/0.33. `Team` puede llevar
  `parentTeamId` (es un filial) y `reserveTeamId` (tiene cantera). Cada `SquadMember`
  lleva `position` (grupo), `role` (subposición) y los 7 atributos (`pace`, `shooting`,
  `passing`, `dribbling`, `defending`, `physical`, `goalkeeping`) para poder comparar;
  las plantillas no se persisten. `careerService.squadComparison(scope)` devuelve la
  plantilla, tu ficha, los rivales de subposición/grupo (`squadRivals`) y los deltas
  por atributo.
- **`League`/`Fixture`/`StandingRow`**: `sortStandings` aplica puntos → diferencia
  de goles → goles a favor → id. `tier` 1 = máxima categoría.
- **`Competition`**: copa o continental. `kind`, `format` (`knockout`/`groups`/`league`),
  `stage` (`qualifying`/`pending`/`groups`/`league`/`knockout`/`done`),
  `continent?`/`countryCode?`, `tier`, `ties` (`KnockoutTie` con sus piernas `Fixture`),
  `groups` (`CompetitionGroup` con `standings`+`fixtures`), `round`/`leg`, `totalRounds`,
  `championId`, `pendingByes`, `twoLeggedRounds`, `knockoutFirstTwoLegged`,
  `twoLeggedFinal`, `pendingEntrants`, `mainEntrants`.
- **`CareerState`**: todo el estado serializable (seed, rngState, season, phase,
  currentRound, **calendar** (`GameDate`), **tick**, player, teamId, leagues,
  teams, **competitions**, **nationalCompetitions**, friendlies, history, trophies,
  inbox, offers, lastMatch, recentResults, seasonsPlayed, previousFinish,
  **pendingEvent**, **lastEventRound**, **eventsThisSeason**, **eventHistory**,
  **lastEventResult**, **seasonCalendar** (`SeasonCalendarEntry[]`, partidos del
  usuario de la temporada)).
- **Enums string**: `Position`, `Foot`, `Continent`, `SquadRole`, `MatchEventType`,
  `SeasonPhase`, `MessageKind`, `TacticalApproach`. Tipos: `MatchOutcome`, `TeamSide`.

### Motores

| Motor | Rol |
|---|---|
| `poisson.ts` | `samplePoisson` (Knuth), `poissonPmf`, `expectedGoals`, `midfieldAdjustment`, `matchLambdas`, `outcomeProbabilities`, `mostLikelyScoreline`. |
| `matchEngine.ts` | `MatchSimulation` (plan completo + revelado con `step()`), `selectStartingEleven` (4-4-2), `simulateQuickMatch`, `previewMatch`, `marketValue`, `suggestedWage`. |
| `ratingEngine.ts` | `computeRating` (1.0-10.0 ponderada por posición y resultado), `ratingLabel`, `ratingTone`. |
| `roleEngine.ts` | `projectRole(player, team, squad?)`: rol (`Starter`/`Bench`/`NotCalled`) y minutos estimados. Banda de rotación amplia + bonus de promesa. **Competencia mezclada** subposición/grupo (`squadCompetitionLevel`) y `squadRivals(player, squad)` (mejor rival de rol y de grupo). Nivel por subposición (`estimatedRoleLevel`). **Fuente única del rol** (la usan `careerService` con plantilla real y el mercado con la media del club). |
| `calendar.ts` | `roundDate(season, round)` y `windowForRound(round)`: fechas reales de cada jornada y ventana de fichajes activa. |
| `schedule.ts` | `buildSeasonSchedule(season)`: lista de tandas (liga y copa entre semana) con su fecha. Alimenta el calendario (`seasonCalendar`) y `simulateUntil`. |
| `cupEngine.ts` | `buildCup`/`buildCups`, `simulateCupTick`, `cupLegForTeam`, `buildBracketRound`, `countBracketRounds`: cuadro de eliminatoria (previa o exentos), ida/vuelta, resolución por agregado/penaltis. |
| `groupEngine.ts` | `buildGroups` (bombos, cualquier tamaño de grupo), `buildLeaguePhase` (tabla única), `simulateGroupRound`, `groupQualifiers`, `groupRange`, `startKnockout`: grupos o fase de liga y salto a la eliminatoria. |
| `continentalEngine.ts` | `buildContinentalCompetitions`, `buildMainStage`: clasificados por puesto de liga y campeón de copa, con previa (`qualifying`), secundarias en espera (`pending`) y reparto por continente. |
| `nationalEngine.ts` | `nationAsTeam`/`nationTeams`, `buildQualifying` (liguilla por confederación), `qualifiedFrom`, `buildTournament` (grupos) y `finishTournamentGroups` (mejores terceros → eliminatoria). |
| `progressionEngine.ts` | Plan de temporada, avances parciales (`applyDevelopmentTick`), cierre (`applySeasonGrowth`), `agePlayer`, `recoverWeekly`, `updateForm`, `mergeSeasonIntoCareer`. |
| `leagueManager.ts` | Calendario (círculo), clasificación, ascensos/descensos (`processPromotionRelegation`, `processCountryPyramid`). |
| `marketEngine.ts` | `interestedTeams`, `generateOffers`, `chooseDebutTeam`. Las ofertas de un filial se marcan con `filialOf` (cantera). |
| `eventEngine.ts` | Eventos aleatorios: `buildEventContext`, `pickEvent` (elegibles + cooldown + sorteo ponderado), `createPendingEvent`, `resolveEvent` (rama arriesgada y efectos). Los efectos de mercado se devuelven al servicio. |
| `crestEngine.ts` | Identidad visual pura: `crestIdentity` (colores reales de `clubColors` o paleta por `hashString`), `initialsOf`, `flagColors`, `flagSvgInner` (banderas por especificación, excepciones a mano y estandarte de reserva). No usa el `rng` de la partida. |

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
  `dashboard`, `match`, `squad`, `calendar`, `table`, `competitions`, `national`,
  `history`, `market`. Soporta query params; `parseHash` cae a `dashboard` si la ruta
  no es válida.
- **Vista de selección** (`nationalView`): nación, convocatoria, estadísticas
  internacionales y clasificación/torneos de selecciones.
- **Vista de competiciones** (`competitionsView`): selector de copa y cuadro de
  eliminatorias con las piernas y el campeón.
- **Creación (`creationView`):** selector en dos pasos — grupo posicional → subposición
  (`rolesOfGroup` + `ROLE_LABELS`). El resto de vistas (vestuario, cabecera, guardados,
  historial, selección) muestran `ROLE_LABELS[player.role]`.
- **Filiales en la UI:** badge «Filial de X» y «Convocado primer equipo» en el
  vestuario; el mercado marca las ofertas de filial como «Cantera de X». El aviso de
  convocatoria aparece en la ficha del próximo partido y en las decisiones de evento.
- **Plantilla (`squadView`, ruta `squad`):** lista la plantilla del club y la de la
  selección con la valoración (OVR) de cada jugador, resalta tu ficha y al rival del
  puesto, y compara tus 7 atributos con él (`squadComparison`). Se accede desde la
  cabecera y con «Ver plantilla» en el vestuario.
- **Calendario (`calendarView`, ruta `calendar`):** tus partidos de la temporada
  agrupados por mes, con competición, rival, resultado (V/E/D) y el próximo resaltado.
  Cada fecha futura tiene «Simular hasta aquí» (con confirmación) que llama a
  `careerService.simulateUntil(tick)`. Se accede desde la cabecera y con «Calendario»
  en el vestuario.
- **Identidad visual (`ui/components/crest.ts`):** `teamCrest` (escudo con partición e
  iniciales), `leagueCrest` (roundel), `nationFlag` (bandera), `teamBadge` (escudo o
  bandera según `nat.*`) y `crestLabel` (escudo + nombre). Se usan en clasificación,
  marcador, próximo partido, resultados, mercado, plantilla, calendario, selección,
  copas, guardados, historial y selector de debut.
- **Eventos aleatorios en la UI:** el vestuario pinta una tarjeta de decisión
  (`eventCard`) con las opciones; al resolverla se abre un **modal de desenlace**
  (`showEventOutcome`) con la narrativa y los chips de consecuencias, y queda la
  tarjeta **«Último evento»** (`lastEventCard`). `MessageKind.Event` (icono 🎲) en la
  bandeja. Mientras hay `pendingEvent`, la ficha de próximo partido y `matchView`
  muestran «Decisión pendiente» y no dejan jugar.
- **Bootstrap (`ui/app.ts`):** monta cabecera + main, conecta `router.onChange`,
  escucha `state:changed` (solo cabecera) y `state:cleared` (vuelve a `creation`).
  Sin carrera activa redirige a `saves` si hay ranuras o a `creation` si no.
- **Componentes:** card, header, statBar, matchLog, modal, toast, tabs, debutPicker
  (selector de club de debut reutilizado por creación y reinicio).
- **Tema claro/oscuro (`ui/theme.ts`):** preferencia de interfaz en `localStorage`
  (`theme:v1`), con valor inicial desde `prefers-color-scheme` y aplicado como
  `data-theme` en `<html>`; un script inline en `index.html` lo fija antes del primer
  pintado. `bootstrap()` llama a `initTheme()` y la cabecera monta un botón de tema.
- **Interfaz responsive:** en escritorio, nav horizontal; en móvil (<900px) **barra
  inferior fija** con 4 secciones + hoja **«Más»** (`openModal`). Rejillas que colapsan
  y **tablas `data--stack`** que se convierten en tarjetas (<560px) usando `data-label`;
  modal tipo *bottom-sheet*, toasts a ancho completo, foco visible global y respeto a
  `prefers-reduced-motion`.
- **Estilos:** `src/styles/main.css` importa en cascada `variables.css`, `base.css`,
  `layout.css`, `components.css`, `views.css`. Tokens en `variables.css` con el tema
  oscuro por defecto y overrides en `[data-theme='light']`. **Ningún CSS se importa
  fuera de `main.ts`.**

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
  (3 POR · 7 DEF · 7 MED · 5 DEL). `SQUAD_SLOTS` reparte además las 15 subposiciones
  entre los 22 dorsales.
- Fuerzas del mundo: `base = topOverall − (index/(total−1))·18.5` + ruido; los
  atributos y reputación se derivan de ahí. `topOverall` por tier (p. ej. ES:
  85/73/63/55).
- Los clubes por liga y su pirámide (`aboveLeagueId`/`belowLeagueId`) se encadenan
  por país en `buildWorld`.
- El estado del RNG global es una pieza más del guardado: cualquier operación que
  consuma `rng` afecta a la reproducibilidad.
- ⚠️ **`memory.md` se actualiza en cada cambio** (ver cabecera y `AGENTS.md`): no
  cierres una tarea sin reflejarla aquí.
- ⚠️ Los eventos aleatorios consumen el `rng` global (`pickEvent` y las tiradas de
  `risk`): no reordenes esas llamadas si quieres reproducibilidad.
- ⚠️ Mientras exista `pendingEvent`, la UI bloquea el partido; solo
  `careerService.resolveEvent` lo limpia, y debe persistir.
- ⚠️ Para añadir un evento basta con declararlo en `data/events.ts` respetando el
  vocabulario de `EventEffect`; no hay que tocar el motor.
- 🐛 Pendiente conocido: `ui/views/marketView.ts` usa `player.potential` directamente
  para un badge, lo que contradice la regla de potencial oculto; debería usar
  `potentialHint()`.
- 🧩 **Comandos de OpenCode** en `.opencode/commands/`: `/feature <descripción>` y
  `/bugs <descripción>`. Ambos fuerzan el agente `plan` (solo planifican y
  diagnostican; no editan archivos) y **no proponen commits**: el usuario commitea
  por su cuenta. Para aplicar el arreglo o implementar hay que cambiar de agente.
- ⚠️ **Subposiciones:** `PlayerRole` se serializa en el guardado (valores string
  estables). Al añadir un rol hay que actualizar `roleGroup`, `ROLE_LABELS`,
  `DEFAULT_ROLE_BY_POSITION`, `rolesOfGroup`, `ovrWeights` y todas las tablas
  `ROLE_*_ADJUST`; la migración deriva `player.role` de `player.position`.
- ⚠️ `ovrFromAttributes` recibe ahora la **subposición** (`role`), no la posición:
  usarla con el grupo desincronizaría el OVR.
- ⚠️ Las plantillas de clubes no se persisten: al cambiar la generación por rol se
  regeneran (deterministas por hash del equipo).
- ⚠️ **Filiales:** el nombre del filial debe existir en `data/leagues.ts` (las ligas
  mantienen 18 equipos; los filiales se añadieron **sustituyendo** clubes). El vínculo
  se resuelve por país + nombre en `worldBuilder.linkFilials`. `getSquad(team, player,
  force)` inyecta al jugador aunque su contrato sea del filial (convocatorias).
- ⚠️ Con `player.callUp` activo, `userFixtureAt` devuelve la jornada del padre y
  `applyUserMatch` localiza el partido por `homeId/awayId/round`; no vuelvas a usar
  `current.teamId` para buscar la jornada.
- ⚠️ **Calendario:** `seasonCalendar` se rellena con las 34 jornadas de liga al
  arrancar temporada y hace **upsert** en cada `commitUserMatch` con partido (copa,
  continental, selección y convocatorias). `simulateUntil` quick-simula hasta la
  tanda elegida y **se detiene** si hay `pendingEvent` o cierra la temporada; la UI
  debe avisar de que tus partidos se juegan en rápido.
- ⚠️ **Identidad visual:** `crestEngine` es puro y usa `hashString`, **no el RNG de la
  partida**: no afecta al determinismo ni al guardado (no hay migración). Los colores
  de `data/clubColors.ts` son **best-effort**; si un club no está en la tabla, el
  escudo usa una paleta derivada de su `id`. Al añadir clubes, dales color ahí.
- ⚠️ **UI y tema:** pinta siempre con los tokens de `variables.css` (o `color-mix`
  sobre ellos), **nunca con colores literales**, o el tema claro (`[data-theme='light']`)
  se romperá. La preferencia de tema es `localStorage['theme:v1']`, **no** forma parte
  de la partida; el script inline de `index.html` la aplica antes del primer pintado.
- ⚠️ **Nav móvil:** `.mobile-nav` es `position: fixed` dentro de `.site-header`. **No
  pongas `backdrop-filter`, `transform`, `filter` ni `perspective` en `.site-header`**:
  crean un bloque contenedor y anclan la barra arriba en vez de abajo.
- ⚠️ **Tablas responsive:** para apilar una tabla en móvil necesita la clase
  `data--stack` **y** un `data-label` en cada `td` (y `data-span` en las celdas a ancho
  completo); sin `data-label` la etiqueta sale vacía. Las tablas de solo lectura que no
  la lleven se desplazan en horizontal (`.table-wrap`).

## 11. Mapa de archivos

```
src/
├── main.ts                     # importa main.css + bootstrap()
├── models/                     # enums, player, team, nation, league, competition, match,
│                               # event, career, index
├── data/                       # config, continents, names, leagues, cups, continental,
│                               # nations, nationalTournaments, events, filials,
│                               # clubColors, flags, worldBuilder, index
├── engine/                     # poisson, matchEngine, ratingEngine, roleEngine, calendar,
│                               # schedule, cupEngine, groupEngine, continentalEngine, nationalEngine,
│                               # progressionEngine, leagueManager, marketEngine, eventEngine,
│                               # crestEngine
├── services/                   # careerService (fachada), storageService, squadService,
│                               # playerFactory, randomService, nameService, idService, eventBus
├── utils/                      # math, random, date
├── styles/                     # variables, base, layout, components, views, main
└── ui/
    ├── app.ts, router.ts, dom.ts, theme.ts
    ├── components/             # card, header, statBar, matchLog, modal, toast, tabs, debutPicker, crest
    └── views/                  # creation, saves, dashboard, match, squad, calendar, table,
                                # competitions, national, history, market, types
```
