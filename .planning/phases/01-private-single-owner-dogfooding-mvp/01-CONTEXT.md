# Phase 1: Private Single-Owner Dogfooding MVP - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega el primer Issopen realmente utilizable: un único owner
levanta una instancia privada con Docker Compose, usa una web HTML responsive
para gestionar proyectos y tickets en un Kanban sencillo, conecta ChatGPT a un
Remote MCP autenticado y concede una identidad separada a Codex para trabajar
un ticket real de Issopen y devolverlo a revisión humana.

El producto conserva backlog, permisos, actividad, estados y referencias de
código. El agente externo conserva el repositorio y las credenciales de Git;
Issopen no edita código, ejecuta CI, hace merge ni despliega.

</domain>

<decisions>
## Implementation Decisions

### Corte de producto
- **D-01:** La fase 1 es un MVP vertical utilizable, no una foundation horizontal
  ni una matriz de compatibilidad previa al producto.
- **D-02:** El MVP es privado y single-owner. No incluye registro público,
  invitaciones, colaboración humana ni multi-tenant.
- **D-03:** La interfaz de producto es una web HTML responsive accesible desde
  navegador de escritorio o móvil. No se construye ni empaqueta una aplicación
  de escritorio.
- **D-04:** El gate de la fase es dogfooding real: ChatGPT prioriza una mejora de
  Issopen, Codex la trabaja fuera de Issopen y el owner revisa el resultado
  trazado antes de decidir el cierre.

### Tablero y revisión
- **D-05:** El tablero usa cinco estados semánticos compartidos por web y MCP:
  `Backlog`, `Ready`, `In Progress`, `Ready for Review` y `Done`.
- **D-06:** El corte incluye únicamente los datos necesarios para trabajar:
  proyecto con contexto Git ligero; ticket con clave estable, título,
  descripción, prioridad y estado; reclamación agentica; referencias a branch,
  commit o pull request; y cronología mínima atribuida.
- **D-07:** Un control responsive y accesible para cambiar de estado es
  obligatorio; drag-and-drop no bloquea el MVP.
- **D-08:** El agente puede entregar trabajo en `Ready for Review`, pero cerrar o
  pasar a `Done` exige permiso separado y la revisión final sigue bajo control
  del owner.

### Identidad y MCP
- **D-09:** No existe acceso anónimo al tracker, la API ni el Remote MCP. El
  bootstrap crea exactamente un owner autenticado.
- **D-10:** ChatGPT usa el flujo OAuth 2.1 con PKCE requerido por un plugin MCP
  privado. El endpoint debe validarse con ChatGPT Work real, no sólo con mocks.
- **D-11:** Codex es el primer agente de código del dogfooding. Usa una identidad
  propia y un PAT revocable mostrado una sola vez y almacenado mediante hash;
  nunca reutiliza la sesión ni la credencial del owner.
- **D-12:** Los scopes y el proyecto permitido limitan al agente. El contenido
  de los tickets se trata como datos no confiables y no puede ampliar permisos
  ni cambiar la operación MCP solicitada.

### Arranque mínimo
- **D-13:** Existe un único procedimiento documentado de Docker Compose que
  incluye Issopen y PostgreSQL, prepara una configuración local segura y puede
  repetirse sin perder configuración ni datos.
- **D-14:** Al completar el arranque se muestran la URL y una confirmación mínima
  de estado, sin imprimir secretos. S3, SMTP, OAuth social, compatibilidad amplia
  y operación de release no bloquean este corte.
- **D-15:** La URL pública HTTPS necesaria para la prueba real con ChatGPT es
  configurable. No se fija ni inventa un hostname, proveedor, registro DNS o
  credencial en esta fase de discusión; el plan debe incluir un checkpoint para
  que el operador aporte y autorice la exposición concreta.

### the agent's Discretion
- Elegir el mecanismo mínimo de bootstrap, sesión segura y recuperación del
  owner, siempre que no dependa de acceso anónimo y permita invalidar sesiones y
  credenciales de forma explícita.
- Revalidar y fijar la cohorte exacta de Node.js, TypeScript, Hono, React,
  PostgreSQL, Better Auth y SDK MCP antes de instalar dependencias. Las versiones
  de investigación son baselines, no locks.
- Decidir estructura interna, nombres de comandos y variables, apariencia
  visual mínima, estrategia de migraciones y pruebas, manteniendo un solo
  deployable y PostgreSQL real.
- Elegir cómo presentar la página mínima de estado y los controles del tablero
  sin ampliar el alcance funcional.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Alcance y decisiones aprobadas
- `.planning/PROJECT.md` — visión, restricciones, límites del MVP single-owner y
  decisiones de producto aprobadas.
- `.planning/REQUIREMENTS.md` — requisitos v1 y contratos trazados; la fase 1
  consume los 30 IDs asignados en el roadmap.
- `.planning/ROADMAP.md` — boundary, criterios de éxito y orden de las nueve
  fases vigentes.
- `.planning/STATE.md` — posición actual, bloqueos conocidos y continuidad de
  la sesión GSD.
- `AGENTS.md` — invariantes locales, flujo GSD y límites de seguridad de
  Issopen.
- `../../ARCHITECTURE.md` — responsabilidades del monorepo y separación entre
  aplicación, plataforma, infraestructura y entornos.

### Investigación previa que debe revalidarse
- `.planning/research/SUMMARY.md` — síntesis de stack, arquitectura, riesgos y
  recomendaciones del producto completo.
- `.planning/research/STACK.md` — baseline tecnológico y cohortes de
  dependencias; no fijar versiones sin comprobación actual.
- `.planning/research/ARCHITECTURE.md` — límites del monolito modular, flujo de
  datos y separación entre web, API y MCP.
- `.planning/research/PITFALLS.md` — riesgos de autorización, MCP, privacidad,
  migraciones y self-hosting relevantes al primer corte.

No existe todavía un SPEC.md ni un ADR adicional para esta fase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app.yaml`: ficha provisional de descubrimiento; debe actualizarse cuando el
  runtime, imagen y puerto sean reales, sin habilitar exposición automáticamente.
- `deploy/values.yaml`: placeholder compatible con el chart común; no representa
  todavía un despliegue aceptado.
- `../../platform/charts/common-app/`: chart reutilizable para un único workload
  web con Service, probes y configuración por entorno; Kubernetes no forma parte
  del arranque Compose del MVP.
- `../../scripts/validate`: validación raíz donde deben integrarse checks
  reproducibles de Issopen cuando existan.

### Established Patterns
- Issopen es greenfield: no hay componentes, dependencias, base de datos ni
  comandos de aplicación que deban conservarse.
- Todo vive en el repositorio Git raíz; no se crea `.git`, submódulo ni remoto
  independiente dentro de `apps/issopen`.
- Producción, ingress y Cloudflare siguen deshabilitados hasta que exista un
  artefacto verificable y se autorice una exposición concreta.
- Los secretos se referencian sólo por nombre y nunca se guardan en Git.

### Integration Points
- El código nuevo vive bajo `apps/issopen/` y debe mantener juntos runtime,
  web, API, MCP, migraciones, tests, Docker Compose y documentación.
- La futura personalización Kubernetes se expresa en `deploy/values.yaml` y
  `environments/`; no debe duplicar el Compose de desarrollo.
- La exposición HTTPS del Remote MCP se integra posteriormente con el flujo
  GitOps y el runbook Cloudflare del monorepo mediante un checkpoint explícito.

</code_context>

<specifics>
## Specific Ideas

- La referencia funcional es un Trello pequeño: tickets visibles y movibles,
  no un sistema generalista de gestión de proyectos.
- El owner debe poder trabajar el mismo backlog desde la web o desde ChatGPT.
- El primer agente de código es Codex ejecutándose fuera de Issopen con acceso
  real al repositorio; Issopen sólo le entrega contexto de ticket y recibe
  estado y enlaces del resultado.
- La primera prueba de valor es usar Issopen para dirigir una mejora real de
  Issopen antes de construir captura visual o auditorías.

</specifics>

<deferred>
## Deferred Ideas

- Registro, GitHub OAuth humano, magic links, sesiones multiusuario,
  colaboradores, comentarios y notificaciones — fase 2.
- Etiquetas reutilizables, archivado/restauración y concurrencia/idempotencia
  avanzada — fase 3.
- Adjuntos y almacenamiento S3 privado — fase 4.
- Extensión Chromium, captura, recorte, saneado DOM y redacción — fases 5 y 6.
- Epics de auditoría y hallazgos mixtos — fase 7.
- Matriz formal de sistemas, arquitecturas y navegadores; SMTP/OAuth providers;
  upgrades, backups, restore y release Community — fase 8.
- Cloud Free, límites, cuotas y operación alojada — fase 9.
- Escalado, refactors y compatibilidad adicional se deciden después de medir el
  MVP; no bloquean la fase 1.

</deferred>

---

*Phase: 01-private-single-owner-dogfooding-mvp*
*Context gathered: 2026-08-31*
