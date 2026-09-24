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

Para completar el plan usa `scripts/epic-planning.mjs`. Asigna a cada resultado
una clave semántica estable: no identifiques duplicados sólo por el título. Marca
la cobertura existente como completa o parcial con evidencia; reutiliza la
completa, añade el plan canónico al final de la parcial sin borrar texto humano y
crea en Backlog sólo el resultado ausente. Las descripciones creadas incluyen un
marcador de intención y hash del plan para que repetir el encargo sea idempotente.
Antes de **cada** escritura relee el inventario y exige el mismo fingerprint; una
edición u otro planificador invalidan el borrador y obligan a fusionar. Relee tras
cada escritura. Las dependencias se expresan por intención durante el borrador y
se sustituyen por UUID reales después de crear los tickets; rechaza ciclos y
referencias desconocidas.

Antes de modificar código, configuración, documentación o despliegue debe existir
un ticket equivalente dentro del Epic activo. Reutilízalo o planifica el faltante;
las consultas y explicaciones no crean tickets. Si Issopen no está disponible,
detén el cambio y conserva sólo un checkpoint local sin secretos.

Aplica `scripts/ticket-first.mjs` antes de tocar archivos o estado externo. Un
ticket recién creado permanece en Backlog: no implementes hasta que el inventario
releído lo declare Ready y elegible. Conserva su UUID en la sesión para que una
petición repetida reutilice el mismo resultado. El guard sólo permite continuar
con `proceed_with_ticket`; `reconcile_ticket`, `prepare_ticket` y
`checkpoint_and_stop` son condiciones de pausa, no permisos implícitos.

Tras cada entrega relee el servidor. Continúa con trabajo independiente elegible
y termina cuando no quede ninguno, falte autoridad o decisión imprescindible,
exista un conflicto/error no transitorio o el estado no progrese. Publica un
resumen de completados, creados, bloqueados y pendientes, y no abandones claims.

Usa `scripts/epic-execution.mjs` para seleccionar y avanzar un ticket. El orden
es prioridad y número, siempre limitado a `eligibleIds`. Reclama y confirma el
claim propio antes de In Progress. Tras implementar, registra una verificación
real: si falla, añade una sola evidencia y conserva In Progress para el flujo de
bloqueos; si pasa, enlaza código, comenta evidencia, aplica exactamente
`project.workflow.completionStatus`, libera el claim y relee todo el Epic. Cada
paso inspecciona el detalle actual y reconoce efectos ya aplicados, de modo que
una respuesta perdida no repite enlaces, comentarios ni transición.

Cuando aparezca un bloqueo usa `scripts/epic-blockers.mjs`. Una decisión humana
genera una pregunta bloqueante con recomendación y 2-3 opciones; dependencia,
claim ajeno, falta de autoridad o problema técnico generan un comentario con
diagnóstico, recomendación y condición de desbloqueo. Relee antes de publicar
para no duplicar la misma pregunta/comentario. Después del checkpoint libera
sólo el claim propio y continúa otro `eligibleId` independiente. No respondas la
pregunta, no inventes estado Blocked y no esperes mediante polling.

Para pausar, reanudar y terminar usa `scripts/epic-session.mjs`. El checkpoint
guarda scope, versión/fingerprint del inventario, resumen, Git HEAD, fingerprint
del worktree y tiempos de operaciones pendientes, nunca secretos ni un cursor de
posición. Una sesión nueva relee Issopen y Git; si cambió una respuesta, claim,
ticket, Epic o worktree, reconcilia y no ejecuta el `nextStep` cacheado. Pasadas
24 horas comprueba primero si el efecto existe antes de generar otra clave.
Continúa mientras haya `eligibleIds`, sin límite arbitrario. Detente con razón
explícita ante cero elegibles, falta de autoridad, conflicto, error no transitorio,
MCP caído o ausencia de progreso. Antes de parar libera todos los claims propios
y resume IDs completados, creados, bloqueados, en revisión y pendientes.
