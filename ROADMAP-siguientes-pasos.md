# Roadmap de Siguientes Pasos

Fecha: 2026-03-04

## Semana 1: Cerrar Riesgos de Producción

1. Corregir credencial de Supabase CLI para migraciones (`SUPABASE_ACCESS_TOKEN` con formato `sbp_...`).
2. Aplicar migración real de `viewer_key` en la base.
3. Configurar `HISTORY_VIEWER_SALT` en Vercel (production y preview).
4. Ejecutar deploy con checklist de producción y registrar release note:
   - commit SHA
   - URL de deploy
   - resultado de smoke tests

## Semana 2: Cierre de QA

1. Ejecutar QA manual end-to-end en desktop y mobile.
2. Confirmar correcciones en:
   - progreso de análisis
   - calidad de insights
   - flujo pedagógico de puzzles
   - labels de openings
   - warnings de charts
3. Documentar findings residuales con severidad y owner.

## Semana 3-4: Observabilidad y Robustez

1. Agregar logs estructurados en `/api/analyze` y `/api/history`.
2. Definir alertas mínimas:
   - errores 5xx
   - latencia alta
   - fallas de análisis
3. Incorporar tests E2E mínimos:
   - flujo de análisis
   - flujo de historial
   - flujo de puzzles

## Mes 2: Identidad y Datos

1. Evolucionar de IP-only a identidad anónima por cookie/device-id (IP como fallback).
2. Definir política de retención de historial.
3. Diseñar camino de migración futura a login (Supabase Auth) sin romper historial existente.

## Mes 3: Producto

1. Mejorar explicaciones pedagógicas de puzzles (feedback más específico por error).
2. Medir calidad de output LLM con rúbrica automática (especificidad, accionabilidad, consistencia).
3. Priorizar UX de práctica diaria basada en errores recurrentes.

## Criterio de Éxito Global

1. Deploy estable sin incidentes críticos.
2. QA final en estado `pass`.
3. Historial segmentado por usuario anónimo de forma confiable.
4. Base lista para escalar a identidad formal sin retrabajo mayor.
