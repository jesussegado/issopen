---
mode: quick
task: 260908-kiy
status: complete
---

# Favicon sobre blanco

El propietario pide fondo blanco para mejorar el favicon en pestañas oscuras.
La autorización de despliegue de esta sesión sigue vigente.

1. Editar el PNG aprobado con image_gen para añadir fondo blanco, conservando
   las seis piezas, check, colores y márgenes. Guardar un favicon versionado
   independiente; el logo de las cabeceras y touch icon conservan su asset.
2. Cambiar la declaración HTML y la ruta convencional `/favicon.ico`, adaptar
   la aceptación existente y registrar esta aplicación de marca. Verificar
   carga completa, fondo opaco claro y aspecto a 16/32 px sobre una pestaña
   oscura; ejecutar lint, typecheck, E2E y build relevantes.
3. Publicar fuente, construir imagen inmutable, publicar digest verificado,
   actualizar únicamente Issopen por GitOps y esperar reconciliación normal.
   Verificar HTTPS, favicon nuevo, runtime sano y PostgreSQL/PVC conservados.

Rollback: imagen actual `plain-labels-aa52179` por GitOps; sin migraciones,
cambios de permisos, datos, infraestructura o rutas públicas nuevas.

Se conserva la actualización concurrente de etiquetas (`aa52179` / GitOps
`bbd6a900`), ya activa al preparar la imagen del favicon.
