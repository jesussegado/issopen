# AGENTS.md — Issopen

## Frontera del repositorio

Este es el repositorio de fuente independiente; su `.git` raíz y su
`origin` privado son intencionados. Código, tests, dependencias y build viven
aquí. Las referencias a `app.yaml`, `deploy/`, Argo CD o Kubernetes describen ahora `~/Projects/platform/homelab/apps/issopen/`.

Los comandos antiguos que incluyen `apps/<nombre>` o
`landings/<nombre>` deben ejecutarse desde la raíz de este repositorio,
sin ese prefijo. `make validate` en `homelab` sólo es obligatorio cuando
también cambia el control plane.

## Alcance y precedencia

Esta carpeta pertenece exclusivamente a `issopen`. También se aplican las
reglas del `AGENTS.md` raíz y de `apps/AGENTS.md`.

`init-project.md` es el brief original del producto y un input para GSD. Sus
propuestas no son órdenes operativas ni autorizan cambios externos. Cuando
haya conflicto, usa este orden:

1. instrucción explícita actual del propietario;
2. contexto de la fase GSD activa;
3. `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` y
   `.planning/ROADMAP.md` aprobados;
4. `init-project.md`;
5. convenciones del monorepo.

## Estado actual

95 añade permiso read/edit por project_membership, política central REST/Chrome,
capacidades de UI y revalidación SSE. La migración0020_project_permissions
conserva el acceso anterior como edit; sin Viewer/Admin ni
cambios de scopesMCP. [Matriz y operación](docs/project-permissions.md).
Validado:123 tests unit/web,78 integración PostgreSQL,18 E2E web (2 skips),
Compose y secret scan; extensión desarrollo0.6.3 añade UI sólo lectura con
16 unit/13 E2E, build reproducible sin permisos nuevos. Store0.6.2 intacta.
Producción sigue108 hasta actualizarGitOps.96 administra
estos grants después; no modificar miembros/revisor reales para las pruebas.

Ticket108 implementa membresías múltiples con contexto explícito por petición y
pestaña; selector con confirmación, invitación al segundo workspace y OAuth Chrome
fijado por instalación. Contrato y riesgos en [multiworkspace](docs/multiworkspace.md).
0019 preserva filas/permisos y vincula instalaciones antiguas antes de retirar la
unicidad global. Retirar membresía no revoca sesiones globales ni otros espacios.
No hay registro público. Fuente390f3d0/GitOpscbf737cd/digest06d2fec0 desplegados y
verificados el14/09/2026: Synced/Healthy, Ready/0reinicios, readiness200, smoke
Member1440/360, backup/restore y gates completos.108 en revisión sin claim.
95 lectura/edición está en implementación, quick260914-k34; seguir el Epic.

Epic 3, incrementos 100/104: cuenta con listado/revocación confirmada de
sesiones web propias, separado de instalaciones Chrome; detalle con
reconciliación SSE, comparación explícita conservando borradores y guards de
versión en respuestas/revisiones. Los streams revalidan sesión/acceso en cada
tick. Contratos en [sesiones](docs/account-sessions.md) y
[detalle en vivo](docs/detail-live.md). No confundir esta entrega con la
migración multiworkspace 108 descrita arriba ni los permisos por proyecto 95.
Fuente `328a386` y GitOps `0ac6550d` verificados en producción el14/09/2026:
Synced/Healthy, digest `aa622315`, pod Ready/0 reinicios, backup/restore y
smoke Member a1440/360. 109 cierra el menú móvil al navegar. 94/100/104/109
están en revisión humana sin claims; seguir con108→95 y repetir integración107.

- Epic 3 entra en implementación por petición explícita tras responder sus
  20 preguntas (v2, 2026-09-13). Contrato 94: Owner/Member por workspace,
  varios workspaces y permisos de lectura/edición por proyecto (95), sin signup
  público. 108 implementa la base multiworkspace antes de sus dependientes.
  Sesiones propias globales (100) y detalle autorizado (104) admiten entregas
  independientes; repetir su integración al introducir tenancy/roles nuevos.
  No se han cambiado accesos reales ni el revisor Store. El índice distingue
  decisiones aprobadas de código entregado en el
  [plan de colaboración](docs/epic-3-collaboration-plan.md), quick `260913-x6a`.
  Releer respuestas/versiones; no retomar las recomendaciones descartadas.

- Ticket 91 deriva el botón de borrado del rol Owner y workspace de la sesión.
  Member conserva edición, comentarios, preguntas y revisión permitidos por
  la API. El detalle sólo muestra `Owner: You` al propietario real; comentarios
  y actividad usan `You` únicamente cuando el ID del actor coincide con quien
  consulta, y muestran el nombre histórico de otras personas como texto seguro.
  No cambia permisos del servidor, datos, esquema ni el ZIP Chrome 0.6.2.
  Fuente `be31905`, GitOps `b0240335` Synced/Healthy, imagen por digest
  `2439285`; backup restaurado aislado y smoke Member productivo a 1440/360 px
  correctos. Owner cubierto por regresiones. Ticket Ready for Human Review,
  claim liberado. Evidencia en quick `260913-u1g`.

- Ticket 86 dispone de un proyecto **Google Review Demo** con un Member local
  exclusivo, sin acceso a proyectos reales. Alta/revocación administrativa en
  `scripts/store-reviewer.ts`, autorización explícita del propietario el
  2026-09-13, procedimiento en [acceso de revisión](docs/chrome-review-access.md).
  Credencial en `.local/secrets/chrome-review.json` ignorado, modo 0600, y en el
  campo privado de Google; nunca copiarla a tickets/Git. Se verificaron login,
  denegaciones y OAuth Chrome con creación de ticket/imagen en producción.
  No caduca automáticamente: retirar el acceso al terminar la revisión.
  Esa alta administrativa no modificó signup, OAuth general, esquema ni imagen.

- Ticket 84 prepara la ficha Chrome 0.6.2 en
  `extensions/chrome/store/LISTING.es.md`, páginas públicas `/chrome` y
  `/support` y assets reproducibles mediante `pnpm store:assets`. Los PNG se
  validan por dimensiones y SHA-256 en `store/assets/assets.json`. El dashboard
  de `serviciosegado@gmail.com` ya tiene el item
  `eohpecaogeelnicbpeedjdganacfknok`, versión 0.6.2, ficha Unlisted guardada,
  contacto verificado y declaración de no operador indicada por el dueño.
  Las instrucciones privadas de prueba están guardadas. Estado observado:
  enviado el 2026-09-13 a las 19:24 UTC, Pendiente de revisión, Unlisted y
  publicación automática desactivada. No aprobado/publicado todavía.
  La aclaración de 86 está resuelta: el 2026-09-13 a las 20:21 UTC la persona
  eligió mantener el Member local durante esta revisión (2/2 respondidas,
  sin preguntas bloqueantes pendientes). No sustituirlo ni retirar su acceso;
  Google de pruebas queda para el piloto. Dashboard reconsultado a las
  20:23 UTC: sigue Pendiente de revisión. Evidencia en quick `260913-v4j`.
  [Operación Store](docs/chrome-store-operations.md) y
  [piloto pendiente](docs/chrome-store-pilot.md) delimitan los gates de 87/88.

- Chrome 0.6.2 conserva el control de datos de ticket 83 y elimina de la fuente
  y del paquete los entrypoints históricos de captura/DOM. Publica `/privacy`
  sin login con inventario,
  finalidad, retención, Limited Use, contacto y derechos; el mismo texto se
  enlaza desde web, consentimiento y panel Chrome. Abrir/editar un borrador no
  transmite nada; el disclosure junto a Enviar ticket describe el gesto. El
  uploader o el owner pueden borrar una imagen individual mediante DELETE web:
  se elimina fila y PNG activo, se registra `capture.evidence_deleted` y se
  advierte que descargas/backups previos quedan fuera. Contrato y revisión RGPD
  básica en [privacidad](docs/privacy.md). No confundir con borrar un ticket,
  que sigue siendo lógico.

- Epic 7 tiene contrato de publicación Unlisted en
  [Chrome Web Store](docs/chrome-web-store.md). El ticket 78 inventaría el
  runtime observado, separa sesión web, Google OIDC, OAuth de extensión y MCP,
  asigna evidencias a 79–88 y fija checkpoints/rollback. La cuenta operadora
  acordada es `serviciosegado@gmail.com`; sólo se documenta su ownership, nunca
  credenciales. Unlisted no es control de acceso: el piloto sigue siendo por
  invitación. Hasta que 86 sea aprobado no afirmar que existe una versión Store.

- Ticket 81 implementa invitaciones Member de siete días con token aleatorio
  guardado sólo como hash, enlace de revelado único/rotación, sesión provisional
  de 15 minutos sin acceso y vinculación Google explícita con email verificado
  idéntico. El Owner gestiona invitaciones y miembros en `/members`; revocar una
  invitación sólo invalida su sesión provisional. Desde108, retirar un miembro
  revoca acceso y OAuth Chrome de ese workspace, no sesiones globales ni otros
  workspaces. Migración aditiva `0018_steady_ironclad` y
  contrato en [invitaciones de miembros](docs/member-invitations.md). No marcar
  la aceptación externa cerrada hasta probarla con una segunda cuenta Google
  real después de configurar 79.

- Ticket 66 añade archivado reversible de Epics. Sus tickets heredan el
  archivado sin cambiar de estado: desaparecen del board, de la colección REST
  activa y de `list_issues`, pero conservan acceso directo, datos y actividad;
  al restaurar reaparecen en sus columnas originales. Manage Epics permite
  mostrarlos y restaurarlos. Fuente base `4ebabcf`, seguimiento `af1e2f7`,
  GitOps `26fa5c30`, digest `ecc2acf`; gate completo, restore aislado y smoke
  Chrome/MCP productivo pasaron sin archivar ningún Epic real. Contrato en
  [archivado de Epics](docs/epic-archiving.md) y evidencia en
  [quick 260910-r66](.planning/quick/260910-r66-archivar-y-restaurar-epics/SUMMARY.md).

- Ticket 64 separa con un `gap` de 8 px el icono `+` y la etiqueta `Create
  ticket in Epic`, sin cambiar nombre accesible ni destino. Fuente `44b1bda`,
  GitOps `cfc0474b` `Synced/Healthy`, digest `0964635`; gate completo, restore y
  Chrome productivo validados. Ticket Ready for Human Review v6, sin claim.

- Ticket 63 sincroniza el board abierto mediante invalidación SSE autenticada y
  acotada al proyecto. El cursor procede del log de actividad append-only y no
  contiene tickets; por ello observa REST, Chrome y MCP. La UI relee estado
  autoritativo en eventos, foco, visibilidad, vuelta de red y reconciliación de
  30 s, sin perder filtros, columnas plegadas ni tarjetas abiertas. Fuente
  `65f2720`, GitOps `db1f864f` `Synced/Healthy`, digest `8f26ffd`; producción y
  restore aislado validados. Ticket Ready for Human Review v6, sin claim.

- Chrome 0.6.0 (ticket 82) permite vincular instalaciones de miembros
  invitados: sólo reciben proyectos asignados, no pueden crear proyectos y sus
  acciones se atribuyen a su propia identidad. `/session` anuncia `userId` y
  `workspaceRole`, manteniendo `ownerId` sólo para compatibilidad 0.5.x; los
  borradores quedan separados por persona/workspace. Retirar la membresía
  invalida access/refresh/cliente en la siguiente operación. Contrato y pruebas
  en [entrega Chrome](docs/chrome-delivery.md).

- Chrome 0.5.5 (ticket 62) elimina el estado engañoso de imágenes tras una
  creación confirmada: oculta los controles editables, libera las copias en
  memoria y confirma cuántas quedaron adjuntas. La eliminación previa al envío
  sigue siendo inmediata; los envíos inciertos permanecen bloqueados e
  idempotentes y no se añade borrado de adjuntos del servidor. Fuentes
  `f337430`/`3da9fc5`, ZIP reproducible y perfil Chrome administrado validados;
  ticket Ready for Human Review v6, sin claim.

- Epic 5 (tickets 57–59) simplifica los listados de Epics sin borrar sus
  descripciones, mantiene siempre visible `+ Create ticket in Epic` y permite
  pegar/elegir hasta cinco imágenes privadas al crear un issue desde la web.
  `POST /api/v1/captures` es owner/same-origin, estricto, idempotente y atómico;
  reutiliza normalización, recibos, tabla de evidencia y PVC existentes sin
  migración. Un resultado de red incierto bloquea el borrador y reintenta la
  misma petición. Contrato y rollback en
  [Epic 5 frontend](docs/epic-5-frontend.md); memoria en
  [quick 260910-h2k](.planning/quick/260910-h2k-completar-epic-5-frontend-y-usabilidad/SUMMARY.md).
  Fuente `b7c48cb`, GitOps `c9c46e9e` `Synced/Healthy`, imagen productiva por
  digest `bd534bb`; pod Ready sin reinicios y PVCs intactos. Backup/restore y
  smoke autenticado desktop/móvil pasaron sin mutar datos. Los tickets 57–59
  están en Ready for Human Review v6, sin preguntas ni claims activos.

- Ticket 61 presenta el estado interno `ready_for_review` como **Ready for
  Human Review** y permite ocultar esa columna o Done por proyecto. La migración
  aditiva 0015 activa ambas por defecto. Ocultar es sólo presentación: conserva
  estado, URL directa, REST y MCP. Fuente `5048f51`, GitOps `ddf9d971`
  `Synced/Healthy`, pod Ready sin reinicios, PVCs intactos; backup/restore y UI
  desktop/móvil verificados. Memoria en
  [quick 260910-g1z](.planning/quick/260910-g1z-renombrar-revision-humana-y-configurar-columnas/SUMMARY.md).

- Ticket 60 añade borrado lógico **sólo web**: botón en detalle y diálogo,
  DELETE owner/same-origin con versión y conjunto de preguntas obligatorios.
  `issue.deleted_at` (migración aditiva 0014), evento `issue.deleted` append-only,
  liberación del claim, sin reutilizar números ni purgar historial/adjuntos.
  Excluido de tableros, Epics, MCP y URLs privadas de imágenes; mutadores toman
  lock de fila y los replays no resucitan tickets borrados. No añade scopes ni
  borrado en MCP/extensión. Recuperación sólo administrativa, sin papelera web.
  Tras usarlo no hacer rollback a un binario anterior sin valorar que volvería
  a mostrar esos tickets. Operación en [borrado de tickets](docs/ticket-deletion.md).

- Chrome 0.5.4 (ticket 56) mejora el enlace de ticket creado y apila las
  acciones finales del compositor, a ancho completo y con separación. Cambio
  visual acotado; sin modificar lógica de envío, permisos ni backend.

- Chrome 0.5.3 (ticket 54) fusiona búsqueda y selección de Proyecto/Epic en
  un único input-combobox por destino. Texto de filtro transitorio, selección
  confirmada por clic/Enter, cancelación sin modificar IDs ni borradores.
  Prioridad/estado y backend/permisos no cambian.

- Chrome 0.5.2 (ticket 53) corrige los selectores que Chrome Linux posicionaba
  fuera de su ventana. Listas HTML dentro del panel con ratón/teclado, filtros
  y bloqueo de envío pendiente; conserva API, permisos y borradores. Pruebas
  deben clicar opciones reales, no saltarse el menú con `selectOption`.

- Chrome 0.5.1 (ticket 52) reúne la introducción/privacidad/borrador en un aviso
  cerrable con preferencia local y ayuda permanente en Cuenta. No modifica
  servidor, permisos, sesión ni borradores. Ver `extensions/chrome/AGENTS.md`.

- Chrome 0.5 (ticket 51): petición del owner de sustituir captura/DOM/editor por
  pegar Ctrl+V o subir hasta cinco imágenes externas. PNG/JPEG/WebP estáticos
  convertidos localmente a PNG, 8 MiB agregados, 32 MP por imagen; miniaturas y
  borrador 24 h. Sin activeTab/scripting ni lecturas de página. ClipboardRead
  opcional sólo al pulsar Pegar imagen. Cuenta continúa en diálogo.
  API v1 admite image legacy O images, conserva recibos y acepta borradores
  pendientes antiguos. No hay migración DB nueva; sí release de backend.
  Guía actual en [extensión](extensions/chrome/AGENTS.md) y
  [entrega](docs/chrome-delivery.md). No reinstalar/downgradear con un borrador
  nuevo pendiente: 0.4.3 puede descartarlo. El siguiente bloque 0.4 es histórico.

- Chrome 0.4 implementa el flujo captura → ticket: selección DOM estructural,
  revisión/exclusión, proyecto y Epic inline, evidencia privada y borrador
  IndexedDB de 24 h con reintento idempotente. Contrato común en
  `src/shared/capture-contract.ts`, API/storage/maintenance en `src/server/capture-*.ts`,
  compositor en `extensions/chrome/entrypoints/sidepanel/Workspace.tsx`.
  Ver [contratos, seguridad, backups y release](docs/chrome-delivery.md).
  Nuevos permisos humanos `extension:write` requieren reconectar/consentir;
  no ampliar grants antiguos ni permisos MCP. Migración aditiva 0013.
  Producción usa volumen separado de adjuntos; su activación/digest se verifica
  en GitOps. `pnpm extension:release` valida y empaqueta sólo un Git limpio.
  La aceptación personal del owner en 33 no se simula con pruebas automáticas.
  Entrega verificada el 2026-09-09: binario fuente `e5da82f`, GitOps `db767e30`
  (seguido de corrección documental `fac0669d`), imagen `chrome-mvp-e5da82f`
  por digest. Chrome 152 real creó pruebas 45–48 con los cuatro modos; PNG
  privado/redactado verificado, backup completo restaurado sin red en PostgreSQL
  aislado y rollback 0.4→0.3→0.4 probado. 182 pruebas del gate y Compose pasan.
  19–32 en Ready for Review, 33 In Progress con una pregunta de aceptación y
  todos los claims liberados; 17 respuestas previas intactas. El workflow CI
  está definido, no se afirma un run remoto Forgejo observado. Memoria detallada:
  [quick de entrega](.planning/quick/260909-vje-completar-epic-chrome-dom-adjuntos-priva/SUMMARY.md).

- Histórico del corte Chrome 0.3.0: captura local (23) y parte del editor (25): viewport,
  full-page acotada y recorte, máscaras previas, restauración de scroll/estilos,
  zoom, recorte posterior, ocultación opaca y deshacer/rehacer. PNG final en
  memoria/descarga, sin subida ni persistencia del original. Detalle e
  invariantes en [chrome-capture.md](docs/chrome-capture.md). Las dependencias
  DOM 24 y envío/almacenamiento 22/26/28 se completan en el corte 0.4 anterior.

- Chrome 0.2.0 añade OAuth humano por instalación (21): PKCE S256 iniciado con
  `chrome.identity`, consentimiento web, acceso de 5 minutos, refresh y límite
  absoluto de 30 días. `src/server/extensions.ts` sirve la API humana separada
  `/api/extension/v1` y gestión owner `/api/v1/extensions`; web `/extensions`.
  Reutiliza las tablas OAuth existentes, sin migración ni concesión de scopes
  a agentes. Cada instalación es un cliente público propio revocable, callback
  Chromium exacto, sin secreto de cliente. Credenciales sólo en storage local
  confiable del worker, nunca mensajes al panel/content scripts ni sync.
  Esa conexión 0.2 sólo permite leer; 0.4 añade escritura con consentimiento nuevo.
  La revisión/digest GitOps siguen siendo la autoridad de qué está desplegado.

- El 2026-09-09 el propietario priorizó el Epic de Chrome (19–33) y aprobó las
  16 recomendaciones pendientes, conservando «Crear proyecto y Epic».
  El primer corte 19–20 está en `extensions/chrome/`: WXT MV3, panel lateral y
  comprobación local de pestaña; 21 y 23 añaden el login y captura descritos arriba.
  Consultar su [AGENTS.md](extensions/chrome/AGENTS.md),
  [guía de instalación](extensions/chrome/README.md) y
  [alcance del Epic](docs/chrome-extension.md). No confundir esta entrega con
  completar fases previas del roadmap, el ticket 44 ni todo el Epic.
- Proyecto greenfield en implementación: los planes `01-01` a `01-05` aportan
  el walking skeleton ejecutable, el dominio transaccional con su REST privada
  y la web responsive del tracker, más identidades agenticas y Remote MCP.
- La inicialización GSD está completa y el propietario aprobó un roadmap de
  nueve fases con los 89 requisitos v1 asignados exactamente una vez.
- La fase 1 nació como `Private Single-Owner Dogfooding MVP`, pero el Epic 7
  evoluciona esa base al piloto externo Owner/Member. `src/server/human-access.ts`
  es la política humana central: Owner administra y Member sólo trabaja en los
  proyectos asignados. La matriz, migración y rollback están en
  [docs/workspace-memberships.md](docs/workspace-memberships.md).
- El primer MVP aceptable termina en la propia fase 1: Docker Compose simple,
  web responsive, tablero tipo Trello, Remote MCP para ChatGPT, identidad
  separada para Codex y revisión humana de una mejora real de Issopen.
- `compose.yml` sigue siendo el runtime local aprobado: un proceso Node en el
  puerto 8080 y PostgreSQL 18 con volumen nombrado.
- Producción se declara bajo `deploy/manifests`: un Deployment de aplicación y
  un StatefulSet PostgreSQL, ambos fijados a `debian13-torre-nya`, más Services
  ClusterIP e Ingress Traefik en namespace `issopen`/proyecto `business-apps`.
- La revisión de fuente y la imagen productiva inmutable se declaran en
  `~/Projects/platform/homelab/apps/issopen/app.yaml`; verificar su digest
  contra Argo CD antes de afirmar qué versión está activa.
- El 2026-09-08 se publicó la identidad de seis piezas, bosque y menta desde
  la fuente `2b0bb5a78b0e6847a3e1a694225db4371b86c671`. Argo CD reconcilió
  `a1956385752a38bc8261ee9b4d6d5b27bfa7d299` como `Synced/Healthy`; se
  conservaron el pod PostgreSQL y su PVC, sin nuevas migraciones. La evidencia
  de publicación vive en quick `260908-ja5`.
- La corrección posterior del favicon blanco se publicó desde `5e2debd`,
  GitOps `4527b882`, el 2026-09-08: `Synced/Healthy`, sin reinicios y con
  PostgreSQL/PVC conservados. Incluye las etiquetas sin corchetes de
  `aa52179`; evidencia y rollback en quick `260908-kiy`.
- El 2026-09-02 Argo CD reconcilió la release de Epics como `Synced/Healthy`;
  la migración conservó 18 issues y 133 eventos, y se verificaron readiness,
  HSTS, discovery OAuth/MCP y el bundle público sin mutar datos del owner.
- El tablero permite plegar cada columna de estado y muestra las tarjetas en
  modo compacto con su clave visible; cada tarjeta puede desplegar una vista
  previa con descripción, prioridad, preguntas y cambio de estado antes de
  abrir el detalle completo.
- La release productiva incorpora Epics ligeros por proyecto: un issue pertenece a
  cero o uno, el tablero filtra por todos/sin Epic/Epic concreto mediante URL,
  y el detalle del Epic deriva progreso y recuentos de sus tickets. Esta
  capacidad conserva el aislamiento por workspace/proyecto y los scopes
  agenticos existentes.
- El detalle muestra la actividad y los comentarios más recientes primero.
  REST y MCP conservan el orden cronológico ascendente estable requerido por
  la paginación; la inversión pertenece únicamente a la presentación web.
- Los valores de runtime viven sólo en los Secrets externos `issopen-env`,
  `issopen-postgres-env` y `registry-serviciosegado`; la fuente de recuperación
  ignorada y con modo `0600` es `.local/secrets/issopen-production.env`.
- La exposición pública usa el camino Caddy/túnel/Traefik existente. No afirmar
  el gate ChatGPT hasta observar DNS, HTTPS, OAuth/uso de tools y revocación.
- El 2026-08-31 Argo CD quedó `Synced/Healthy`, aplicación y PostgreSQL quedaron
  `Ready` en el master, y se verificaron DNS público, certificado Let's Encrypt,
  readiness y discovery OAuth/MCP en `https://issopen.serviciosegado.com`.
  El owner y el workspace ya existen, y el MCP con PAT separado se ha usado
  para leer, crear y reclamar tickets reales. Consentimiento, tool call y
  revocación desde ChatGPT Work siguen siendo el checkpoint humano pendiente.
- `init-project.md` procede de
  `/home/jsegado/Downloads/issopen-init-project.md`; se conserva como brief,
  no como código ejecutable.

No escribas código de producto, instales dependencias ni habilites despliegues
fuera de un plan de fase discutido y aprobado.

## Producto y bucle principal aprobados

Issopen es un issue tracker abierto y self-hostable para desarrolladores
individuales, mantenedores open source y sus colaboradores. Su primer bucle
diferenciador es:

```text
crear y priorizar un issue desde el tablero o ChatGPT
  -> un agente de código externo lo reclama mediante MCP
  -> trabaja en el repositorio y enlaza branch, commit o PR
  -> lo devuelve a Ready for Human Review (`ready_for_review`)
  -> una persona revisa y decide el cierre
```

Issopen debe usar este bucle para dirigir sus propias mejoras. La captura
Chromium segura enriquece el producto después de validar ese MVP agentico.

El producto completo será open source y estará disponible como Community
self-hosted y Cloud Free con paridad funcional. Cloud monetiza capacidad,
retención, operación y soporte, no funciones cerradas. Issopen no aloja
agentes ni inferencia: coordina agentes externos BYO-AI mediante MCP.

## Flujo GSD obligatorio

La inicialización ya está aprobada. No la repitas ni sustituyas sus decisiones
por las propuestas del brief. La memoria canónica está en:

```text
.planning/PROJECT.md
.planning/config.json
.planning/research/SUMMARY.md
.planning/REQUIREMENTS.md
.planning/ROADMAP.md
.planning/STATE.md
```

Antes de trabajar en una fase:

- lee `STATE.md`, la fase de `ROADMAP.md` y sus requisitos trazados;
- no crees un `.git` anidado: todo se versiona desde la raíz del monorepo;
- no conviertas una fase del roadmap directamente en código;
- conserva las reglas manuales de este archivo cuando GSD regenere sus bloques;
- actualiza `STATE.md`, trazabilidad y documentación al cerrar cada fase.

El siguiente flujo es:

```text
$gsd-plan-phase 1
$gsd-execute-phase 1
```

Ejecuta `$gsd-ui-phase N` antes del plan sólo cuando la fase tenga
`**UI hint**: yes` en el roadmap.

No ejecutes una fase sin contexto, plan verificable y criterios de aceptación.

## Evidencias pendientes por resolver en sus fases

- Validar en la fase 1 ChatGPT Work y Codex con una mejora real de Issopen,
  manteniendo repositorio, CI, merge y despliegue fuera del servidor.
- Convertir en la fase 5 la privacidad del DOM y la redacción destructiva en un
  contrato probado frente a páginas hostiles.
- Validar semántica y utilidad de las auditorías con usuarios en la fase 7.
- Resolver la revisión legal de la licencia AGPLv3 antes de la release pública
  Community de la fase 8.
- Medir costes reales antes de publicar cuotas de Cloud Free en la fase 9.

## Arquitectura planificada y estado de implementación

La investigación selecciona un monolito modular desplegable sobre Node.js y
TypeScript: SPA React/Vite, backend Hono para REST, auth y MCP, extensión WXT
Manifest V3, PostgreSQL con migraciones Drizzle, Better Auth y almacenamiento
S3-compatible. Community y Cloud deben usar los mismos artefactos y contratos.

Next.js y los SDK de aplicación de Supabase se descartaron para evitar un
servidor duplicado y dependencia propietaria. Las versiones de
`.planning/research/STACK.md` son baselines investigadas, no dependencias
instaladas: la fase 1 debe comprobarlas y fijarlas como cohorte. No crees
microservicios ni paquetes sin una responsabilidad real.

El plan `01-01` implementa un único paquete ESM: `src/server/` sirve la SPA de
`src/web/`, monta Better Auth y opera sobre PostgreSQL mediante Drizzle. Las
migraciones SQL viven en `drizzle/`; `scripts/owner.ts` es la única vía de
bootstrap y recovery. El plan `01-02` añade `src/server/domain/` como única
fuente de mutaciones transaccionales de proyectos, issues, claims, enlaces de
código, revisión y actividad append-only; `src/server/http/` expone esas mismas
operaciones a sesiones humanas con aislamiento por workspace/proyecto y
denegación por defecto; las operaciones administrativas son Owner-only. MCP y agentes
llegan en planes posteriores y deben reutilizar esos servicios, no duplicar
reglas de dominio ni aceptar actor, origen, fecha o diff desde el cliente.

El plan `01-03` implementa la SPA de `src/web/` sin router ni biblioteca de
componentes externa: `components/` contiene primitivas semánticas locales,
`routes/` monta formularios, tablero, detalle, revisión y actividad, y `lib/`
centraliza navegación, estado online y el corte de sesión ante `401`. El estado
remoto no se persiste en almacenamiento del navegador; las mutaciones esperan
la respuesta autoritativa antes de mover tarjetas o anunciar resultados. Los
tests de `tests/web/` usan Testing Library y los de `tests/e2e/` levantan una
PostgreSQL efímera para verificar Chromium desktop y móvil, incluido teclado.

El plan `01-04` añade identidades agenticas con scopes y allowlist por proyecto,
PAT de revelado único guardados sólo como Argon2id y revocación inmediata. El
servidor `src/server/mcp/` expone una superficie acotada de herramientas tipadas sobre
los servicios de dominio existentes mediante MCP 2.0 stateless. Better Auth,
`@better-auth/mcp` y `@better-auth/cimd` están fijados conjuntamente en `1.7.2`;
el SDK MCP está fijado en `2.0.0`. ChatGPT usa authorization code con PKCE S256,
discovery RFC 9728 y consentimiento owner; Codex usa PAT. Las identidades Codex
reciben `issues:create` por defecto, pero sólo pueden crear en proyectos de su
allowlist y siempre en Backlog; el owner humano sigue siendo el propietario y
la actividad conserva el agente autor. `questions:write` permite añadir
preguntas con recomendación y opciones, pero sólo el owner humano puede guardar
o cambiar respuestas. Ninguna identidad recibe `issues:close` por defecto y el
dominio vuelve a comprobar ese permiso.

Los grants de agente se pueden reducir mediante
`PATCH /api/v1/agents/:agentId/access`, nunca ampliar. Cada petición MCP vuelve
a resolver desde PostgreSQL la identidad, scopes y allowlist, aunque el cliente
ya estuviera conectado. `agent_identity` conserva `last_used_at` y
`revoked_at`; la UI expone sólo metadatos seguros de acceso. Revocar una
identidad invalida su PAT o, para OAuth, sus access tokens, refresh tokens y
consentimiento. La actividad histórica mantiene la instantánea de ID y nombre
del actor. `offline_access` es un scope OAuth de conexión, no un permiso de
producto y no debe persistirse en `agent_scope`.

Los comentarios viven en `issue_comment` y son append-only también a nivel de
PostgreSQL. REST permite al owner añadirlos y MCP expone `add_comment` sólo con
`comments:write`; autor, nombre visible, origen y fecha se derivan siempre de la
sesión o principal autenticado. `get_issue` los devuelve en orden cronológico y
React muestra el cuerpo como texto no confiable, sin renderizar Markdown/HTML.
No existen edición, borrado, menciones ni notificaciones implícitas en el MVP.

Todas las mutaciones MCP actuales exigen `idempotencyKey`. El servicio
`src/server/domain/idempotency.ts` acota la clave por workspace, identidad y
tool, normaliza y hashea el payload, serializa concurrencia mediante advisory
lock de PostgreSQL y guarda la respuesta junto al efecto en la misma
transacción. Un replay idéntico durante 24 horas devuelve la respuesta original
sin duplicar actividad; reutilizar la clave con otro payload devuelve conflicto.
No persistir tokens, cabeceras ni secretos en esos registros. Toda nueva tool
MCP mutante debe atravesar este servicio.

`get_agent_context` devuelve sólo identidad, scopes y allowlist efectivos del
agente autenticado; el catálogo de tools no equivale a permisos. El handler sirve
también clientes nativos Codex de protocolo 2025 mediante el fallback stateless
del SDK v2: ambas eras conservan POST-only, autenticación por petición y todos
los controles de dominio. No habilitar sesiones ni el endpoint SSE antiguo.

Los listados MCP se versionan con `schemaVersion: 1` y usan paginación keyset:
50 elementos por defecto, máximo 100 y cursores opacos ligados a la tool, los
filtros y la allowlist efectiva. `list_projects`, `list_issues` y
`list_activity` devuelven sólo resúmenes acotados; no incluyen descripciones
completas ni el payload `changes` de actividad. `list_issues` filtra por
proyecto, estado, prioridad y claim (`any`, `claimed`, `unclaimed`, `mine`).
`get_issue` conserva el paquete detallado autorizado. No conviertas los
cursores en offsets ni filtres después de paginar: ambas cosas romperían el
aislamiento y la estabilidad del recorrido.

Los tickets pueden contener varias preguntas. Cada una mantiene una única
respuesta actual editable —opción predefinida u `Other`— y cada cambio queda
registrado en actividad append-only. Los recuentos se derivan en servidor; una
pregunta bloqueante sin responder activa el warning y el filtro del tablero, y
el dominio impide mover el ticket a `ready_for_review` hasta responderlas todas.
Al guardar una respuesta, la web avanza a la siguiente pregunta pendiente del
ticket y vuelve al principio si hace falta. Si todas están respondidas, conserva
la actual. Un guardado fallido mantiene la pregunta y su borrador.

Los Epics viven en `epic` y sólo agrupan tickets del mismo proyecto/workspace.
Cada Epic tiene un `number` positivo, único y estable dentro de su proyecto;
`project.next_epic_number` lo asigna transaccionalmente, separado del contador
de issues. La web usa `epicLabel` e `issueLabel` para mostrar `número-título`, sin corchetes,
sin prefijos de proyecto. Las claves se conservan en API/MCP y se generan
automáticamente para proyectos nuevos creados en la web. No se muestran en
formularios, badges, referencias de actividad ni etiquetas accesibles; los
textos escritos por usuarios no se reescriben. No cambian títulos almacenados
ni URLs UUID. La migración `0011_epic_numbers` numera los
existentes por `created_at`/`id`, conserva sus relaciones y actualiza contadores.
La asociación nullable `issue.epic_id` usa una FK compuesta para que ni REST ni
MCP puedan cruzar esas fronteras. `TrackerService` es la única vía para crear o
editar Epics y asociar tickets; los recuentos por estado y el progreso no se
persisten, se derivan de los issues reales. La web gestiona los Epics en
`routes/EpicRoutes.tsx` y conserva el filtro del tablero en `?epic=`. MCP no
añade scopes para la asociación ticket–Epic: `get_issue` devuelve el contexto, `list_issues`
acepta `epicId`, y `create_issue`/`update_issue` validan la asociación usando
los scopes y la allowlist de proyecto existentes.

`get_project`, `list_epics` y `get_epic` usan `issues:read`; el listado MCP de
Epics es compacto y paginado, y su detalle agrega progreso sin cargar los hijos.
`create_epic`/`update_epic` requieren respectivamente `epics:create`/`epics:write`,
con idempotencia y atribución. La migración aditiva `0012_giant_leo` añade sólo
valores al enum: no concede permisos ni cambia tokens. UI y perfil por defecto
dejan ambos scopes desmarcados. Un rollback de binario conserva el enum ampliado;
no intentar borrar valores usados. Las credenciales nuevas con permisos Epic no
deben utilizarse contra un binario anterior al soporte de esas herramientas.

La edición de planes acepta `expectedVersion` en REST/MCP para issues y Epics;
las issues aceptan además el conjunto completo `questionVersions` (`id/version`).
Los guards son opcionales durante la transición, pero la web y la skill los usan.
La escritura SQL comprueba versión; cambios/preguntas/respuestas bloquean la fila
padre durante la transacción para validar decisiones sin una carrera intermedia.
Un conflicto devuelve 409 sin modificar datos/actividad. La web conserva el
borrador y permite comparar antes de adoptar explícitamente una base nueva.
El replay idempotente confirmado se resuelve antes de volver a evaluar el guard.

El plan `01-05` añade `scripts/dogfood.ts`: un cliente operador idempotente que
usa exclusivamente REST y MCP para dirigir una mejora de Issopen desde la
priorización hasta la revisión humana. Recibe la credencial owner y una URL de
resultado por entorno efímero, mantiene el PAT sólo en memoria, lo revoca al
terminar y produce evidencia sin secretos. `tests/e2e/dogfood.spec.ts` ejecuta
ese mismo cliente contra Hono y PostgreSQL reales, verifica atribución, rechazo
de cierre agentico, request-changes, aceptación e idempotencia. No hay imports,
procesos ni credenciales de Git, CI, merge o despliegue en ese camino.

## Skill de Codex y aceptación actual

El paquete reusable vive en `skills/issopen/` (instrucciones, referencias y
helpers puros); `scripts/install-skill.mjs` instala una revisión Git fijada y
protege cambios locales. No se distribuyen credenciales, datos del Epic ni
configuración privada. Issopen sigue siendo el plan canónico, GSD una copia
derivada con versiones de ticket y preguntas.

El trabajo del Epic 4 se sigue en Issopen: tickets 13 y 34–42 listos para revisión;
43 cerrado en Done por instrucción explícita del owner el 2026-09-09, con las
salvedades de aceptación documentadas, sin afirmar que todas las pruebas pasaron;
44 pendiente de publicación y piloto autorizado. El detalle verificable está en
[docs/codex-skill-acceptance.md](docs/codex-skill-acceptance.md). No confundir
descubrimiento por app-server con aceptación de la UI de Codex, ni los tests del
SDK con una sesión nativa del modelo. No cambiar políticas de aprobación para
sortear una prueba bloqueada. El cierre autorizado de 43 no autoriza publicar el
candidato ni iniciar 44. No reabrir ni retomar automáticamente las pruebas de 43.

## Invariantes de seguridad

- Nunca guardes secretos, tokens, cookies, credenciales o kubeconfigs en Git.
- No captures contraseñas, valores de formularios sensibles, almacenamiento
  del navegador, cabeceras de autorización ni el DOM completo.
- Todo contexto DOM debe sanearse y limitarse antes de salir del navegador.
- La autorización se comprueba en servidor y debe aislar workspaces y proyectos.
  Toda nueva ruta humana reutiliza `HumanAccess`: no se infieren permisos desde
  enlaces ocultos ni desde el rol mostrado por la SPA.
- Los PAT se generan con 256 bits, se muestran una sola vez y se almacenan con
  Argon2id, fingerprint seguro, scopes, expiración, último uso y revocación.
- Los permisos persistidos de una identidad sólo pueden reducirse. La siguiente
  petición revalida identidad, scopes, proyectos y revocación; nunca confía sólo
  en una conexión abierta o en claims OAuth antiguos.
- Los adjuntos son privados y se sirven mediante autorización o URLs firmadas
  de vida corta.
- MCP no permite parches arbitrarios de base de datos ni acceso implícito a
  otros proyectos.
- Un issue sólo puede apuntar a un Epic de su mismo workspace y proyecto; esta
  regla se aplica en dominio y mediante FK compuesta, no sólo en la interfaz.
- Los listados MCP aplican workspace y allowlist dentro de la consulta, limitan
  cada página a 100 filas y atan el cursor a los filtros autorizados.
- Los comentarios son inmutables, conservan una instantánea atribuida del autor
  y nunca aceptan identidad, origen o fecha enviados por el cliente.
- MCP acepta sólo `POST`, verifica issuer/audience/expiry y PKCE S256 para OAuth,
  y registra un conjunto fijo de herramientas cuyos argumentos valida con Zod.
- Toda mutación MCP exige una clave idempotente; efecto, actividad y respuesta
  se confirman atómicamente, y un mismo agente no puede reutilizar la clave para
  otro payload dentro de la retención de 24 horas.
- Issopen coordina agentes externos; no aloja ni paga inferencia en el MVP.

Estas invariantes sólo pueden relajarse mediante una decisión explícita,
documentada y revisada.

## Desarrollo, despliegue y validación

### Identidad visual aprobada

La [decisión de diseño 0001](docs/design/0001-brand-identity.md), aprobada por el
propietario el 2026-09-07, fija la apertura de seis piezas (variante 07), verde
bosque `#027067` y menta `#6FD9B5`. La fuente de tokens es `src/web/styles.css`;
las cabeceras reutilizan `Brand` con `issopen-icon-v1.png`; el touch icon usa
ese mismo asset transparente.
El favicon usa `issopen-favicon-v2-white.png`, con fondo blanco opaco aprobado
el 2026-09-08 para su lectura en pestañas oscuras. Conservar colores semánticos
de error/advertencia, contraste y
etiquetas textuales. Esta decisión sustituye el azul y wordmark sin logo del
contrato UI inicial; no reinventar la marca en pantallas nuevas.

Los comandos reales se ejecutan desde `apps/issopen`:

```bash
corepack pnpm@11.22.0 install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:web
pnpm test:e2e -- tracker
pnpm test:integration
pnpm build
pnpm dogfood
pnpm test:secrets
pnpm validate
docker compose config --quiet
pnpm test:compose
```

`README.md` documenta la generación local de `.env`, el arranque, bootstrap,
recovery, restart y parada. Los únicos secretos de este corte son
`POSTGRES_PASSWORD` y `BETTER_AUTH_SECRET`; los comandos de owner reciben
`ISSOPEN_OWNER_EMAIL` y `ISSOPEN_OWNER_PASSWORD` sólo en el entorno efímero del
proceso. No los imprimas ni los persistas fuera del `.env` ignorado.
El dogfood añade `ISSOPEN_DOGFOOD_CODE_URL` y, opcionalmente,
`ISSOPEN_DOGFOOD_CODE_TYPE`; son referencias de resultado, no autorización para
acceder al repositorio.

Desde la raíz también es obligatorio:

```bash
make validate
```

Las preferencias `project.showReviewColumn` y `project.showDoneColumn` sólo
controlan la visibilidad del board. Nunca deben mover, borrar ni ocultar de MCP
los tickets; `ready_for_review` continúa siendo el valor estable del contrato y
se presenta a personas como **Ready for Human Review**.

Los cambios productivos deben seguir siendo GitOps. Argo consume
`deploy/argocd.yaml` y `deploy/manifests`; `deploy/values.yaml` es un contrato de
referencia veraz, no el renderer activo. No ejecutes `kubectl apply`, patch ni
upgrades Helm para esta app. Los Secrets se provisionan únicamente mediante
`scripts/provision-production-secrets.sh` desde la fuente ignorada con modo
`0600`; ese comando puede crear Secrets ausentes, pero nunca rotarlos ni
sobrescribirlos. El claim PostgreSQL usa `local-path` con retención de
StatefulSet `Retain`; no es HA ni un backup. Las migraciones siguen siendo
forward-only y el restore productivo continúa diferido, así que conserva el
claim y valida compatibilidad de esquema antes de revertir binarios.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Issopen**

Issopen es un issue tracker abierto y self-hostable para desarrolladores
individuales, mantenedores de proyectos abiertos y sus colaboradores. Comienza
como un tablero sencillo tipo Trello conectado por MCP con ChatGPT y agentes de
programación externos, de modo que una persona pueda convertir una intención en
trabajo trazable, delegarlo y revisar el resultado.

Issopen debe poder gestionar su propio backlog para mejorar mediante el mismo
bucle que ofrece a otros proyectos. Sobre esa base añade captura visual segura,
epics de auditoría y un servicio Cloud que cobra por operación y capacidad, no
por ocultar el flujo principal.

**Core Value:** Convertir una intención humana en trabajo estructurado y seguro que ChatGPT y
agentes de código externos puedan entender, ejecutar y devolver a revisión
dentro de un único flujo trazable.

### Constraints

- **Proceso**: no comienza la implementación hasta aprobar PROJECT.md,
  REQUIREMENTS.md y ROADMAP.md — evita convertir el brief en código sin validar.
- **Open source**: todo el producto será abierto; AGPLv3 es la licencia objetivo
  pendiente de revisión legal — no diseñar fronteras artificiales de código
  cerrado.
- **Modelo de IA**: Issopen coordina agentes externos mediante MCP y BYO-AI — no
  ejecuta ni financia inferencia en el MVP.
- **Autoprogramación**: significa dogfooding agentico gobernado — Issopen
  conserva backlog, permisos y auditoría, pero no se modifica, fusiona código
  ni se despliega a sí mismo sin sistemas externos y aprobación explícita.
- **Autorización**: las identidades agenticas usan permisos configurables,
  scopes y alcance por proyecto — la autonomía total nunca es acceso implícito.
- **Privacidad**: capturas y DOM se revisan, sanean y minimizan antes de enviarse
  — nunca se capturan secretos, cookies, tokens ni valores sensibles por defecto.
- **Colaboración**: workspaces con roles humanos sencillos y agentes separados —
  organizaciones y políticas enterprise quedan fuera de v1.
- **Navegador**: la primera extensión cubre Chromium Manifest V3 — no asumir
  compatibilidad Firefox/Safari sin una fase propia.
- **Arquitectura**: empezar con un backend desplegable y cortes verticales
  pequeños — no microservicios ni paquetes sin responsabilidad real.
- **Git**: un único repositorio en la raíz del homelab — nunca crear `.git`
  dentro de `apps/issopen`.
- **Despliegue**: no existe todavía imagen, puerto real, dominio ni producción —
  se decidirán después de investigar stack y operación.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recomendación ejecutiva
## Decisiones que deben fijarse ahora
| Área | Decisión | Motivo y efecto sobre self-hosting | Confianza |
|---|---|---|---|
| Runtime | Node.js 24 LTS, ESM | Es la línea LTS actual; Node 26 sigue en `Current` hasta octubre de 2026. Un runtime único reduce diferencias entre Cloud, Compose y homelab. | HIGH |
| Lenguaje | TypeScript 6.0.x inicialmente | TS 7.0 es estable y mucho más rápido, pero todavía no expone una API programática estable. TS 6 es el ancla compatible para WXT y tooling hasta probar TS 7.1. | HIGH |
| Web | React SPA + Vite; no Next.js | No hay requisito SSR/SEO en el producto autenticado. El resultado estático se sirve desde el backend y funciona igual en cualquier host. | HIGH |
| Backend | Hono sobre Node; REST `/api/v1` + `/mcp` en el mismo proceso | Hono usa `Request`/`Response` Web Standard y tiene adaptador oficial Node y adaptador oficial MCP. Un solo deployable, sin microservicios. | HIGH |
| Contratos | Zod 4 como validación en frontera + OpenAPI 3.1 como contrato externo | Web y extensión pueden compartir schemas publicados; clientes externos no dependen de inferencia TypeScript interna. | HIGH |
| MCP | Especificación `2026-07-28`, SDK TypeScript v2, Streamable HTTP stateless | Es el transporte Remote MCP vigente; el modo stateless evita afinidad de sesión/Redis y escala igual en Compose o Cloud. | HIGH |
| Auth web | Better Auth sobre las tablas PostgreSQL de Issopen | Soporta GitHub, magic link y adaptador Drizzle sin un servicio de identidad propietario. | HIGH |
| Auth MCP | Better Auth MCP + CIMD + OAuth 2.1/RFC 9728; PAT como vía adicional, no sustitutiva | Entrega discovery y tokens ligados al recurso. Community opera su propio authorization server dentro del mismo backend. | MEDIUM-HIGH |
| Datos | PostgreSQL 18; Drizzle ORM y migraciones SQL versionadas | Es portable entre contenedor y proveedores gestionados. No se requiere extensión propietaria. | HIGH |
| Ficheros | API S3 mediante AWS SDK v3; SeaweedFS sólo como default de Compose | El código funciona con SeaweedFS, S3, R2, B2 u otro S3 compatible. El proveedor está fuera del dominio. | HIGH para el contrato; MEDIUM para SeaweedFS como default |
| Monorepo | pnpm workspaces + Turborepo | Hay tres artefactos reales y contratos compartidos. Turbo sólo coordina tareas/caché; no define arquitectura ni exige cache remoto. | HIGH |
| Observabilidad | JSON a stdout con Pino + trazas/métricas OTLP opcionales | Funciona sin SaaS y puede conectarse a cualquier collector. Los eventos de auditoría siguen siendo datos del producto. | HIGH |
| Distribución | Una imagen OCI para web/API/MCP; ZIP/CRX separado para la extensión | Cloud y Community prueban el mismo binario. Las migraciones se ejecutan como comando/job explícito. | HIGH |
## Versiones de referencia verificadas
### Runtime y toolchain
| Tecnología | Baseline exacto | Política de adopción | Uso |
|---|---:|---|---|
| Node.js | `24.19.0` LTS | Adoptar ahora; `engines: >=24 <25`; imagen exacta y digest | Runtime de API, build web/extension, migraciones y tests |
| pnpm | `11.22.0` | Fijar en `packageManager` con hash de integridad | Instalación reproducible y workspaces |
| TypeScript | `6.0.3` | Fijar ahora; reevaluar TS `7.1+`, no TS `7.0.2` en foundation | Typecheck y emisión del backend |
| Turborepo | `2.10.11` | Fijar patch; caché local/CI, sin dependencia de Vercel Remote Cache | Grafo `dev/build/test/typecheck` |
| Biome | `2.5.10` | Fijar patch | Formato y lint sintáctico; `tsc` conserva el typecheck |
### Aplicación web
| Tecnología | Baseline exacto | Uso | Nota de portabilidad |
|---|---:|---|---|
| React / React DOM | `19.2.8` | UI de web y extensión | Misma versión exacta en ambos artefactos |
| Vite | `8.2.2` | Dev server y build SPA | Produce estáticos; no impone plataforma de hosting |
| `@vitejs/plugin-react` | `6.1.0` | React Refresh/transform | Fijar junto con Vite |
| TanStack Router | `1.170.32` | Routing tipado de la SPA | Sólo cliente; las reglas de acceso siguen en API |
| TanStack Query | `5.102.1` | Estado remoto, invalidación y mutaciones | No usarlo como estado de dominio |
| Tailwind CSS | `4.3.3` | Estilos | Build local; ninguna CDN runtime |
| shadcn CLI | `4.19.0` | Copiar componentes iniciales | Ejecutar sólo al incorporar componentes y versionar el código generado |
| Radix primitives | familia `1.x` | Accesibilidad de componentes complejos | Añadir únicamente primitivas realmente usadas |
| dnd-kit | `@dnd-kit/core 6.3.1`, `@dnd-kit/sortable 10.0.0` | Kanban accesible por puntero/teclado | Debe verificarse con Playwright y teclado real |
### API, contratos y dominio
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Hono | `4.13.3` | Router HTTP y middleware | El dominio no importa tipos de Hono |
| `@hono/node-server` | `2.1.1` | Adaptador Node y servicio de estáticos | Único entrypoint de producción |
| Zod | `4.4.3` | Validación de env, requests, responses, payloads MCP | Parsear en toda frontera; tipos TS no sustituyen validación |
| `@hono/zod-openapi` | `1.6.1` | REST versionada y OpenAPI | Generar y comprobar el documento en CI |
| Pino | `10.3.1` | Logs JSON estructurados | Redactar cookies, authorization, tokens, DOM y URLs firmadas |
### Remote MCP
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| MCP protocol | `2026-07-28` | Revisión de protocolo ofrecida por `/mcp` | Conservar compatibilidad legacy stateless mientras los clientes reales la necesiten |
| `@modelcontextprotocol/server` | `2.0.0` | `McpServer`, tools y `createMcpHandler` | No usar el monolítico `@modelcontextprotocol/sdk` v1 |
| `@modelcontextprotocol/hono` | `2.0.0` | Adaptador oficial del handler Web Standard a Hono | Misma versión que server/core/client |
| `@modelcontextprotocol/client` | `2.0.0` | Tests automáticos de interoperabilidad | No es dependencia de producción del servidor |
| `@better-auth/mcp` | `1.7.1` | Authorization server/protected resource MCP | Fijar junto con todo Better Auth |
| `@better-auth/cimd` | `1.7.1` | Client ID Metadata Documents | Usar perfil `mcp-2026-07-28` |
### Extensión Chromium
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| WXT | `0.21.4` | Build, entrypoints, manifest y packaging | Target único MV3/Chromium en v1 |
| `@wxt-dev/module-react` | `1.2.2` | React dentro de popup/editor/content UI | React exacto compartido con web |
| Manifest | `manifest_version: 3` | Service worker y content scripts | Nada de background page persistente ni código remoto |
| Chrome APIs | `sidePanel`, `identity`, `storage`, `clipboardRead` opcional | Imágenes externas por gesto y login (0.5) | Sin acceso a webs ni lectura automática del clipboard |
### PostgreSQL, ORM y migraciones
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| PostgreSQL | `18.6` | Estado transaccional, auth, cuotas, auditoría | Misma major en dev/CI/Compose; Cloud puede ser servicio gestionado compatible |
| Drizzle ORM | `0.45.2` | Schema y queries tipadas | No esconder SQL complejo; constraints viven en DB |
| Drizzle Kit | `0.31.10` | Generación/check/aplicación de migraciones | `generate` + revisión + `migrate`; nunca `push` en entornos compartidos |
| Postgres.js | `3.4.9` | Driver PostgreSQL de Node | Pool limitado y configurable; una sola implementación de driver |
### Autenticación humana, agentes y correo
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Better Auth | `1.7.1` | Sesiones web, GitHub OAuth, magic link y OAuth MCP | Tablas en el mismo PostgreSQL; secretos sólo por entorno |
| Nodemailer | `9.0.5` | Transporte SMTP para magic links | Community configura cualquier SMTP; Mailpit en local |
### Almacenamiento de capturas y adjuntos
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| `@aws-sdk/client-s3` | `3.1116.0` | Cliente S3 portable | Fijar toda la cohorte AWS SDK en el mismo release |
| `@aws-sdk/s3-request-presigner` | `3.1116.0` | PUT/GET firmados de vida corta | Bucket siempre privado; el API decide key, tamaño y TTL |
| `file-type` | `22.0.2` | Comprobación de tipo por contenido | No confiar en extensión ni `Content-Type` del cliente |
| Sharp | `0.35.3` | Re-encode/normalización de imágenes | Validar binarios amd64/arm64 en CI antes de adoptarlo |
| SeaweedFS | `4.41` | Proveedor S3 incluido en Docker Compose Community | Servicio interno; no publicar UIs/admin al exterior |
### Testing
| Tecnología | Baseline exacto | Cobertura prioritaria |
|---|---:|---|
| Vitest | `4.1.11` | Dominio, authz, cuotas, sanitización DOM, selectors y handlers |
| `@vitest/browser-playwright` | `4.1.11` | Componentes con navegador real cuando aporte valor |
| Playwright | `1.62.1` | E2E web y extensión MV3 empaquetada |
| Testcontainers PostgreSQL | `12.1.0` | Integración con PostgreSQL 18 real y migraciones desde cero |
| MSW | `2.15.0` | Simular API sólo en tests de UI/extension, no en aceptación E2E |
| MCP client SDK | `2.0.0` | Tests de initialize/discovery, auth, tools, errores y scopes |
### Observabilidad
| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Pino | `10.3.1` | Logs JSON stdout | Siempre disponible, incluso sin collector |
| OpenTelemetry API | `1.9.1` | API neutral de instrumentación | No acoplar el dominio al SDK |
| OpenTelemetry Node SDK | `0.221.0` | Trazas y métricas | Activación por env; export OTLP configurable |
| OTel auto-instrumentations | `0.79.0` | HTTP/PostgreSQL y runtime | Lista explícita de instrumentaciones, no “todo” sin revisar |
## Layout recomendado
## Topología portable
### Community / Docker Compose
- Una imagen `issopen` contiene el JS del backend y los estáticos Vite.
- `postgres:18.6` usa volumen y healthcheck; backup/restore se documenta antes del release Community.
- `seaweedfs:4.41` ejecuta el modo S3 single-node con volumen; sólo el endpoint S3 queda accesible a la red interna.
- Mailpit se habilita sólo con perfil de desarrollo; producción exige SMTP real.
- El comando de migración es explícito e idempotente; la app no modifica el schema en startup.
- Ningún dominio, GitHub OAuth app, SMTP ni storage credential viene hardcodeado.
### Issopen Cloud
- Ejecuta la misma imagen y el mismo comando de migración.
- Puede usar PostgreSQL y S3 gestionados, pero sólo mediante los contratos estándar.
- CDN, WAF, backups, autoscaling y lifecycle del bucket son infraestructura, no imports del producto.
- Multi-tenancy se mantiene lógica por workspace en las mismas tablas; no se crea una variante Cloud del dominio.
### Homelab / Kubernetes posterior
## Configuración portable mínima
## Cohortes que deben actualizarse juntas
| Cohorte | Paquetes/versiones de referencia | Verificación obligatoria |
|---|---|---|
| React | `react`, `react-dom` `19.2.8` | Build web + extension, hydration no aplica |
| Vite | `vite 8.2.2`, plugin React `6.1.0` | Build production y HMR web |
| MCP | todos `@modelcontextprotocol/* 2.0.0` | protocolo moderno + fallback legacy decidido explícitamente |
| Better Auth | `better-auth`, `@better-auth/mcp`, `@better-auth/cimd` `1.7.1` | migración schema, web login, consent y cliente MCP real |
| AWS SDK | S3 client/presigner `3.1116.0` | SeaweedFS + proveedor Cloud elegido |
| OTel | SDK/exporters `0.221.0`; API `1.9.1` | startup ESM, shutdown y export deshabilitado |
| Vitest | core/browser `4.1.11` | unit + browser mode |
| Drizzle | ORM `0.45.2`, Kit `0.31.10`, driver `3.4.9` | generar, DB vacía, upgrade y rollback ensayado |
## Dependencias iniciales propuestas
# Workspace tooling
# API/domain
# Database/auth/MCP/storage
# Web
# Extension
## Qué evitar explícitamente
| Evitar | Por qué | Usar en su lugar |
|---|---|---|
| Next.js 16 como web principal | Duplica servidor/routing/caché y no evita la API requerida por extensión/MCP; SSR no valida el producto. | React 19 SPA + Vite 8, servida por Hono |
| Supabase Auth/Storage/RLS como arquitectura | Convierte Community en una instalación de Supabase o en una implementación distinta; reparte authz entre API y políticas proveedor-específicas. | Better Auth + PostgreSQL normal + S3 API; Supabase sólo podría ser un PG gestionado |
| MinIO Community en Compose | Proyecto archivado/source-only y releases finales con vulnerabilidad sin parche Community. | SeaweedFS 4.41 por defecto; cualquier S3 externo soportado |
| Node 26 en producción ahora | Sigue en Current el 2026-08-23. | Node 24 LTS; evaluar Node 26 tras LTS y matriz de dependencias |
| TypeScript 7.0.2 en foundation | No tiene todavía API programática estable; riesgo innecesario con tooling. | TS 6.0.3; spike de TS 7.1 cuando exista |
| SDK MCP v1 / endpoint SSE antiguo | Es la línea/protocolo anterior y obliga a migración inmediata. | Paquetes v2 + Streamable HTTP `2026-07-28` |
| OAuth MCP casero o PAT-only | Reduce interoperabilidad, discovery y seguridad; construir un AS correcto es trabajo especializado. | Better Auth MCP/CIMD; PAT adicional con hash/scopes |
| Hono RPC como único contrato | Acopla cliente y servidor a la misma versión/tipos y no sirve a terceros. | REST OpenAPI + Zod compartido; MCP schemas separados |
| `drizzle-kit push` en staging/prod | Cambia schema sin historial SQL revisable ni plan de rollout. | `generate`, revisar, commit, `migrate` explícito |
| SQLite en tests de persistencia | Oculta comportamiento PostgreSQL y aislamiento real. | Testcontainers con PostgreSQL 18.6 |
| Bun/Deno/Workers como runtime canónico | Aumenta la matriz de auth/driver/storage sin aportar al MVP. | Node 24; Hono conserva una posible portabilidad futura |
| Bucket público o proxy de base64 por MCP | Rompe privacidad y dispara memoria/ancho de banda. | Bucket privado + URLs firmadas cortas + metadata MCP |
| `<all_urls>` en la extensión | Acceso persistente excesivo y warning de instalación. | `activeTab` + `scripting` después de gesto explícito |
| Service worker MV3 como estado durable | Chrome puede terminarlo; produce pérdidas y carreras. | Estado transitorio en `chrome.storage`/IndexedDB y servidor como autoridad |
| Sentry u otro SaaS obligatorio | Community deja de ser autónomo. | stdout JSON + OTLP opcional; adaptadores Cloud opcionales |
| Kubernetes/microservicios/colas en el producto inicial | No validan captura → issue → MCP y empeoran Community. | Un proceso Node y jobs DB-driven sólo cuando haya necesidad medida |
## Política de pinning para la implementación
## Riesgos y comprobaciones pendientes
| Tema | Riesgo | Acción antes de adoptar | Confianza |
|---|---|---|---|
| Better Auth 1.7 + MCP SDK 2 | Ambos releases son recientes y la superficie OAuth/CIMD es sensible. | Spike con Codex y Claude reales, consent, refresh, revocación, scopes y DPoP; revisar migrations generadas. | MEDIUM |
| TypeScript 7 | TS 7.0 no tiene API programática; retrasarlo pierde rendimiento, adoptarlo puede romper tooling. | Repetir matriz con WXT, Drizzle, Vite, Biome y SDK MCP cuando 7.1 sea estable. | HIGH sobre el riesgo |
| SeaweedFS `weed mini` | Adecuado para dev/single-node, no demuestra HA ni hardening; UIs administrativas requieren aislamiento. | Compose sólo publica app; backup/restore y upgrade probados; documentar S3 externo para producción seria. | MEDIUM |
| S3 compatibility | “S3-compatible” no garantiza idéntico CORS, checksums, signed POST, path-style o multipart. | Suite contractual contra SeaweedFS y el proveedor Cloud elegido. | HIGH |
| WXT 0.x | Sigue antes de 1.0 y puede introducir cambios de tooling. | Pin exacto; fixture build/package y upgrade notes antes de actualizar. | MEDIUM-HIGH |
| Drizzle ORM 0.x | API aún 0.x y Kit tiene versionado separado. | Pin cohortes, revisar SQL y no dejar migrations en manos del startup. | MEDIUM-HIGH |
| Sharp | Binarios nativos y formatos de imagen amplían superficie. | Probar amd64/arm64; límites de pixels, decode time y memoria; considerar omitirlo en el primer upload vertical. | MEDIUM |
## Fuentes primarias adicionales
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [pnpm releases](https://github.com/pnpm/pnpm/releases)
- [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [React versions](https://react.dev/versions)
- [Vite releases](https://vite.dev/blog)
- [Hono releases](https://github.com/honojs/hono/releases)
- [WXT releases](https://github.com/wxt-dev/wxt/releases)
- [Zod releases](https://github.com/colinhacks/zod/releases)
- [Drizzle repository/releases](https://github.com/drizzle-team/drizzle-orm)
- [Better Auth releases](https://github.com/better-auth/better-auth/releases)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [PostgreSQL supported versions](https://www.postgresql.org/support/versioning/)
- [Vitest releases](https://vitest.dev/blog)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
## Confidence assessment
| Área | Nivel | Motivo |
|---|---|---|
| Runtime/toolchain | HIGH | LTS y releases oficiales claros; TS 7 documenta explícitamente su límite de API. |
| Web/API | HIGH | React/Vite/Hono son estables; la elección SPA deriva directamente del producto autenticado y del backend obligatorio. |
| Extension | MEDIUM-HIGH | WXT está activo y Chrome APIs están documentadas, pero WXT sigue 0.x y las políticas Web Store evolucionan. |
| Database/migrations | HIGH | PostgreSQL 18.6 y el flujo de migraciones están documentados oficialmente. |
| Auth | MEDIUM-HIGH | Better Auth cubre el alcance y es portable, pero 1.7/MCP requieren spike de seguridad e interoperabilidad. |
| MCP | MEDIUM-HIGH | Spec y SDK v2 son actuales y oficiales, pero muy recientes al 2026-08-23. |
| Storage | HIGH para S3; MEDIUM para el default Compose | El contrato AWS es estable; SeaweedFS debe validarse operacionalmente y no prometer HA con `weed mini`. |
| Testing/observability | HIGH | Herramientas y límites están documentados; OTel browser se excluye por su estado experimental. |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
