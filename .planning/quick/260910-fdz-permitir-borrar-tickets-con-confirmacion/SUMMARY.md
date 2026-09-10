# 60 — Borrado de tickets sólo en la web

Owner aclaró explícitamente «Solo en la web». Issue canónica
82303564-63e4-45bd-9570-8a247264f5ab. Fuente publicada
c8d0d1a4b3e99ad6c5c10c3d4997153ec2a1242e.

## Implementación y alcance

Botón Delete ticket en detalle, diálogo nativo con número/título, cancelar,
teclado/foco, confirmación explícita, errores, bloqueo offline/doble petición y
vuelta al proyecto sólo después del éxito. Borrado lógico: columna nullable
0014, versión y preguntas guardadas, lock de fila, evento append-only, claim
liberado y número no reutilizable. GET y mutaciones del ticket dan 404 después;
tablero/Epics/MCP/adjuntos directos también excluyen borrados. Replays no vuelven
a crear el ticket. DELETE repetido sólo confirma el mismo resultado.

Sólo owner REST de mismo origen; no endpoint/scopes de borrado en Chrome/MCP.
No purga, papelera ni recuperación web. Retención/recuperación administrativa y
límite de rollback en docs/ticket-deletion.md. Un binario anterior ignora la
marca y volvería a mostrar eliminados: preferir roll-forward tras usarlo.

## Verificación

Gate pnpm validate completo: 226 PASS (78 unit/web + 52 integración PostgreSQL
+ 8 web E2E + 76 unit Chrome + 12 E2E Chrome); 2 skips desktop-only esperados.
Lint, TypeScript, build reproducible Chrome y escaneo de secretos PASS (253 ficheros).
Compose arranque/bootstrap/reinicio/persistencia: 1 PASS adicional.

Fixtures aisladas verifican agentes/Chrome no autorizados, otros owners/workspaces,
CSRF, versión y preguntas desfasadas, carrera editar/borrar, reintentos,
historial, números, recuentos, URL directa/descarga de imagen y MCP. Chromium
desktop/móvil verifica confirmar/cancelar/Escape/foco, error de red, 409 y éxito.
Screenshots sintéticos en /tmp/issopen-playwright-results inspeccionados.

El test histórico de migración de Epics ahora inserta el fixture con SQL del
esquema antiguo, evitando que el ORM moderno exija deleted_at antes del upgrade;
conserva todas sus aserciones y añade comprobación de deletedAt null.
Se corrigió navegación de foco del diálogo y se cierra el menú móvil dejado
abierto por la fixture antes de probarlo. Ningún gate omitido/relajado.

## Backup y publicación

Backup privado completo fuera del master:
homelab/.local/backups/issopen-web-delete/issopen-jmiXuy.
Dump y tar con manifiesto/checksums. Restaurado PostgreSQL efímero sin red ni
puertos; migración conserva 61 tickets, 532 eventos, 7 recibos y 7 evidencias;
7 PNG íntegros. Contenedor de prueba eliminado; backup/adjuntos restaurados
conservados privados. Ningún ticket real borrado para pruebas.

Imagen publicada e inspeccionada:
registry.serviciosegado.com/issopen:web-delete-c8d0d1a@sha256:53ac2bb7b0a944c8ec1e4b0aea7da5e1e1a00df48f8eb11a2f60ac6bce7a9d5c.
Manifiesto amd64 c647f7859ff75d1179685e234371785dbc1c06e0abb065363dc6c54feed7eb79.
GitOps main 543a2f65c5b10e57802cfd2e479017c7bde6cc41; seguimiento canónico homelab
e0fbe616bfc5e040252b528f52a8a05382e5a675. Sólo archivos de Issopen publicados,
sin mezclar la rama divergente/cambios ajenos de watchdog/red.

Homelab make validate: 197 PASS y 31 repositorios válidos; Ansible/Helm ausentes,
sus checks no se ejecutaron. Kustomize real de main renderiza y tres manifiestos
+ documento de release son idénticos a la copia canónica validada.

## Estado de entrega

2026-09-10 09:31 UTC: GitOps 543a2f65 Synced/Healthy, pod
issopen-854dd7fd4c-mcvks Ready, cero reinicios, digest efectivo igual al índice
del registro, en debian13-torre-nya. PostgreSQL sin reinicio de este despliegue;
ambos PVC/PV originales Bound y conservados. Readiness público OK.

15 migraciones, 61 tickets/0 eliminados, 534 eventos (dos entradas propias de
seguimiento posteriores al backup), 7 recibos/7 evidencias. Auditoría de adjuntos
7 PNG/416516 bytes íntegros, cero inválidos/huérfanos. Web productiva comprobada
en Chromium aislado con sesión existente en memoria: 1440/360 px, botón,
confirmación, foco y Cancel, 0 peticiones DELETE; contexto temporal cerrado.
Ticket 60 Ready for Review v6, claim null, cero preguntas, relectura tras liberar.
No se ha recargado ni alterado el panel de la extensión del usuario.
