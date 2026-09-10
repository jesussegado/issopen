# 54 — Búsqueda y selección de destino en un único campo

Ticket `6d1e31a4-c3f3-42ad-941d-883b5e4d5baa`, Epic Chrome.

## Implementación 0.5.3

SelectField tiene modo `searchable` para Proyecto/Epic. Un único input con
flecha sustituye Buscar + selector. Clic/teclado abre lista HTML; texto filtra
por subcadena ignorando mayúsculas y tildes. Enter/clic confirma una opción.
Escape/Tab/fuera cancela y restaura el nombre guardado; texto libre no cambia
ni se persiste como ID. Flecha abre/cierra, `Sin Epic` permite desasignar.

`value` del input es texto visible y `data-selected-value` es el ID confirmado.
API/draft no cambian. Prioridad/Estado conservan modo no editable. Mantiene
edición de texto nativa, composición IME, ARIA/foco, bloques de envío incierto,
respuestas tardías ignoradas y Epic conservado al reseleccionar proyecto.
Sin dependencias, permisos, red extra ni cambios de backend.

## Pruebas previas a release

Lint/TypeScript raíz/extensión PASS. Cinco E2E compositor/selectores PASS:
ratón, teclado, búsqueda, cancelación, sin resultados, tildes/mayúsculas,
chevron, Sin Epic, textos largos/320–400px, persistencia y carga/error asíncronos.
Inspección visual del compositor a 320px: sólo Proyecto y Epic, sin duplicados.
OAuth nativo/API/DB real PASS con búsqueda inline, creación de destinos,
dos imágenes privadas, respuesta perdida/reintento y bloqueo de selectores.
Fixtures efímeros y sintéticos; no se envían tickets/imágenes del owner.

`make validate` homelab: 197 PASS; Ansible/Helm no instalados, checks omitidos.
Cambios ajenos intactos. No se despliega Kubernetes por una modificación de UI.

## Entrega

Pendiente del gate completo, artefacto limpio 0.5.3 y recarga de la misma
instalación con sesión/borrador confirmados. Conservar la imagen real del owner,
no leer clipboard ni cambiar el destino actual en la comprobación en vivo.
