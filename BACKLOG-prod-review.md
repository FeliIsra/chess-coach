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
| **M** (2-4h) | 8 | #2, #4, #5, #6, #9, #12, #15, #17 |
| **L** (1+ dia) | 5 | #13, #14, #18, #19, #20 |

## Orden sugerido de ataque

**Sprint 1 (quick wins):** #1, #2, #3, #7 - fixear bugs y limpiar ruido  
**Sprint 2 (novice unlock):** #5, #10, #4 - hacer la app entendible para novatos  
**Sprint 3 (puzzle upgrade):** #6, #9 - mejorar la experiencia de practica  
**Sprint 4 (context):** #8, #11, #12 - agregar contexto y navegacion  
**Sprint 5 (depth):** #13, #14, #17 - features para intermedios/avanzados  
**Sprint 6 (growth):** #15, #18, #19, #20 - retention y sharing  
