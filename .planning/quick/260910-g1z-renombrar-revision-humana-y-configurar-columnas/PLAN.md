# Quick 260910-g1z — Revisión humana y columnas configurables

## Objetivo

Cambiar la etiqueta visible de `ready_for_review` a **Ready for Human Review** y
permitir que cada proyecto oculte de su tablero las columnas de revisión humana
y Done sin alterar estados, tickets, enlaces directos ni contratos MCP/REST.

## Alcance y decisiones

- Conservar `ready_for_review` y `done` como valores internos estables.
- Añadir a proyecto `show_review_column` y `show_done_column`, ambos `true` por
  defecto mediante una migración aditiva y reversible por roll-forward.
- La API del tablero devuelve únicamente las columnas habilitadas y cuenta los
  tickets que quedan ocultos para no presentar un falso estado vacío.
- Configuración ofrece dos controles independientes con explicación explícita
  de que ocultar no mueve ni borra trabajo.
- Los cambios de estado siguen ofreciendo los cinco estados. Si una tarjeta se
  mueve a una columna oculta, desaparece del tablero visible y queda accesible
  por su enlace directo.

## Tareas

1. Extender esquema, contratos, servicio HTTP y migraciones con las dos
   preferencias, manteniendo compatibilidad y auditoría de actualización.
2. Actualizar etiquetas y UI: controles de configuración, columnas/filtros
   dinámicos, recuento de tickets ocultos y estados vacíos honestos.
3. Cubrir dominio, HTTP, React y Playwright; ejecutar el gate completo, probar
   Compose y restaurar un backup productivo en PostgreSQL aislado.
4. Publicar fuente e imagen inmutable mediante GitOps, comprobar migración,
   Argo CD, salud, persistencia y UI productiva, y cerrar la evidencia en el
   ticket 61 y la documentación operativa.

## Criterios de aceptación

- Toda etiqueta humana muestra `Ready for Human Review`; API/MCP continúan
  usando `ready_for_review`.
- Proyectos existentes y nuevos muestran ambas columnas por defecto.
- Desactivar cualquiera de los controles la elimina del tablero tras guardar;
  reactivarla vuelve a mostrarla con sus tickets intactos.
- Ocultar columnas no produce `No issues yet` si contienen trabajo y el usuario
  recibe un aviso con la cantidad oculta y acceso a configuración.
- Todas las pruebas, build, migración, backup/restore y validaciones GitOps pasan.

## Rollback

Reactivar ambas preferencias y publicar un binario compatible con las columnas
aditivas. No eliminar las columnas de PostgreSQL; un binario anterior ignorará
sus valores y volverá a mostrar siempre las cinco columnas.
