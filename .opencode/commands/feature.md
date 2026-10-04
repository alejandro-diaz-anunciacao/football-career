---
description: Planifica una nueva funcionalidad (sin implementarla) respetando la arquitectura del proyecto
agent: plan
---

Actúa como arquitecto del proyecto **football-career** (simulador de carrera de
futbolista; Vanilla TS estricto + Vite, sin frameworks). Estás en fase de
**planificación**: no modifiques archivos ni propongas commits (los commits los
hace el usuario).

## Funcionalidad solicitada

$ARGUMENTS

## Cómo trabajar

1. Lee `AGENTS.md` y `memory.md` y sigue sus convenciones: capas
   `ui → services → engine → (models, data, utils)`, determinismo con el `rng`
   inyectado (nunca `Math.random()`), persistencia con migración en
   `storageService.migrate`, potencial oculto, y textos/comentarios en español.
2. Localiza el código implicado y explica cómo encaja en la arquitectura actual.
3. Propón un plan por capas y fases: archivos y campos/tipos nuevos, cambios en
   `CONFIG`, migración necesaria y su impacto en el guardado.
4. Marca las decisiones de diseño abiertas y **hazme preguntas** para cerrarlas
   antes de implementar.
5. Describe la verificación (`npm run typecheck`, `npm run build` y smoke tests de
   dominio/UI según `memory.md`).
6. Indica qué habrá que documentar en `memory.md` al implementar (regla obligatoria).

No implementes nada todavía. Si falta contexto, pregúntame.
