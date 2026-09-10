# Error de captura comprensible — ticket 49

El aviso de la captura del owner procedía de un catch genérico. No permite
deducir retrospectivamente si fue permiso, navegación, contenido o tamaño.

Implementado un catálogo tipado de causas y recuperación con textos estáticos;
el worker devuelve un código seguro y la UI título, explicación, pasos y aviso
de que no se ha enviado esta captura. Se conserva el preview anterior. Si no hay
causa comprobada, se declara desconocida; nunca se reenvían excepciones de Chrome.
La verificación del documento distingue mutación de contenido de resize/DPR sin
relajar ninguna protección ni alterar la limpieza/restauración.

Regresión inicial: extension:validate PASS, 77 unitarias y 8 E2E Chromium,
typecheck/lint, build idéntico y secret scan. E2E verifica navegación a otro origen
sin permiso → aviso correcto → icono real → captura correcta, resize separado,
contenido cambiante/decoys, límites/cancelación y preview previo intacto.

El cambio de botones paralelo 724a2da se conserva. Esta entrega 0.4.2 modifica
sólo el artefacto de extensión; no necesita reiniciar servidor ni Kubernetes.
Publicación y verificación de la versión final se registrarán tras completarlas.
Ticket 33 sigue pendiente de aceptación personal; no se responde ni cierra aquí.
