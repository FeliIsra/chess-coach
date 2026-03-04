# QA Manual Report

Fecha: 2026-03-04  
Target: `https://chess-coach-iota.vercel.app/`  
Usuario probado: `Feliisra`  
Método: Playwright + inspección funcional manual

## Resumen

La app sigue funcional en términos de flujo completo (fetch + análisis + resultados + puzzles), pero en producción todavía se observan issues de `P0/P1/P2` que habían sido priorizados.

Estado general:

- Flujo principal: **parcialmente funcional**, con inconsistencias de progreso.
- Calidad de insight: **útil pero genérica** en varios puntos.
- Puzzles: **funcionan**, pero con UX pedagógica incompleta.
- UI/labels: **todavía hay texto crudo y duplicación**.

---

## Findings (ordenados por severidad)

## Alta

### 1) Progreso inconsistente durante análisis

Qué vi:

- Se mostró `Game 1/5 — move 20/35` mientras el mensaje decía `Game 3/5: evaluating move 20/35`.
- Luego `Game 4/5 — move 9/19` con mensaje `Game 2/5: evaluating move 9/19`.
- Más tarde `Game 5/5` con `80%` y mensaje `Game 2 analyzed...`.

Impacto:

- Rompe confianza del usuario en el estado del análisis.
- Hace difícil saber si el proceso está colgado o terminando correctamente.

Severidad: **Alta**

---

### 2) El insight del bot sigue con patrones de texto genérico / inferencias débiles

Qué vi:

- Frases tipo: `You probably thought...`, `You likely thought...` repetidas en “Key Mistakes”.
- Elogios sobredimensionados en algunos “Great Moves” sin mucho sustento práctico.
- Varias explicaciones reusan estructura muy similar entre movimientos distintos.

Impacto:

- Baja valor didáctico para entrenamiento serio.
- El usuario recibe feedback “aceptable” pero no suficientemente específico.

Severidad: **Alta**

---

## Media

### 3) Puzzles funcionan, pero el loop de aprendizaje es básico

Qué vi:

- Al fallar un puzzle, muestra `Not quite. The best move was g8g6`.
- Avanza correctamente al siguiente puzzle.
- El score visible aparece como `0 / 1` (correct/wrong), pero no comunica “intentos”, “first try” ni razonamiento.
- No vi theme/concept visible en el puzzle modal de producción.

Impacto:

- Sirve para practicar acierto, pero enseña poco sobre el porqué del error.

Severidad: **Media**

---

### 4) Labels de apertura sin sanitizar

Qué vi:

- Ejemplos visibles:
  - `/Www.Chess.Com/Openings/Kings Pawn Opening 1...E5`
  - `/Www.Chess.Com/Openings/Owens Defense ...`

Impacto:

- Percepción de producto sin pulir.
- Dificulta lectura rápida de repertorio.

Severidad: **Media**

---

### 5) Warning de charts en consola

Qué vi:

- Warning repetido:
  - `The width(-1) and height(-1) of chart should be greater than 0 ...`

Impacto:

- No rompe la UI, pero indica render frágil y potenciales glitches.

Severidad: **Media**

---

## Baja

### 6) Densidad y redundancia de contenido en resultados

Qué vi:

- Secciones largas en cascada (`AI Coach Summary`, `Your Strengths`, `Areas to Improve`, `Study Plan`, `Weak Spots`, etc.).
- Microcopy duplicado o muy parecido en varios bloques.

Impacto:

- Sobrecarga cognitiva.
- Menor claridad sobre “qué practicar primero”.

Severidad: **Baja**

---

## Cobertura ejecutada

- Home/input + slider.
- Inicio de análisis con stream.
- Espera y seguimiento del progreso.
- Pantalla final completa.
- Apertura de detalle de partida.
- Modal de puzzles:
  - intento incorrecto
  - feedback
  - avance al siguiente puzzle
- Revisión responsive en viewport `390x844`.
- Revisión de warnings de consola.

---

## Recomendaciones concretas (siguiente iteración)

1. Corregir el estado de progreso en frontend para usar una sola fuente de verdad (game index + completed + percent sincronizados).
2. Endurecer prompt/normalización del coach en producción para eliminar inferencias psicológicas no verificables.
3. Subir calidad del puzzle trainer:
   - mostrar theme/concept
   - registrar intentos y first-try
   - añadir explicación corta del motivo táctico al fallar/reveal.
4. Sanitizar opening names antes de render en todas las vistas.
5. Corregir contenedores de charts para evitar `width(-1)/height(-1)`.
6. Reducir redundancia de bloques de texto en resultados y priorizar CTA de práctica inmediata.

---

## Estado final del QA

Resultado: **Aprobación condicional (no listo para cerrar QA completo)**  
Condición para “pass”: resolver al menos findings `Alta` + `Media` 3/4/5.
