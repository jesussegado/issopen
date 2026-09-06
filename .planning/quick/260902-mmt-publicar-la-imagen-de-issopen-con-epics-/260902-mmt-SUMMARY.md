---
quick: 260902-mmt
status: complete
completed_at: 2026-09-02T16:31:57+02:00
commits:
  - 144ca29
  - 2de2c41
gitops_revision: 7f271494a437a13046946e4484cb7ab274972e89
image: registry.serviciosegado.com/issopen:epics-2dc6413@sha256:26d63b85271253c1496226f2ab3e0b491df327cdba3faa7d44ed7f3002cf0e8e
---

# Publicación productiva de Epics — resumen

## Resultado

La funcionalidad de Epics está publicada en el master mediante GitOps. Argo CD
reconcilió la revisión `7f27149`, la aplicación quedó `Synced/Healthy` y el pod
web ejecuta el digest inmutable esperado con cero reinicios. PostgreSQL no fue
recreado y su PVC permaneció montado.

## Seguridad y rollback

- El cambio se publicó con un push fast-forward sobre un worktree limpio de
  `gitops/main`; no se ejecutó `kubectl apply`, `patch`, `delete` ni un restart
  manual.
- El replay contiene exclusivamente `apps/issopen/`. El `AGENTS.md` legacy de
  `gitops/main` se preservó ante el conflicto documental y no se mezcló con el
  despliegue.
- La migración es aditiva: crea `epic`, añade `issue.epic_id` nullable y su FK.
  El digest anterior puede restaurarse por GitOps sin revertir el esquema ni
  perder datos.

## Evidencia productiva

- Antes y después del rollout: 1 proyecto, 18 issues y 133 eventos. Tras la
  migración existen `epic`, `issue.epic_id`, una FK de Epic y 11 migraciones;
  todavía hay 0 Epics porque el despliegue no inventó datos del owner.
- El entrypoint registró `Database migrations completed.` y el pod quedó
  `Running`, Ready y sin reinicios sobre `debian13-torre-nya`.
- `https://issopen.serviciosegado.com/health/ready` responde 200 con
  `{"status":"ok"}` y HSTS sigue activo.
- Discovery OAuth publica PKCE S256; el protected-resource MCP conserva los
  scopes esperados. `GET /mcp` devuelve 405/Allow POST, POST anónimo 401 con
  `resource_metadata` y REST anónimo 401.
- El JavaScript servido por producción contiene `Manage Epics`, `Show Epic`,
  `All Epics`, `No Epic`, `Create Epic` y `Project Epics`.

## Gates

- Biome, TypeScript, build y secret scan: PASS.
- Unitarias/UI: 24 PASS; integración PostgreSQL: 29 PASS.
- Playwright: 3 PASS y 1 skip intencionado del dogfood móvil; el recorrido
  autenticado de Epics se valida en escritorio y móvil contra la misma fuente
  con la que se construyó la imagen.
- `make validate`: 187 PASS; sólo avisos conocidos por Ansible y Helm ausentes
  del PATH.

No se creó contenido de prueba en la base productiva ni se accedió a secretos o
sesiones del owner para completar el smoke test.
