# QA Action Plan

Fecha: 2026-03-04  
Base: [QA-report-2026-03-04-manual.md](./QA-report-2026-03-04-manual.md)

## Objetivo

Cerrar los accionables del QA manual en orden de impacto, hasta pasar de “aprobación condicional” a “QA pass”.

## Estrategia de ejecución

- Ejecutar en 5 fases secuenciales.
- Cada fase debe cerrar con criterios de aceptación explícitos.
- Recomendación: 1 PR por fase para mantener trazabilidad.

---

## Fase 1: Flujo de progreso (bloqueante)

Problema principal:

- El progreso de análisis muestra estados contradictorios (`Game X/Y` vs mensaje de otra partida vs `%`).

Acciones:

1. Definir una sola fuente de verdad para progreso en frontend.
2. Normalizar eventos del stream para separar:
   - progreso agregado (global)
   - eventos por partida
3. Ajustar mapping de `phase`, `gamesCompleted`, `gameIndex` y `%`.
4. Evitar render de mensajes stale entre fases.
5. Agregar logging mínimo para depurar stream en dev.

Criterios de aceptación:

- Nunca aparecen simultáneamente datos de partidas distintas.
- El `%` coincide con `gamesCompleted/totalGames`.
- El usuario entiende inicio, avance y final del análisis sin ambigüedad.

Entregable:

- PR `phase-1-progress-consistency`

---

## Fase 2: Calidad del coaching LLM

Problema principal:

- Explicaciones genéricas y uso de inferencias tipo “you probably thought...”.

Acciones:

1. Endurecer prompt para:
   - explicar consecuencia concreta
   - evitar inferencias no verificables
   - reducir elogios no sustentados
2. Implementar post-procesado de respuesta:
   - validación de estructura
   - filtro de frases de baja calidad
   - deduplicación de conceptos repetidos
3. Definir una rúbrica simple de calidad de insight:
   - especificidad
   - accionabilidad
   - consistencia con evaluación

Criterios de aceptación:

- Cada error relevante explica qué se perdió y por qué.
- Se reduce significativamente el texto “plantilla”.
- El feedback se percibe más concreto y útil para entrenar.

Entregable:

- PR `phase-2-llm-insight-quality`

---

## Fase 3: Puzzles pedagógicos

Problema principal:

- El puzzle valida acierto, pero enseña poco cuando el usuario falla.

Acciones:

1. Mostrar metadatos de entrenamiento:
   - `theme`
   - `concept`
   - `attempts`
   - `first-try`
2. Mejorar feedback de error:
   - mensaje de fallo claro
   - reveal con explicación breve
3. Reemplazar score ambiguo por métricas claras.
4. Conectar cada error crítico con su puzzle específico.

Criterios de aceptación:

- Fallar un puzzle también genera aprendizaje concreto.
- Métricas de progreso del puzzle son legibles.
- Desde `Game Details` se puede saltar a `Practice this position`.

Entregable:

- PR `phase-3-puzzle-learning-loop`

---

## Fase 4: UI/UX y limpieza de datos

Problema principal:

- Labels crudos de aperturas y redundancia de contenido en resultados.

Acciones:

1. Sanitizar `openingName` en todas las vistas.
2. Reducir redundancia entre bloques de resumen.
3. Priorizar jerarquía:
   - qué corregir
   - qué practicar ahora
   - detalles después
4. Estandarizar microcopy de métricas y estados.

Criterios de aceptación:

- No aparecen strings crudos tipo `/Www.Chess.Com/...`.
- La pantalla final es más escaneable y accionable.
- El CTA principal de práctica queda claro.

Entregable:

- PR `phase-4-results-ux-copy`

---

## Fase 5: Estabilidad visual y cierre QA

Problema principal:

- Warnings de charts (`width/height -1`) y riesgo de render frágil.

Acciones:

1. Corregir montaje/medición de charts en contenedores responsivos.
2. Verificar desktop + mobile (390px) + tablet.
3. Correr validación final:
   - `npm run lint`
   - `next build --webpack`
   - QA manual end-to-end

Criterios de aceptación:

- Sin warnings de chart en consola durante flujo principal.
- Sin overflow horizontal en mobile.
- QA final marcado como “pass”.

Entregable:

- PR `phase-5-visual-stability-qa-close`
- Nuevo reporte `QA-report-final-YYYY-MM-DD.md`

---

## Orden recomendado de PRs

1. `phase-1-progress-consistency`
2. `phase-2-llm-insight-quality`
3. `phase-3-puzzle-learning-loop`
4. `phase-4-results-ux-copy`
5. `phase-5-visual-stability-qa-close`

---

## Definición de Done global

Se considera cerrado cuando:

1. Las 5 fases están mergeadas.
2. QA manual final no tiene findings de severidad Alta.
3. Hallazgos medios restantes tienen ticket explícito o están corregidos.
4. Existe reporte final de QA con estado “pass”.
