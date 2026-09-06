---
quick: 260902-ght
type: quick
status: complete
date: 2026-09-02
description: "Añadir Epics de proyecto para agrupar issues, filtrar el tablero y navegar a un detalle con sus tickets relacionados"
files_modified:
  - src/server/db/schema.ts
  - src/server/domain/contracts.ts
  - src/server/domain/tracker.ts
  - src/server/http/tracker.ts
  - src/server/mcp/tools.ts
  - src/web/types.ts
  - src/web/App.tsx
  - src/web/routes/BoardRoute.tsx
  - src/web/routes/TrackerForms.tsx
  - src/web/routes/EpicRoutes.tsx
  - src/web/routes/IssueDetailRoute.tsx
  - src/web/styles.css
  - tests/integration/tracker.test.ts
  - tests/integration/http.test.ts
  - tests/integration/mcp.test.ts
  - tests/web/tracker.test.tsx
  - tests/e2e/tracker.spec.ts
  - drizzle/0010_*.sql
  - drizzle/meta/0010_snapshot.json
  - drizzle/meta/_journal.json
  - README.md
  - AGENTS.md
  - ../../AGENTS.md
must_haves:
  truths:
    - "El owner puede crear y editar Epics dentro de un proyecto y cada issue puede pertenecer a cero o un Epic del mismo proyecto"
    - "El tablero puede mostrar todos los tickets, los tickets sin Epic o únicamente los tickets de un Epic elegido"
    - "Abrir un Epic muestra de forma sencilla sus tickets, recuentos por estado y progreso derivado"
    - "La asociación o desasociación de un issue queda registrada en actividad y no permite referencias entre proyectos o workspaces"
    - "MCP conserva el contexto del Epic en lecturas y puede filtrar issues por Epic sin ampliar scopes"
  artifacts:
    - path: src/server/db/schema.ts
      provides: "Entidad Epic y FK compuesta que fuerza proyecto/workspace coherentes"
    - path: src/server/domain/tracker.ts
      provides: "CRUD, detalle, recuentos y asociación transaccional con actividad"
    - path: src/web/routes/EpicRoutes.tsx
      provides: "Creación, edición y detalle accesible del Epic"
    - path: src/web/routes/BoardRoute.tsx
      provides: "Filtro de Epic y acceso a sus contenidos"
  key_links:
    - from: src/web/routes/BoardRoute.tsx
      to: /api/v1/projects/:projectId/epics
      via: "selector y enlaces de Epics"
    - from: src/web/routes/EpicRoutes.tsx
      to: /api/v1/epics/:epicId
      via: "detalle con issues y resumen de estados"
    - from: src/server/domain/tracker.ts
      to: src/server/db/schema.ts
      via: "mutaciones atómicas y aislamiento por workspace/proyecto"
---

<objective>
Incorporar un Epic general y ligero como contenedor de tickets de un proyecto, reutilizable desde el tablero y visible para clientes MCP, sin adelantar las reglas específicas de auditorías de la fase 7.
</objective>

<scope>
- Un Epic tiene título, descripción, proyecto, versión y timestamps.
- Un issue admite `epicId` nullable y sólo puede apuntar a un Epic de su mismo proyecto y workspace.
- No se implementan jerarquías de Epics, fechas, owners adicionales, cierre independiente, auditorías ni borrado.
</scope>

<threat_model>
| Threat | Severity | Mitigation |
| --- | --- | --- |
| Asociar un issue a un Epic de otro proyecto/workspace | high | FK compuesta y consultas siempre acotadas por workspace/proyecto; respuesta privacy-safe |
| Filtro manipulado permite inferir recursos ajenos | high | Validar UUID, comprobar Epic dentro del proyecto y aplicar allowlist MCP antes de listar |
| Migración rompe datos existentes | high | `epic_id` nullable, tabla nueva, migración desde PostgreSQL vacío y sobre fixture con issues existentes |
| Recuentos del Epic divergen del tablero | medium | Derivarlos siempre de estados reales de issues en una sola consulta/servicio |
</threat_model>

<tasks>
<task type="auto">
  <name>Task 1: Modelar Epics y publicar contratos REST/MCP seguros</name>
  <files>src/server/db/schema.ts, src/server/domain/contracts.ts, src/server/domain/tracker.ts, src/server/http/tracker.ts, src/server/mcp/tools.ts, drizzle/, tests/integration/tracker.test.ts, tests/integration/http.test.ts, tests/integration/mcp.test.ts</files>
  <action>Añadir la entidad Epic, la asociación nullable del issue y sus constraints compuestas. Implementar create/list/get/update, resumen por estado, filtro de issues y eventos append-only. Exponer REST owner y lectura/filtro MCP bajo `issues:read`; permitir que create/update issue acepte `epicId` sólo con los scopes ya existentes.</action>
  <done>La API crea y consulta Epics, asigna/desasigna tickets, rechaza cruces de proyecto/workspace y devuelve recuentos deterministas; MCP ve y filtra el contexto sin nuevos privilegios.</done>
  <verify><automated>pnpm typecheck &amp;&amp; pnpm test:integration -- tracker http mcp</automated></verify>
</task>

<task type="auto">
  <name>Task 2: Añadir gestión, filtro y detalle de Epics en la web</name>
  <files>src/web/types.ts, src/web/App.tsx, src/web/routes/BoardRoute.tsx, src/web/routes/TrackerForms.tsx, src/web/routes/EpicRoutes.tsx, src/web/routes/IssueDetailRoute.tsx, src/web/styles.css, tests/web/tracker.test.tsx, tests/e2e/tracker.spec.ts</files>
  <action>Añadir rutas para listado/creación/edición/detalle, selector de Epic en alta/edición de issue, badge/enlace en tarjeta y detalle, y filtro persistido en la URL del tablero para todos/sin Epic/un Epic. Mantener responsive, teclado, foco visible y estados de carga/error/vacío.</action>
  <done>El owner puede organizar tickets y navegar board → Epic → issue en desktop y móvil, con recuentos y filtros coherentes.</done>
  <verify><automated>pnpm test:web &amp;&amp; pnpm test:e2e</automated></verify>
</task>

<task type="auto">
  <name>Task 3: Actualizar contratos operativos y ejecutar el gate completo</name>
  <files>README.md, AGENTS.md, ../../AGENTS.md</files>
  <action>Documentar el modelo, rutas, límites y comportamiento MCP de Epics; actualizar el mapa técnico y el resumen de catálogo. Ejecutar todos los gates de la app y del monorepo sin incluir cambios ajenos.</action>
  <done>La documentación describe fielmente la función y todos los tests, build, secret scan y validación raíz pasan.</done>
  <verify><automated>pnpm validate &amp;&amp; pnpm build &amp;&amp; make -C ../.. validate</automated></verify>
</task>
</tasks>
