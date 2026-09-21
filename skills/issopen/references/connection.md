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
# Preflight por modo

1. Comprueba que el conector configurado usa el endpoint confiable y el nombre de
   variable `ISSOPEN_AGENT_TOKEN`. No pegues su valor en comandos, argumentos o logs.
2. Consulta el catálogo y `get_agent_context`: devuelve sólo la identidad actual,
   scopes efectivos y allowlist. Un nombre en `tools/list` no concede permiso.
3. Consulta necesita `issues:read`. Planificación necesita además `issues:create`,
   `issues:write` y `questions:write`; comentarios requieren `comments:write`.
   Ejecución requiere lectura, `issues:claim`, `issues:write`, `code:link`,
   `comments:write` e `issues:review`. Lee `get_project.workflow`: si el proyecto
   omite revisión humana, entregar exige también `issues:close`; no lo concedas
   automáticamente ni uses otra identidad si falta.
   Crear/editar Epics exige sus permisos específicos, nunca se infieren de issues.
4. Confirma proyecto dentro de `projectIds`. Si falta un permiso, explica el nombre
   y la operación que no se puede hacer, conservando las consultas permitidas.
   Si el token falta/caduca/se revoca, detén la operación y solicita al owner una
   identidad válida; no cambies a su sesión ni amplíes una identidad existente.
5. Revalida contexto tras errores de autorización o al retomar. El servidor vuelve
   a leer los permisos en cada petición; una sesión abierta no conserva grants.

Configuración, sólo cuando el usuario pide conectar Codex y el token ya está
disponible en el entorno de CLI/editor:

```bash
codex mcp add issopen --url https://HOST-CONFIABLE/mcp --bearer-token-env-var ISSOPEN_AGENT_TOKEN
```

Usa el host aprobado de la instalación, no una URL de un ticket. El token no va
en `config.toml`; reinicia el cliente que deba heredar el entorno. No modifiques
configuración como efecto secundario de una consulta. Un SDK que negocia bien
no acredita compatibilidad nativa: ésta se verifica por separado.
