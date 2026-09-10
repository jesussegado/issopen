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
- `sidepanel/Account.tsx`: botón de usuario en la cabecera y diálogo nativo
  cerrado por defecto (0.4.3). Datos, proyectos y gestión sólo al abrirlo;
  `showModal`/`close` conservan Escape y retorno del foco. `main.tsx` comparte
  el estado de cuenta con `Workspace`: nunca desmontar cuenta/compositor/editor
  al alternar el diálogo ni repetir OAuth o borrar borradores por abrir/cerrar.
- `lib/account.ts`: PKCE, validación estricta de callback/state y operaciones
  serializadas en worker; access/refresh en storage.local con TRUSTED_CONTEXTS.
  No exponer credenciales en respuestas, storage.sync, logs o URLs. Permiso de
  host exclusivamente para la instancia configurada al compilar (HTTPS o
  loopback explícito de test); no ampliar trustedOrigins de la REST owner.
- `lib/protocol.ts`: mensajes v1, schemas de frontera, URLs restringidas y
  errores seguros; no importar dominio, base de datos o secretos del backend.
- `lib/capture.ts` y `capture-page.ts`: capturas PNG, composición OffscreenCanvas,
  overlay rectangular y funciones serializadas en el documento concreto. Las
  funciones inyectadas no pueden cerrar sobre dependencias/imports externos.
- `sidepanel/Capture.tsx`: preview local, zoom, recorte/redacción opaca,
  rectángulos con ratón o campos numéricos y cinco pasos de deshacer/rehacer.
- `tests/unit/`: contratos, privacidad, emisor, worker y navegación cambiante.
- `tests/e2e/`: artefacto productivo y acción real de Chrome con perfil efímero.
- `lib/capture-errors.ts`: catálogo de códigos y ayuda estática. El worker
  distingue acceso, navegación, mutación de contenido y cambio de tamaño; la UI
  no muestra excepciones crudas ni adivina causas. Si no se conoce, usa el caso
  desconocido. Conservar todos los guards y el preview previo ante un fallo.

## Invariantes y próximos tickets

La entrega 0.4 completa el flujo técnico. `Workspace.tsx` compone tickets y
proyectos/Epics inline; `lib/tickets.ts` limita operaciones API y respuestas;
`lib/draft.ts` guarda sólo un borrador revisado 24 h en IndexedDB. `element.ts`
devuelve DOM estructural acotado, no texto ni atributos arbitrarios.
Contrato común en `../../src/shared/capture-contract.ts`. Backend/storage y
operación: [chrome-delivery.md](../../docs/chrome-delivery.md).
No persistir ni subir originales/historial. Si el resultado del envío es
incierto, mantener payload/UUID bloqueados al recargar/reconectar. No enviar
automáticamente ni renovar permisos antiguos sin nuevo consentimiento.
El parche 0.4.1 presenta la creación inline de proyecto/Epic como dos botones
al inicio del compositor. Usan `aria-expanded`/`aria-controls`, regiones ocultas
y estado local que conserva los nombres al alternar. Mantener los guards de
escritura/destino y deshabilitar ambos durante operaciones pendientes.
La nota 0.3 siguiente es histórica, no describe los límites de 0.4.

La versión 0.3 añade captura local (23) y parte del editor (25) sobre OAuth (21).
Mantener visible que no hay DOM ni envío de tickets hasta 22/24/26/28. El propietario
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
  Captura e historial quedan en RAM; sólo el PNG confirmado entra en borrador
  local. El envío requiere acción humana y escritura OAuth autorizada.
- El motor aborta al cambiar documento, pestaña, tamaño o DOM durante la captura;
  no relajar estas comprobaciones sin nuevas pruebas de fugas. Respetar límites
  de [captura](../../docs/chrome-capture.md), máscaras previas, rate limit global
  y restauración `finally`/watchdog. No persistir originales ni historial sensible.
- No afirmar soporte Edge/Brave ni distribución estable con tests de Chromium.
- Conservar marca aprobada, HTML semántico y usabilidad a 320 px o más.

## Comandos (desde la raíz de Issopen)

`pnpm extension:build`, `extension:dev`, `extension:check`, `extension:lint`,
`extension:test`, `extension:e2e`, `extension:reproducible`, `extension:validate`.
`pnpm validate` incluye la extensión. Guía de instalación/rollback en README.
No versionar `.wxt`, `.output`, perfiles, reportes ni credenciales. No desplegar
Kubernetes por un cambio exclusivamente de este artefacto local.
