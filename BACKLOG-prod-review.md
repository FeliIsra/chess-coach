# Backlog: Production Review (2026-04-13)

Hallazgos del review en produccion sobre `chess-coach-iota.vercel.app`.
Analisis con usuario `gothamchess`, 3 juegos bullet, 28s end-to-end.

Cada item tiene: prioridad (P0-P3), esfuerzo estimado (S/M/L), y categoria.

---

## P0 - Bugs y problemas que rompen la experiencia

### 1. "Plan: 0ms" en Performance metrics
- **Categoria**: Bug
- **Esfuerzo**: S
- **Detalle**: El label "Plan" mapea a `performance.overallMs` en `results-view.tsx:162`. En produccion muestra "0ms", lo que sugiere que la medicion del Phase 3 (overall insight) no esta capturando el tiempo correctamente, o el label esta mal asignado.
- **Archivo**: `src/components/results-view.tsx:162`, `src/app/api/analyze/route.ts:221`
- **Accion**: Verificar que `overallMs` mide lo que debe. Si es correcto, renombrar el label. Si no, fixear la medicion.

### 2. Texto repetido entre "What To Fix First" y "Train By Theme"
- **Categoria**: Bug UX
- **Esfuerzo**: S
- **Detalle**: Las descripciones en "Train By Theme" son copia exacta del "Next training block" / `studyPlan`. Ej: "Pause on quiet moves and ask which piece improves most without creating new targets" aparece verbatim en ambas secciones.
- **Archivo**: `src/components/results-view.tsx` (seccion Train By Theme), `src/lib/llm-coach.ts`
- **Accion**: Train By Theme deberia usar `weakSpots[].tip` que es especifico por tema, no repetir el study plan. Alternativamente, generar tips distintos en el prompt del LLM.

---

## P1 - UX: Quick wins de alto impacto

### 3. Eliminar o colapsar la seccion Performance
- **Categoria**: Information Architecture
- **Esfuerzo**: S
- **Detalle**: Fetch/Engine/AI/Plan/Analyze/End-to-End son metricas de debug. Un usuario de chess no sabe que hacer con "847ms Fetch" o "4.8s Engine". Contamina la zona de resumen con ruido tecnico.
- **Archivo**: `src/components/results-view.tsx:138-184`
- **Accion**: Opcion A: Eliminar. Opcion B: Mover detras de un toggle "Show timing details" colapsado por defecto. Opcion C: Dejar solo "Analysis took 28s" como una linea.

### 4. Simplificar nombres de aperturas
- **Categoria**: Readability
- **Esfuerzo**: M
- **Detalle**: "Reti Opening Nimzo Larsen Variation 2...d6 3.Bb2 E5" es inentendible para cualquiera que no sea un jugador avanzado. Aparece en "Your Openings" y en "Game Details".
- **Archivo**: `src/lib/chess-format.ts` (sanitizeOpeningName), `src/components/results-view.tsx`
- **Accion**: Truncar a la variante principal. Ej: "Reti Opening" o maximo "Reti Opening (Nimzo-Larsen)". Mostrar nombre completo en tooltip o al expandir.

### 5. Agregar tooltips/glosario para terminos clave
- **Categoria**: Onboarding / Novatos
- **Esfuerzo**: M
- **Detalle**: "Blunder", "Mistake", "Average Accuracy", evaluacion en peones ("0.9 pawns of value") no tienen definicion visible. Un novato no sabe el umbral de cada clasificacion ni que significa perder "0.9 peones de valor".
- **Accion**: Agregar tooltips inline al hover/tap:
  - Blunder: "A move that loses significant material or position (> 2 pawns of value)"
  - Mistake: "A move that loses moderate advantage (> 0.5 pawns of value)"  
  - Accuracy: "How close your moves were to the engine's best moves (100% = perfect)"
  - En puzzles: reemplazar "0.9 pawns of value" con "a moderate advantage" o mostrar ambos

### 6. Agregar hints al puzzle trainer
- **Categoria**: Puzzle UX
- **Esfuerzo**: M
- **Detalle**: Solo existe "Show After Move" que revela la respuesta completa. No hay paso intermedio. Esto reduce el valor pedagogico porque el usuario pasa de "no idea" a "respuesta revelada" sin oportunidad de pensar guiado.
- **Accion**: Agregar boton "Get Hint" que muestre progresivamente:
  1. Primer hint: el tema/concepto ("Think about center control")
  2. Segundo hint: la pieza correcta ("The best move involves the e-pawn")
  3. Tercer hint: el destino ("Try e2-e4")
  4. Despues de 3 hints o click en "Show Answer": revelar completo

### 7. Reemplazar footer tecnico
- **Categoria**: Polish
- **Esfuerzo**: S
- **Detalle**: "Uses Chess.com API, Stockfish via chess-api.com, and GPT-4o-mini" expone detalles de implementacion al usuario final. 
- **Archivo**: `src/app/page.tsx`
- **Accion**: Reemplazar con "Powered by Stockfish engine analysis and AI coaching" o similar. Sin nombres de APIs ni modelos especificos.

---

## P2 - Features que mejoran la experiencia significativamente

### 8. Mostrar rating del usuario analizado
- **Categoria**: Context
- **Esfuerzo**: S
- **Detalle**: El analisis no muestra el rating del usuario. El dato esta disponible en la respuesta de Chess.com API. Agregar el rating actual junto al username en el header de resultados.
- **Accion**: Extraer rating del perfil o de los games y mostrar "gothamchess (2850 bullet)" en el header.

### 9. Feedback visual al resolver puzzles
- **Categoria**: Puzzle UX
- **Esfuerzo**: M
- **Detalle**: Al hacer la jugada correcta en un puzzle no hay feedback claro (animacion, checkmark, sonido, cambio de color). El usuario no sabe si acerto o no hasta que interpreta el resultado.
- **Accion**: Al acertar: borde verde + checkmark + texto "Correct!". Al errar: borde rojo + shake + "Try again" con el numero de intento.

### 10. Humanizar evaluacion en puzzles
- **Categoria**: Copy / Novatos
- **Esfuerzo**: S
- **Detalle**: "Find a better move to avoid dropping about 0.9 pawns of value" - el numero no es intuitivo.
- **Accion**: Mapear rangos a lenguaje natural:
  - 0.3-0.7: "a small advantage"
  - 0.7-1.5: "a significant advantage"  
  - 1.5-3.0: "roughly a piece worth of advantage"
  - 3.0+: "a decisive advantage"
  - Mantener el numero entre parentesis para quien lo entienda: "a significant advantage (~0.9)"

### 11. Link a la partida en Chess.com
- **Categoria**: Feature
- **Esfuerzo**: S
- **Detalle**: En Game Details no hay forma de ver la partida completa en Chess.com. El URL del game esta disponible en la data de Chess.com API.
- **Accion**: Agregar link "View on Chess.com" en cada game card expandido.

### 12. Filtrar/ordenar juegos en Game Details
- **Categoria**: Feature
- **Esfuerzo**: M
- **Detalle**: Con 10-20 juegos, no se puede filtrar por resultado (solo losses), por time control, o por cantidad de errores. Todo es una lista plana.
- **Accion**: Agregar filtros minimos: "All / Wins / Losses / Draws" y ordenar por "Most errors first" o "Chronological".

### 13. Comparacion con promedio de su nivel
- **Categoria**: Context / Engagement
- **Esfuerzo**: L
- **Detalle**: "79% accuracy" no tiene contexto. El usuario no sabe si eso es bueno o malo para su rating. Algo como "Players at 2800 average 85% accuracy in bullet" seria muy util.
- **Accion**: Mantener una tabla de referencia (o calcular de la data historica) y mostrar "Your accuracy: 79% vs. typical at your level: 85%".

### 14. Analisis por fase del juego
- **Categoria**: Feature / Intermedios+
- **Esfuerzo**: L
- **Detalle**: No hay breakdown de accuracy por opening/middlegame/endgame. La data ya esta parcialmente disponible (move numbers + eval). Un jugador intermedio necesita saber si pierde en la apertura o en el final.
- **Accion**: Clasificar jugadas en 3 fases (moves 1-12: opening, 13-30: middlegame, 31+: endgame) y mostrar accuracy por fase.

### 14b. Hacer los puzzles mas interactivos y claros al mover piezas
- **Categoria**: Puzzle UX / Feedback
- **Esfuerzo**: M
- **Detalle**: Al resolver puzzles no queda suficientemente claro como se mueven las piezas ni cuando una accion fue registrada. Falta feedback multisensorial y visual durante drag, drop, acierto y error.
- **Accion**: Agregar señales mas obvias inspiradas en productos de ajedrez:
  - highlight claro de casillas origen/destino
  - animacion de movimiento mas evidente
  - sonido opcional al mover, acertar y errar
  - estados visuales mas notorios para "move accepted", "wrong move" y "correct solution"
  - affordance inicial tipo "drag the piece" o gesto guiado en el primer puzzle

### 14c. Hacer la UI mas inspirada en Chess.com
- **Categoria**: Visual Design / Product Identity
- **Esfuerzo**: L
- **Detalle**: La app funciona, pero la identidad visual todavia se siente generica. Queremos una direccion mas cercana al lenguaje de productos como Chess.com: jerarquia mas clara, superficies mas definidas, contraste funcional, foco fuerte en tablero, metricas y practica.
- **Accion**: Replantear el sistema visual sin copiar literalmente:
  - layout y espaciado mas cercanos a una herramienta de estudio de ajedrez
  - cards, tabs, badges y CTA con mas peso visual
  - mejor integracion entre tablero, analisis, puzzles y detalle de partida
  - revisar paleta, tipografia, densidad y estados interactivos con referencia explicita a Chess.com como inspiracion

### 14d. Convertir resultados en una experiencia de acordeones configurables
- **Categoria**: Information Architecture / UX
- **Esfuerzo**: M
- **Detalle**: Hoy el resultado se presenta como una pagina larga con muchas secciones abiertas al mismo tiempo. Quiero poder elegir que ver y que no, especialmente en mobile, para reducir ruido y navegar mejor entre resumen, openings, partidas y practica.
- **Accion**: Pasar las secciones principales a acordeones/expanders:
  - `What To Fix First`
  - `Train By Theme`
  - `Your Openings`
  - `Game Details`
  - contenido interno expandible por partida
  - considerar recordar el ultimo estado abierto/cerrado por usuario o sesion

---

## P3 - Nice to have / Power users

### 15. Export PGN con anotaciones
- **Categoria**: Feature / Avanzados
- **Esfuerzo**: M
- **Detalle**: No hay forma de guardar o compartir el analisis. Un PGN anotado con los comentarios del LLM seria util para estudio offline.
- **Accion**: Boton "Export PGN" que genere PGN con comentarios en las jugadas clave.

### 16. Mostrar profundidad de analisis del motor
- **Categoria**: Transparencia / Avanzados
- **Esfuerzo**: S
- **Detalle**: No se muestra a que profundidad evaluo Stockfish. Para jugadores avanzados, depth 15 vs depth 25 tiene implicancias en la confianza de la evaluacion.
- **Accion**: Mostrar "Engine depth: 18" en un tooltip o en la seccion de detalle del juego.

### 17. Analisis de tiempo por jugada
- **Categoria**: Feature / Avanzados
- **Esfuerzo**: M
- **Detalle**: Chess.com API provee timestamps por jugada. Se podria mostrar un grafico de tiempo usado por jugada overlay con el eval chart. Ya se parsea `clockSeconds` en `analyzer.ts:274`.
- **Accion**: Agregar linea de "time per move" al eval chart, o una seccion separada de "Time management".

### 18. Mejorar "Your Progress" con data historica
- **Categoria**: Retention
- **Esfuerzo**: L
- **Detalle**: "Your Progress" muestra EMPTY para usuarios nuevos y solo un sparkline basico despues. Para ser util necesita: trend de accuracy, trend de blunders/game, comparacion entre sesiones.
- **Accion**: Despues de 3+ sesiones, mostrar graficos de tendencia con labels claros ("Your accuracy is improving: 72% → 79% over 3 sessions").

### 19. Compartir analisis
- **Categoria**: Growth / Social
- **Esfuerzo**: M
- **Detalle**: No hay forma de compartir resultados. Un link compartible o imagen generada serviria para redes sociales y crecimiento organico.
- **Accion**: Boton "Share" que genere un link publico de solo lectura o una imagen resumen.

### 20. Conceptos tacticos con links educativos
- **Categoria**: Pedagogia / Novatos
- **Esfuerzo**: M
- **Detalle**: Los conceptos ("Pawn breaks", "Piece activity", "Rook activity", "Passed pawns") aparecen como tags pero no tienen link a material educativo. Un novato lee "Concept: Pawn breaks" y no sabe que hacer con eso.
- **Accion**: Linkear cada concepto a un recurso externo (Lichess lessons, Chess.com articles) o crear paginas internas con explicacion + mini-ejercicios.

---

## Resumen por esfuerzo

| Esfuerzo | Items | IDs |
|----------|-------|-----|
| **S** (< 1h) | 7 | #1, #3, #7, #8, #10, #11, #16 |
| **M** (2-4h) | 10 | #2, #4, #5, #6, #9, #12, #14b, #14d, #15, #17 |
| **L** (1+ dia) | 6 | #13, #14, #14c, #18, #19, #20 |

## Orden sugerido de ataque

**Sprint 1 (quick wins):** #1, #2, #3, #7 - fixear bugs y limpiar ruido  
**Sprint 2 (novice unlock):** #5, #10, #4 - hacer la app entendible para novatos  
**Sprint 3 (puzzle upgrade):** #6, #9 - mejorar la experiencia de practica  
**Sprint 4 (navigation + structure):** #8, #11, #12, #14d - agregar contexto y navegacion  
**Sprint 5 (visual direction):** #14b, #14c - subir interactividad e identidad visual  
**Sprint 6 (depth):** #13, #14, #17 - features para intermedios/avanzados  
**Sprint 7 (growth):** #15, #18, #19, #20 - retention y sharing  

---

## Plan de paralelizacion por worktrees

Objetivo: dividir el trabajo en slices con bajo acoplamiento para correr varios agentes/worktrees en paralelo sin chocarse.

### Worktree A - Resultados, IA y copy pedagogico
- **Owner**: `src/components/results-view.tsx`, `src/lib/llm-coach.ts`, `src/lib/chess-glossary.ts`
- **Tareas**:
  - #2 Texto no repetido entre `What To Fix First` y `Train By Theme`
  - #5 Tooltips y glosario para terminos clave
  - #10 Humanizar evaluacion en puzzles y copy de ventaja
  - revisar copy general de resumen para novatos
- **Notas**: no tocar puzzle board ni layout global salvo ajustes minimos de texto.

### Worktree B - Puzzle UX e interactividad
- **Owner**: `src/components/puzzle-trainer.tsx`, `src/components/chess-board-viewer.tsx` si hace falta, estilos asociados
- **Tareas**:
  - #6 Sistema de hints progresivos
  - #9 Feedback visual al resolver puzzles
  - #14b Puzzles mas interactivos: sonido, highlights, motion, affordances
- **Notas**: este worktree deberia concentrar todo lo que pase dentro de la experiencia de practica para evitar conflictos con resultados.

### Worktree C - IA de informacion y navegacion de resultados
- **Owner**: `src/components/results-view.tsx`
- **Tareas**:
  - #3 Colapsar/eliminar performance details
  - #8 Mostrar rating del usuario analizado mejor integrado
  - #11 Link a Chess.com por partida
  - #12 Filtros/orden en `Game Details`
  - #14d Convertir secciones principales a acordeones
- **Notas**: este worktree toca estructura de resultados y navegacion, pero no deberia meterse en logica de LLM ni en puzzle trainer.

### Worktree D - Openings, data formatting y contexto ajedrecistico
- **Owner**: `src/lib/chess-format.ts`, partes puntuales de `src/components/results-view.tsx`
- **Tareas**:
  - #4 Simplificar nombres de aperturas
  - #14 Analisis por fase del juego
  - #16 Mostrar profundidad real del analisis
  - #17 Analisis de tiempo por jugada
- **Notas**: ideal para alguien trabajando sobre data shaping y presentacion tecnica de ajedrez.

### Worktree E - Visual system e identidad tipo Chess.com
- **Owner**: estilos globales, componentes visuales base, layout de `src/app/page.tsx` y `src/components/results-view.tsx`
- **Tareas**:
  - #7 Footer tecnico/polish residual
  - #14c Direccion visual inspirada en Chess.com
  - homogeneizar cards, tabs, badges, CTA, densidad y jerarquia
- **Notas**: deberia entrar despues de que Worktree C estabilice acordeones/estructura, o trabajar primero sobre tokens/base styles y dejar wiring final para merge posterior.

### Worktree F - Export, sharing e historico
- **Owner**: `src/lib/pgn-export.ts`, historial y futuras rutas/features relacionadas
- **Tareas**:
  - #15 Export PGN con anotaciones
  - #18 Mejorar `Your Progress` con historica
  - #19 Compartir analisis
  - #20 Conceptos tacticos con links educativos
- **Notas**: slice mas independiente y de menor urgencia. Bueno para avanzar en paralelo mientras se estabiliza UX core.

---

## Orden recomendado para correr en paralelo

### Ola 1 - maxima velocidad con poco conflicto
- Worktree A
- Worktree B
- Worktree C

### Ola 2 - cuando la estructura base ya este mas estable
- Worktree D
- Worktree E

### Ola 3 - growth y extensiones
- Worktree F

---

## Riesgos de solapamiento

### Alto solapamiento
- Worktree A y Worktree C
  - Ambos tocan `src/components/results-view.tsx`
  - Conviene dividir ownership por secciones o secuenciar merges chicos

- Worktree C y Worktree E
  - Ambos pueden tocar layout/estilos de resultados
  - Conviene que E trabaje sobre primitives/tokens y C sobre comportamiento

### Bajo solapamiento
- Worktree B con casi todos los demas
- Worktree F con casi todos los demas
- Worktree D si evita refactors visuales grandes

---

## Paquetes concretos para ejecutar ya

### Pack 1 - `results-copy`
- #2, #5, #10

### Pack 2 - `puzzle-interaction`
- #6, #9, #14b

### Pack 3 - `results-navigation`
- #3, #8, #11, #12, #14d

### Pack 4 - `opening-and-analysis-data`
- #4, #14, #16, #17

### Pack 5 - `visual-refresh`
- #14c

### Pack 6 - `retention-and-sharing`
- #15, #18, #19, #20

---

## Plan maestro consolidado

Este plan ya fue descompuesto en paralelo y validado por slices tecnicos. La idea no es solo dividir por archivo, sino por ownership funcional dentro de los hotspots (`results-view.tsx`, `globals.css`).

### Hotspots y reglas de ownership

#### `src/components/results-view.tsx`
- **Owner A (`results-copy`)**:
  - copy de `Train By Theme`
  - glosario/tooltips asociados
  - integracion de `weakSpots.tip`
- **Owner C (`results-navigation`)**:
  - acordeones
  - filtros/sort de `Game Details`
  - jerarquia del header y links visibles a Chess.com
  - bloque colapsable de analysis/performance details
- **Owner D (`opening-and-analysis-data`)**:
  - phase summary
  - depth real
  - time-management summary
  - openings simplificados en presentacion
- **Owner F (`retention-and-sharing`)**:
  - wiring de export/share
  - links educativos tacticos
- **Owner E (`visual-refresh`)**:
  - styling final y visual hierarchy
  - no redefinir contenido ni logica de acordeones

#### `src/app/globals.css`
- **Owner E** define tokens, superficies, card styles, acordeon styles y direccion visual.
- **Owner B** solo puede agregar motion helpers minimos (`shake`, `pulse`, reduced-motion fallback) si no bloquea a E.

#### `src/components/puzzle-trainer.tsx`
- **Owner B** completo:
  - hints
  - feedback visual
  - sonido
  - affordances de drag/move
  - humanizacion final del copy del puzzle

### Worktrees listos para crear

#### WT-A `results-copy`
- **Objetivo**: #2, #5, parte de #10
- **Files**:
  - `src/components/results-view.tsx`
  - `src/lib/chess-glossary.ts`
  - `src/lib/llm-coach.ts`
- **Entregable**:
  - `Train By Theme` deja de repetir `studyPlan`
  - glosario mas claro para novatos
  - tips del LLM mas cortos y distintos
- **Bloqueo**:
  - depende de B para cerrar el texto visible del puzzle en #10

#### WT-B `puzzle-interaction`
- **Objetivo**: #6, #9, #14b y cierre de #10 en puzzles
- **Files**:
  - `src/components/puzzle-trainer.tsx`
  - `src/components/puzzle-trainer.test.ts`
  - `src/lib/puzzle-feedback.ts` nuevo
  - `src/app/globals.css` solo si hace falta motion
- **Entregable**:
  - hints progresivos robustos
  - feedback de acierto/error mucho mas visible
  - cues de audio y affordance de arrastre
  - copy de ventaja humanizado dentro del puzzle
- **Bloqueo**:
  - ninguno fuerte

#### WT-C `results-navigation`
- **Objetivo**: #3, #8, #11, #12, #14d
- **Files**:
  - `src/components/results-view.tsx`
  - `src/components/results-accordion-section.tsx` nuevo
- **Entregable**:
  - secciones en acordeon
  - filtro + sort unificados
  - header de resultado mas fuerte
  - Chess.com links mas visibles
  - performance details escondidos o reducidos
- **Bloqueo**:
  - ninguno fuerte

#### WT-D `opening-and-analysis-data`
- **Objetivo**: #4, #14, #16, #17
- **Files**:
  - `src/lib/chess-format.ts`
  - `src/lib/chess-format.test.ts`
  - `src/lib/types.ts`
  - `src/lib/analyzer.ts`
  - `src/components/results-view.tsx`
  - `src/components/eval-chart.tsx`
- **Entregable**:
  - openings mas legibles
  - phase breakdown
  - depth real del engine
  - time-management summary/chart
- **Bloqueo**:
  - ninguno fuerte

#### WT-E `visual-refresh`
- **Objetivo**: #14c y polish residual de #7
- **Files**:
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - `src/components/results-view.tsx`
  - `src/components/puzzle-trainer.tsx`
  - `src/components/chess-board-viewer.tsx`
  - `src/components/progress-summary.tsx`
  - `src/components/progress-bar.tsx`
- **Entregable**:
  - sistema visual inspirado en Chess.com
  - home mas intencional
  - resultados y puzzle mode visualmente coherentes
- **Bloqueo**:
  - conviene entrar despues de C si E va a tocar markup de acordeones

#### WT-F `retention-and-sharing`
- **Objetivo**: #15, #18, #19, #20
- **Files**:
  - `src/lib/pgn-export.ts`
  - `src/lib/pgn-export.test.ts`
  - `src/components/results-view.tsx`
  - `src/components/progress-summary.tsx`
  - `src/lib/history.ts`
  - `src/lib/chess-education.ts`
  - `src/lib/chess-education.test.ts`
  - opcional para share real:
    - `supabase/migrations/...`
    - `src/app/api/share/route.ts`
    - `src/app/share/[id]/page.tsx`
    - `src/lib/share.ts`
- **Entregable**:
  - PGN export mas robusto
  - progress/historial mas util
  - mas concepts con recursos educativos
  - share real si decidimos link publico
- **Bloqueo**:
  - #19 depende de decidir si share es URL publica o accion liviana

---

## Orden real de ejecucion y merge

### Ola 1 - arrancar ya en paralelo
- WT-B `puzzle-interaction`
- WT-C `results-navigation`
- WT-D `opening-and-analysis-data`

Razon:
- tienen alto valor
- estan razonablemente aislados
- destraban los cambios mas visibles de producto

### Ola 2 - montar sobre estructura mas estable
- WT-A `results-copy`
- WT-F `retention-and-sharing`

Razon:
- A necesita caer sobre la estructura nueva de resultados
- F toca `results-view.tsx`, pero en zonas mas puntuales si C ya definio acordeones/header

### Ola 3 - visual polish final
- WT-E `visual-refresh`

Razon:
- si entra antes, corre riesgo de rehacer layout dos veces
- mejor usarlo como capa final de consolidacion visual sobre markup ya estable

---

## Merge strategy recomendada

### Merge 1
- WT-C
- asegura:
  - acordeones
  - header mas fuerte
  - links visibles
  - estructura final de resultados

### Merge 2
- WT-D
- asegura:
  - data nueva de analysis
  - depth real
  - openings simplificados
  - phase/time context

### Merge 3
- WT-B
- asegura:
  - puzzle experience visible y diferenciada
  - sonido/feedback/affordance

### Merge 4
- WT-A
- asegura:
  - copy final arriba de la estructura nueva
  - cierre limpio de pedagogia

### Merge 5
- WT-F
- asegura:
  - PGN/history/education/share

### Merge 6
- WT-E
- asegura:
  - refresh visual final sobre superficie estable

---

## Dependencias clave a vigilar

### A depende parcialmente de B
- para cerrar #10 completo, el copy del puzzle se termina en `puzzle-trainer.tsx`

### A depende practicamente de C
- conviene aplicar el copy final cuando la estructura de resultados ya sea estable

### E depende practicamente de C y D
- necesita markup relativamente estable para no retrabajar layout y summary cards

### F depende practicamente de C
- export/share/history deben aterrizar en la version final del panel de resultados

---

## Prompts operativos listos

### Prompt WT-A
`Implementa #2, #5 y la parte no-puzzle de #10. Owner: Train By Theme copy, glossary/tooltips, llm-coach fallback tips. No toques accordion behavior ni puzzle-trainer.`

### Prompt WT-B
`Implementa #6, #9, #14b y el cierre de #10 dentro de puzzle-trainer. Owner total de puzzle UX, feedback visual, sonido opcional y affordances de arrastre. No toques results-view salvo wiring imprescindible.`

### Prompt WT-C
`Implementa #3, #8, #11, #12 y #14d. Owner de acordeones, header de resultados, filtros/sort y visibilidad de links. Crea un accordion helper minimo si hace falta.`

### Prompt WT-D
`Implementa #4, #14, #16 y #17. Owner de analyzer/types/opening formatting/eval chart/result summaries. No te metas con layout de acordeones.`

### Prompt WT-E
`Implementa #14c y el polish visual residual. Owner del visual system, home shell y styling final de resultados/puzzles/progress. Inspiracion Chess.com, sin clonarla.`

### Prompt WT-F
`Implementa #15, #18, #19 y #20. Owner de PGN export, history/progress, educational links y share flow. Si #19 requiere URL publica, separa DB/API/page en commits independientes.`

---

# Plan paralelo siguiente: Plataforma (Auth + Reports + i18n)

Este es el siguiente plan a atacar en paralelo, ya alineado con la base actual:
Next.js 16 App Router, Supabase JS instalado, `src/lib/supabase/server.ts` existente, `/api/history` que hoy persiste sesiones por `username` libre.

Las features se descomponen en tres bloques de producto (F1, F2, F3) y se paralelizan en worktrees (WT-G a WT-J). El supuesto base es Supabase para auth + DB porque ya existe wiring; cualquier cambio de proveedor (ej. Clerk via Vercel Marketplace) se decide antes de arrancar WT-G.

---

## F1 - Cuenta de usuario, perfil propio e historial real

### #21. Home / landing publica con login
- **Categoria**: Onboarding / Marketing
- **Prioridad**: P0 (bloquea F1)
- **Esfuerzo**: M
- **Detalle**: Hoy `src/app/page.tsx` arranca directo en el flujo de analisis. Necesitamos una home publica que explique de que va la app y exponga `Sign in` / `Sign up`. Usuario logueado va al home logueado (analisis + historial + progreso).
- **Accion**:
  - Nueva ruta `/` publica con hero, value props, CTA `Sign in` / `Sign up`.
  - Nueva ruta protegida (`/app` o re-uso de `/`) que es la experiencia actual cuando hay sesion.
  - Footer + nav comun con `Sign in / Profile` segun estado.

### #22. Sistema de auth
- **Categoria**: Plataforma
- **Prioridad**: P0
- **Esfuerzo**: M
- **Detalle**: Auth con email + OAuth (Google opcional) usando Supabase Auth. Sesion via cookies en server components.
- **Accion**:
  - `/sign-in`, `/sign-up`, `/auth/callback`.
  - Helpers `getUser()` / `requireUser()` en `src/lib/supabase/server.ts`.
  - Middleware o layout guard para rutas privadas.
  - Tests minimos del helper de sesion.

### #23. Perfil de usuario independiente del usuario de Chess.com
- **Categoria**: Plataforma
- **Prioridad**: P0
- **Esfuerzo**: M
- **Detalle**: El `username` libre que hoy se pasa a `/api/history` debe pasar a estar atado a un `user_id` de auth. El perfil tiene campos propios (`display_name`, `avatar_url`, `default_chess_username`, `language`) y puede asociar uno o varios `chess.com handles`.
- **Accion**:
  - Tabla `profiles` con FK a `auth.users` (RLS por owner).
  - Tabla `chess_accounts` (user_id, platform, handle, time_class_default).
  - Pagina `/profile` para editar.
  - Migrar `/api/history` para que use `user_id` en lugar de `username` libre cuando hay sesion (aceptar legacy `username` solo para flujo anonimo si decidimos mantenerlo).

### #24. Historial de analisis persistido por usuario
- **Categoria**: Retention
- **Prioridad**: P0
- **Esfuerzo**: M
- **Detalle**: Hoy `history.ts` y `/api/history` existen pero no estan atados a sesion real. Queremos que cada analisis quede asociado al usuario logueado, listable y reabrible mas tarde.
- **Accion**:
  - Tabla `analyses` (`id`, `user_id`, `created_at`, `chess_username`, `time_class`, `result_json`, `summary_metrics`).
  - RLS: solo el owner puede leer; opcional `is_public` para share existente.
  - `/history` con lista paginada + busqueda + filtro por time class.
  - `/history/[id]` que reabre el `results-view` desde DB en lugar de localStorage.
  - Migracion suave: si hay sesiones en localStorage, ofrecer importarlas al loguearse.

### #25. Progreso de ELO por modalidad a lo largo del tiempo
- **Categoria**: Retention / Engagement
- **Prioridad**: P1
- **Esfuerzo**: L
- **Detalle**: Quiero ver mi rating en `bullet`, `blitz`, `rapid`, `daily` a lo largo del tiempo, para validar si los analisis ayudan. Chess.com API expone rating actual; los snapshots historicos los tenemos que crear nosotros (uno por analisis y/o uno periodico).
- **Accion**:
  - Tabla `elo_snapshots` (`user_id`, `chess_username`, `time_class`, `rating`, `captured_at`).
  - Capturar snapshot en cada analisis (gratis, ya pegamos a Chess.com).
  - Componente `EloProgressChart` con tabs por time class (recharts ya esta instalado).
  - Anotaciones en el chart de cuando hubo analisis (para correlacionar visualmente).
  - Vacio elegante cuando hay <2 puntos.

---

## F2 - Reportes anonimos y backoffice admin

### #26. Reportes anonimos de bug y pedidos de feature
- **Categoria**: Voice of customer
- **Prioridad**: P1
- **Esfuerzo**: M
- **Detalle**: Cualquier usuario (logueado o no) puede mandar un reporte. No se identifica a la persona salvo que ella decida poner email opcional.
- **Accion**:
  - Tabla `reports` (`id`, `type` enum `bug | feature | other`, `body`, `email?`, `page_url`, `user_agent`, `created_at`, `status` enum `new | triaged | done | wont_do`).
  - Endpoint `POST /api/reports` con rate limit basico (IP + token de captcha o BotID si lo activamos).
  - Componente flotante `Report an issue` accesible desde cualquier pagina (footer + boton).
  - RLS: insert publico, select solo admin.

### #27. Rol admin y cuenta seed admin/admin
- **Categoria**: Plataforma
- **Prioridad**: P1
- **Esfuerzo**: S
- **Detalle**: Necesitamos un rol `admin` para gating del backoffice. La cuenta seed `admin/admin` es solo para dev/staging, no para prod.
- **Accion**:
  - Columna `role` en `profiles` (`user`, `admin`).
  - Helper `requireAdmin()` server-side.
  - Script de seed que crea `admin@chess-coach.local` con password `admin` y `role=admin` solo si `NODE_ENV !== 'production'` (o detras de flag `ALLOW_DEV_SEED`).
  - Nota explicita en README: en prod, el primer admin se promueve via SQL/Supabase dashboard.

### #28. Backoffice admin
- **Categoria**: Internal tooling
- **Prioridad**: P1
- **Esfuerzo**: M
- **Detalle**: Solo accesible para `role=admin`. Vista para revisar reportes, marcar status, filtrar.
- **Accion**:
  - `/admin` layout protegido por `requireAdmin()`.
  - `/admin/reports` lista con filtros por `type` y `status`, search por texto.
  - `/admin/reports/[id]` detalle con cambio de status y notas internas.
  - Opcional fase 2: `/admin/users` (lista de usuarios, ultimos analisis, ELO actual).

---

## F3 - Internacionalizacion total

### #29. i18n con switcher disponible en cualquier vista
- **Categoria**: Plataforma
- **Prioridad**: P1
- **Esfuerzo**: L
- **Detalle**: El usuario elige lenguaje (ES, EN, PT como primer set; ampliable). El switcher esta en el header global. Logueado: persiste en `profiles.language`. Anonimo: persiste en cookie.
- **Accion**:
  - Adoptar `next-intl` (canonico para App Router).
  - Estructura `messages/{locale}.json` por feature (home, results, puzzle, history, admin).
  - Locale routing: `/[locale]/...` o detection via cookie + `Accept-Language`. Decidir antes de arrancar WT-J.
  - Componente `LocaleSwitcher` montado en el header global.
  - Cubrir UI estatica + microcopy + errores. Strings server-side tambien.

### #30. Traduccion automatica de TODO el contenido dinamico
- **Categoria**: Plataforma / IA
- **Prioridad**: P2
- **Esfuerzo**: L
- **Detalle**: El output del LLM coach (`llm-coach.ts`), tips de puzzles, glosario y nombres de aperturas formateados deben aparecer en el lenguaje elegido.
- **Accion**:
  - Para LLM: pasar `locale` como input al prompt y pedir respuesta en ese idioma. Cachear por `(analysis_id, locale)` para no re-pagar.
  - Para strings precomputados (glosario, education links, opening labels): generar variantes via script de build (`scripts/translate-glossary.ts`) usando el mismo OpenAI key.
  - Cache de traducciones en tabla `translation_cache` (`source_hash`, `locale`, `text`) o en `messages/*.gen.json` checked-in.
  - Fallback: si no hay traduccion, mostrar EN.

---

## Worktrees

### WT-G `auth-and-profile` (F1 - fundacion)
- **Objetivo**: #21, #22, #23
- **Files**:
  - `src/app/page.tsx` (split publico/privado)
  - `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/auth/callback/route.ts`
  - `src/app/profile/page.tsx`
  - `src/lib/supabase/server.ts`, nuevo `src/lib/supabase/client.ts`
  - `src/lib/auth.ts` con `getUser`, `requireUser`
  - `middleware.ts`
  - `supabase/migrations/0001_profiles.sql`
- **Entregable**:
  - landing publica + auth funcional + perfil editable + RLS basica
- **Bloqueo**:
  - Decidir Supabase Auth vs Clerk antes de arrancar
  - Decidir si la URL publica de la app queda en `/` o muda a `/app`

### WT-H `analyses-history-and-elo` (F1 - data del usuario)
- **Objetivo**: #24, #25
- **Files**:
  - `src/app/api/history/route.ts` (refactor a `user_id`)
  - `src/app/history/page.tsx`, `src/app/history/[id]/page.tsx`
  - `src/lib/history.ts`, `src/lib/elo-progress.ts` nuevo
  - `src/components/elo-progress-chart.tsx` nuevo
  - `supabase/migrations/0002_analyses.sql`, `0003_elo_snapshots.sql`
  - extension de `src/lib/analyzer.ts` o `route.ts` de `/api/analyze` para capturar snapshot
- **Entregable**:
  - historial real persistido por usuario, reabrible
  - chart de ELO por time class con anotaciones de analisis
- **Bloqueo**:
  - depende de WT-G (necesita `user_id` y RLS)

### WT-I `reports-and-admin` (F2 completa)
- **Objetivo**: #26, #27, #28
- **Files**:
  - `src/app/api/reports/route.ts`
  - `src/components/report-button.tsx`, `src/components/report-dialog.tsx`
  - `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/reports/page.tsx`, `src/app/admin/reports/[id]/page.tsx`
  - `src/lib/auth.ts` (extension `requireAdmin`)
  - `supabase/migrations/0004_reports.sql`, `0005_role_on_profile.sql`
  - `scripts/seed-admin.ts`
- **Entregable**:
  - reportes anonimos + backoffice protegido + admin seed dev-only
- **Bloqueo**:
  - el endpoint de reportes y el componente flotante NO bloquean en WT-G (anon insert)
  - el backoffice y rol admin SI dependen de WT-G (necesita auth + perfil)
  - se puede partir en dos commits: (a) reports endpoint + UI flotante (independiente), (b) backoffice (depende de G)

### WT-J `i18n` (F3 completa)
- **Objetivo**: #29, #30
- **Files**:
  - `next.config.ts` (rewrites/locale routing si elegimos prefijo)
  - `src/i18n/` (config de next-intl, request handler)
  - `messages/{en,es,pt}/*.json`
  - `src/components/locale-switcher.tsx` montado en `src/app/layout.tsx`
  - `src/lib/llm-coach.ts` (param `locale` + cache por locale)
  - `scripts/translate-strings.ts` (genera traducciones AI offline)
  - posible `supabase/migrations/000X_translation_cache.sql`
- **Entregable**:
  - UI traducida en ES/EN/PT
  - LLM responde en el locale elegido y queda cacheado
  - switcher funcionando desde cualquier vista
- **Bloqueo**:
  - 99% independiente de WT-G/H/I, pero hay tocando puntual de `layout.tsx` y `llm-coach.ts`
  - si entra antes que H, H tiene que escribir strings i18n-ready desde el inicio (preferible)

---

## Dependencias entre worktrees

| Depende de | Worktree | Razon |
|------------|----------|-------|
| -- | WT-G | fundacion, no depende de nadie |
| WT-G | WT-H | necesita `user_id` y RLS |
| WT-G (parcial) | WT-I | reports anon es independiente; backoffice depende de auth + role admin |
| -- | WT-J | independiente, pero conviene definir locale routing antes de que H/I escriban paginas nuevas |

---

## Orden recomendado para correr en paralelo

### Ola 1 - arrancar ya
- **WT-G** (auth/profile/landing) — bloqueante para H y para parte de I
- **WT-J** (i18n) — independiente; conviene que ya este la decision de routing y `LocaleSwitcher` antes de que H/I escriban UI nueva
- **WT-I.a** (`reports endpoint + boton flotante`, sin backoffice) — independiente

### Ola 2 - cuando G este mergeado
- **WT-H** (analyses + ELO)
- **WT-I.b** (`backoffice admin` sobre G + rol admin)

### Ola 3 - integracion final
- conectar i18n en H y en I.b si quedaron strings no traducidos
- pulido visual final (puede tomar prestados tokens de WT-E del plan anterior si ya esta mergeado)

---

## Decisiones abiertas a confirmar antes de arrancar

1. **Auth provider**: Supabase Auth (default por wiring existente) vs Clerk via Vercel Marketplace.
2. **Locale routing**: prefijo `/[locale]/` vs cookie + middleware sin cambio de URL.
3. **Set inicial de idiomas**: confirmar EN, ES, PT (o agregar otros desde el dia 1).
4. **Seed admin/admin**: confirmar que es solo para dev/staging y NO se crea en prod.
5. **Migracion del `username` libre actual**: que pasa con sesiones anonimas en localStorage cuando alguien se loguea — importar automaticamente o descartarlas.
6. **Rate limit / antifraude en `/api/reports`**: BotID (Vercel) vs hCaptcha vs solo rate limit por IP.
7. **Traduccion del output del LLM**: traducir on-the-fly por request o pre-traducir on-write y cachear por `(analysis_id, locale)`.

---

## Prompts operativos listos

### Prompt WT-G
`Implementa #21, #22 y #23 con Supabase Auth. Owner de landing publica, sign-in/sign-up/callback, helpers de sesion, middleware y pagina de perfil. Crea tablas profiles + chess_accounts con RLS por owner. NO toques /api/history ni el flujo de analisis salvo para gating con requireUser donde aplique.`

### Prompt WT-H
`Implementa #24 y #25 sobre WT-G. Owner de tabla analyses + elo_snapshots, refactor de /api/history a user_id, paginas /history y /history/[id], EloProgressChart con tabs por time class y captura de snapshot en cada analisis. NO toques auth ni admin.`

### Prompt WT-I
`Implementa #26, #27 y #28. Parte (a): tabla reports, POST /api/reports anon, componente flotante de reporte montado en layout — independiente de auth. Parte (b): rol admin en profiles, requireAdmin, backoffice /admin/reports con lista + detalle + cambio de status. Seed admin/admin solo dev. NO toques i18n ni history.`

### Prompt WT-J
`Implementa #29 y #30 con next-intl. Owner de configuracion de locale, messages/{en,es,pt}, LocaleSwitcher en el header global, persistencia en cookie + profiles.language cuando hay sesion. Para LLM: pasar locale al prompt y cachear por (analysis_id, locale). Genera traducciones de strings con script offline. NO toques auth ni reports salvo para envolver textos en t().`
