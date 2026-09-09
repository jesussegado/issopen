# Chrome Epic — evidencia del primer corte

Fecha: 2026-09-09. Alcance de esta entrega: EXT-01 / 19 y EXT-02 / 20.
Plan/canon: [PLAN.md](PLAN.md) y Epic `ca26c29b-43ac-4ca0-b768-594d6779d6e7`.
Commit del alcance aprobado: `18658bb`.

## Decisiones y atribución

El propietario aprobó las recomendaciones de las 16 preguntas pendientes.
Se registraron por la API normal desde su sesión web autenticada, en su nombre
y bajo esa autorización explícita; no mediante SQL ni elevación del agente.
La relectura MCP independiente verificó 17/17 respondidas, cero bloqueantes y
la conservación de «Crear proyecto y Epic» (respuesta anterior de EXT-01).
La identidad agentica separada registró comentarios, reclamó 19/20 y actualizó
el plan. El comentario de 26 hace explícita la creación inline de ambos.

## Implementación y límites

- Workspace pnpm WXT/React/TS, MV3, panel lateral, worker y content script
  runtime aislado. Sin host permissions ni inyección global.
- Protocolo v1 validado con Zod y emisor restringido. Consulta de origen,
  viewport y DPR sólo al comprobar; sin persistencia, red, DOM o imagen.
- Apertura manual en `action.onClicked` y `sidePanel.open`: se reprodujo que
  `openPanelOnActionClick: true` abría el panel SIN otorgar activeTab en
  Chromium 151. La corrección se validó sin ampliar permisos.
- Marca aprobada copiada byte a byte; layout real comprobado a 360 px y prueba
  adicional a 320 px, sin desbordamiento. Guías y AGENTS del workspace añadidos.
- Root `pnpm validate` incorpora gates específicos, sin importar tests E2E de
  extensión en el runner Vitest de la app. Escaneo de secretos ampliado a
  extensión y documentación. Docker del servidor no necesita el workspace.

No hay OAuth de extensión, captura de imagen, selección DOM, redacción,
adjuntos, creación de tickets, borradores, distribución estable ni aceptación
de producción. Esos trabajos siguen en 21–33. No se cierra el Epic ni se
marcan fases históricas completas; 43 permanece cerrado, 44 no se inicia.

## Verificaciones observadas

| Comprobación | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, dos workspaces |
| `pnpm extension:validate` | PASS completo |
| Unitarios extensión | 27 PASS (protocolo, emisor, worker, navegación/errores) |
| E2E extensión | 2 PASS (manifest y acción real de Chromium) |
| Chromium | 151.0.7922.34, Playwright 1.62.1; perfil efímero |
| Permiso antes/después del icono | Antes: URL inaccesible. Después: script real responde. Navegar fuera: denegado |
| Payload/UI | Sin path/query/hash/título/formulario/DOM de fixture; cero peticiones HTTP del panel |
| Build productivo | 7 archivos, MV3 0.1.0, sin sourcemaps ni hosts/remoto |
| Dos builds consecutivos | Byte-identical; tree SHA-256 abajo |
| `pnpm extension:dev` | PASS, servidor local y output dev con sourcemaps; detenido al terminar |
| Lint + TypeScript raíz/extensión | PASS |
| Unitarios/web raíz | 75 PASS en 22 archivos |
| Integración servidor/PostgreSQL | 40 PASS en 7 archivos |
| E2E web | 7 PASS, 1 SKIP preexistente en matriz móvil |
| Build web/servidor | PASS |
| Docker `--target dependencies` | PASS con lockfile nuevo, sin copiar extensión al contenedor |
| Secret scan | PASS, 185 archivos antes de este resumen |
| `homelab make validate` | PASS, 197 tests; Ansible y Helm ausentes, checks omitidos por el runner |
| `workspace validate --checkouts` | PASS, 31 repos declarados |

Tree SHA-256 (JSON de rutas ordenadas → hash de cada archivo, calculado por
`scripts/check-extension-build.ts`):
`17f6189fb612a649f072535cc66850dd8d62dfc1b82921db422ac2c9784c3f85`.

Screenshot de fixture sin datos reales:
`extensions/chrome/test-results/foundation-real-toolbar-ac-70e6f--opens-a-working-side-panel/sidepanel.png`.
Es salida ignorada y regenerable. No se guardaron perfiles, cookies ni tokens.

## Entrega y recuperación

Artefacto listo para cargar unpacked en
`extensions/chrome/.output/chrome-mv3`. Seguir el README del workspace.
No se instaló en el perfil personal ni se publicaron imágenes/Cloud Store,
DNS, GitOps o cambios de producción. Para revertir la instalación local,
desactivar o eliminar esa extensión; no hay datos que migrar ni recuperar.
Commits locales; sin publicar los commits anteriores pendientes de la skill.

Siguiente corte: EXT-03 / 21 (vinculación humana PKCE), seguido del contrato de
capturas/adjuntos; 23/24 son independientes tras la base. Releer las decisiones
canónicas antes de ejecutar, reclamar por identidad MCP y devolver a revisión
con evidencia. No usar el PAT de agente como credencial de usuario de extensión.
