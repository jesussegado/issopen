# Input-select único para Proyecto y Epic

Petición explícita: fusionar los inputs de búsqueda con los selectores,
eliminando la duplicación. Mantener listas HTML dentro del panel, no popups OS.

1. Añadir modo buscable a SelectField para Proyecto y Epic. Una sola etiqueta
   y campo editable con flecha; al escribir filtra y se elige con clic/teclado.
   El ID confirmado sólo cambia al elegir una opción; texto libre y filtro
   son transitorios. Escape/Tab/fuera restauran el nombre seleccionado.
2. Conservar el modo no editable de Prioridad/Estado, los bloqueos durante
   envío pendiente, selección de Epic y borrador. Cambiar proyecto limpia Epic,
   reseleccionar el mismo no. Sin nuevas dependencias, API o permisos.
3. Probar filtros/sin resultados, ratón/teclado, cancelación, persistencia,
   selección asíncrona e inline y 320/400px. Gates completos, artefacto 0.5.3,
   recarga misma instalación sólo tras comprobar el borrador guardado.
4. Commit/push, documentación y ticket Ready for Review. No tocar aceptación
   personal 33 ni cambios ajenos de homelab; no enviar la imagen real del owner.
