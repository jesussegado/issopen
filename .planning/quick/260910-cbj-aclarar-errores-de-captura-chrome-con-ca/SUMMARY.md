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
Ticket 33 sigue pendiente de aceptación personal; no se responde ni cierra aquí.

## Entrega final verificada

- Fuente `db26d877b7d2d25c38e46aad6ce9beaa32500d1f`, publicada en origin/main.
- Release desde worktree limpio aislado para no interferir con los cambios
  paralelos del compositor. `pnpm extension:release`: **216 PASS**, 2 skips
  esperados (78 unit/web, 45 integración, 8 web/OAuth, 77 unit extensión,
  8 browser). Lint/TS, secreto scan y builds reproducibles pasan.
- Homelab `make validate`: 197 tests PASS, workspace/checkouts correcto.
  Ansible/Helm no disponibles; no cambios en esas tecnologías ni en GitOps.
- ZIP `extensions/chrome/.output/releases/issopen-chrome-0.4.2-db26d877b7d2.zip`;
  SHA256 `8a085431c50065e3273f829878fb85b8ee1b4242aedaed607c5eff0aa1277e6b`.
  ZIP/checksum comprobados y copiados al checkout habitual junto al unpacked.
- Artefacto 0.4.1 conservado en `.output/chrome-mv3-before-errors-20260910`.
  Se mantiene el mismo ID/ruta de instalación. Chrome real de pruebas recargado
  y verificado en **0.4.2**, cuenta todavía conectada. No había texto, captura ni
  reintento pendiente antes de recargar. El primer intento de abrir el panel
  coincidió con el reinicio del worker; repetir la acción lo abrió correctamente.
- Screenshot del aviso de acceso inspeccionado: título legible, causa y pasos
  numerados, sin URL privada ni excepción cruda. Guardado en los resultados
  sintéticos de Playwright del worktree de release, no versionado.
- Ticket **49 Ready for Review v6**, claim null, sin preguntas bloqueantes,
  leído de nuevo por MCP tras enlazar commit/evidencias. 33, 43 y 44 intactos.

No afirmar que el aviso histórico fuera necesariamente falta de permiso. Al
reproducir el problema con esta versión se muestra la causa que sí se detecta.
