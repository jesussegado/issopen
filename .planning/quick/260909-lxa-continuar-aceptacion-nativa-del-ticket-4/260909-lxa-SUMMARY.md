---
status: incomplete
canonical_issue: https://issopen.serviciosegado.com/issues/5c69ca94-a189-42cf-8e23-2eb2c3f12fb2
---

# Checkpoint — 43, no terminado

## Verificado

- Consolidada ejecución nativa con editor y reapertura: test 1/1, sólo
  greeting.mjs, un comentario atribuido, Ready for Review y claim liberado.
- Nueva consulta CLI nativa a Epic vacío por número: identidad, allowlist,
  asociación, detalle y listado de hijos correctos; cero mutaciones/archivos.
- 75 tests unit/web, cuatro de descubrimiento incluidos; lint, tipos y escaneo
  de secretos (165 archivos) correctos. No se repitieron integración/E2E: no
  hay cambios del servidor/web, y se distingue su evidencia previa.
- Corregido checker que contaba copias de skill deshabilitadas como duplicados.
- Fixture de planificación con Epic vacío, ticket previo, Other guardado y
  snapshots completos de planes/preguntas. No equivale a una prueba pasada.
- Se conserva aprobación interactiva y la instalación personal. El cliente
  nativo persistió confianza temporal; retirada únicamente su nueva entrada y
  verificado el hash global original.

## Commits locales de código

- `997628b`: descubrimiento y cuatro regresiones.
- `62908c4`: aceptación interactiva de editor y escenario de planificación.
- `5e287f5`: modo background para separar el fixture de la terminal.

No release, tag, push, despliegue ni piloto 44. GSD quick se ejecutó inline con
el CLI legacy instalado porque gsd-sdk no está en PATH; Issopen sigue siendo
canónico y no se ha marcado la fase completa.

## Punto de reanudación

El primer servidor de planificación recibió SIGTERM y terminó con código 143
a las 13:55 UTC. Su informe final preservó las aserciones de cero mutaciones.
No se ha establecido quién originó la señal ni atribuido el problema a producción.

Nueva base de datos, no continuación de la anterior:

- Repo: `/tmp/issopen-native-acceptance-jck3x2`.
- Control privado: `/tmp/issopen-ide-control-MPtIb5`.
- Log: `/tmp/issopen-native-launch-Uta13p/fixture.log`.
- PID: 2517887, parent PID 1; MCP: `http://127.0.0.1:40385/mcp`.
- Snapshot: `GET http://127.0.0.1:40385/__acceptance/status`.
- Proyecto: `d8d42e16-9f4e-45c2-9824-87847d59824b`.
- Epic vacío: `66543fe1-cff5-49db-9517-8b246ca70f0d`.
- Skill candidata 62908c4; contenido del paquete sin cambios respecto a 4a5c0bf.
- Ventana 0x09400004, título `Issopen 43 — isolated acceptance`; Restricted Mode.

El owner debe confiar sólo en esa carpeta desde Manage → Trust. No aprobar por
él. Después completar la bienvenida de Codex y enviar la sección 2 de START-HERE
desde el panel con aprobaciones interactivas. No se ha enviado aún la petición
mutante. Repetir el plan, comparar IDs/contenido y luego probar cambio de respuesta
con owner sintético vía web, no con credenciales reales. Completar casos de fallo
y matriz antes de Done. Ticket 43 pausado en Backlog con claim liberado.

Al terminar o cancelar, enviar SIGTERM sólo al PID verificado del harness para
guardar informe/cerrar DB; cerrar sólo su ventana. No dejarlo activo tras la prueba.
