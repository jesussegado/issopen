# Chrome 0.5: imágenes pegadas o seleccionadas

Petición actual del owner sustituye el editor/capturador de la extensión por
imágenes ya recortadas con otras herramientas. Sin reabrir decisiones del Epic.

1. Un bloque de adjuntos: Ctrl+V, botón Pegar (permiso opcional sólo por gesto),
   selección múltiple PNG/JPEG/WebP, miniaturas y eliminar antes de enviar.
   Máximo cinco imágenes y 8 MiB PNG totales / 32 MP por imagen. Normalizar
   localmente sin EXIF/metadatos; no leer texto/HTML/URLs del clipboard.
2. Adjuntar es una acción explícita: sólo esas imágenes normalizadas entran
   en el borrador local 24 h, con aviso visible. Enviar ticket es la única subida.
   No controles de captura/DOM en el flujo nuevo; cuenta/destinos se conservan.
3. API v1 aditiva con lista opcional de PNG; mantener payload/recibos antiguos,
   permisos humanos, cuota, atomicidad e idempotencia. Varias evidencias privadas
   del mismo ticket; sin migración de base de datos. Capacidad en /session.
4. Probar archivos inválidos/límites, pegar, eliminar, estados de carga/carreras,
   borrador y reintento tras recarga. OAuth/API/PNG privados en entorno aislado.
5. Publicar fuente y artefacto validado; backup y deploy GitOps del backend
   antes de actualizar Chrome. Mantener mismos PVC, perfil e ID. No responder
   ni cerrar la aceptación personal del Epic 33.

La UI de captura anterior queda retirada; sus helpers y tests puros se conservan
como código legacy, sin rutas de captura activas en el worker nuevo. No hace
falta permiso a la página para adjuntar imágenes. No tocar proyectos ajenos.
