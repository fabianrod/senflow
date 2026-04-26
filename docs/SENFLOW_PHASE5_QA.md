# Fase 5 - Validacion E2E (QA)

Fecha: 2026-04-26  
Entorno obligatorio ejecutado: macOS (darwin 25.3.0)

## Matriz de pruebas

- Caso: primera instalacion (bootstrap launcher)
  - Comando base: `bash install.sh` (en HOME temporal)
  - Resultado: OK
  - Evidencia: launcher creado en `~/.local/bin/senflow` y `senflow --help` responde.

- Caso: reinstalacion
  - Comando base: `bash install.sh` ejecutado de nuevo sobre la misma instalacion temporal
  - Resultado: OK
  - Evidencia: script idempotente; launcher sigue operativo.

- Caso: actualizacion
  - Comando base: `bash install.sh` sobre instalacion existente
  - Resultado: OK
  - Evidencia: flujo de re-ejecucion mantiene launcher y app operativos.

- Caso: `run` sin `install` previo
  - Preparacion: eliminar `node_modules`, `.env` y `data/app.db` en app temporal.
  - Comando base: `senflow run`
  - Resultado: OK
  - Evidencia: detecta setup incompleto, ejecuta `senflow install` automatico, y levanta `next start`.

- Caso: apertura automatica de navegador
  - Comando base: `senflow run` (sin `SENFLOW_DISABLE_BROWSER`)
  - Resultado: OK
  - Evidencia: tras healthcheck, se registra llamada al comando `open http://localhost:<port>` (validado con mock de `open`).

## Estado por plataforma

- macOS: aprobado.
- Linux: pendiente (deseable).
- Windows: pendiente (deseable).

## Checklist QA

- [x] Primera instalacion validada.
- [x] Reinstalacion validada.
- [x] Actualizacion validada.
- [x] Run sin install previo validado.
- [x] Apertura automatica del browser validada.
- [x] Build de produccion validado (`npm run build`).
