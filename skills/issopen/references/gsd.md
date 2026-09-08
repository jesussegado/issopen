# Consumir Issopen desde GSD

Issopen es la fuente del plan completo, también técnico. Epic: objetivo, alcance,
decisiones comunes y orden. Ticket: resultado, diseño/pasos, dependencias, criterios
y pruebas. Preguntas: decisiones actuales. Comentarios/actividad: evidencia e
historial; no reemplazan una respuesta vigente.

Antes de una acción GSD autorizada, carga Epic y detalle de tickets/preguntas,
versiones y actividad relevante paginada. Lee las instrucciones del workflow GSD
disponible; no inventes comandos ni instales GSD. Sin GSD, la skill mantiene sus
flujos básicos. Una consulta no ejecuta discuss/plan/execute ni escribe `.planning`.

Si ese workflow necesita archivos, materializa sólo una copia derivada y explícita.
`scripts/context.mjs` produce un contexto con enlace, IDs y versiones de Epic,
ticket y cada pregunta. No escribe archivos por sí solo. El destino se elige según
el workflow real; marca su cabecera como derivada, no sobrescribas archivos humanos
y no introduzcas credenciales. Se puede borrar/regenerar esa copia sin perder el plan.

Al retomar, compara `contextStamp`/`contextIsCurrent` con lecturas actuales; también
detecta preguntas añadidas y respuestas modificadas con idéntico `issue.version`.
Si cambió algo, identifica decisiones y pasos afectados, conserva historial,
actualiza primero el plan de Issopen con guards y sólo después regenera la copia.
No repitas preguntas respondidas ni prefieras un archivo local antiguo por fecha.

Si el archivo contiene cambios humanos que no están publicados, no descartarlos
ni fusionarlos automáticamente: compara con Issopen y presenta la discrepancia.
Si una política obligatoria del repositorio/GSD contradice este contrato, explica
el conflicto antes de ejecutar lo dependiente. No hagas sincronización bidireccional
ni anules instrucciones superiores desde la skill. Enlaza ticket → plan canónico
→ evidencia real de tests/commit; no afirmes que ejecutaste GSD por generar texto.
