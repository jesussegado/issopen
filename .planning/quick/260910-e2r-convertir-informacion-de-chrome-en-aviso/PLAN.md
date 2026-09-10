# Aviso informativo cerrable y ayuda permanente en Cuenta

Ticket 52 (`327e0b54-0f31-4cec-990f-95a4d26795b2`), Epic Chrome 1.

Petición del owner: la introducción no debe ocupar siempre el compositor.
La captura adjunta muestra 0.4.3; aplicar sobre el flujo vigente 0.5 de imágenes,
sin reintroducir captura/DOM ni tocar API/Kubernetes.

1. Un aviso informativo compacto con cierre accesible y preferencia local que
   sobreviva recarga/reapertura. No timeout automático, permisos o notificación OS.
2. Reutilizar el contenido siempre dentro de Cuenta, incluso desconectada.
   Mover allí las notas genéricas repetidas de privacidad/borrador; conservar
   límites de archivo y errores/estados operativos en su contexto.
3. No desmontar compositor/cuenta ni tocar imágenes, borrador, tokens o destino.
   Cierre con foco útil, fallo de storage sin bloquear trabajo, sincronizar
   preferencia entre vistas del mismo perfil.
4. Probar teclado, reapertura, ayuda tras descartar, borrador intacto y 320/400px.
   Release limpia 0.5.1 y actualizar mismo perfil/ID sin perder trabajo.
