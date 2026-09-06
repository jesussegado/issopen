---
created: 2026-08-30T14:21:28.602Z
completed: 2026-08-30T19:29:05+02:00
title: Documentar MVP autoprogramable con ChatGPT
area: planning
files:
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/research/STACK.md
---

## Problem

El propietario quiere que el primer producto utilizable de Issopen sea una
base similar a Trello conectada por MCP con ChatGPT y que, desde ese MVP, el
propio producto pueda emplearse para dirigir sus mejoras. La intención no es
sólo gestionar tareas: Issopen debe convertirse en el control plane donde una
persona prioriza trabajo y agentes de programación externos consumen tickets,
trabajan en el repositorio y devuelven resultados trazables.

La planificación actual contiene casi todas las piezas, pero expresa otra
secuencia: coloca la captura visual antes del primer bucle MCP completo y sólo
exige interoperabilidad con Codex y Claude. Antes de ejecutar la fase 1 hay que
reconciliar el roadmap aprobado con esta nueva prioridad explícita:

```text
tablero utilizable
  -> ChatGPT consulta y gestiona tickets mediante MCP
  -> un agente de código reclama un ticket y trabaja fuera de Issopen
  -> enlaza branch, commit o PR y lo deja listo para revisión
  -> una persona revisa, acepta y prioriza la siguiente mejora
  -> Issopen usa su propio tablero para evolucionar Issopen
```

“Autoprogramable” es todavía una hipótesis que necesita una frontera clara. La
interpretación segura de partida es **dogfooding agentico gobernado**, no que el
servidor modifique su propio código o producción sin control. Issopen conserva
el backlog, permisos, estado y auditoría; ChatGPT y los agentes externos
proponen o ejecutan trabajo según sus scopes; Git, CI, merge y despliegue siguen
siendo sistemas separados y las operaciones irreversibles requieren aprobación
humana explícita.

## Solution

### Corte vertical propuesto para validar primero

1. Workspace y proyecto personal con un tablero mínimo y estados semánticos
   `Backlog`, `Ready`, `In Progress`, `Ready for Review` y `Done`.
2. Issues con título, descripción, prioridad, etiquetas, comentarios, owner
   humano, reclamación agentica y actividad atribuida.
3. Remote MCP desplegado con herramientas enfocadas para:
   - listar proyectos e issues;
   - obtener el contexto de un issue;
   - crear y actualizar issues;
   - reclamar y liberar trabajo;
   - comentar y cambiar estados permitidos;
   - enlazar branch, commit o pull request como resultado.
4. Plugin personal conectable desde ChatGPT en modo desarrollador y probado en
   ChatGPT Work, además del cliente de código que vaya a ejecutar el trabajo.
5. OAuth 2.1 con PKCE, metadata del recurso protegido, discovery y scopes por
   proyecto para cualquier dato privado o herramienta de escritura.
6. Proyecto de dogfooding `issopen`: las siguientes mejoras del producto se
   crean, priorizan y revisan usando el propio MVP.

La captura visual, auditorías avanzadas, Cloud Free y publicación del plugin
siguen siendo importantes, pero no deben impedir comprobar antes que una
persona puede gobernar desde ChatGPT un backlog que un agente de código mueve
hasta revisión.

### Superficies y responsabilidades propuestas

| Superficie | Responsabilidad en el MVP |
| --- | --- |
| Web de Issopen | Tablero, ficha del issue, permisos, actividad y revisión humana. |
| ChatGPT Work | Conversar con el backlog mediante el plugin MCP: consultar, crear, priorizar y actualizar dentro de los scopes concedidos. |
| Codex u otro agente de código | Trabajar en el repositorio externo, reclamar el issue y devolver branch/commit/PR y explicación. |
| MCP de Issopen | Contratos de herramientas, autenticación, autorización, idempotencia y atribución. |
| Git y CI | Código, pruebas, revisión y merge; Issopen sólo guarda referencias y estado. |
| Persona responsable | Concede autonomía, prioriza, revisa resultados y controla cierre, merge y despliegue. |

ChatGPT y Codex pueden consumir el mismo MCP/plugin, pero no deben confundirse:
ChatGPT es la primera interfaz conversacional solicitada; el agente de código
es quien dispone de un entorno de repositorio y herramientas para programar.

### Niveles de autonomía a decidir

- **Lectura**: consultar proyectos, issues y actividad.
- **Propuesta**: crear borradores, comentarios o sugerencias sin reclamar ni
  cambiar estado.
- **Trabajo gobernado**: reclamar, actualizar campos permitidos, enlazar
  resultados y pasar a `Ready for Review`.
- **Cierre delegado**: pasar a `Done` sólo con scope independiente.
- **Código y entrega**: ocurren fuera de Issopen; merge y despliegue automático
  quedan fuera del MVP hasta definir repositorio, CI, rollback y aprobación.

El nivel se concede por identidad agentica y proyecto. El contenido de un
ticket nunca puede ampliar permisos ni seleccionar por sí solo otra herramienta.

### Contrato MCP inicial a concretar

Las herramientas deben separarse cuando cambian permisos o consecuencias. El
primer diseño debe especificar para cada herramienta nombre estable, intención,
input/output estructurado, autorización, efectos, idempotencia y errores.

```text
list_projects       read:projects
list_issues         read:issues
get_issue           read:issues
create_issue        write:issues
update_issue        write:issues
claim_issue         work:issues
release_issue       work:issues
add_comment         comment:issues
link_code_result    work:issues
move_to_review      work:issues
close_issue         close:issues
```

Los nombres son provisionales. `close_issue` debe quedar separado de
`move_to_review`, y las herramientas de escritura deben anunciar correctamente
sus efectos; las anotaciones MCP ayudan al cliente, pero nunca sustituyen la
autorización del servidor.

### Prueba de valor del MVP

El corte se considera validado cuando, usando Issopen como backlog de Issopen:

1. una persona pide desde ChatGPT ver y priorizar el backlog;
2. ChatGPT crea o actualiza un issue con atribución y permisos correctos;
3. un agente de código autorizado reclama el issue sin reemplazar al owner;
4. el agente entrega un cambio probado y enlaza su branch, commit o PR;
5. el issue pasa a `Ready for Review`, nunca a `Done` sin el permiso acordado;
6. la persona revisa el resultado en web y decide el cierre;
7. reintentos, concurrencia y contenido hostil no duplican trabajo ni amplían
   scopes.

### Cambios de planificación que deben discutirse

- Actualizar `PROJECT.md` para convertir el dogfooding agentico en parte
  explícita de la propuesta de valor, sin prometer autonomía ilimitada.
- Decidir si el **MVP Trello + MCP** debe ser un corte anterior a la captura
  visual o si se mantiene la secuencia actual de fases.
- Ampliar `MCP-09` para exigir una prueba real con ChatGPT Work; conservar Codex
  como cliente de código y decidir si Claude sigue en la matriz v1.
- Definir qué acciones puede iniciar ChatGPT y cuáles pertenecen sólo a una
  identidad de agente de código.
- Definir si la ejecución comienza únicamente a petición humana o también por
  polling, eventos o tareas programadas.
- Fijar las aprobaciones de `Done`, merge, release y despliegue.
- Elegir una métrica de aprendizaje: tiempo de idea a revisión, porcentaje de
  tickets completados con trazabilidad, fallos de permisos, duplicados y
  porcentaje de resultados aceptados sin retrabajo.

### Hechos actuales de la integración OpenAI

Según la documentación oficial consultada el 2026-08-30:

- un servidor MCP desplegado puede conectarse como plugin personal desde el
  modo desarrollador de ChatGPT y probarse en ChatGPT Work;
- ChatGPT y Codex comparten el contrato de plugins/MCP y el directorio universal
  de plugins;
- los datos específicos de usuario y las acciones de escritura deben
  autenticarse;
- el contrato esperado es OAuth 2.1 conforme a MCP, con PKCE, metadata de
  recurso protegido y discovery del authorization server; ChatGPT puede usar
  CIMD, DCR o un cliente predefinido según la configuración;
- las herramientas deben representar objetivos coherentes y separar lecturas
  de escrituras o acciones con distinta autorización y riesgo.

Fuentes:

- https://developers.openai.com/plugins/quickstart
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/plan/tools

La disponibilidad exacta por cuenta, plan o workspace debe comprobarse de
nuevo durante la implementación; no se asume como estable por aparecer en la
documentación actual.
