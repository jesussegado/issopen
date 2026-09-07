---
mode: quick
task: 260907-vpo
status: complete
---

# Variantes del icono aperture-check

## Objetivo

Explorar seis alternativas del concepto 06 solicitado por el propietario,
probando verde, morado y cambios de estructura. Mantener el original y guardar
las propuestas como conceptos sin conectarlas al producto ni desplegar.

## Tareas

1. Generar seis PNG con la herramienta integrada de imágenes, usando el PNG
   original como referencia: esmeralda, morado, cuatro aspas bicolor, check
   integrado, apertura suave y órbita abierta. Inspeccionar cada resultado y
   comprobar formato y transparencia antes de guardarlo.
2. Guardar los resultados en
   `src/web/public/assets/branding/icon-concepts/aperture-variants/`, junto a
   una galería de comparación con fondos claro/oscuro y muestras a 16/32/64 px,
   README y prompts exactos. Enlazarla desde el README de conceptos.
3. Verificar las imágenes y referencias de la galería, ejecutar las
   validaciones del workspace, revisar el diff y registrar entrega y estado
   GSD. Preservar todos los cambios ajenos ya presentes en el worktree.

## Criterios de aceptación

- Seis alternativas distintas, incluyendo verde, morado y geometrías nuevas.
- Archivos originales conservados; sin cambio de favicon, runtime ni GitOps.
- PNG legibles y galería local navegable, con prompts reproducibles.
- Sólo los archivos de esta tarea entran en sus commits locales.

## Ejecución

Flujo GSD quick en el agente actual, sin agentes adicionales. Se usa el helper
local `gsd-tools.cjs init quick`, disponible en esta instalación, porque
`gsd-sdk` no está en PATH. No se instalan dependencias.

## Refinamiento solicitado por el propietario

Crear una nueva versión de la propuesta 05 con exactamente seis piezas curvas
alrededor del check. Conservar el verde bosque y el verde menta de la imagen
seleccionada, alternando tres piezas de cada color, y el check verde oscuro.
Guardar el resultado como variante 07 y conservar las seis propuestas previas.
Verificar visualmente el recuento, colores y transparencia; registrar prompt
y resultado sin cambiar el icono activo ni desplegar.
