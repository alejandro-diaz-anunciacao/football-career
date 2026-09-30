# ⚽ Footballer Sim · Carrera de Leyenda

Simulador de carrera de futbolista en **Vanilla TypeScript estricto** (Vite, sin frameworks),
organizado con **Clean Architecture** en capas desacopladas: dominio, motores de
simulación, datos, servicios y presentación.

Empiezas con 16 años y 48-58 de media global en la **categoría más baja de tu país**
(en España, Segunda Federación). A partir de ahí: rendimiento, progresión, mercado,
ascensos, descensos y trofeos a lo largo de **26 ligas de 5 continentes**.

---

## 🚀 Comandos

```bash
npm install        # instala Vite + TypeScript
npm run dev        # servidor de desarrollo → http://localhost:5173
npm run typecheck  # tsc --noEmit (strict: true)
npm run build      # typecheck + bundle de producción en dist/
npm run preview    # sirve el build de producción
```

## 🗂️ Estructura

```
footballer-sim/
├── index.html                  # shell de la SPA (#app, #modal-root, #toast-root)
├── package.json / tsconfig.json (strict) / vite.config.ts
└── src/
    ├── main.ts                 # punto de entrada
    ├── utils/                  # utilidades puras y sin dependencias
    │   ├── math.ts             # clamp, round, normalización de pesos, cuotas
    │   └── random.ts           # RNG determinista mulberry32 (estado serializable)
    ├── models/                 # capa de dominio (sin lógica de infraestructura)
    │   ├── enums.ts            # Position, Foot, Continent, SquadRole, MatchEventType…
    │   ├── player.ts           # Player, Attributes, Contract, stats + OVR ponderado
    │   ├── team.ts             # Team, SquadMember
    │   ├── league.ts           # League, Fixture, StandingRow, orden de clasificación
    │   ├── match.ts            # MatchEvent, PlayerMatchStats, MatchResult
    │   ├── career.ts           # CareerState, SeasonHistory, Trophy, TransferOffer
    │   └── index.ts
    ├── data/                   # base de datos estática + construcción del mundo
    │   ├── config.ts           # TODAS las constantes de balance
    │   ├── continents.ts       # continentes y países jugables
    │   ├── names.ts            # bancos de nombres por país
    │   ├── leagues.ts          # 26 ligas y 468 clubes reales
    │   └── worldBuilder.ts     # genera equipos con ataque/medio/defensa/reputación
    ├── engine/                 # lógica de simulación pura
    │   ├── poisson.ts          # Poisson, lambdas, 1X2 y marcador más probable
    │   ├── ratingEngine.ts     # nota 1.0-10.0 ponderada por rol
    │   ├── matchEngine.ts      # MatchSimulation minuto a minuto + previa + mercado
    │   ├── progressionEngine.ts# crecimiento por edad/rendimiento/minutos + declive
    │   ├── leagueManager.ts    # calendario (método del círculo), tabla, ascensos
    │   └── marketEngine.ts     # clubes interesados y ofertas de fichaje
    ├── services/               # orquestación, estado e infraestructura
    │   ├── careerService.ts    # fachada de la carrera (única fuente de verdad)
    │   ├── storageService.ts   # persistencia multi-partida en localStorage
    │   ├── squadService.ts     # plantillas deterministas por club (cacheadas)
    │   ├── playerFactory.ts    # creación del jugador y de sus atributos
    │   ├── randomService.ts    # RNG global + estado persistible
    │   ├── nameService.ts / idService.ts / eventBus.ts
    ├── styles/                 # CSS modular con variables (tema oscuro deportivo)
    │   ├── variables.css · base.css · layout.css · components.css · views.css
    │   └── main.css
    └── ui/                     # presentación
        ├── app.ts              # bootstrap, enrutado y sincronización con el estado
        ├── router.ts           # enrutador por hash tipado
        ├── dom.ts              # helper `el()` para construir DOM sin frameworks
        ├── components/         # card, header, statBar, matchLog, modal, toast, tabs
        └── views/              # creation, saves, dashboard, match, table, history, market
```

## 💾 Varias partidas a la vez

La pantalla **Partidas** (`#/saves`) permite tener hasta **12 carreras simultáneas**:

| Acción | Qué hace |
|---|---|
| **Nueva partida** | Crea una ranura nueva sin tocar las demás |
| **Continuar / Recargar** | Carga esa carrera y la convierte en la activa |
| **Reiniciar** | Empieza de cero conservando nombre, país, posición, dorsal y pie, pero con nueva media inicial, nuevo potencial oculto, nuevo club de debut y nueva semilla |
| **Eliminar** | Borra la partida (con confirmación); si era la activa, se cierra la sesión |
| **Borrar todas** | Vacía el almacenamiento |

Cada ranura guarda solo metadatos ligeros en el índice (`slots:v1`) y su estado completo
en `slot:<id>:v1`, de modo que el listado se pinta sin deserializar cientos de KB y **nunca
expone el potencial oculto**. El calendario se serializa en formato compacto
(`[jornada, local, visita, jugado, gf, gc]` con índices de equipo), lo que reduce cada
partida de ~950 KB a ~300 KB y permite convivir con varias.

La versión anterior de guardado único (`save:v1`) se **migra automáticamente** a una
ranura al arrancar, y los estados antiguos se completan con los campos nuevos.

## 📈 Desarrollo del futbolista

El crecimiento ya no es un ajuste anual opaco: es un **plan de temporada** que se ve
crecer jornada a jornada.

1. **Plan de temporada.** Al empezar cada curso se fija un objetivo de puntos de atributo
   a partir de la edad, el margen hasta el potencial oculto y el rendimiento esperado.
2. **Avances parciales.** Cada **4 jornadas** el motor reparte una fracción del objetivo,
   modulada por tu nota media acumulada. El vestuario muestra la barra de progreso
   (`+3,4 / +5,4 OVR`) y el último informe con el detalle por atributo.
3. **Cierre de temporada.** Se recalcula el objetivo con el rendimiento real (nota media,
   minutos, titularidades), se liquida lo que falte y se genera el informe anual. Una nota
   de rendimiento ≥ 85 en un menor de 21 años desbloquea una **temporada de explosión**
   (+18 % de crecimiento).
4. **Reparto guiado por lo que haces.** Los puntos no caen al azar: pesa la posición, tus
   acciones reales (goles → tiro, asistencias y pases clave → pase, robos → defensa,
   atajadas → portería, minutos → físico) y el **foco de entrenamiento** que elijas, que
   multiplica ×2,5 el peso de ese atributo.
5. **Curva realista.** 16-18 años ×1,9 · 19-21 ×1,3 · 22-24 ×0,85 · 25-27 ×0,45 · y declive
   progresivo desde los 30, que castiga antes el ritmo y el físico que la técnica.
6. **El potencial es un techo duro.** Al alcanzarlo el futbolista deja de crecer, y el
   informe lo refleja.

## 🧠 Cómo funciona la simulación

**Partido (minuto a minuto).** Para cada equipo se calculan los goles esperados con
Poisson a partir de la relación ataque/defensa, ajustada por el dominio del mediocampo,
el factor local (1.18/0.87) y el planteamiento táctico. Sobre esa base se planifica el
guion completo (goles, tiros, paradas, quites, intercepciones, pases clave, tarjetas,
lesiones y sustituciones) y se revela con `MatchSimulation.step()`, lo que permite al
usuario ver el partido en directo e intervenir cambiando el planteamiento.

**Calificación.** Cada acción tiene un peso distinto según la posición (atajadas y
porterías a cero para porteros; quites e intercepciones para defensas; pases clave y
asistencias para medios; goles y tiros para delanteros), modulado por el resultado.

**Progresión.** `edad × rendimiento × minutos × margen hasta el potencial`. De 16 a 18
años el crecimiento es muy alto, se estabiliza a los 22-24 y se vuelve declive desde los
30. El potencial es siempre oculto: la UI solo muestra una pista difusa.

**Pirámide.** Al cerrar la temporada se ejecutan ascensos y descensos reales en cada país
(el campeón sube, los últimos bajan) con refuerzo/debilitamiento de plantilla. El mundo
se recalcula por completo: calendarios, tablas y mercado.

**Tu peso en el equipo.** Un futbolista muy superior a la media de su club eleva el
ataque, el mediocampo y la defensa del equipo en el partido, de forma proporcional a su
rol (titular, suplente o no convocado) — por eso un crack acaba arrastrando a su club
hacia arriba en la tabla.

**Persistencia.** Todo el estado (`CareerState`) se serializa en `localStorage` bajo una
clave versionada e incluye el estado del RNG, de modo que la partida guardada es
reproducible.

## ✅ Validación

Los motores y la interfaz se han probado de extremo a extremo (7 temporadas seguidas,
ciclo completo de partidas, 400 partidos simulados y navegación por todas las vistas):

- media de **2.75 goles por partido**, distribución de marcadores realista;
- **468 clubes / 26 ligas** coherentes tras cada temporada (18 equipos siempre);
- clasificaciones consistentes (victorias = derrotas, partidos cuadrados);
- calificaciones siempre entre 1.0 y 10.0 y coherentes con la posición;
- **ciclo de partidas**: crear varias, listar, cambiar de una a otra, reiniciar
  conservando la identidad, eliminar (incluida la activa) y límite de 12 ranuras;
- **migración** del guardado antiguo de un solo hueco, con relleno de los campos nuevos;
- **progresión**: el foco cambia la distribución de puntos de forma determinista, un
  juvenil crece más que un veterano, quien no juega no progresa y el potencial nunca se
  supera;
- puerta a puerta desde Segunda Federación hasta la élite con fichajes internacionales.
