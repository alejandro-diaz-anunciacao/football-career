---
description: Diagnostica un bug en modo Plan (causa raíz + plan de arreglo), sin editar archivos
agent: plan
---

Vas a **diagnosticar un bug** en el proyecto **football-career** (simulador de
carrera de futbolista; Vanilla TS estricto + Vite, sin frameworks). Estás en modo
Plan: **no modifiques archivos** ni propongas commits (los commits los hace el
usuario).

## Bug reportado

$ARGUMENTS

## Cómo trabajar

1. **Reproduce** el bug si tienes pasos; si no, formula una hipótesis y localiza
   el código implicado leyendo `AGENTS.md` y `memory.md`.
2. Encuentra la **causa raíz** (no parches cosméticos) y explícala con referencias
   a los archivos y líneas concretas.
3. Propón el **plan del arreglo** por capas, respetando:
   - `ui → services → engine → (models, data, utils)`;
   - determinismo: `rng` inyectado, nunca `Math.random()`;
   - persistencia: `storageService.migrate` para campos nuevos de
     `Player`/`CareerState`, y `packState`/`unpackState` si cambia `League`/`Fixture`.
4. Indica la **verificación** prevista (`npm run typecheck`, `npm run build` y
   smoke tests de dominio/UI según `memory.md`).
5. Señala qué actualizar en **`memory.md`** al aplicar el arreglo (causa, solución y
   trampas nuevas). Esa parte se documentará al implementar, no ahora.

No apliques cambios. Si falta información, pregúntame.
