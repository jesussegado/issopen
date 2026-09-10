# Accesos de creación en el compositor Chrome

Petición aprobada con captura: mover «Crear proyecto aquí» y «Crear Epic aquí»
arriba de Crear ticket y presentarlos como botones. Entrada GSD init quick.

1. Dos botones juntos antes del aviso y los campos, con icono +, foco visible,
   estado expandido y formularios inline accesibles. Conservar campos, validación,
   destino, borrador y permisos. Sin cambios de servidor ni Kubernetes.
2. Regresión E2E: posición, teclado, apertura/cierre, conservar nombres al cambiar
   de formulario y creación real de proyecto/Epic; capturas y envío sin cambios.
3. Build/version patch, verificar a 320 px y en el Chrome de pruebas, conservar
   borrador revisado antes de recargar. Commit/push y artefacto local actualizado;
   documentar pruebas. No cerrar la aceptación humana 33 ni tocar 43/44.
