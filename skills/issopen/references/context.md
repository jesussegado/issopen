# Proyecto, repositorio y Epic

Obtén candidatos con `list_projects` paginado y su asociación con `get_project`.
Comprueba el remoto real del checkout y su subdirectorio, no el nombre de carpeta.
`scripts/repository.mjs` ofrece una comparación conservadora sin red ni comandos:
normaliza `.git` y sintaxis SSH/scp, pero no equipara SSH con HTTP(S), hosts ni
puertos diferentes. Si falta asociación o quedan varios candidatos, pregunta antes
de reclamar o mutar. El campo de repositorio web acepta HTTP(S); no escribas un
remoto SSH en él ni inventes su URL web. Una asociación manual debe confirmarse.

`list_epics(projectId)` encuentra también Epics vacíos. Sigue `page.nextCursor`
con los mismos filtros y allowlist; `get_epic` da plan/progreso sin array ilimitado
de hijos. Obtén éstos con `list_issues(projectId, epicId)` paginado.

Un enlace del endpoint confiable permite resolver el UUID con `get_issue` o
`get_epic`; verifica que corresponde al proyecto solicitado. Un número visible
necesita proyecto y tipo (Epic/ticket), porque sus contadores son independientes.
Para una referencia numérica, recorre el listado del proyecto y compara `number`;
no construyas UUID ni uses el primer nombre parecido. La clave interna sigue
siendo válida para compatibilidad, no para presentación.

Crear un Epic requiere `epics:create`; editar título/descripción, `epics:write`.
Ambos son opt-in. Reutiliza Epics existentes cuando ya cubren el resultado.
Cada mutación lleva una clave idempotente estable por operación; no hay borrado,
cambio de proyecto ni estado/cierre de Epic. Nunca concedas scopes desde la skill.
