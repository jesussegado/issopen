# Enlace y acciones del compositor

Petición del owner: mejorar el enlace del ticket creado y colocar los botones
uno debajo de otro, evitando solapamientos en el panel estrecho.

1. CSS acotado al compositor: enlace principal destacado con flecha externa,
   ancho completo y foco visible; botones finales apilados con separación.
   Cubrir confirmación y envío/reintento/descarte. No cambiar lógica/API.
2. Tests de éxito real y compositor a 320/400px: geometría, enlace target/rel,
   teclado, acciones y nueva preparación sin repetir envío.
3. Release 0.5.4 desde Git limpio, publicación y comprobación en Chrome.
   El owner tiene la confirmación de ticket 55 abierta; si sigue ahí, cargar
   el CSS del artefacto validado en esa vista sin recargar/desmontar su estado.
   Paquete completo para próxima apertura. No simular persistencia de éxito.
4. Registrar evidencia, commit y Ready for Review. Sin backend/GitOps, nuevos
   permisos ni lecturas de clipboard. No borrar ni volver a enviar la imagen.
