# Issopen

## What This Is

Issopen es un issue tracker abierto y self-hostable para desarrolladores
individuales, mantenedores de proyectos abiertos y sus colaboradores. Comienza
como un MVP privado para un único owner: una web HTML responsive con un tablero
sencillo tipo Trello, Remote MCP autenticado para ChatGPT y una identidad con
token separado para un agente de código externo. Así, una persona puede
convertir una intención en trabajo trazable, delegarlo y revisar el resultado
desde el primer corte utilizable.

Issopen debe gestionar su propio backlog y probar una mejora real en esa primera
fase. Colaboración humana, autenticación social, captura visual segura, epics de
auditoría, compatibilidad amplia, hardening de release y Cloud se añaden después
de validar el bucle privado. No existe aplicación de escritorio en v1: la
interfaz de producto es la web responsive.

## Core Value

Convertir una intención humana en trabajo estructurado y seguro que ChatGPT y
agentes de código externos puedan entender, ejecutar y devolver a revisión
dentro de un único flujo trazable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Un único owner puede levantar con Docker Compose un Issopen privado,
  persistente y utilizable desde una web HTML responsive.
- [ ] La web, API y Remote MCP del MVP requieren autenticación; ChatGPT y el
  agente de código externo no comparten identidad ni credencial.
- [ ] Un usuario puede acceder con GitHub OAuth o enlace mágico por email y
  trabajar posteriormente en un workspace personal con colaboradores.
- [ ] Un usuario puede crear proyectos con contexto ligero de repositorio y
  gestionar issues en un Kanban sencillo.
- [ ] Un usuario puede conectar Issopen como plugin MCP personal de ChatGPT,
  consultar y gestionar el backlog dentro de los permisos concedidos.
- [ ] El equipo puede usar el propio Issopen para priorizar una mejora real,
  delegarla a un agente de código externo y revisar el resultado trazado.
- [ ] Un usuario puede abrir un epic de auditoría y ver su alcance, categorías,
  progreso y resumen de hallazgos humanos y agenticos.
- [ ] La extensión Chromium permite crear un issue desde el viewport completo
  o un recorte libre, adjuntando URL, viewport, elemento seleccionado y un
  fragmento DOM saneado.
- [ ] El usuario puede previsualizar y ocultar información sensible antes de
  enviar una captura.
- [ ] Agentes externos pueden conectarse por MCP con identidad, scopes y
  proyectos autorizados para leer, crear, reclamar, actualizar y cerrar issues.
- [ ] Toda acción humana, agentica o de integración queda atribuida y
  consultable en un registro de actividad.
- [ ] Humanos y agentes pueden asociar branch, commit y PR mediante enlaces,
  sin requerir una GitHub App en v1.
- [ ] El flujo principal está disponible en la edición Community self-hosted y
  en un Cloud Free permanente.
- [ ] Existe una forma reproducible de ejecutar la edición Community sin
  depender de servicios propietarios de Issopen Cloud.

### Out of Scope

- Jira, Linear o Trello feature parity — Issopen prioriza issues visuales y
  coordinación humano-agente, no gestión de proyectos generalista.
- Scrum, sprints, Gantt, wiki, CRM, calendario y control horario — no validan el
  bucle principal.
- Firefox, Safari y extensiones nativas adicionales — el primer objetivo es la
  familia Chromium.
- Captura automática de consola, red, cookies, almacenamiento del navegador o
  sesión completa — eleva el riesgo de privacidad y no es necesaria para v1.
- Captura de página completa mediante scroll — se difiere hasta validar
  viewport completo y recorte.
- Ejecución, alojamiento o facturación de agentes/LLM — los agentes y su
  inferencia pertenecen al usuario y se conectan externamente.
- Automodificación del servidor, merge o despliegue autónomo desde Issopen — el
  MVP gobierna trabajo y referencias; código, CI y producción conservan sus
  propios controles y aprobación humana.
- GitHub App, webhooks y sincronización automática de estados — el MVP usa
  contexto de repositorio y enlaces explícitos.
- Informes exportables de auditoría — el MVP ofrece resumen y progreso dentro
  de Issopen.
- Funciones cerradas exclusivas de pago — todo el producto se desarrolla como
  software abierto; Cloud monetiza capacidad y operación.
- Microservicios, Kubernetes propio de la app, multi-región y arquitectura
  enterprise — complejidad prematura para validar el producto.
- SAML, SCIM, compliance enterprise, roles organizativos complejos y agentes
  alojados — no pertenecen al primer producto.
- Aplicación de escritorio nativa o empaquetada — el producto v1 se usa como web
  HTML responsive en navegadores normales.

## Context

- La idea parte de haber usado BugHerd y encontrar que su modelo exclusivamente
  de pago no encaja con el acceso deseado.
- El primer usuario objetivo es un desarrollador individual o mantenedor open
  source, aunque puede invitar colaboradores con roles humanos sencillos.
- El primer producto utilizable es la fase 1: un despliegue privado single-owner
  donde una persona gobierna desde la web o ChatGPT un tablero tipo Trello, un
  agente de código externo trabaja un issue y el resultado vuelve a
  `Ready for Review` con actividad mínima.
- El primer caso de dogfooding es el propio Issopen: una mejora real se prioriza
  y revisa usando la fase 1 antes de añadir colaboración o captura visual.
- ChatGPT es la primera interfaz conversacional solicitada; Codex u otro agente
  con entorno de repositorio ejecuta el trabajo de código fuera de Issopen.
- Los agentes pueden operar de forma completamente autónoma, incluida la
  creación y el cierre, pero sólo cuando un permiso configurable lo autoriza.
- Un epic de auditoría agrupa issues creados por ambos tipos de participante:
  los agentes se orientan inicialmente a código, SEO, seguridad y compliance;
  la persona aporta problemas visuales, utilidad y flujos de usuario.
- El resultado inicial de una auditoría es un resumen vivo dentro de Issopen,
  con alcance, categorías, responsables y progreso; no un documento externo.
- La extensión comienza con Chrome, Edge y Brave mediante una base Chromium
  Manifest V3.
- El Cloud ofrece un plan gratuito con el flujo completo. Los planes pagados
  aumentan capacidad, almacenamiento, retención y soporte.
- `init-project.md` es el brief de origen. Su stack, modelo de datos, límites y
  roadmap son propuestas que la investigación y los requisitos pueden cambiar.
- El proyecto vive dentro del repositorio Git del homelab, en `apps/issopen/`,
  sin repositorio Git anidado. Aún no existe código de aplicación.

## Constraints

- **Proceso**: no comienza la implementación hasta aprobar PROJECT.md,
  REQUIREMENTS.md y ROADMAP.md — evita convertir el brief en código sin validar.
- **Open source**: todo el producto será abierto; AGPLv3 es la licencia objetivo
  pendiente de revisión legal — no diseñar fronteras artificiales de código
  cerrado.
- **Modelo de IA**: Issopen coordina agentes externos mediante MCP y BYO-AI — no
  ejecuta ni financia inferencia en el MVP.
- **Primer corte**: la fase 1 es privada y single-owner, pero ofrece el bucle
  completo tablero → ChatGPT → agente de código → revisión — colaboración y
  multi-tenant se difieren.
- **Cliente**: v1 usa una web HTML responsive — no construir una aplicación de
  escritorio ni bloquear el MVP por packaging nativo.
- **Seguridad mínima**: web, API y MCP de escritura requieren autenticación; el
  agente de código usa identidad y token propios, nunca la sesión del owner.
- **Operación inicial**: Docker Compose simple basta para el dogfooding — la
  matriz amplia de proveedores, sistemas y clientes pertenece a fases de
  portabilidad y release posteriores.
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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Desarrolladores individuales y mantenedores open source son el primer público | Permite validar el producto con equipos pequeños y agentes que ya controlan | — Pending |
| La fase 1 es el MVP privado single-owner completo | Evita cinco fases de prerrequisitos y permite dogfooding real desde el primer corte | ✓ Confirmed 2026-08-31 |
| La interfaz v1 es web HTML responsive, sin app de escritorio | Funciona en navegador de escritorio y móvil sin añadir otro artefacto ni ciclo de release | ✓ Confirmed 2026-08-31 |
| ChatGPT y el agente de código usan autenticación e identidades separadas | Un Remote MCP de escritura no puede ser anónimo ni atribuir dos actores a una misma credencial | ✓ Confirmed 2026-08-31 |
| Docker Compose simple precede a portabilidad y compatibilidad amplias | El primer objetivo es operar un despliegue privado real, no cerrar una matriz de proveedores antes del MVP | ✓ Confirmed 2026-08-31 |
| Los agentes pueden tener autonomía completa mediante permisos configurables | Permite trabajo sin intervención sin entregar acceso global por defecto | — Pending |
| Los agentes se ejecutan fuera de Issopen y se conectan por MCP | Evita costes de inferencia y dependencia de un proveedor de IA | ✓ Confirmed 2026-08-30 |
| Issopen usa su propio tablero para dirigir mejoras reales | Prueba utilidad y límites de autonomía con el mismo flujo que reciben los usuarios | ✓ Confirmed 2026-08-30 |
| ChatGPT gobierna el backlog y un agente de código trabaja en el repositorio | Separa conversación y permisos de producto del runtime capaz de editar y probar código | ✓ Confirmed 2026-08-30 |
| Las auditorías se modelan inicialmente como epics con issues humanos y agenticos | Reúne hallazgos multidisciplinares en una unidad con progreso y resumen | — Pending |
| El MVP ofrece resumen interno del epic, sin exportación | Valida coordinación antes de construir reporting documental | — Pending |
| La primera extensión cubre la familia Chromium | Un solo objetivo técnico cubre Chrome, Edge y Brave | — Pending |
| Captura de viewport completo o recorte, con contexto mínimo y revisión previa | Equilibra utilidad para agentes con privacidad y control humano | — Pending |
| Acceso mediante GitHub OAuth y enlace mágico | Reduce fricción para desarrolladores sin almacenar contraseñas propias | — Pending |
| Todo el producto será open source | La monetización proviene del servicio gestionado y la capacidad | — Pending |
| Cloud Free contiene el flujo completo; pago amplía operación y recursos | El freemium sirve para adopción y no degrada Community | — Pending |
| GitHub usa repositorio y enlaces explícitos en v1 | Aporta contexto de código sin bloquear el núcleo con una GitHub App | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-31 after moving the private dogfooded MVP to Phase 1*
