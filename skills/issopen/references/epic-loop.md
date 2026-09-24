# Inventario, ticket-first, ejecución y reanudación

Dentro de `work-epic`, recorre todas las páginas del Epic con filtros estables y
confirma el detalle de cada candidato. No selecciones Backlog como sustituto de
Ready, no tomes claims ajenos y no trates una recomendación como respuesta.

Usa `scripts/epic-inventory.mjs` para obtener el detalle de todas las páginas y
construir un snapshot puro. Registra las dependencias verificadas como relaciones
por UUID con `satisfiedStatuses`; no las deduzcas del orden, título o prosa. Un
ticket sólo entra en `eligibleIds` si está Ready, sus preguntas bloqueantes tienen
una respuesta válida, no tiene claim ajeno y todas sus dependencias están
satisfechas. Conserva cada motivo de exclusión, incluidos ciclo, referencia rota,
estado, pregunta y claim. Un inventario vacío es un resultado válido.

Antes de modificar código, configuración, documentación o despliegue debe existir
un ticket equivalente dentro del Epic activo. Reutilízalo o planifica el faltante;
las consultas y explicaciones no crean tickets. Si Issopen no está disponible,
detén el cambio y conserva sólo un checkpoint local sin secretos.

Tras cada entrega relee el servidor. Continúa con trabajo independiente elegible
y termina cuando no quede ninguno, falte autoridad o decisión imprescindible,
exista un conflicto/error no transitorio o el estado no progrese. Publica un
resumen de completados, creados, bloqueados y pendientes, y no abandones claims.
