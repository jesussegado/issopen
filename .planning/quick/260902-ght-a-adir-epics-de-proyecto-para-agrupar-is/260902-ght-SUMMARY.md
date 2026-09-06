---
quick: 260902-ght
status: complete
completed_at: 2026-09-02T12:23:53+02:00
commits:
  - dd2434c
  - 70a8a43
---

# Epics de proyecto — resumen

## Resultado

Issopen incorpora Epics ligeros dentro de cada proyecto. El owner puede
crearlos y editarlos, asociar o desasociar tickets, filtrar el tablero por un
Epic o por tickets sin Epic y abrir una vista con todos los tickets, estados y
progreso derivado. No se añadieron jerarquías, fechas, lifecycle independiente
ni borrado.

## Implementación

- `epic` y `issue.epic_id` quedan protegidos por claves compuestas de workspace
  y proyecto; la migración añade la relación como nullable para conservar los
  tickets existentes.
- `TrackerService` concentra CRUD, resumen de estados, validación de
  asociaciones y actividad append-only. REST publica listado, alta, detalle,
  edición y filtros `uuid|unassigned`.
- MCP conserva su superficie de scopes: `get_issue` incluye el Epic,
  `list_issues` filtra por `epicId` y create/update permiten asociarlo sólo si
  pertenece a un proyecto autorizado.
- La web añade listado/alta/edición/detalle de Epics, selector en el formulario
  del ticket, badges navegables y filtro persistido en la URL del tablero.
- El recorrido E2E crea proyecto, Epic y ticket, comprueba la preasignación,
  filtra el tablero y continúa el ciclo completo de preguntas y revisión tanto
  en escritorio como en móvil.

## Decisiones

- Un ticket pertenece a cero o un Epic; el workflow sigue viviendo en el
  ticket y el progreso del Epic se deriva de sus estados.
- Se reutilizan `issues:read`, `issues:create` e `issues:write`; agrupar trabajo
  no concede un permiso nuevo ni evita la allowlist por proyecto.
- El filtro web usa `?epic=<uuid|unassigned>` y la API usa
  `?epicId=<uuid|unassigned>` para que los enlaces sean compartibles sin
  persistir estado remoto en el navegador.

## Validación

- Biome y TypeScript: PASS.
- Unitarias/UI: 8 archivos, 24 pruebas PASS.
- Integración PostgreSQL: 5 archivos, 29 pruebas PASS.
- Playwright: 3 PASS y 1 skip intencionado del dogfood móvil; el tracker pasa
  en Chromium 1440 px y 360 px.
- Build de producción y secret scan de 101 archivos: PASS.
- `make validate`: 187 pruebas PASS; sólo warnings ya conocidos por Ansible y
  Helm ausentes del PATH.

## Operación

Los commits contienen código, migración y documentación. No se construyó ni
publicó una imagen nueva y no se modificó GitOps o producción en esta tarea; el
digest documentado continúa siendo el estado productivo observado.
