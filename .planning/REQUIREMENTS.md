# Requirements: Issopen

**Defined:** 2026-08-23
**Core Value:** Convertir una intención humana en trabajo estructurado y seguro
que ChatGPT y agentes de código externos puedan entender, ejecutar y devolver a
revisión dentro de un único flujo trazable.

## v1 Requirements

### Identidad, workspace y activación

- [ ] **AUTH-01**: Una persona puede registrarse e iniciar sesión mediante
  GitHub OAuth sin crear una contraseña de Issopen.
- [ ] **AUTH-02**: Una persona puede registrarse e iniciar sesión mediante un
  enlace mágico de un solo uso enviado a su email.
- [ ] **AUTH-03**: Una misma persona puede vincular sus métodos GitHub y email
  sin crear cuentas duplicadas ni permitir que otra persona reclame su cuenta.
- [ ] **AUTH-04**: Una persona puede consultar sus sesiones activas, cerrar la
  sesión actual y revocar las demás sesiones.
- [x] **AUTH-05**: El despliegue privado permite inicializar exactamente un
  owner y protege web, API y Remote MCP; ninguna lectura o escritura de datos
  del tracker queda disponible de forma anónima.
- [x] **WRKS-01**: La primera entrada crea un workspace personal y permite
  cambiar su nombre sin intervención administrativa.
- [ ] **WRKS-02**: Un owner o admin puede invitar colaboradores por email,
  consultar invitaciones pendientes y revocarlas; el invitado puede aceptar o
  rechazar la invitación.
- [ ] **WRKS-03**: Los roles humanos `owner`, `admin` y `member` tienen permisos
  definidos y aplicados en el servidor para membresía, proyectos y ajustes.
- [ ] **WRKS-04**: Ningún usuario, agente o enlace de archivo puede leer o
  modificar recursos de un workspace al que no pertenece.
- [ ] **ONBD-01**: El usuario dispone de un checklist reanudable y descartable
  para crear su primer proyecto, issue, captura desde la extensión y conexión
  MCP, con cada paso completado a partir de hechos reales del sistema.
- [x] **WEB-01**: El flujo principal se ofrece como web HTML responsive usable
  desde navegadores normales de escritorio y móvil; v1 no requiere aplicación
  de escritorio nativa ni empaquetada.

### Proyectos, issues y Kanban

- [x] **PROJ-01**: Un miembro autorizado puede crear un proyecto con nombre,
  clave estable y descripción, y puede editar esos datos sin cambiar los
  identificadores de sus issues.
- [x] **PROJ-02**: Un proyecto puede guardar como contexto opcional la URL de un
  repositorio Git, su rama por defecto y un subdirectorio del repositorio.
- [ ] **PROJ-03**: Un admin puede archivar y restaurar un proyecto; archivarlo
  impide nuevas mutaciones sin borrar su historial ni sus archivos.
- [x] **ISSU-01**: Una persona puede crear rápidamente un issue desde la web con
  título, descripción y proyecto, obteniendo una clave legible, estable y no
  reutilizable.
- [x] **ISSU-02**: Una persona autorizada puede editar título, descripción,
  prioridad y estado de un issue; etiquetas y asignación colaborativa se añaden
  sin cambiar el contrato básico del ticket.
- [ ] **ISSU-03**: Los issues admiten prioridades y etiquetas de proyecto
  reutilizables, visibles tanto en la ficha como en el tablero.
- [ ] **ISSU-04**: Una persona puede buscar por clave o texto y filtrar issues
  por proyecto, estado, prioridad, etiqueta, responsable, reclamación agentica
  y pertenencia a una auditoría.
- [x] **ISSU-05**: El responsable humano y el agente que reclama el trabajo son
  campos independientes, de modo que una reclamación nunca sustituye el
  ownership humano.
- [ ] **ISSU-06**: Personas y agentes autorizados pueden añadir comentarios; la
  web permite menciones a miembros y muestra claramente el autor y la fecha.
- [x] **ISSU-07**: Una persona o agente autorizado puede asociar enlaces a
  branch, commit o pull request, indicando el tipo y el resultado entregado sin
  requerir una GitHub App.
- [ ] **ISSU-08**: Un miembro puede archivar y restaurar un issue sin perder sus
  comentarios, adjuntos, relaciones, referencias de código ni actividad.
- [x] **BOARD-01**: Cada proyecto ofrece un Kanban simple con las fases
  semánticas fijas `Backlog`, `Ready`, `In Progress`, `Ready for Review` y
  `Done`, compartidas por la web y las herramientas MCP.
- [x] **BOARD-02**: Una persona puede mover un issue entre estados mediante un
  control responsive y accesible por teclado; el cambio persiste y aparece en
  la actividad, sin exigir drag-and-drop en el primer MVP.
- [x] **ACTV-01**: Cada mutación aceptada genera en la misma operación un evento
  inmutable con actor humano, agente o sistema, origen, fecha y cambios
  relevantes; una mutación no puede quedar aplicada sin su evento.
- [x] **ACTV-02**: La ficha del issue presenta una cronología mínima de cambios,
  reclamaciones y referencias de código, mostrando actor y fecha; comentarios,
  adjuntos y filtros se incorporan cuando existan esas superficies.
- [ ] **NOTF-01**: La web ofrece notificaciones mínimas para invitaciones,
  menciones, asignaciones y paso a `Ready for Review`, enlazadas al recurso que
  las originó.
- [ ] **NOTF-02**: Cada usuario puede marcar notificaciones como leídas y silenciar
  un issue o proyecto sin impedir que la actividad siga quedando registrada.

### Archivos y captura visual segura

- [ ] **FILE-01**: Capturas y adjuntos se almacenan como privados, con validación
  de tipo, tamaño e integridad antes de asociarlos a un workspace e issue.
- [ ] **FILE-02**: La lectura de un archivo privado requiere autorización vigente
  y usa acceso de corta duración; una URL obtenida en otro tenant o ya caducada
  no permite descargarlo.
- [ ] **FILE-03**: La creación y eliminación de adjuntos contabiliza cuota de
  forma consistente y limpia reservas, cargas incompletas y objetos huérfanos.
- [ ] **CAPT-01**: Existe una extensión Manifest V3 instalable y reproducible para
  Chrome, Edge y Brave, identificada con la versión de Issopen que la generó.
- [ ] **CAPT-02**: Desde una acción explícita del usuario, la extensión permite
  capturar el viewport visible completo o dibujar un recorte libre de éste; la
  captura por scroll de toda la página no forma parte de v1.
- [ ] **CAPT-03**: Una captura puede incluir URL, título, fecha, tamaño del
  viewport, posición de scroll y navegador, mostrando esos datos antes del
  envío.
- [ ] **CAPT-04**: El usuario puede seleccionar un elemento y adjuntar sus
  límites, un selector estable, texto limitado y un fragmento DOM acotado y
  saneado que conserve contexto útil sin copiar la página completa.
- [ ] **CAPT-05**: Antes de enviar, el usuario ve exactamente la imagen y los
  campos que recibirá Issopen y puede omitir individualmente URL, metadatos,
  elemento o DOM.
- [ ] **CAPT-06**: El usuario puede ocultar zonas de la imagen de forma
  destructiva; cookies, tokens, storage, contraseñas, campos sensibles y
  valores ocultos nunca se incluyen por defecto ni sobreviven en una versión
  original subida al servidor.
- [ ] **CAPT-07**: Antes del envío se pueden añadir rectángulos, flechas, trazos
  libres y texto sobre la captura sin modificar la página inspeccionada.
- [ ] **CAPT-08**: La extensión conserva localmente un borrador no enviado,
  permite reintentar tras un error sin repetir la captura y evita crear issues
  duplicados por reintentos de red.
- [ ] **CAPT-09**: Tras enviar, la extensión confirma proyecto, clave y enlace del
  issue creado, y permite abrirlo inmediatamente.
- [ ] **CAPT-10**: La extensión solicita permisos mínimos, sólo captura tras un
  gesto explícito y explica qué datos inspeccionará antes de acceder a la
  página o transmitir contenido.

### Identidades agenticas y permisos

- [x] **AGNT-01**: Un admin puede crear una identidad agentica con nombre y
  descripción, y cualquier secreto directo asociado se muestra una sola vez y
  se almacena únicamente mediante un hash no reversible.
- [x] **AGNT-02**: Cada identidad agentica recibe scopes explícitos y una lista
  permitida de proyectos; no obtiene acceso por herencia implícita a todo el
  workspace.
- [x] **AGNT-03**: Un admin puede revocar o caducar una identidad o credencial y
  consultar su último uso sin borrar la actividad histórica atribuida a ella.
- [x] **AGNT-04**: La interfaz de actividad distingue acciones humanas,
  agenticas y del sistema y muestra la identidad concreta responsable de cada
  acción.
- [x] **AGNT-05**: Un agente autorizado puede reclamar y liberar un issue; la
  reclamación tiene fecha y no sustituye ni bloquea la decisión del owner.
- [x] **AGNT-06**: Un agente puede llevar trabajo a `Ready for Review`; pasar a
  `Done` o cerrar un issue requiere un scope independiente concedido de forma
  explícita.
- [ ] **AGNT-07**: Reducir scopes, quitar un proyecto o revocar una credencial
  tiene efecto en nuevas solicitudes sin invalidar la trazabilidad de acciones
  ya realizadas.

### Remote MCP

- [x] **MCP-01**: Issopen publica un Remote MCP autenticado: ChatGPT puede
  completar el flujo OAuth 2.1 con PKCE necesario para herramientas privadas y
  el agente de código externo usa un PAT revocable, almacenado mediante hash y
  ligado a su identidad separada; nunca existe escritura MCP anónima.
- [x] **MCP-02**: Un agente autorizado puede listar sus proyectos e issues con
  filtros y paginación, sin conocer ni inferir recursos fuera de su allowlist.
- [x] **MCP-03**: Un cliente autorizado puede obtener un paquete acotado de un
  issue con descripción, estado, contexto ligero de repositorio, actividad
  relevante y referencias de código, respetando sus permisos; evidencia visual
  y auditorías se incorporan después sin cambiar la identidad del issue.
- [ ] **MCP-04**: MCP entrega adjuntos mediante referencias autorizadas y
  temporales, no como imágenes privadas incrustadas permanentemente en las
  respuestas o logs del protocolo.
- [ ] **MCP-05**: Un agente con scope de creación puede crear un issue o hallazgo
  con proyecto, contenido, prioridad, etiquetas y auditoría permitidos, quedando
  identificado como origen agentico.
- [x] **MCP-06**: Un agente con scope de trabajo puede reclamar y liberar issues,
  y consultar si otro agente mantiene una reclamación vigente.
- [x] **MCP-07**: Un agente autorizado puede comentar, actualizar campos
  permitidos, enlazar branch/commit/PR, cambiar de estado y cerrar sólo cuando
  dispone del scope específico para cada operación.
- [ ] **MCP-08**: Las mutaciones MCP aceptan una clave de idempotencia y una
  versión esperada del recurso, de modo que reintentos y escrituras concurrentes
  no dupliquen ni sobrescriban silenciosamente trabajo.
- [ ] **MCP-09**: El flujo de descubrimiento, autenticación y herramientas se
  valida de extremo a extremo con ChatGPT Work y con al menos un agente de
  código externo real, Codex u otro seleccionado para el dogfooding; la
  compatibilidad con otros clientes no bloquea el primer MVP.
- [x] **MCP-10**: Texto, HTML y DOM procedentes de un issue se tratan como datos
  no confiables: no pueden ampliar scopes, cambiar de proyecto ni provocar una
  herramienta distinta de la solicitada y autorizada por el cliente.
- [x] **MCP-11**: Una persona puede añadir la URL MCP desplegada como plugin
  personal en ChatGPT, completar OAuth, instalarlo e invocar desde ChatGPT Work
  herramientas de lectura y escritura dentro de sus scopes.

### Dogfooding y evolución agentica

- [ ] **DOGF-01**: Antes de ampliar el MVP con captura visual, el equipo puede
  gestionar en Issopen una mejora real de Issopen: priorizarla desde ChatGPT,
  hacer que un agente de código externo la reclame y entregue un branch, commit
  o PR, y aceptar o rechazar el resultado mediante revisión humana trazada.

### Epics de auditoría

- [ ] **AUDT-01**: Una persona puede crear un epic de auditoría con proyecto,
  título, objetivo, alcance, owner y categorías que incluyan al menos visual,
  UX, flujos, código, SEO, seguridad y compliance.
- [ ] **AUDT-02**: Issues creados por personas, extensión o agentes pueden
  enlazarse y desenlazarse de una auditoría conservando su origen, autor y
  actividad propios.
- [ ] **AUDT-03**: La auditoría muestra y filtra hallazgos por estado, categoría,
  fuente, responsable humano y agente reclamante.
- [ ] **AUDT-04**: La auditoría calcula un resumen vivo y determinista de alcance,
  recuentos y progreso a partir de sus issues, sin inventar conclusiones ni
  depender de inferencia oculta.
- [ ] **AUDT-05**: Un agente con los scopes y proyecto adecuados puede leer una
  auditoría, crear o enlazar hallazgos y actualizar sus issues mediante MCP.
- [ ] **AUDT-06**: Sólo una persona autorizada puede completar o reabrir una
  auditoría; ningún scope agentico permite completar el epic.
- [ ] **AUDT-07**: La UI diferencia `auditoría completada` de una certificación y
  no presenta los hallazgos como prueba automática de seguridad, accesibilidad
  o cumplimiento normativo.

### Community, portabilidad y releases

- [ ] **COMM-01**: El flujo v1 completo —incluidos captura, auditorías y MCP— se
  publica como código abierto y puede ejecutarse sin llamar a un servicio
  propietario de Issopen Cloud; la licencia definitiva se aprueba legalmente
  antes de la primera release pública.
- [x] **COMM-02**: El primer despliegue privado se levanta con un único
  procedimiento Docker Compose simple que incluye Issopen y PostgreSQL,
  conserva configuración y datos al repetirlo y no exige S3, SMTP ni OAuth
  social antes de necesitarlos.
- [ ] **COMM-03**: Community admite PostgreSQL, almacenamiento compatible con S3,
  SMTP y proveedores OAuth mediante configuración documentada y nombres de
  secretos, sin credenciales incluidas en el repositorio.
- [ ] **COMM-04**: Cada release incluye migraciones explícitas, prueba una
  instalación limpia y documenta actualización desde la versión anterior y el
  rollback cuando la migración lo permita.
- [ ] **COMM-05**: Un operador puede hacer backup y restaurar de forma conjunta
  base de datos y objetos, y una restauración se verifica antes de considerar
  estable la release Community.
- [ ] **COMM-06**: La distribución expone health/readiness, versión y errores de
  configuración accionables, y documenta instalación, configuración, upgrade,
  backup, restauración y diagnóstico.

### Cloud Free y modelo freemium

- [ ] **CLOD-01**: Una persona puede completar en Cloud Free el mismo bucle
  principal de Community: proyecto, issue, captura, auditoría, conexión MCP,
  trabajo agentico y revisión humana.
- [ ] **CLOD-02**: Cloud usa los mismos artefactos, migraciones y contratos
  públicos que Community; una diferencia operativa no introduce una función
  cerrada exclusiva del servicio alojado.
- [ ] **CLOD-03**: Workspace y administradores ven en un único lugar consumo,
  límites y periodo de cada recurso limitado antes de alcanzarlo.
- [ ] **CLOD-04**: Al alcanzar un límite de capacidad se bloquea sólo el
  crecimiento relacionado y se conservan lectura, descarga, comentarios de
  texto, archivado y eliminación; los datos existentes no quedan secuestrados.
- [ ] **CLOD-05**: Un owner puede exportar los datos y referencias de archivos de
  su workspace y solicitar su eliminación con estado y plazo visibles.
- [ ] **CLOD-06**: Cloud aplica aislamiento por tenant, rate limits, protección de
  abuso, backups y monitorización sin reducir las garantías de autorización de
  Community.
- [ ] **CLOD-07**: Los límites exactos del plan Free se publican sólo después de
  medir costes reales y se mantienen configurables y visibles, sin valores
  mágicos dispersos por el código.
- [ ] **CLOD-08**: Los planes de pago amplían capacidad, retención, operación o
  soporte, pero no desbloquean herramientas o flujos funcionales que falten en
  Community.

### Seguridad, accesibilidad y operación

- [ ] **SECU-01**: Toda autorización se decide en el servidor y se prueba frente
  a acceso horizontal y vertical entre workspaces, proyectos, roles e
  identidades agenticas.
- [ ] **SECU-02**: OAuth, magic links, sesiones y credenciales MCP validan origen,
  audiencia, expiración y revocación, y nunca aparecen en URLs persistidas,
  respuestas de error o logs.
- [ ] **SECU-03**: La ingestión de URL, HTML y archivos limita tamaño y
  complejidad, valida contenido real y bloquea SSRF, tipos engañosos, bombas de
  imagen y ejecución activa.
- [x] **SECU-04**: Los eventos de actividad derivan del actor autenticado y de la
  mutación aceptada en el servidor; el cliente no puede falsificar autor,
  origen, fecha ni cambios auditados.
- [ ] **ACCS-01**: Registro, creación de proyecto e issue, Kanban, revisión de
  captura, auditoría y administración de agentes son utilizables con teclado,
  foco visible, nombres accesibles y contraste conforme al objetivo WCAG 2.2 AA.
- [ ] **OPER-01**: Web, extensión y MCP devuelven errores accionables con un
  identificador de solicitud correlacionable, sin exponer secretos ni datos de
  otro tenant.
- [ ] **OPER-02**: Métricas y logs permiten observar autenticación, autorización,
  latencia MCP, errores de captura, colas de archivos, cuota y restores sin
  registrar capturas, DOM, tokens ni contenido privado por defecto.
- [ ] **QUAL-01**: La release v1 dispone de pruebas automatizadas del bucle
  captura → issue → reclamación MCP → resultado → revisión humana y de sus
  principales denegaciones de autorización y privacidad.

## v2 Requirements

### Integraciones y automatización

- **GITH-01**: Una GitHub App puede vincular repositorios, recibir webhooks y
  sincronizar branch, commit, PR y estados según reglas explícitas.
- **HOOK-01**: Un workspace puede emitir webhooks firmados e integrar avisos con
  herramientas como Slack sin conceder acceso MCP completo.
- **IMPT-01**: Un usuario puede importar proyectos, issues y actividad desde
  proveedores priorizados tras validar el formato y la fidelidad del mapeo.

### Captura y evidencia avanzada

- **CAP2-01**: La extensión puede generar una captura fiable de página completa
  mediante scroll y mostrar su composición antes de subirla.
- **CAP2-02**: El usuario puede adjuntar consola y red de forma explícita, con
  redacción, allowlists y previsualización independientes.
- **CAP2-03**: El usuario puede adjuntar una grabación o replay de sesión con
  controles de consentimiento, privacidad, retención y tamaño.
- **VERI-01**: Un issue puede guardar evidencia antes/después y una persona puede
  aceptar o rechazar el resultado contra criterios explícitos.
- **BROW-01**: La extensión soporta Firefox y Safari con el mismo contrato de
  privacidad y un conjunto documentado de diferencias.

### Gestión y auditorías avanzadas

- **AUD2-01**: Una auditoría puede exportarse o compartirse como informe con
  alcance, evidencia, hallazgos y limitaciones verificables.
- **AUD2-02**: Existen plantillas y auditorías recurrentes con comparación entre
  ejecuciones, sin duplicar hallazgos abiertos.
- **ISS2-01**: Los issues admiten relaciones, subissues, dependencias y plantillas
  sin convertir el producto en una suite generalista de project management.
- **VIEW-01**: Los usuarios pueden guardar vistas, realizar acciones masivas y
  personalizar más dimensiones del tablero.
- **TEAM-01**: Los workspaces admiten roles personalizados y proyectos privados
  con permisos humanos más granulares.
- **NOT2-01**: Hay preferencias de email, resúmenes y reglas de notificación más
  detalladas por proyecto y evento.

### Operación comercial y enterprise

- **BILL-01**: Cloud ofrece autoservicio de suscripción, facturación, cambios de
  plan y gestión de medios de pago sin alterar la paridad funcional.
- **ENTR-01**: SSO empresarial, SCIM, políticas de retención y controles de
  compliance se incorporan sólo después de validar demanda y modelo operativo.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Paridad general con Jira, Linear o Trello | Issopen valida captura visual y colaboración humano-agente, no gestión de proyectos universal. |
| Scrum, sprints, Gantt, wiki, CRM, calendario y control horario | Añaden superficie sin mejorar el bucle principal. |
| Agentes o inferencia alojados por Issopen | El producto coordina agentes BYO-AI externos mediante MCP. |
| Clonar, indexar o almacenar credenciales de repositorios | El contexto v1 es ligero y los agentes trabajan en sus propios entornos. |
| Editar su propio código, ejecutar CI, hacer merge o desplegar desde el servidor Issopen | El tracker registra y gobierna trabajo; el agente de código y el pipeline permanecen externos y las operaciones irreversibles conservan aprobación humana. |
| Captura pasiva, sesión completa automática o DOM bruto | Contradice el consentimiento explícito y la minimización de datos. |
| Cookies, tokens, passwords, local/session storage o valores sensibles | Nunca son contexto válido de un issue. |
| Adjuntos públicos o anónimos en v1 | Rompen el modelo privado por tenant y amplían abuso y moderación. |
| Intake público o guest capture | Se difiere hasta diseñar identidad, spam y moderación. |
| Triage o resumen generativo oculto dentro del producto | Issopen no ejecuta IA en v1; los resúmenes base son deterministas. |
| Automatizaciones arbitrarias y workflows programables | Elevan riesgo y complejidad antes de validar permisos y MCP. |
| Funciones cerradas exclusivas de pago | Cloud monetiza operación y capacidad, no feature gates. |
| Microservicios, multi-región o Kubernetes propio de la app | Complejidad prematura para el primer producto y la edición Community. |
| Aplicaciones móviles nativas | La web responsive y extensión Chromium cubren el flujo inicial. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 1 | Complete |
| WRKS-01 | Phase 1 | Complete |
| WRKS-02 | Phase 2 | Pending |
| WRKS-03 | Phase 2 | Pending |
| WRKS-04 | Phase 2 | Pending |
| ONBD-01 | Phase 6 | Pending |
| WEB-01 | Phase 1 | Complete |
| PROJ-01 | Phase 1 | Complete |
| PROJ-02 | Phase 1 | Complete |
| PROJ-03 | Phase 3 | Pending |
| ISSU-01 | Phase 1 | Complete |
| ISSU-02 | Phase 1 | Complete |
| ISSU-03 | Phase 3 | Pending |
| ISSU-04 | Phase 7 | Pending |
| ISSU-05 | Phase 1 | Complete |
| ISSU-06 | Phase 2 | Pending |
| ISSU-07 | Phase 1 | Complete |
| ISSU-08 | Phase 3 | Pending |
| BOARD-01 | Phase 1 | Complete |
| BOARD-02 | Phase 1 | Complete |
| ACTV-01 | Phase 1 | Complete |
| ACTV-02 | Phase 1 | Complete |
| NOTF-01 | Phase 2 | Pending |
| NOTF-02 | Phase 2 | Pending |
| FILE-01 | Phase 4 | Pending |
| FILE-02 | Phase 4 | Pending |
| FILE-03 | Phase 4 | Pending |
| CAPT-01 | Phase 5 | Pending |
| CAPT-02 | Phase 5 | Pending |
| CAPT-03 | Phase 5 | Pending |
| CAPT-04 | Phase 5 | Pending |
| CAPT-05 | Phase 5 | Pending |
| CAPT-06 | Phase 5 | Pending |
| CAPT-07 | Phase 6 | Pending |
| CAPT-08 | Phase 6 | Pending |
| CAPT-09 | Phase 6 | Pending |
| CAPT-10 | Phase 5 | Pending |
| AGNT-01 | Phase 1 | Complete |
| AGNT-02 | Phase 1 | Complete |
| AGNT-03 | Phase 1 | Complete |
| AGNT-04 | Phase 1 | Complete |
| AGNT-05 | Phase 1 | Complete |
| AGNT-06 | Phase 1 | Complete |
| AGNT-07 | Phase 3 | Pending |
| MCP-01 | Phase 1 | Complete |
| MCP-02 | Phase 1 | Complete |
| MCP-03 | Phase 1 | Complete |
| MCP-04 | Phase 4 | Pending |
| MCP-05 | Phase 7 | Pending |
| MCP-06 | Phase 1 | Complete |
| MCP-07 | Phase 1 | Complete |
| MCP-08 | Phase 3 | Pending |
| MCP-09 | Phase 1 | Pending |
| MCP-10 | Phase 1 | Complete |
| MCP-11 | Phase 1 | Complete |
| DOGF-01 | Phase 1 | Pending |
| AUDT-01 | Phase 7 | Pending |
| AUDT-02 | Phase 7 | Pending |
| AUDT-03 | Phase 7 | Pending |
| AUDT-04 | Phase 7 | Pending |
| AUDT-05 | Phase 7 | Pending |
| AUDT-06 | Phase 7 | Pending |
| AUDT-07 | Phase 7 | Pending |
| COMM-01 | Phase 8 | Pending |
| COMM-02 | Phase 1 | Complete |
| COMM-03 | Phase 8 | Pending |
| COMM-04 | Phase 8 | Pending |
| COMM-05 | Phase 8 | Pending |
| COMM-06 | Phase 8 | Pending |
| CLOD-01 | Phase 9 | Pending |
| CLOD-02 | Phase 9 | Pending |
| CLOD-03 | Phase 9 | Pending |
| CLOD-04 | Phase 9 | Pending |
| CLOD-05 | Phase 9 | Pending |
| CLOD-06 | Phase 9 | Pending |
| CLOD-07 | Phase 9 | Pending |
| CLOD-08 | Phase 9 | Pending |
| SECU-01 | Phase 2 | Pending |
| SECU-02 | Phase 2 | Pending |
| SECU-03 | Phase 5 | Pending |
| SECU-04 | Phase 1 | Complete |
| ACCS-01 | Phase 7 | Pending |
| OPER-01 | Phase 9 | Pending |
| OPER-02 | Phase 9 | Pending |
| QUAL-01 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 89 total
- Mapped to roadmap phases: 89
- Unmapped: 0

---
*Requirements defined: 2026-08-23*
*Last updated: 2026-08-31 after moving the private dogfooding MVP to Phase 1*
