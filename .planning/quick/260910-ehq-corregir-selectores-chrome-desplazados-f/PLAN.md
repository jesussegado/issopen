# 53 — Selectores visibles dentro del panel Chrome

Petición: «no funcionan los selectores». Epic Chrome, ticket
`2e35f68d-ca28-4432-872d-999b9df5004b`, reclamado e In Progress.

## Diagnóstico observado

Chrome 152 Linux, extensión 0.5.1 conectada: Proyecto 3 opciones, Epic 5,
Prioridad 4 y Estado 5; ningún campo deshabilitado ni error de API.
Al clicar Proyecto, `:open` y AX expanded=true, pero el popup X11 aparece en
X=2592, ancho 271, fuera de la ventana Chrome X=0..2560. Es un problema de
posición del popup nativo en este panel, no falta de proyectos.
No se modificaron selecciones ni se accedió al portapapeles.

## Trabajo

1. Reemplazar los cuatro popups nativos por un selector accesible con lista
   HTML dentro del panel (sin ventanas del sistema). Conservar filtros,
   valores internos, creación inline y bloqueo de operaciones pendientes.
2. Probar clic real sobre opciones, teclado, cierre/cancelación, filtros,
   cambio de proyecto/Epic, carga asíncrona y borrador persistido; tamaños
   320/400 px. No basta con `selectOption` que evita el popup.
3. Gates completos y release 0.5.2 desde Git limpio; publicación privada y
   recarga de la misma instalación sólo tras confirmar el borrador guardado.
   Verificar en Chrome real sin enviar la imagen/ticket del owner.
4. Documentar y devolver ticket a Ready for Review con commit/evidencias.

Sin cambios de backend, API, permisos, DB ni formato de borrador. No cerrar
el criterio personal 33. No tocar cambios ajenos en homelab.
