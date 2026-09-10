# Compositor Chrome 0.4.1

Accesos Crear proyecto / Crear Epic juntos al principio de Crear ticket, antes
del aviso y los campos. Botones con iconos +/−, foco visible, estado expandido y
paneles semánticos. Conserva nombres, guards, destino y contratos existentes.
Actualizar Epics mantiene separación de bloque respecto al título del ticket.

Primeras verificaciones: lint de ficheros propios, TypeScript, build, 46 unitarias
y E2E OAuth/API real completo pasan. Nuevo E2E de compositor pasa a 320/400 px,
incluyendo posición, teclado, ocultación, conservación y permisos. Inspección
visual del screenshot a 320 px realizada. El E2E compartido encontró dos fallos
en cambios paralelos ajenos de errores de captura; no se modifican ni incluyen
en este commit. Verificar este parche de forma aislada antes de cargarlo.

Sólo artefacto de extensión; no reiniciar/desplegar web, Kubernetes o base de
datos. La aceptación humana 33 sigue pendiente. Verificación final a continuación.

## Entrega verificada

- Fuente `724a2da8063b5903ce2b7fb5c5b635e562135536`, publicada en origin/main.
- Release desde worktree limpio separado: `pnpm extension:release` PASS,
  **183 tests** (78 unit/web + 45 integración + 8 web/OAuth E2E + 46 unit extensión
  + 6 browser extensión), 2 skips esperados, lint/TS, secreto scan y build
  reproducible. Los fallos ajenos del checkout compartido no aparecen aquí.
- ZIP `extensions/chrome/.output/releases/issopen-chrome-0.4.1-724a2da8063b.zip`;
  SHA256 `e52c675aa748c89fea6062fa16ed0e6b23e70eb205f8a864fcae29187916c2a7`,
  checksum verificado. Artefacto copiado al checkout normal sin tocar sus fuentes
  paralelas. Output previo conservado como `.output/chrome-mv3-before-buttons-20260910-0701`.
- Chrome real del perfil de pruebas recargado en la misma ruta e ID unpacked,
  **0.4.1**, cuenta todavía conectada. No había texto ni captura pendiente antes
  de recargar. Ambos botones abren/cierran los formularios; el compositor queda
  visible para el propietario. Screenshot privado en `test-results/composer-chrome-041.png`.
- No se reinició ni publicó el servidor. Backend permanece compatible sin cambio.
