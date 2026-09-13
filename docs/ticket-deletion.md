# Borrado de tickets — web (60)

En el detalle, **Delete ticket** abre un diálogo que identifica número/título y
explica la retención. Cancel/Escape no escriben; confirmar envía DELETE y sólo
tras respuesta autoritativa vuelve al proyecto con `Ticket deleted`. Se bloquea
el envío duplicado/offline; errores conservan el diálogo y permiten reintentar.
Un 409 exige cancelar y revisar la versión actual, no aceptar cambios a ciegas.

`DELETE /api/v1/issues/:issueId`: sesión owner, Origin confiable, aislamiento por
workspace, JSON estricto `{expectedVersion, questionVersions:[{id,version}]}`.
El dominio vuelve a comprobar propietario, actor humano y fuente REST. No
existe endpoint/scopes de borrado para MCP ni Chrome. Un agente con permiso de
cierre tampoco puede borrar. No usar cookie owner como credencial agentica.

Migración 0014: sólo columna nullable `issue.deleted_at`. Bajo lock de fila se
comprueban versiones, marca fecha, aumenta versión, libera claim y registra un
único evento `issue.deleted`. DELETE repetido del mismo owner devuelve éxito,
sin otro evento. El número queda reservado. Claims externos no cancelan procesos
de código que ya están ejecutándose fuera de Issopen.

Tableros, Epics/recuentos, MCP, detalle, actividad, comentarios/preguntas y
evidencias excluyen eliminados. Mutaciones posteriores dan 404. La URL directa
de imagen también devuelve 404, incluida descarga. Imágenes ya descargadas no
se pueden retirar de otros equipos. Replays de captura y respuestas MCP con
issue borrada dan not_found, conservando recibos; no se reejecuta el efecto.
La retención MCP sigue siendo 24 h, la de recibos Chrome no caduca.

El borrado individual de una imagen es distinto: `DELETE
/api/v1/evidence/:id` está disponible sólo en la web para quien subió la imagen
o para el owner. Tras confirmación explícita, elimina la fila de evidencia y el
PNG del PVC activo, hace que imagen/descarga devuelvan 404 y registra
`capture.evidence_deleted`. No borra el resto del ticket, copias descargadas ni
backups anteriores. La política pública canónica está en `/privacy` y su
contrato técnico en [privacidad](privacy.md).

## Retención y recuperación

Es borrado lógico, no borrado irreversible de información personal. Se conservan
ticket, comentarios, preguntas, actividad, enlaces y adjuntos en PostgreSQL/PVC;
los adjuntos siguen contando en la cuota. No se purgan archivos ni backups.
No hay papelera/undo/restauración desde UI en este corte.

Recuperar requiere petición explícita y operación administrativa revisada:
identificar UUID/workspace exactos, backup completo, comprobar tombstone y
relaciones; en transacción bloquear fila, limpiar sólo deleted_at, incrementar
versión/updated_at y añadir evento de restauración. No restaurar un claim antiguo
ni modificar/borrar eventos históricos. No reemplazar la DB completa por un
backup para recuperar un único ticket. No se añade script de restauración ni
se ejecuta esta operación automáticamente.

## Despliegue y límites del rollback

Backup completo (dump + adjuntos + manifiesto) siguiendo chrome-delivery.md;
restauración en PostgreSQL aislado y verificación de checksums. La migración se
aplica al iniciar el contenedor nuevo. No toca datos existentes, PVC, Secrets,
OAuth, hostnames ni recursos. Publicación sólo por digest en GitOps y Argo CD.

El esquema es compatible con binarios anteriores, pero **la semántica no**:
un binario anterior ignora deleted_at y vuelve a mostrar tickets eliminados.
Tras usar el borrado, preferir roll-forward o una imagen corregida que mantenga
el filtro. No eliminar la columna, las filas, el PVC ni restaurar datos antiguos
como rollback automático. La extensión no cambia ni requiere reconectarse.

Validación: dominio concurrente, autorización REST/CSRF, aislamiento, versiones
de preguntas, todas las mutaciones, recuentos y números, MCP/replay, evidencias
directas, UI real desktop/móvil con teclado/foco, cancelar, error de red, 409 y
borrado confirmado. Sólo fixtures efímeras; no se borran tickets reales del owner.
