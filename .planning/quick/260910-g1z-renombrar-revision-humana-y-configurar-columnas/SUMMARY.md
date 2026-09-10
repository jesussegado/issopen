# Quick 260910-g1z — Resumen

## Resultado

Ticket 61 implementado y publicado. `ready_for_review` continúa siendo el valor
estable de dominio, REST y MCP, pero toda etiqueta humana activa muestra **Ready
for Human Review**. Cada proyecto puede mostrar u ocultar por separado esa
columna y Done desde Project settings.

Ocultar no modifica tickets. El endpoint del board omite las columnas
desactivadas, devuelve recuentos total/oculto y la web evita presentar un falso
“No issues yet”. El filtro sólo ofrece columnas visibles; el selector de una
tarjeta conserva los cinco estados, por lo que moverla a uno oculto la retira
del board sin perder su URL directa.

## Implementación

- migración aditiva `0015_minor_rocket_raccoon.sql` con
  `show_review_column` y `show_done_column`, `NOT NULL DEFAULT true`;
- contratos create/update, persistencia auditada y respuesta autoritativa del
  board extendidos;
- configuración accesible con dos checkboxes y texto que explica la retención;
- grid de tres, cuatro o cinco columnas sin huecos artificiales y una sola
  columna en móvil;
- etiquetas actualizadas en board, detalle, Epics, formularios, permisos y
  documentación activa, manteniendo `ready_for_review` internamente;
- cobertura de defaults, migración histórica, REST, React, transición a una
  columna oculta, enlace directo y E2E desktop/móvil.

## Verificación

- `pnpm validate`: 79 pruebas unitarias/web, 52 de integración, 8 E2E web
  aprobadas y 2 skips esperados, 76 unitarias y 12 E2E de Chrome; lint,
  typecheck, build, reproducibilidad y secret scan aprobados.
- `pnpm test:compose`: 1 prueba aprobada.
- `make validate`: 197 pruebas aprobadas; Ansible y Helm no instalados, sus
  comprobaciones opcionales se omitieron con warning.
- Backup completo en `.local/backups/issopen-board-columns/issopen-nIA9OW`,
  checksums verificados y restore aislado: 2 proyectos, 62 filas de tickets,
  540 eventos, 7 evidencias y 7 archivos. Migración 16 aplicada; cero proyectos
  con las opciones desactivadas.
- Imagen `board-columns-5048f51` inspeccionada con la migración y bundle nuevos;
  digest `sha256:09d68e4093c6fb6a1e9be0930fc2a51f470a21ae2624f818713adf450599d72b`.
- GitOps `ddf9d9714795e6fc54e02c0a1c3f4ec4303ce659` reconciliado
  `Synced/Healthy`; pod `issopen-6b8c54c776-hbv75` Ready, cero reinicios, digest
  exacto y nodo `debian13-torre-nya`.
- PostgreSQL productivo conserva 2 proyectos, 62 tickets, 544 eventos, 7
  evidencias y 7 recibos; 16 migraciones, defaults `true`, `NOT NULL` y ambas
  preferencias activas en los dos proyectos.
- PVCs conservados: `pvc-cf93e0a7-b978-46c2-9c03-c77f902742b9` y
  `pvc-c40b0035-0433-436f-91c4-feff7a20e754`.
- UI productiva leída con sesión owner en contextos aislados de 1440×900 y
  360×800: etiqueta nueva, dos controles activos y cero overflow horizontal;
  ninguna configuración se mutó durante la comprobación.

## Publicación y seguimiento

- Fuente: `5048f513e4cdc1cfff45ef9dba9bc6ec0f87b922` en `origin/main`.
- GitOps remoto: `ddf9d9714795e6fc54e02c0a1c3f4ec4303ce659` en `main`.
- Copia operativa homelab: `a322f072` con sólo `apps/issopen` agrupado; los
  cambios ajenos de watchdog/red quedaron intactos.
- Ticket 61: Ready for Human Review, versión 6, claim liberado, commit y
  evidencia enlazados.

## Rollback

Reactivar las dos preferencias y volver al digest web-delete previo. No borrar
las columnas de PostgreSQL: un binario anterior las ignora y mostrará siempre
las cinco columnas. Los PVCs no requieren cambio.
