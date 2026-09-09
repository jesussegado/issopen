# AGENTS.md — extensión Chrome de Issopen

Se aplican las instrucciones de `../../AGENTS.md`. Es un workspace pnpm de la
misma fuente: nunca crear un `.git` independiente aquí. Canon de trabajo:
Epic `ca26c29b-43ac-4ca0-b768-594d6779d6e7`, tickets 19–33 en Issopen.

## Qué hay y cómo funciona

- WXT 0.21.4, MV3, React 19.2.8, TypeScript 6.0.3 y Zod 4.5.4, fijados en
  package/lockfile. Build de extensión independiente de Docker/web/API.
- `wxt.config.ts`: manifest, permisos, CSP, build y asset de marca compartido.
- `entrypoints/background.ts`: acción del icono, apertura del panel, validación
  del emisor, consulta de pestaña e inyección bajo activeTab.
- `entrypoints/page.content.ts`: script runtime, frame principal, mundo
  aislado; devuelve origen + viewport + DPR. No captura DOM ni imágenes.
- `entrypoints/sidepanel/`: panel React en español, conexión humana, proyectos,
  comprobación, resultado efímero, limpieza y errores accionables.
- `lib/account.ts`: PKCE, validación estricta de callback/state y operaciones
  serializadas en worker; access/refresh en storage.local con TRUSTED_CONTEXTS.
  No exponer credenciales en respuestas, storage.sync, logs o URLs. Permiso de
  host exclusivamente para la instancia configurada al compilar (HTTPS o
  loopback explícito de test); no ampliar trustedOrigins de la REST owner.
- `lib/protocol.ts`: mensajes v1, schemas de frontera, URLs restringidas y
  errores seguros; no importar dominio, base de datos o secretos del backend.
- `tests/unit/`: contratos, privacidad, emisor, worker y navegación cambiante.
- `tests/e2e/`: artefacto productivo y acción real de Chrome con perfil efímero.

## Invariantes y próximos tickets

La versión 0.2 añade OAuth humano (21) a la base (20), no el Epic completo.
Mantener visible que no hay captura/envío de tickets hasta 22/23/25/26. El propietario
aprobó recomendaciones y conservó «Crear proyecto y Epic»; no sustituir esa
respuesta por sólo selección. Alcance y dependencias en
[`../../docs/chrome-extension.md`](../../docs/chrome-extension.md).

- No acceso preventivo/global a webs, captura automática, incógnito o permisos
  futuros. Abrir desde el selector del panel no equivale a otorgar activeTab.
- No volver a `openPanelOnActionClick: true` sin comprobar la concesión real:
  en Chromium 151 abría el panel pero no otorgaba acceso. Mantener acción
  explícita + `sidePanel.open` y su test.
- No tokens de agente para actuar como persona. OAuth PKCE humano revocable
  usa `/extensions/link` y `/api/extension/v1`, con clientes por instalación
  y caducidad máxima de 30 días; la revocación web afecta la siguiente petición.
- Ni DOM, valores de formulario, URLs privadas ni errores crudos en logs.
  Captura y redacción futuras deben permanecer locales hasta el envío humano.
- No afirmar soporte Edge/Brave ni distribución estable con tests de Chromium.
- Conservar marca aprobada, HTML semántico y usabilidad a 320 px o más.

## Comandos (desde la raíz de Issopen)

`pnpm extension:build`, `extension:dev`, `extension:check`, `extension:lint`,
`extension:test`, `extension:e2e`, `extension:reproducible`, `extension:validate`.
`pnpm validate` incluye la extensión. Guía de instalación/rollback en README.
No versionar `.wxt`, `.output`, perfiles, reportes ni credenciales. No desplegar
Kubernetes por un cambio exclusivamente de este artefacto local.
