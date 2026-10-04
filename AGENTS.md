# AGENTS.md

Simulador de carrera de futbolista: SPA **Vanilla TypeScript estricto + Vite**, sin frameworks.
No es un repositorio git.

## Regla innegociable: `memory.md` siempre al día

**Tras CUALQUIER cambio** (código, datos, UI, config, arquitectura o arreglo de
bugs) actualiza `memory.md` **en el mismo turno**, antes de dar la tarea por
terminada. Deja reflejado:

- Qué ha cambiado y por qué.
- Archivos, campos y tipos nuevos, y su migración (si toca guardado).
- Invariantes, reglas o trampas nuevas.
- La fecha de la última revisión.

Una tarea **no está "hecha"** hasta que `memory.md` refleja el cambio. Esta regla
también está reforzada en la skill `feature` y en la cabecera de `memory.md`.

## Comandos

```bash
npm run dev        # Vite en http://localhost:5173 (host: true)
npm run typecheck  # tsc --noEmit — la verificación más rápida, ejecútala siempre
npm run build      # tsc --noEmit && vite build  (el build ya incluye el typecheck)
npm run preview    # sirve dist/
```

**No hay test runner, lint ni formatter.** No busques `npm test`: no existe. La
verificación real se hace con typecheck + un script ad-hoc empaquetado con esbuild
(recetas más abajo).

## Arquitectura

Capas con dependencias en una sola dirección: `ui → services → engine → (models, data, utils)`.
`engine`, `models`, `data` y `utils` **no tocan el DOM**; `ui` nunca es importado por otras capas.

- `src/models/` — entidades y enums del dominio. Sin lógica de infraestructura. `models/index.ts` es el único punto de import del dominio.
- `src/engine/` — simulación pura e inyectable (recibe `Random`). `matchEngine` (partido minuto a minuto), `progressionEngine`, `leagueManager`, `marketEngine`, `ratingEngine`, `poisson`.
- `src/services/` — orquestación y estado. `careerService` es la **fachada única** y la fuente de verdad.
- `src/ui/` — enrutador por hash + vistas que devuelven `HTMLElement` con el helper `el()` de `ui/dom.ts`.
- `src/data/config.ts` — **todas** las constantes de balance. No inventes números mágicos en los motores.

Única excepción a la regla de capas: `engine/marketEngine.ts` importa `uid` de `services/idService`.

## Convenciones que romperías sin saberlo

- `verbatimModuleSyntax` + `noUnusedLocals/Parameters`: todo import de tipo debe ir con `import type`, y cualquier import sin usar rompe el build.
- Los enums son **string enums** (`Position.Midfielder === 'MED'`); se serializan legibles en disco.
- Comentarios, textos de UI y términos del dominio en **español**; identificadores y nombres de API en **inglés**.
- CSS modular en `src/styles/*.css`, importado **solo** desde `src/main.ts` (`@import` en cascada). No hay CSS-in-JS.
- El **potencial del jugador es oculto**: nunca lo pintes en la UI ni lo metas en los metadatos de partidas guardadas. Usa `potentialHint()`.

## Estado, guardado y determinismo

- `careerService` mantiene un **singleton `state`** en memoria. Cualquier mutación relevante termina en `persist()`, que guarda en la ranura activa y emite `state:changed`.
- `ui/app.ts` **solo repinta la cabecera** ante `state:changed` a propósito: repintar la vista entera destruiría un partido en directo. Para refrescar la vista, las vistas llaman a `ctx.refresh()`.
- Persistencia multi-partida en `localStorage`: índice `slots:v1` + `slot:<id>:v1`. El estado se guarda **compactado** (`packState`/`unpackState` codifican los calendarios como `[jornada, local, visita, jugado, gf, gc]` con índices de equipo). Si cambias la forma de `League`/`Fixture`, actualiza ambas funciones.
- `storageService.migrate()` rellena campos nuevos en partidas antiguas. Al añadir un campo a `Player` o `CareerState`, añádelo también ahí.
- Determinismo: usa el `rng` inyectado / `Random`, **nunca `Math.random()`**. El estado del RNG se persiste en `rngState` para que la partida sea reproducible.
- Las plantillas de los clubes se generan de forma determinista a partir del hash del id del equipo y se cachean en memoria; **no se persisten**.
- En Node sin shim de `localStorage`, `storageService` traga los errores y `loadSlot()` devuelve `null` en silencio: si pruebas persistencia, define un shim primero.

## Invariantes de la simulación

- **Orden de jornada**: primero se aplica el partido del usuario (`applyUserMatch`) y después `simulateRestOfRound()`. `applyFixtureResult` es idempotente (`if (fixture.played) return`), así que no dupliques el orden.
- Todas las ligas tienen **18 equipos → 34 jornadas**, y el mundo se recorre entero en cada jornada. `generateFixtures` devuelve `[]` si el número de equipos es **impar**: mantén siempre un número par de equipos por liga.
- `MatchSimulation` es interactivo: se avanza con `step()` (1 minuto por llamada) y `getResult()` solo es válido cuando `finished === true`.
- Las fuerzas del equipo del usuario se ajustan según su OVR y su rol (`effectiveTeam`); no simules su equipo con las fuerzas base.

## Recetas de verificación

Motor / dominio en Node (esbuild, sin test runner):

```bash
npx esbuild /tmp/opencode/smoke.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/opencode/smoke.mjs && node /tmp/opencode/smoke.mjs
```

El script de prueba importa con rutas **absolutas** al `src/` (p. ej. `import { careerService } from '/home/.../src/services/careerService.ts'`) y define un shim de `localStorage`. esbuild no comprueba tipos, así que ejecuta `npm run typecheck` aparte.

Interfaz real sobre jsdom:

```bash
npm install --no-save jsdom
npx esbuild /tmp/opencode/ui-smoke.ts --bundle --platform=node --format=esm \
  --packages=external --outfile=.tmp-ui-smoke.mjs && node .tmp-ui-smoke.mjs && rm .tmp-ui-smoke.mjs
```

El outfile debe quedar **dentro del proyecto** para que Node resuelva `jsdom`. Hay que inyectar
en `globalThis`: `window`, `document`, `location`, `history`, `localStorage`, `addEventListener`,
un `scrollTo` no-op y `Element.prototype.scrollIntoView`.

Chrome headless por CDP (para capturas y flujos reales, con el dev server en 5173):

```bash
google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 \
  --user-data-dir=/tmp/opencode/chrome-profile about:blank
# luego un cliente CDP en Node (global fetch + WebSocket)
```

- Para ejecutar código contra los módulos ya cargados por la app, resuelve la URL real del módulo con `performance.getEntriesByType('resource')`: con HMR, Vite sirve `.../careerService.ts?t=...` y un `import('/src/services/careerService.ts')` crearía **una segunda instancia** con estado `null`.
- `localStorage.clear()` + recarga antes de cada pasada: el perfil de Chrome conserva la partida anterior.
- `innerText` devuelve el texto con `text-transform` aplicado (mayúsculas en `.field__label`): compara en minúsculas.
