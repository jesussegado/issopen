---
task: 260907-vpo
status: complete
date: 2026-09-07
asset_commit: 96de32a
---

# Seis variantes de aperture-check

Se entregan seis conceptos PNG de 1254 × 1254 con alpha real: esmeralda,
morado, cuatro aspas verde/morado, check integrado, apertura suave en verdes
y órbita abierta morado/lima. El original permanece idéntico al de Git.

## Archivos y método

- `src/web/public/assets/branding/icon-concepts/aperture-variants/` contiene
  seis PNG individuales, galería HTML, captura comparativa, README y prompts.
- El README de conceptos enlaza la nueva galería.
- Generación con `image_gen` integrado, una petición por variante. Las
  variantes 03–06 recibieron extracción del damero de fondo; la 01 recibió
  reparación de una mancha y extracción de fondo adicional.
- La galería muestra fondos claro, oscuro y damero, y tamaños de 64/32/16 px.
  `comparison.png` es una captura de Chromium; no se editaron los iconos con
  Python, SVG ni herramientas de procesamiento raster.
- Se usó el helper GSD local `gsd-tools.cjs init quick`; `gsd-sdk` no está en
  PATH. Ejecución en el agente actual y sin instalar dependencias.

## Validación

- Inspección visual individual y comparativa en fondos claro/oscuro: realizada.
- Seis PNG decodificables, cuadrados, RGBA y rango alpha 0–255: comprobado.
- Original comparado por SHA-256 con `HEAD`: idéntico.
- Chromium: seis tarjetas, 25 imágenes cargadas, botones de fondo operativos,
  sin errores JavaScript ni overflow horizontal a 390 px.
- Biome dirigido a galería y prompts: pasa.
- `pnpm test:secrets`: pasa.
- `git diff --check` y `git diff --cached --check`: pasan.
- `homelab/make validate`: pasa, 190 tests. Omite syntax-check de Ansible y
  Helm lint porque esas herramientas no están instaladas.
- `workspace validate --checkouts`: pasa, 31 repositorios declarados.
- No se ejecutó la suite funcional de la aplicación ni su build: los cambios
  son conceptos visuales y documentación, sin conexión al runtime.

## Entrega y límites

Commit de assets: `96de32a`. Sin commit GitOps, push ni despliegue; ningún
favicon ni referencia del producto cambia. Los cambios de Epics presentes
al inicio quedaron fuera de esta tarea y fueron preservados.

Son conceptos raster para decidir una dirección, no un master vectorial de
marca: los bordes y los tokens de color se podrán normalizar al elegir uno.
La decisión visual queda en manos del propietario, sin bloquear esta entrega.

Rollback: revertir el commit de assets elimina los conceptos nuevos y su
enlace, sin efecto en datos o producción.

## Refinamiento 07 · Seis piezas

A petición del propietario se conserva la paleta de verdes de la propuesta 05
y se cambia su apertura a seis piezas curvas, tres oscuras y tres menta
alternadas, con check verde oscuro independiente. Archivo:
`src/web/public/assets/branding/icon-concepts/aperture-variants/issopen-aperture-07-seis-piezas-verde-bosque.png`.
Los prompts exactos de generación, reparación y extracción con `image_gen`
integrado se guardan en `issopen-aperture-07-prompts.json` y el README enlaza
ambos archivos. La variante 05 permanece idéntica a Git.

Se inspeccionaron las seis piezas y los colores; se comprobó PNG 1254 × 1254,
RGBA, alpha real 0–255 y la reparación de una zona interior que el generador
había erosionado. El interior revisado de esa pieza tiene alpha 253–254.
Biome y diff-check pasan. Se repitió `homelab/make validate` (190 tests OK,
Ansible y Helm ausentes) y `workspace validate --checkouts` (31 repos OK).
No cambió lógica de aplicación y no se ejecutó su suite funcional.

Commit del refinamiento: `cfe220d`, local, sin push ni despliegue. Para revertir
solamente esta iteración, revertir ese commit; las propuestas anteriores quedan
conservadas.
