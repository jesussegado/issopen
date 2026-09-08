---
mode: quick
task: 260908-ja5
status: complete
completed: 2026-09-08
source_revision: 2b0bb5a78b0e6847a3e1a694225db4371b86c671
gitops_revision: a1956385752a38bc8261ee9b4d6d5b27bfa7d299
control_plane_local_commit: c17e6cbc00c475ddb401c6848e643e979ae884bd
---

# Identidad bosque y menta desplegada

La nueva identidad está disponible en
<https://issopen.serviciosegado.com>. Argo CD reconcilió automáticamente el
commit `a1956385` como **Synced/Healthy**. Logo, favicon y tokens de color se
verificaron por HTTPS en la aplicación real, en escritorio y móvil.

## Artefactos y commits

| Artefacto | Revisión |
| --- | --- |
| Fuente publicada y construida | `2b0bb5a78b0e6847a3e1a694225db4371b86c671` |
| GitOps publicado en main | `a1956385752a38bc8261ee9b4d6d5b27bfa7d299` |
| Registro en la rama del checkout canónico de homelab | `c17e6cbc00c475ddb401c6848e643e979ae884bd` |
| Tag nuevo | `registry.serviciosegado.com/issopen:brand-2b0bb5a` |
| Digest verificado en registry y pod | `sha256:33679a9e2c4edcdbeb8ee4064ca584dcadf011485df2404423f667506c2526b1` |
| Manifiesto linux/amd64 del índice | `sha256:d6d12bd55c474760b6809d8e423ebcf68cb0ddb25889d731c0a00e673947bd96` |

La imagen se construyó desde `git archive` de la fuente publicada, sin enviar
archivos locales ignorados ni secretos al build. La etiqueta OCI de revisión
coincide con el SHA completo. No cambiaron Dockerfile, dependencias ni
migraciones respecto a la revisión productiva anterior.

El checkout principal de homelab permanece en su rama de trabajo existente.
El commit publicado se preparó en un worktree limpio de `gitops/main`,
preservando su estructura legacy y sin incorporar otras tareas de plataforma.
Sólo cambian cuatro archivos bajo `apps/issopen`: descriptor, Deployment,
values de referencia y nota operativa de release. El diff de Kubernetes
renderizado cambia **únicamente la imagen del contenedor web**.

## Verificación

- Fuente: se conserva la validación completa de quick `260907-wrj` para el
  mismo código (31 unitarias/web, 31 integración, 5 E2E aprobadas y el skip
  intencional del dogfood móvil), más su build y comprobación de secretos.
- Imagen final: arranque con PostgreSQL efímera, readiness 200, UID 1001,
  REST anónima 401, icono/favicon idénticos al original, colores del CSS y
  apagado limpio con salida 0. Contenedores y red de prueba eliminados.
- Control plane: 190 tests aprobados, Kustomize correcto y catálogo de 31
  checkouts válido. Ansible y Helm ausentes; sus checks opcionales se omiten.
- La primera validación rechazó una nota de release en la raíz del descriptor;
  se trasladó a `deploy/RELEASE-2026-09-08.md`, siguiendo el contrato del repo,
  y la validación completa pasó antes de publicar.
- Producción: `issopen-b479646b4-b6ncc`, 1/1 Ready, cero reinicios y digest
  efectivo esperado en `debian13-torre-nya`. Logs de arranque sin errores;
  migraciones completadas y servidor iniciado en el puerto 8080.
- Service y EndpointSlice apuntan al nuevo pod (`10.0.0.114:8080`). Ingress y
  probes conservados. Medición posterior: web 1m CPU / 55 MiB; PostgreSQL
  8m CPU / 39 MiB.
- PostgreSQL conserva UID `ab78f6be-f08f-4d8b-a7ea-bc100a5ddfdc`, Ready y cero
  reinicios. PVC conserva UID `cf93e0a7-b978-46c2-9c03-c77f902742b9`, Bound.
- HTTPS real: readiness 200, HSTS conservado, REST anónima 401, logo y favicon
  PNG con SHA-256 `dde3a1b048f27664a1fe195aef7bc56290f98eacfe296b4bf2a6f5c72cf5492c`.
- Chromium a 1440 y 360 px: logo cargado y decodificado completo, forest/mint
  aplicados, favicon declarado correcto, sin errores JavaScript ni scroll
  horizontal. HSTS se comprueba en una respuesta HTTP nueva; la navegación
  móvil reutilizada podía devolver cabeceras de caché incompletas.
- Una captura móvil inicial tenía una carga parcial del icono. Se comprobó
  que el PNG original y su respuesta HTTPS completa se decodifican bien; las
  capturas finales esperan explícitamente `image.decode()` y verifican
  `complete` antes de guardarse. Durante estas pruebas hubo una navegación
  local interrumpida por `ERR_NETWORK_CHANGED`; el recorrido final pasó.
- Escaneo de secretos final de fuente y documentación: 117 archivos, correcto.

El smoke productivo fue de sólo lectura y anónimo. Los flujos autenticados se
validaron con datos sintéticos en la tarea de implementación; no se crearon
proyectos, issues, sesiones de propietario ni credenciales de prueba en
producción. No hubo cambios de esquema ni intervenciones directas sobre el
clúster o DNS. Se esperó la reconciliación automática, sin forzar un sync.

## Evidencia

- [Imagen probada](./image-smoke.json).
- [Referencias de release y baseline](./release.json).
- [Estado del runtime](./runtime.json).
- [Smoke HTTPS y navegador](./evidence/public-smoke.json).
- [Captura de escritorio](./evidence/production-sign-in-1440.png).
- [Captura de móvil](./evidence/production-sign-in-360.png).

## Rollback

Revertir `a1956385` mediante GitOps restaura:

`registry.serviciosegado.com/issopen:epic-numbers-f79e305@sha256:61d2f3989b9fbbeccd48336c3534fa112334d9843641c0b6950f7d9d8e14b16d`.

Fuente anterior: `f79e305d7358f4d46a25f2ecfb13916f4824ea3a`. El esquema es
idéntico; el rollback no requiere borrar datos ni recrear PostgreSQL o PVC.
No quedan bloqueos dentro del alcance de esta publicación.
