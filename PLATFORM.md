# Relación con la plataforma

Este es un repositorio privado e independiente de tipo `application` dentro de
`~/Projects/platform/`. Su remoto canónico es
`ssh://git@192.168.2.165:2222/jsegado/issopen.git`.

El estado deseado está separado en `~/Projects/platform/homelab/apps/issopen/`.
El código produce artefactos o imágenes; `homelab` referencia versiones
inmutables y nunca depende de este checkout local para reconciliar producción.
