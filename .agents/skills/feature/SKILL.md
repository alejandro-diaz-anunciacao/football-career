---
name: feature
description: >
  Workflow paso a paso para añadir una funcionalidad nueva (feature) a este
  proyecto respetando la arquitectura por capas, el determinismo y la
  persistencia. Úsala cuando el usuario pida "añade", "implementa", "crea" o
  "agrega" una función/funcionalidad, un motor, una vista, una regla de juego,
  un campo de dominio o un flujo de carrera.
---

# Feature · añadir funcionalidad nueva

Guía operativa para implementar una funcionalidad nueva en este simulador de
carrera de futbolista (Vanilla TS + Vite, sin frameworks). El objetivo es que la
función encaje en la arquitectura, sea determinista, persistente y verificable
sin romper el build ni la partida guardada.

Antes de empezar, ten presentes `AGENTS.md` (instrucciones) y `memory.md`
(contexto de arquitectura). Esta skill asume su contenido.

## Cuándo usar

- El usuario pide implementar/crear/añadir una funcionalidad o regla de juego.
- Hay que tocar varias capas (modelo + motor + servicio + UI).
- Se añade un campo a `Player`/`CareerState`, un motor, una vista o un flujo de
  carrera (ascensos, mercado, progresión, partido…).

## Principios no negociables

1. **Dirección de dependencias:** `ui → services → engine → (models, data, utils)`.
   Nunca importes hacia arriba. Única excepción conocida:
   `engine/marketEngine.ts → services/idService`.
2. **Sin números mágicos:** toda constante de balance va a `data/config.ts`.
3. **Determinismo:** usa el `rng` inyectado / `Random`. **Nunca `Math.random()`**
   en la lógica (solo `randomSeed()` y `newSlotId()` pueden).
4. **Potencial oculto:** `Player.potential` jamás se pinta ni se guarda en
   metadatos (`SaveSlot`). Usa `potentialHint()`.
5. **Una sola fuente de verdad:** las mutaciones relevantes terminan en
   `careerService.persist()`, que guarda y emite `state:changed`.
6. **Idioma:** comentarios, UI y dominio en **español**; identificadores y APIs en
   **inglés**.
7. **Sin framework, sin runtime de UI:** construye DOM con `el()` de `ui/dom.ts`.

## Flujo de trabajo

### 1. Delimitar la funcionalidad

- Escribe en una frase qué hace y **quién la dispara** (una acción de la UI, el
  cierre de temporada, el avance de jornada…).
- Identifica el estado nuevo que necesita (`Player`, `CareerState`, `League`…).
- Decide si afecta al **guardado** (casi siempre que añades estado, sí).

### 2. Repartir por capas (de dentro hacia fuera)

| Qué necesitas | Dónde va |
|---|---|
| Entidad, campo, enum, tipo | `src/models/` (exporta desde `models/index.ts` si es nuevo) |
| Constante de balance | `src/data/config.ts` |
| Cálculo puro, aleatorio inyectado | `src/engine/` (recibe `Random`) |
| Orquestación, mutación de estado, persistencia | `src/services/` (`careerService` como fachada) |
| Botón/vista/pintado | `src/ui/` (vistas/componentes) |
| Datos estáticos (ligas, nombres, países) | `src/data/` |

### 3. Modelo y datos primero

- Añade el campo/tipo en `models/`. Si es un acumulador, crea un helper `empty*()`.
- Si el valor deriva de otros, recalcúlalo con una función pura
  (patrón `ovrFromAttributes`, `teamOverall`), no lo guardes duplicado.
- Constantes → `CONFIG` en `data/config.ts`.

### 4. Lógica en el engine (pura)

- Firma con `rng: Random` inyectado; sin efectos secundarios ni acceso a DOM o
  `localStorage`.
- Reutiliza utilidades: `clamp`, `round`, `Random.weighted/pick/int/chance/gauss`.
- Si el comportamiento se configura, reutiliza tablas ponderadas por posición
  (patrón `POSITION_WEIGHTS`, `DEVELOPMENT_WEIGHTS`).
- Recuerda los invariantes de simulación: 18 equipos/34 jornadas, orden
  `applyUserMatch` → `simulateRestOfRound`, `applyFixtureResult` idempotente,
  fuerzas efectivas vía `effectiveTeam`.

### 5. Orquestar en `careerService`

- Añade la operación y **expórtala en el objeto fachada** `careerService`.
- Si muta estado: `requireState()` → mutar → `persist()` (sincroniza `rngState`).
- Si hay que avisar al usuario: `pushMessage(...)` (bandeja) o
  `notify(mensaje, tono)` (toast vía `bus`).
- Si es un cálculo de solo lectura, expón una consulta que lea `state`.

### 6. UI

- La cabecera solo se repinta en `state:changed`; para refrescar la vista entera
  llama a `ctx.refresh()`.
- Construye con `el()`; formatea con `fmt`, `fmtMoney`, `fmtWage`.
- Si es una pantalla nueva: crea la factoría en `ui/views/`, regístrala en
  `FACTORIES` (en `ui/app.ts`), añade el `RouteId` y la ruta válida en
  `ui/router.ts`, y enlázala desde la cabecera o navegación si procede.
- No muestres nunca `potential`; etiquetas de UI en español.

### 7. Persistencia y migración (no lo olvides)

- Si el nuevo estado vive en `CareerState`/`Player`: rellénalo en
  `storageService.migrate()` para partidas antiguas.
- Si cambias la forma de `League` o `Fixture`: actualiza **`packState` y
  `unpackState`** a la vez.
- Sube `SAVE_VERSION` si el cambio es incompatible.
- La plantilla de clubes es determinista y cacheada en memoria; **no se persiste**.

### 8. Verificar (obligatorio)

```bash
npm run typecheck   # siempre; el build también lo ejecuta
npm run build       # cuando toques UI/estilos o quieras confirmar el bundle
```

Prueba de motor/dominio en Node (esbuild + shim de `localStorage`, ver §8 de
`memory.md`):

```bash
npx esbuild /tmp/opencode/smoke.ts --bundle --platform=node --format=esm \
  --outfile=/tmp/opencode/smoke.mjs && node /tmp/opencode/smoke.mjs
```

Para UI real, usa jsdom o Chrome headless por CDP (recetas en `memory.md`).
Comprueba al menos: el caso feliz, el determinismo (misma semilla → mismo
resultado) y la carga de una partida antigua migrada.

### 9. Documentar el cambio (obligatorio, no opcional)

- **`memory.md` se actualiza SIEMPRE** con cada cambio, no solo cuando cambia la
  arquitectura: qué cambió y por qué, archivos/campos/tipos nuevos, migración,
  invariantes o trampas nuevas y la fecha de la última revisión. Debe quedar hecho
  **en el mismo turno**, antes de dar la tarea por terminada.
- Actualiza `README.md` solo si es una funcionalidad visible para el jugador.

## Checklist de convenciones (rompe el build si falla)

- [ ] Todo import de tipo usa `import type`.
- [ ] No hay imports, locales ni parámetros sin usar (`noUnusedLocals/Parameters`).
- [ ] `switch` con `break`/`return` en todos los casos.
- [ ] Overrides marcados con `override` (`noImplicitOverride`).
- [ ] Sin números mágicos: van a `CONFIG`.
- [ ] Sin `Math.random()` en la lógica.
- [ ] Identificadores en inglés, textos en español.
- [ ] CSS nuevo, solo en `src/styles/*.css` y enganchado por `@import` en
      `cascada` desde `main.ts` (no importar CSS desde componentes).

## Anti-patrones (evítalos)

- Meter lógica de simulación en la UI o en `careerService`.
- Guardar en `localStorage` directamente desde una vista; usa la fachada.
- Duplicar un valor derivado en el estado en vez de recalcularlo.
- Añadir un campo sin migración → partidas viejas con `undefined`.
- Cambiar `Fixture`/`League` sin tocar `packState`/`unpackState`.
- Persistir la caché de plantillas.
- Repintar la vista completa ante `state:changed` (rompe el partido en directo).

## Definición de "hecho"

1. `npm run typecheck` en verde (y `build` si hubo UI).
2. Funcionalidad jugable end-to-end y determinista con la misma semilla.
3. Migración cubierta si se añadió estado persistido.
4. Sin números mágicos fuera de `CONFIG` ni usos de `Math.random()`.
5. `potential` sigue siendo invisible.
6. `memory.md` actualizado **siempre** (obligatorio); `README.md` si es visible.
