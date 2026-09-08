---
mode: quick
task: 260908-kiy
status: complete
completed: 2026-09-08
source_revision: 5e2debde07edee5f3fc22aa5babd10fd99b3e3a0
gitops_revision: 4527b882f47a6697f44b406a4b6e75a42d2d3e84
control_plane_local_commit: 7cdc9facb0d3255013ebec50931a9e454c8b10c8
---

# Favicon blanco desplegado

El favicon de <https://issopen.serviciosegado.com> tiene fondo blanco opaco
para mejorar su lectura sobre pestañas oscuras. Se conservan las seis piezas,
el check y los colores bosque/menta. El logo de cabeceras y touch icon siguen
usando el PNG transparente original.

El nuevo asset es
[`issopen-favicon-v2-white.png`](../../../src/web/public/assets/branding/issopen-favicon-v2-white.png).
Se editó con `image_gen` usando el logo aprobado como referencia y se guardó
sin modificaciones posteriores. El [prompt íntegro y procedencia](./image-edit.json)
registran la solicitud de fondo blanco y conservación de la geometría.
El resultado es opaco en todos sus píxeles; las muestras de fondo son blancas
con una variación mínima de RGB (253–255), no un relleno matemáticamente
uniforme de `#FFFFFF`. La comparación a 16/32 px está en
[la captura de pestañas oscuras](./evidence/favicon-dark-tabs.png).

HTML declara la URL versionada nueva; `/favicon.ico` sirve sus mismos bytes
como `image/png`. La decisión de diseño 0001 y `AGENTS.md` documentan la variante.

## Publicación

- Fuente publicada y construida: `5e2debde07edee5f3fc22aa5babd10fd99b3e3a0`.
- GitOps/main: `4527b882f47a6697f44b406a4b6e75a42d2d3e84`.
- Registro en la rama del checkout canónico de homelab: `7cdc9facb0d3255013ebec50931a9e454c8b10c8`.
- Imagen: `registry.serviciosegado.com/issopen:favicon-white-5e2debd@sha256:e94cd0b09ee2d961584ceb7b30151c3c5f621f4dd8486815498fcf1af2e66902`.

La imagen se construyó desde `git archive` del commit publicado, con revisión
OCI correcta y digest comprobado en el registry. Incluye el cambio concurrente
de etiquetas sin corchetes de `aa52179`, que ya estaba activo antes de esta
release. El commit público de GitOps se preparó en un worktree limpio de main;
conserva su estructura legacy y excluye otros trabajos de plataforma.

Sólo cambian el descriptor, la imagen de Deployment, los values de referencia
y la nota de release bajo `apps/issopen/deploy/`. El diff de Kubernetes
renderizado cambia únicamente la imagen web. Se esperó la reconciliación
automática, sin mutaciones directas sobre Kubernetes, sincronización forzada
ni cambios DNS. No se modificaron dependencias, Dockerfile, esquema ni permisos.

## Verificación

- Lint, typecheck y build correctos. La aceptación existente de branding pasa
  en escritorio y móvil (2 tests), incluyendo descarga exacta y fondo opaco.
  Se ejecutó la aceptación pertinente al favicon, no toda la suite del tracker.
- Escaneo final de secretos correcto: 126 archivos de fuente y documentación.
- Imagen final: PostgreSQL efímera, readiness 200 y bytes/MIME correctos para
  ambas rutas del favicon. Contenedores y red de prueba retirados.
- Homelab: 190 tests y catálogo de 31 checkouts correctos; render Kustomize y
  `git diff --check` correctos. Ansible y Helm no están instalados; se omiten
  sus comprobaciones opcionales, sin cambios en esas áreas.
- Argo CD `Synced/Healthy` en `4527b882`; pod `issopen-974549dc4-j8cn8` Ready,
  cero reinicios y digest efectivo esperado. Logs de arranque sin errores.
  Service y EndpointSlice apuntan a `10.0.0.84:8080`; Ingress conservado.
- PostgreSQL conserva UID `ab78f6be-f08f-4d8b-a7ea-bc100a5ddfdc`, Ready y cero
  reinicios; PVC conserva UID `cf93e0a7-b978-46c2-9c03-c77f902742b9`, Bound.
- HTTPS: readiness 200 y los dos endpoints del favicon devuelven el PNG
  esperado (925588 bytes, SHA-256
  `98e9965e4f229f6ee8188988ed58ca140ad647fe23b54422e19befb3ee148a0e`).
  El logo original coincide byte a byte con el aprobado.
- Chromium anónimo: favicon declarado correcto, touch icon original, logo y
  favicon decodificados completos y fondo opaco claro en las cuatro esquinas.
  La primera carga del favicon produjo `EncodingError`; la descarga HTTP ya
  coincidía con el archivo, y una página nueva con URL de verificación sin
  caché pasó sin peticiones fallidas. No se modificaron datos productivos.

## Evidencia

- [Validación de fuente y opacidad](./validation.json).
- [Smoke de imagen](./image-smoke.json).
- [Revisiones y digest de release](./release.json).
- [Runtime y conservación de PostgreSQL/PVC](./runtime.json).
- [Smoke público HTTPS y navegador](./evidence/public-smoke.json).

## Rollback

Revertir el commit GitOps `4527b882` restaura la imagen anterior:

`registry.serviciosegado.com/issopen:plain-labels-aa52179@sha256:cbde4f9c6a2efd8c1bc6235cecb6d11b43641493300fa3391d95f051ec835015`.

Fuente anterior: `aa521793be898b658f485020f0cd0763ffc5bcdc`. No requiere revertir
esquema ni tocar PostgreSQL/PVC. Preservar cualquier release posterior al
preparar un rollback. No quedan bloqueos dentro del alcance de esta corrección.
