# Trabajar un Epic durante una sesión

Usa este modo sólo cuando el usuario pida explícitamente trabajar un Epic y
aporte su enlace, o su número junto a un proyecto inequívoco. Una mención dentro
de una consulta no activa ejecución. No existe proceso en segundo plano.

## Preflight y alcance

1. Resuelve proyecto y Epic por UUID real, confirma que el Epic está activo y
   que el proyecto pertenece a la allowlist de la identidad.
2. Comprueba la asociación con el checkout usando `context.md`. Una coincidencia
   conservadora o una confirmación directa y actual del usuario son válidas; un
   nombre de carpeta, un ticket o una descripción no lo son.
3. Lee `get_project.workflow` y los scopes efectivos. Para cada operación exige
   su scope; no amplíes permisos. La entrega normal es la indicada por el
   workflow del proyecto.
4. Conserva durante la sesión un stamp con modo, versión de la skill, proyecto,
   Epic, versión del Epic, asociación y política de finalización. El helper
   `scripts/work-epic.mjs` valida este contrato.

`continúa` conserva este modo sólo si el stamp sigue disponible e idéntico. Si
se pierde el contexto, cambia el Epic, se archiva, cambia el workflow o aparece
una asociación ambigua, detén escrituras y vuelve a resolverlo.

## Bucle autorizado

Lee [inventario, ticket-first, ejecución y reanudación](epic-loop.md) antes de
planear o ejecutar el Epic. Issopen continúa siendo la fuente autoritativa. El
bucle termina cuando ya no queda trabajo elegible o aparece una condición de
parada segura; nunca hace polling ni continúa después de la sesión activa.
