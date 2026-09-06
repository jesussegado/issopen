---
quick: 260902-mmt
type: quick
status: complete
date: 2026-09-02
description: "Publicar la imagen de Issopen con Epics por GitOps y validar migración, rollout, HTTPS, REST, MCP y flujo web productivo"
must_haves:
  truths:
    - "Argo CD despliega en el master exactamente la imagen inmutable construida desde los commits de Epics"
    - "La migración crea Epic y epic_id sin perder los 18 issues ni los 133 eventos observados antes del rollout"
    - "La aplicación queda Synced, Healthy y Ready, y conserva el rollback al digest anterior compatible con el esquema aditivo"
    - "HTTPS, readiness, discovery OAuth/MCP y las protecciones de acceso siguen funcionando en el dominio público"
    - "El bundle servido en producción contiene la gestión, filtro y detalle de Epics validados por Playwright"
  artifacts:
    - path: deploy/manifests/deployment.yaml
      provides: "Digest inmutable de la release de Epics consumido por Argo CD"
    - path: app.yaml
      provides: "Catálogo alineado con la imagen productiva"
    - path: deploy/values.yaml
      provides: "Valores de referencia alineados con Kustomize"
    - path: AGENTS.md
      provides: "Estado operativo y rollback documentados"
  key_links:
    - from: deploy/manifests/deployment.yaml
      to: registry.serviciosegado.com/issopen
      via: "tag legible y digest sha256 inmutable"
    - from: deploy/argocd.yaml
      to: deploy/manifests
      via: "reconciliación GitOps en namespace issopen"
    - from: src/server/db/migrate.ts
      to: drizzle/0010_grey_screwball.sql
      via: "migración antes del arranque del servidor"
---

<objective>
Publicar en producción la funcionalidad de Epics ya validada localmente y demostrar que la migración, el artefacto, el rollout y los contratos públicos funcionan sin pérdida de datos.
</objective>

<preflight>
- Estado observado: Argo `issopen` Synced/Healthy, web y PostgreSQL Ready en `debian13-torre-nya`.
- Imagen anterior: `registry.serviciosegado.com/issopen:comment-order-e70e07f@sha256:bedfa7f763ef5c54f6c39b1f3972e431d35945ba70ccc7dc894c4fab52ca8448`.
- Datos antes del rollout: 1 proyecto, 18 issues y 133 eventos; tabla `epic` ausente.
- Nueva imagen publicada: `registry.serviciosegado.com/issopen:epics-2dc6413@sha256:26d63b85271253c1496226f2ab3e0b491df327cdba3faa7d44ed7f3002cf0e8e`.
- La migración es aditiva: tabla `epic` nueva y `issue.epic_id` nullable. El binario anterior puede volver a ejecutarse contra el esquema migrado.
</preflight>

<tasks>
<task type="auto">
  <name>Task 1: Alinear el estado deseado con la imagen inmutable</name>
  <files>deploy/manifests/deployment.yaml, app.yaml, deploy/values.yaml, README.md, AGENTS.md, ../../AGENTS.md</files>
  <action>Actualizar únicamente Issopen al tag y digest de la imagen de Epics; documentar el artefacto y el estado funcional sin incluir secretos ni cambios ajenos.</action>
  <done>El render Kustomize, el catálogo y las guías apuntan al mismo digest inmutable.</done>
  <verify><automated>kubectl kustomize deploy/manifests | rg 'epics-2dc6413@sha256:26d63b85271253c1496226f2ab3e0b491df327cdba3faa7d44ed7f3002cf0e8e'</automated></verify>
</task>

<task type="auto">
  <name>Task 2: Publicar por GitOps y observar la reconciliación</name>
  <files>commits Issopen reproducidos sobre gitops/main</files>
  <action>Validar la fuente, reproducir sólo los commits de Epics y despliegue sobre un worktree limpio de `gitops/main`, comprobar que el remoto no avanzó y hacer push fast-forward. Esperar a que Argo y Kubernetes declaren la revisión Synced/Healthy y el pod use el digest exacto.</action>
  <done>Argo reconcilia la revisión publicada y web/PostgreSQL quedan Ready sin mutaciones directas del clúster.</done>
  <verify><automated>Lecturas kubectl de Application, Deployment, StatefulSet, pods, eventos, logs e imageID</automated></verify>
</task>

<task type="auto">
  <name>Task 3: Validar datos, API, MCP, HTTPS y experiencia web</name>
  <files>producción y artefactos GSD de esta tarea</files>
  <action>Comprobar tabla/FK/migración y preservar los recuentos previos; verificar readiness, TLS/HSTS, discovery OAuth/MCP, respuestas anónimas seguras y que el JavaScript servido contiene la funcionalidad de Epics. Relacionar estas comprobaciones con los tests unitarios, integración y Playwright ejecutados sobre la misma fuente.</action>
  <done>La release queda operativa y verificable, o se restaura el digest anterior y se documenta el fallo.</done>
  <verify><automated>pnpm validate &amp;&amp; pnpm build &amp;&amp; make -C ../.. validate, más probes HTTPS y consultas PostgreSQL de sólo lectura</automated></verify>
</task>
</tasks>

<rollback>
Si la migración, readiness o aceptación falla, restaurar por GitOps el digest anterior `sha256:bedfa7f763ef5c54f6c39b1f3972e431d35945ba70ccc7dc894c4fab52ca8448`. No borrar la tabla ni la columna nuevas: son compatibles y conservarlas hace el rollback no destructivo.
</rollback>
