# Chrome 0.5 — imágenes a ticket, operación y seguridad

## Cambio vigente: pegar/subir imágenes (ticket 51)

Petición explícita del owner: reemplazar captura, inspector y editor internos
por Ctrl+V/CmdV, Pegar imagen y Subir imágenes (múltiple), con miniaturas/quitar.
PNG/JPEG/WebP estáticos se decodifican y convierten localmente a PNG sin EXIF.
Hasta 5 imágenes y 8 MiB agregados normalizados; también 8 MiB por archivo de
entrada y 32 MP por imagen antes de decodificar. No SVG/GIF/animaciones.
El usuario prepara/oculta información con una herramienta externa.

No activeTab ni scripting. El worker rechaza captura/inspección y no lee webs.
El pegado nativo consume sólo imágenes del evento del usuario; el texto conserva
su comportamiento. El botón solicita clipboardRead opcional por gesto y muestra
fallback a Ctrl+V/archivos si se deniega. No lectura automática ni de HTML/enlaces.
Los archivos elegidos se incorporan al único borrador local 24 h; no hay
confirmación separada. No hay red hasta Enviar ticket.

API v1 añade `images?: PNG[]` (máximo 5, 8 MiB agregados), excluyente con
`image` legacy. Los envíos pendientes antiguos se reintentan sin modificar el
payload/hash; no añadir defaults. `/session.maxImages:5` anuncia capacidad;
extensión nueva con servidor anterior limita el envío a una imagen.
Desplegar servidor antes de recargar la extensión.

Normalización PNG, autorización, cuota y recibos conservan los controles abajo.
Un lote inválido no crea parte del ticket. Cada imagen crea una fila existente
de evidencia, con metadata `mode:upload, attachmentIndex:0..4` para el orden.
No migración DB, nuevo volumen ni permisos OAuth. Web muestra todas las imágenes
privadas y mantiene lectura de evidencias históricas.

Rollback: sólo imagen/digest por GitOps, conservando DB/recibos/ambos PVCs.
El binario antiguo puede no mostrar metadata upload, aunque no borra adjuntos.
No bajar la extensión a 0.4.3 con borrador multiimagen o envío pendiente:
el parser antiguo puede descartarlo. Resolver/exportar primero y mantener ruta/ID.
No se afirma compatibilidad de downgrade de ese borrador.

Validación 0.5: selección PNG/JPEG/WebP, Ctrl+V nativo, texto pegado intacto,
miniaturas/quitar, recarga del borrador, errores de lote/size y panel 320/400 px.
Ramas del botón con permiso/vacío usan fixture explícito. OAuth E2E envía dos
imágenes, pierde respuesta tras commit, recarga y reintenta sin duplicar;
descarga owner y rechazo anónimo verificados. Integración comprueba cinco
imágenes atómicas, orden, reintentos y rechazo sin filas parciales.
Los tests unitarios de helpers de captura legacy no significan que siga esa UI.

## Entrega histórica 0.4 y contrato operativo conservado

Contrato del Epic 1 (19–33), derivado de sus respuestas aprobadas. La aceptación
personal del owner en 33 es independiente de las pruebas técnicas. No amplía
el ticket 44 ni cierra fases históricas de GSD.

## Qué entrega

OAuth humano → proyecto/Epic existente o creado inline → viewport/full/recorte/
elemento → revisión, recorte/redacción → ticket con evidencia privada → enlace.
El éxito no navega automáticamente. Proyecto/Epic se recuerdan; prioridad
`medium` y estado `backlog`. El número visible no lleva la clave del proyecto.

La selección admite hover, ↑ ancestro, ↓ volver, Enter y Escape. Devuelve una
ruta estructural `tag:nth-child(n)` (best-effort si cambia el DOM), bbox y hasta
60 nodos / profundidad 4 / 3 ancestros. No texto, IDs, clases, URLs, scripts,
handlers ni valores de formularios; sólo etiquetas y atributos semánticos
enumerados. No hermanos ni DOM completo. Se indica truncación y se pueden
excluir DOM, descriptor, imagen o metadatos. El borde verde queda en los píxeles.

Sólo **Confirmar captura revisada** incorpora el PNG final al borrador. Cualquier
edición o cambio de inclusión invalida esa aprobación. El historial/original
queda sólo en RAM; nunca se persiste ni se envía. El borrador restaurado puede
volver a editarse. Antes de **Enviar ticket** se muestra exactamente la imagen y
el contexto elegidos. Una captura no confirmada se pierde al cerrar el panel.

## API v1 y autorización

`src/shared/capture-contract.ts` es el contrato tipado común Zod, sin imports
de servidor en la extensión. Rutas bajo `/api/extension/v1`:

| Operación | Entrada / resultado |
| --- | --- |
| GET `/session` | identidad, caducidad, `apiVersion:1`, `canWrite` |
| GET `/projects` | proyectos del workspace owner |
| GET `/projects/:id/epics` | id, número y título del mismo proyecto |
| POST `/projects` | UUID idempotente + nombre; clave interna generada |
| POST `/projects/:id/epics` | UUID idempotente + título |
| POST `/captures` | `CaptureSubmission`: v1, UUID, proyecto/Epic, campos, PNG y metadatos opcionales |
| POST `/disconnect` | revoca exclusivamente la instalación actual |

Cada escritura requiere `extension:write` **en el token y cliente**, además de
`extension:read`, audience de extensión, firma, owner, cliente activo y origen
si está presente. Conexiones antiguas no adquieren escritura: desconectar y
reconectar para nuevo consentimiento. El registro dinámico MCP no concede estos
scopes y los permisos de agente siguen separados. No se usan cookies owner en
esta API ni se amplía su lista de orígenes de confianza.

Capturas: JSON leído con límite real 12 MiB y timeout 15 s, PNG 8 MiB / 32 MP,
máximo dos operaciones simultáneas, normalización serializada por lock DB.
Sólo PNG RGB/RGBA de 8 bits no entrelazado: firma, estructura, CRC, dimensiones,
scanlines y descompresión acotadas. Se recomprimen scanlines validadas eliminando
metadatos auxiliares y bytes ocultos sobrantes. Los píxeles del PNG almacenado
son los del preview; el encoding/checksum puede cambiar sin cambiar la imagen.
No SVG, JPEG, APNG, rutas de cliente, SSRF ni fetch servidor de la URL capturada.

Ticket, número, actividad humana `chrome_extension`, evidencia y recibo se
confirman en una transacción. Recibo único por workspace/owner/operación/UUID,
hash canónico del payload y respuesta. Sobrevive reconexión/revocación y no
caduca automáticamente: un reintento viejo tampoco duplica. Cambiar el payload
con el mismo UUID produce 409. La imagen se sincroniza antes del commit; un
commit incierto no provoca borrado prematuro del archivo.

Errores estables: `validation`, `size`, `permission`, `auth` (cliente), `quota`,
`storage`, `conflict`, `busy`, `not_found`, `version` y `network` (cliente).
Sin SQL, imagen, URL, DOM ni token en errores/logs. El cliente persiste el payload
y UUID **antes** de enviar, bloquea edición en resultado incierto y sólo reintenta
por acción humana. Los errores definitivos de campos/destino permiten corregir.

## Borradores y datos privados

Un solo borrador en IndexedDB del origen de extensión; hasta 24 h desde cambio.
TTL verificado en lectura y limpieza al arrancar worker/panel; con Chrome
apagado no puede ejecutarse borrado puntual, pero nunca se restaura uno vencido.
Sin `unlimitedStorage`, sync, alarmas, colas de envío o telemetría. Su identidad
owner/workspace impide enviar desde otra cuenta. El envío incierto conserva
payload/UUID al recargar. Descartar advierte si el servidor pudo crear ya algo.
OAuth se guarda en `storage.local` con `TRUSTED_CONTEXTS`; el panel es también un
contexto privilegiado pero no recibe tokens mediante nuestro protocolo. Una
compromisión de código privilegiado sigue siendo una frontera crítica.

Evidencias: GET owner `/api/v1/issues/:id/evidence` y
`/api/v1/evidence/:id/image[?download=1]`; descarga requiere sesión y workspace,
`private, no-store`, `nosniff`, CSP sandbox y nombre generado. No filesystem keys
en respuestas. DOM se renderiza como texto y es colapsable/copiable; móvil
controla overflow. Actividad conserva actor, fecha y fuente Chrome.

## Volumen, cuota, backup y recuperación

`ISSOPEN_ATTACHMENTS_DIR` (producción `/data/attachments`) habilita almacenamiento.
`ISSOPEN_ATTACHMENTS_QUOTA_BYTES` por defecto 1 GiB. Volumen propio, no comparte
directorio con PostgreSQL. UUID PNG inmutable, permisos 0600, SHA-256/bytes/MIME/
owner/ticket/fecha en DB; `O_NOFOLLOW`, validación de claves y checksum en lectura.
Se reserva margen libre de disco. GET owner `/api/v1/extensions/storage` muestra
bytes/cuota para operación. Sin variable, aún pueden crearse tickets sin imagen.

El borrado lógico web posterior (ticket 60) conserva las evidencias y su cuota,
pero bloquea sus URLs y replays de captura. No amplía permisos de Chrome.
Ver [borrado y retención](ticket-deletion.md). Huérfanos por transacción fallida
nunca se sirven. Operación:

```bash
# Con entorno privado inyectado; nunca pegar valores en consola/documentos.
pnpm captures:audit
# Sólo tras revisar backup y el informe: mueve huérfanos >24 h a cuarentena,
# bajo el mismo lock de escritores; no toca archivos referenciados ni los borra.
pnpm captures:audit --quarantine
```

El comando devuelve sólo cantidades (incluye corrupción/ausentes). Cuarentena
recuperable dentro del volumen; no cuenta en cuota activa, sí consume disco.
Nunca ejecutar `rm`/podar PVC para arreglar almacenamiento. Restaurar un PNG de
cuarentena requiere confirmar su UUID, checksum y referencia antes de moverlo.

Backup desde el equipo de operación, **fuera del master**, con kubeconfig privado:

```bash
pnpm exec tsx scripts/backup-captures.ts /ruta/privada/kubeconfig.yaml /ruta/privada/backups
# Antes de habilitar el primer volumen: añadir --database-only.
```

Fija namespace/targets de Issopen, no muta Kubernetes. Dump consistente PostgreSQL
primero y tar del volumen inmutable después; manifiesto de checksums al terminar.
Directorios 0700/ficheros 0600. Un backup sin manifiesto completo no es válido.
Copias manuales: hacer antes de cada release y diariamente durante el piloto;
RPO = último backup, no se promete backup programado ni HA. Objetivo RTO piloto
30 minutos a verificar según tamaño. No subir dumps, tokens o capturas a Git/CI.

Restore: verificar SHA-256; restaurar `database.dump` con `pg_restore --no-owner`
en PostgreSQL aislado; extraer el tar en un directorio/volumen **nuevo**, nunca
sobre producción. Arrancar la misma versión apuntando a ambos; ejecutar auditoría
y comprobar imagen/DOM, ticket, recibos e idempotencia. La suite de integración
prueba dump completo → segundo PostgreSQL → volumen separado → checksum/píxeles
y cuarentena sin perder la imagen referenciada. No reemplazar datos del owner
sin autorización explícita y un plan de corte.

Migración `0013`: dos tablas nuevas y enum `chrome_extension`; aditiva. Rollback
de binario conserva tablas/enum, PostgreSQL, recibos y **ambos PVCs**. El servidor
0.3 no presenta las evidencias nuevas pero puede leer tickets. Nuevos tokens con
escritura no amplían a clientes viejos; revocar por instalación ante incidente.

## Gates y distribución

`pnpm validate`: lint, TS, unit/web, PostgreSQL, web/E2E OAuth real, extensión
(DOM hostil, geometría, máscaras, DPR/zoom/scroll/Escape, borrador), builds
idénticos y secretos. Integración comprueba rollback transaccional, reintento
concurrente/tras reconectar, read-only, imagen inválida, auth y restore. E2E
simula respuesta perdida **después del commit**, recarga y reintenta, confirma
un solo issue y píxeles negros en la imagen privada. Los perfiles/capturas de
prueba son sintéticos; no se suben trazas privadas a artifacts.

`pnpm extension:release` exige Git limpio y ejecuta todos los gates, después
produce ZIP determinista + SHA-256 + JSON con versión, commit y API. Sin bypass.
Workflow Forgejo `.forgejo/workflows/chrome.yml` hace lo mismo y sólo sube esos
ficheros tras éxito. Requiere runner aislado con Docker/Chromium; no instala ni
modifica runners productivos. Un workflow definido no equivale a un run observado.

Auditoría de dependencias: no nuevas dependencias runtime. Revisar `pnpm audit`;
la advertencia moderada GHSA-67mh-4wv8-2f99 proviene del esbuild antiguo opcional
de drizzle-kit/Better Auth: afecta al servidor de desarrollo, no invocado por
la app ni la extensión. No exponer servidores de desarrollo; runtime sirve
artefactos estáticos. No hay high/critical en el corte auditado; no forzar
overrides incompatibles en la cadena de migraciones sin pruebas específicas.

## Amenazas y límites conocidos

- Web hostil: mundo aislado, emisor exacto del panel, sin postMessage/WebAccessible
  resources, scripts locales, rutas API cerradas. No eval/código remoto.
- Página sensible: máscaras previas, DOM sin textos/valores, URL sin credenciales/
  query/hash y heurística de path; la revisión humana sigue siendo obligatoria,
  no se promete detectar todos los secretos en píxeles/rutas.
- Filtración de token: audience/PKCE/state, access 5 min, refresh máximo 30 días,
  revocación DB en cada petición. Revocar instalación, conservar evidencia,
  distribuir versión reparada y reconectar; no rotar a todos los agentes.
- DoS/archivos: límites previos, normalización, cuota y concurrencia. Piloto
  owner único, no es una plataforma pública multiusuario a escala.
- Disco/commit: archivos inmutables, fsync, lock/recibo, backup fuera del master,
  auditoría; local-path no es HA. Nunca rebajar límites para ocultar fallos.
- Store: antes de publicar requerirá política de privacidad pública, ficha,
  iconos/capturas aprobados, permisos justificados y validación manual de Chrome.
  **No se publica en Web Store en este MVP**; Edge/Brave no se declaran probados.

Fuentes primarias: [almacenamiento Chrome](https://developer.chrome.com/docs/extensions/reference/api/storage),
[content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts),
[zlib Node](https://nodejs.org/download/release/v24.2.0/docs/api/zlib.html),
[artifacts Forgejo](https://forgejo.org/docs/latest/user/actions/advanced-features/).
