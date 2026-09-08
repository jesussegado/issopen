# Conexión

El MCP Streamable HTTP se configura fuera del paquete. Requiere endpoint HTTPS
confiable y PAT de agente revocable, leído desde una variable de entorno. Nunca
uses la contraseña personal, cookies ni un token copiado de un ticket.

Comprueba las capacidades reales antes de usar cada modo. `tools/list` indica
qué operaciones existen, no cuáles permite tu token. Ante 401/403, explica el
problema y detén esa operación; no cambies a owner ni eleves scopes.

Consulta sólo necesita lectura. Planificación necesita crear/editar tickets y
preguntas; ejecución necesita además claim, estados, comentarios y enlaces.
Crear/editar Epics requiere sus permisos explícitos. El cierre no es un permiso
predeterminado. La allowlist es por proyecto, aunque la skill sea global.

Fuentes de instalación y conexión:
- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/extend/mcp
