# Chrome: cuenta accesible desde la cabecera

Petición del owner: sacar la información «Tu cuenta» del flujo principal y
mostrarla al pulsar un icono de usuario o una pestaña.

## Alcance aprobado

1. Botón de usuario «Cuenta» en la cabecera, con estado de conexión visible.
2. Diálogo nativo, cerrado por defecto, con los datos/proyectos, conexión,
   desconexión y enlace de gestión existentes. Cierre con botón o Escape y
   retorno del foco; sin nuevas dependencias ni permisos.
3. Cuenta y compositor permanecen montados: alternar no vuelve a autenticar,
   descarta capturas, cambia el destino ni borra el borrador.
4. Verificar teclado, 320/400 px, estados de conexión y recorrido OAuth real
   con captura/edición/envío idempotente en entorno aislado.
5. Publicar una release del artefacto Chrome y actualizar la misma instalación
   de pruebas sólo si no hay trabajo pendiente sin guardar. Sin despliegue del
   servidor, cambios de GitOps ni cierre de aceptación personal del Epic.

## Validación

Gates existentes de `pnpm extension:release` (Git limpio, suite completa y
reproducibilidad), checksum/ZIP y comprobación visual en Chrome. Registrar
resultado y rollback en SUMMARY/STATE y devolver el ticket a revisión.
