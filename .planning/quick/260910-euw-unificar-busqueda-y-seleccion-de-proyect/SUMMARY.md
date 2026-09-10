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

Fuente publicada `b5795e6995d674791a5c1c9466daebba976b9177`.
Gate completo `pnpm extension:release` desde Git limpio PASS: 78 unit/web +
46 integración + 8 E2E app + 76 unit extensión + 11 E2E extensión = **219 tests**,
dos skips móviles previstos. Lint/TypeScript y escaneo de secretos PASS.
Build reproducible (8 archivos), tree SHA
`cdc3379e3fe1d1bf550abeb69de043df997cc5bef0a621b0a9e540f5e5038e63`.

Artefacto ignorado `extensions/chrome/.output/releases/issopen-chrome-0.5.3-b5795e6995d6.zip`.
SHA256 `43bff029cfc32e625cb3394390bd315c6962ff0aed780654f2ff5f2197504a6c`.
Checksum/unzip -t PASS, extracción temporal idéntica al build antes de recarga.
0.5.2 retenido y checksum verificado. No necesita cambio de servidor/GitOps.

Mismo perfil/ruta/ID Chrome 152, versión cargada **0.5.3** y cuenta conectada.
Antes de recargar: UI y única imagen confirmadas en IndexedDB, sin operaciones
pendientes ni edición transitoria. Después: fingerprint de cuenta/formulario/
evidencia/pending idéntico (comparado en memoria, sin imprimir contenido).
Dos inputs buscables, cero inputs Buscar antiguos. En ambos se probaron filtro,
clic en opción actual y cancelación de búsqueda sin resultados; ID/etiqueta y
borrador se conservaron. No lectura de clipboard ni subida de imágenes/tickets.

Ticket 54 reread: Ready for Review v6, claim null, cero preguntas. Commit y
evidencias enlazados. Ticket personal 33 y cambios ajenos permanecen intactos.
