# Ticket 130 — Resumen

## Resultado

- `useLatestRequest` concentra scope, orden, unmount y aceptación de respuestas
  tardías; las rutas conservan el fetch y su política de aplicación.
- `apiFailureKind` distingue cancelación, falta de acceso/recurso, conflicto,
  fallo transitorio y error de petición.
- `mutationFailureMessage` conserva el mensaje de conflicto o validación sin
  perder el borrador local.
- `RouteLoadError` permite reintentar una primera carga fallida. Board y detalle
  ya no presentan un fallo 5xx/red como si el recurso no existiera.
- Las suscripciones live siguen invalidando datos autorizados y los refrescos
  siguen pasando por REST; no cambian contratos ni permisos.

## Evidencia local

- Código y documentación: `c132ea7`.
- Tests específicos board/detalle: 36; guarda de concurrencia: 1: PASS.
- Fast suite: 47 ficheros, 218 tests: PASS.
- Integración: 22 ficheros, 118 tests: PASS.
- Caracterización: 80 servidor/web + 3 Chrome: PASS.
- Web E2E: 42 PASS, 2 skips esperados; Chrome: 16 unit + 13 E2E: PASS.
- Lint, tipos, build, extensión reproducible, secret scan y 42 tablas sin drift:
  PASS.

## Producción

- Imagen `refactor-web-state-c132ea7`, digest
  `sha256:9da614c318cc97054924b81d0bc14f9f9d1c7305082f05385c886945369ff8f7`.
- GitOps `936643bee959d3135dc7881cd026a1ebc174b9a8`; Kustomize y 140 tests
  + 12 subtests PASS.
- Argo CD está en la revisión exacta, Synced y Healthy; pod Ready, 0 reinicios
  y digest exacto; root/onboarding HTTP 200.
- PVC PostgreSQL `cf93e0a7-b978-46c2-9c03-c77f902742b9` y adjuntos
  `c40b0035-0433-436f-91c4-feff7a20e754` siguen Bound y sin cambios.
- Ticket 130 queda Ready for Human Review, sin claim, con comentario y enlace al
  commit publicados mediante MCP.
