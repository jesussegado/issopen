---
quick: 260902-ght
status: passed
verified_at: 2026-09-02T12:23:53+02:00
score: 5/5
---

# Verificación — Epics de proyecto

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Crear/editar Epics y asociar cero o uno por issue | PASS | Dominio, REST y UI cubiertos por `tracker.test.ts`, `http.test.ts` y Playwright |
| Filtrar todos, sin Epic o un Epic | PASS | Filtro API validado y selector web persistido en URL; test web y E2E |
| Ver detalle simple con tickets y progreso | PASS | `EpicRoutes.tsx` y resumen derivado probado en integración/web |
| Evitar cruces y registrar cambios | PASS | FK compuesta, checks de dominio/allowlist y actividad probados |
| Conservar contexto Epic en MCP | PASS | `get_issue`, `list_issues`, create/update cubiertos en `mcp.test.ts` |

No se encontraron gaps funcionales dentro del alcance aprobado. La publicación
de una imagen productiva queda fuera de esta verificación de código.
