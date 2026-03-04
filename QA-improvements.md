# Chess Coach QA Improvements

Fecha de QA: 2026-03-04  
Entorno revisado: `https://chess-coach-iota.vercel.app/`  
Usuario probado: `Feliisra`

## Objetivo

Convertir el QA manual en un backlog claro de mejoras de producto, UX y calidad de feedback para que la app pase de "demo funcional" a "coach útil y confiable".

## Resumen Ejecutivo

La app ya tiene una base fuerte:

- El onboarding es simple.
- El análisis de partidas produce datos reales y suficientemente ricos.
- La idea de practicar errores propios con puzzles es buena.

Los problemas principales hoy no están en la propuesta, sino en la experiencia:

- El progreso del análisis transmite poca confianza.
- El feedback del bot es demasiado genérico en varios casos.
- Los puzzles funcionan, pero enseñan poco cuando el usuario falla.
- Hay detalles visuales y de copy que bajan la percepción de calidad.

## Prioridades

## P0: Resolver antes de seguir escalando

### 1. Hacer confiable el flujo de progreso

Problema:

- Durante el análisis aparecieron estados contradictorios.
- La UI mostró combinaciones como `Game 4/5`, `60%` y mensajes de otra partida al mismo tiempo.
- Eso hace que el usuario dude si el proceso terminó, sigue corriendo o se trabó.

Mejoras:

- Unificar la fuente de verdad del progreso.
- Mostrar una sola métrica principal:
  - `Game X of Y`
  - fase actual
  - ETA aproximado si se puede calcular
- Resetear correctamente mensajes viejos al cambiar de fase o partida.
- Mostrar un estado final inequívoco al terminar:
  - `Analysis complete`
  - resumen rápido
  - CTA principal

Criterio de éxito:

- Nunca se muestran simultáneamente datos de partidas distintas.
- El usuario entiende en todo momento qué está pasando.

### 2. Mejorar la calidad pedagógica del bot

Problema:

- Parte del texto del coach suena plantillado.
- Algunas explicaciones sobreintuyen intención del jugador sin evidencia.
- Algunas jugadas reciben elogios o etiquetas poco defendibles.

Mejoras:

- Reescribir prompts para obligar al modelo a:
  - describir la consecuencia concreta de la jugada
  - evitar frases del tipo `you probably thought`
  - no sobreelogiar jugadas neutrales
  - referirse a amenaza, pieza, rey, material o táctica específicos
- Limitar el tono motivacional y priorizar claridad.
- Diferenciar mejor:
  - blunder decisivo
  - error práctico
  - jugada aceptable

Criterio de éxito:

- Cada explicación debe responder al menos estas preguntas:
  - qué se perdió
  - qué había que ver
  - qué principio aplica

### 3. Arreglar el loop pedagógico de puzzles

Problema:

- El puzzle correcto avanza.
- Cuando el usuario falla, casi no hay feedback.
- El marcador `1 / 0` es confuso.
- El puzzle hoy evalúa acierto, pero enseña poco.

Mejoras:

- Agregar feedback explícito al fallo:
  - `Incorrect`
  - por qué no funciona
  - qué amenaza no viste
- Mostrar solución guiada después de uno o dos errores.
- Reemplazar el score actual por algo claro:
  - `1 correct, 1 attempted`
  - o `% solved first try`
- Agregar una línea pedagógica por puzzle:
  - `Theme: king safety`
  - `Theme: loose piece`
  - `Theme: mate threat`

Criterio de éxito:

- Fallar un puzzle también deja aprendizaje concreto.

## P1: Mejoras importantes de producto y UX

### 4. Limpiar nombres de aperturas y labels de datos

Problema:

- Se muestran strings crudos como `/Www.Chess.Com/Openings/Kings Pawn Opening 1...E5`.
- Eso se ve como dato mal parseado y baja la confianza.

Mejoras:

- Normalizar nombres de aperturas antes de renderizar.
- Remover URLs embebidas del label.
- Mantener formato humano:
  - `King's Pawn Game`
  - `Caro-Kann Defense`
- Si no hay nombre limpio, mostrar `Unknown opening` o `Unclassified opening`.

Criterio de éxito:

- Ningún texto visible parece una URL transformada en título.

### 5. Dar una jerarquía más clara al resultado

Problema:

- La pantalla final informa mucho, pero prioriza poco.
- Todo compite por atención:
  - summary
  - strengths
  - weak spots
  - study plan
  - openings
  - game details

Mejoras:

- Reordenar el resultado en este orden:
  1. Qué te está frenando más
  2. Qué hacer esta semana
  3. Práctica inmediata
  4. Detalle de partidas
- Convertir el bloque principal en una vista más ejecutiva:
  - `Top 3 recurring problems`
  - `What to practice next`
  - `Start with 5 puzzles`

Criterio de éxito:

- El usuario sabe qué acción tomar en menos de 10 segundos.

### 6. Mejorar la relación entre análisis y práctica

Problema:

- Hoy hay análisis por un lado y puzzles por otro.
- La conexión existe, pero podría sentirse mucho más directa.

Mejoras:

- Desde cada error crítico, agregar CTA:
  - `Practice this position`
  - `See the correct move on board`
- Permitir filtrar puzzles por tema:
  - tactics
  - king safety
  - opening
- Marcar cuáles errores se repiten entre partidas.

Criterio de éxito:

- El usuario pasa naturalmente de insight a entrenamiento.

## P2: Mejora de percepción de calidad

### 7. Reducir copy genérico y duplicación conceptual

Problema:

- Varias secciones dicen cosas parecidas con distinto wording.
- Esto hace que el resultado parezca más largo que útil.

Mejoras:

- Consolidar mensajes redundantes entre:
  - summary
  - weaknesses
  - weak spots
  - study plan
- Hacer que cada sección tenga una función única.

### 8. Revisar visualización de charts y warnings de layout

Problema:

- Aparecieron warnings de tamaño inválido en charts.
- No rompieron la página, pero indican fragilidad de render.

Mejoras:

- Revisar el montaje del chart en contenedores responsivos.
- Evitar render de gráficas si el ancho aún no está medido.
- Añadir estados seguros para mobile y para contenido colapsado.

### 9. Mejorar microcopy de interfaz

Problema:

- Algunos labels y métricas son ambiguos.

Mejoras:

- Reemplazar labels como:
  - `6B 1M`
  - por `6 blunders, 1 mistake`
- Aclarar métricas agregadas:
  - `Avg Accuracy across analyzed games`
  - `Blunders under time pressure`
- Evitar números sin contexto.

## Recomendaciones de Implementación

## Fase 1

- Corregir el estado de progreso.
- Limpiar nombres de aperturas.
- Arreglar score y feedback básico de puzzles.

## Fase 2

- Reescribir prompts del coach para mayor precisión.
- Reordenar pantalla final según prioridad pedagógica.
- Conectar errores concretos con práctica concreta.

## Fase 3

- Añadir feedback adaptativo en puzzles.
- Añadir filtros por tema y repetición de errores.
- Refinar charts, labels y microcopy.

## Propuesta de Nuevos Criterios de QA

### Flujo principal

- El usuario entiende cuándo empieza, progresa y termina el análisis.
- El estado de carga nunca muestra información contradictoria.

### Calidad del coach

- Cada blunder importante tiene explicación específica y verificable.
- El texto no inventa intención psicológica del jugador.
- Las mejores jugadas no se sobrevaloran.

### Puzzles

- Resolver un puzzle da refuerzo claro.
- Fallar un puzzle también enseña.
- El score es fácil de entender.

### UI/UX

- Labels limpios y humanos.
- Jerarquía clara entre resumen, plan y detalle.
- Mobile usable sin overflow ni componentes inestables.

## Métricas sugeridas

- Tasa de usuarios que completan el primer análisis.
- Tiempo hasta primer CTA de práctica.
- Porcentaje de puzzles resueltos al primer intento.
- Porcentaje de usuarios que vuelven a analizar más partidas.
- Click-through rate de `Practice this mistake`.

## Conclusión

El producto ya tiene una idea con valor real: analizar partidas propias y convertir errores en práctica dirigida. La siguiente mejora no debería enfocarse en agregar más features, sino en hacer tres cosas mejor:

- confiar en el flujo
- entender el feedback
- aprender algo útil después de cada análisis
