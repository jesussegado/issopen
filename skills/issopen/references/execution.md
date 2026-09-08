# Ejecutar un resultado autorizado

1. Exige un encargo de ejecución y alcance inequívoco. Confirma proyecto/Epic,
   remoto/subdirectorio, instrucciones del repo, permisos y cambios del usuario.
   Si no hay asociación fiable o falta plan/decisión, no escribas código todavía.
2. Lista todas las páginas de Ready del Epic activo, lee detalles/preguntas y
   condiciones de dependencias. `nextReady` sólo ordena los IDs cuya elegibilidad
   ya has revisado: prioridad urgent > high > medium > low, después número ascendente.
   No elige por recencia, no salta a otro Epic y no usa Backlog si no quedan Ready.
3. Reclama con `claim_issue` y comprueba la respuesta autoritativa/propietario.
   `requireOwnClaim` rechaza trabajo no reclamado por esta identidad. Si el claim
   falla o pertenece a otro, relee y selecciona otro elegible; no robes ni liberes
   claims ajenos. Después mueve a In Progress usando las versiones actuales.
4. Implementa sólo el resultado del ticket, preservando trabajo ajeno. Captura
   contexto/versiones de plan y respuestas al comenzar. Si falta una decisión,
   sigue el flujo de preguntas, checkpoint y pausa; continúa sólo lo independiente
   que pertenezca al encargo. No improvises respuestas ni cambies scopes.
5. Verifica criterios con pruebas proporcionales al riesgo. Guarda comandos,
   resultado real y límites (simulación, entorno efímero, navegador, producción).
   No atribuyas al navegador lo comprobado sólo por SDK ni cierres con tests fallidos.
6. Antes de entregar, relee plan, claim y respuestas. Distingue tus propias
   transiciones/enlaces de un cambio humano de plan o respuesta; si cambiaron
   decisiones, revisa su impacto y verifica de nuevo lo afectado. Una versión
   nueva no se adopta sin comparar. Usa guards al escribir/mover.
7. Publica evidencia en comentario atribuido y enlaza commit/branch/PR sólo si
   existe una URL real aprobada. La skill no autoriza por sí sola commit, push,
   merge ni despliegue; sigue el encargo y las reglas del repo. Si están autorizados,
   ejecuta/verifica esos pasos, sin inventar referencias. Un resultado local puede
   documentarse como local sin enlace ficticio.
8. Entrega Ready for Review y **libera explícitamente tu claim**: `move_issue` no
   lo libera. Si falla liberar, informa de la propiedad residual y reintenta sólo
   conforme al contrato idempotente; no anuncies que está libre sin comprobarlo.
   Done sólo con autorización humana explícita de cierre y `issues:close`; el
   perfil base no lo tiene. Termina con enlace, evidencia, límites y siguiente paso.

Al pausar, deja checkpoint y libera el claim propio tras guardar trabajo. Reanudar
exige volver a leer estado actual; no recuperar por fuerza una propiedad ajena.
Un warning no es una columna Blocked. No marcar revisión si falta una respuesta
bloqueante ni tratar Ready for Review como aceptación humana ya concedida.
