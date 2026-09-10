# Mensajes claros de captura Chrome

Petición directa del owner, 2026-09-10: explicar el aviso genérico y mejorar su
descripción. El aviso anterior agrupa fallos distintos y no permite diagnosticar
la captura histórica. No atribuirla a permisos sin evidencia.

1. Devolver códigos seguros para acceso/página restringida, navegación, cambios
   de contenido/tamaño, límites y fallo desconocido. Mantener todas las barreras
   de privacidad y limpieza. No devolver errores crudos de Chrome, URL ni DOM.
2. Mostrar título, causa comprobada y pasos específicos en español, distinguiendo
   conexión con la extensión de conexión con Issopen. Mantener preview/borrador.
3. Regresión unitaria y Chrome real: acceso denegado, contenido cambiante,
   redimensionado, cancelación, límites y captura correcta. Validar artefacto.
4. Publicar sólo la extensión: no reiniciar ni desplegar Kubernetes por este cambio.
   Conservar instalación/storage y no recargar un panel con trabajo no revisado.
5. Registrar evidencias en Issopen y STATE, sin responder aceptación personal 33.

El cambio paralelo de botones proyecto/Epic vive en quick 260910-cbm y fue
commiteado en 724a2da durante este trabajo. Se conserva sin modificarlo; los
estilos de error van en un archivo separado. Este arreglo incrementa 0.4.1 a 0.4.2.
