# 60 — Borrar tickets desde la web

Petición del owner: botón y funcionalidad de borrado, **sólo web**.
Issue canónica: 82303564-63e4-45bd-9570-8a247264f5ab (In Progress).

1. Añadir deleted_at nullable y operación transaccional del owner REST con
   confirmación, expectedVersion y questionVersions. Borrado lógico auditado;
   conservar numeración, historial, adjuntos y recibos para recuperación manual.
2. Excluir eliminados de tablero, Epic, detalle, preguntas, actividad, MCP y
   evidencias privadas; impedir mutaciones concurrentes/replays que resuciten
   tickets. Sin endpoints/permisos nuevos en extensión o MCP.
3. Botón de peligro en detalle, diálogo accesible con cancelar seguro, errores
   y bloqueo durante petición/offline; navegar al proyecto tras éxito confirmado.
4. Tests aislados de permisos, aislamiento, concurrencia, versiones, reintentos,
   listados y evidencia; pruebas UI y navegador desktop/móvil. Gate completo.
5. Backup privado, build y publicación fuente/imagen, sólo GitOps para desplegar;
   comprobar Argo/health/DB/PVC y documentar límites del rollback. No borrar
   tickets reales del owner ni recargar su extensión durante esta tarea.

No incluye papelera/restauración web, purga irreversible ni borrado masivo.
Rollback a binario previo mostraría tickets marcados: tras usar el borrado,
preferir roll-forward; no presentar el rollback como semánticamente compatible.
