# AGENTS.md — extensión Chrome de Issopen

Se aplican las instrucciones de `../../AGENTS.md`. Workspace pnpm del mismo
repositorio; no crear otro Git. Epic Chrome
`ca26c29b-43ac-4ca0-b768-594d6779d6e7`; ticket 51 simplifica las imágenes
por petición explícita del owner. El criterio personal 33 sigue independiente.

## Qué hace ahora (0.6.0)

OAuth humano → pegar/subir imágenes externas → proyecto/Epic y campos →
Enviar ticket → enlace. No captura ni lee la página, no inspecciona DOM.
El usuario recorta/redacta en su herramienta antes de adjuntar.
No reintroducir controles de captura por seguir documentación histórica 0.3/0.4.

- WXT 0.21.4, MV3, React 19.2.8, TypeScript 6.0.3 y Zod 4.5.4 fijados.
  Build independiente de Docker/API; sin nuevas dependencias.
- `wxt.config.ts`: sólo sidePanel, identity, storage y host de la instancia.
  clipboardRead es opcional y se pide exclusivamente al pulsar Pegar imagen.
  Sin activeTab, scripting, all_urls, lecturas automáticas ni scripts globales.
- `background.ts`: abre panel desde acción; emisor exacto y schemas antes de
  OAuth/tickets. Rechaza mensajes legacy de captura/inspección.
- `sidepanel/Images.tsx`: Ctrl+V/CmdV nativo (texto sigue pegándose como texto),
  botón con permiso opcional/fallback, selección múltiple, miniaturas y quitar.
  Un gate serializa lectura/conversión; un lote inválido no aplica parcialmente.
  No leer portapapeles automáticamente ni registrarlo en logs.
- `lib/image-import.ts`: PNG/JPEG/WebP estáticos, cabeceras/dimensiones antes de
  decodificar, conversión local a PNG sin metadatos. Máximo 5 imágenes, 8 MiB
  agregados tras conversión, 8 MiB por archivo de entrada y 32 MP por imagen.
  Rechaza SVG/GIF/animaciones. Nunca subir URLs ni nombres/rutas de archivos.
- `Workspace.tsx`: compositor y creación de proyecto/Epic inline; conserva
  cuenta/formulario/imágenes al alternar paneles. Bloquea operaciones durante
  preparación o envío incierto. Conserva payload y UUID para reintentar.
  Tras una creación confirmada oculta los controles editables, libera la copia
  de imágenes en memoria e indica cuántas quedaron adjuntas al ticket; un envío
  incierto conserva exactamente el borrador y no entra en ese estado.
- `style.css`: las acciones finales del compositor son una columna a ancho
  completo con 12px de separación; enlace de éxito destacado y flecha externa.
  Selectores CSS acotados al compositor y su estado de éxito; no apilar opciones
  de combobox ni alterar los controles de imágenes/creación inline.
  El éxito actual vive en RAM: no recargar una confirmación sin considerar que
  se perderá esa vista (el ticket ya creado no se borra ni se vuelve a enviar).
- `SelectField.tsx`: proyecto/Epic usan un único input-combobox buscable, sin
  otro input de búsqueda encima. El filtro ignora mayúsculas/tildes y no cambia
  el ID confirmado; sólo elegir una opción llama onChange. Escape/Tab/fuera
  restauran el nombre guardado. `data-selected-value` expone el ID interno a
  tests; `value` del input es texto visible, nunca un ID para enviar.
  Prioridad/estado conservan el modo no editable. Todos usan una lista HTML
  dentro del panel. El popup nativo de select se observó fuera de la ventana en
  Chrome Linux. No restaurarlo sin probar su posición en el panel real.
  Clic/Enter confirman, flechas navegan; Espacio/Home/End/letras conservan la
  edición nativa en inputs y la navegación del modo no editable. Ignora Enter
  durante composición IME. Listas acotadas y foco/ARIA; sin nuevas dependencias.
  Respeta `locked`; reseleccionar proyecto conserva Epic. La carga asíncrona
  de Epics no borra el ID guardado ni aplica respuestas de otro proyecto.
- `Account.tsx`: botón de usuario y diálogo nativo cerrado por defecto,
  Escape y retorno del foco. Muestra Owner/Member y sólo los proyectos
  autorizados. No desmontar el compositor al alternarlo.
- `Information.tsx`: aviso introductorio cerrable; `InformationContent` se
  muestra también siempre en Cuenta → Ayuda e información, incluso sin sesión.
  El cierre escribe sólo el booleano local `issopen-information-dismissed-v1`,
  sincroniza vistas del mismo perfil y devuelve el foco a Cuenta. No leer ni
  modificar claves de OAuth/IndexedDB; fallo de preferencia no bloquea trabajo.
  No auto-cerrar con temporizador ni solicitar permiso de notificaciones.
  Las notas genéricas de borrador/privacidad viven aquí, sin repetir tarjetas
  en el compositor. Conservar errores operativos y límites junto a los campos.
- `lib/account.ts`: PKCE/state/callback y operaciones serializadas;
  tokens en storage.local TRUSTED_CONTEXTS, nunca respuestas/logs/storage.sync.
- `/session` usa `userId` y `workspaceRole`; `ownerId` permanece como alias de
  transición para 0.5.x. El borrador usa `userId:workspaceId`, por lo que no se
  cruza entre personas. Member no ve ni puede invocar Crear proyecto, aunque sí
  puede crear Epics/tickets en proyectos asignados. El servidor vuelve a
  comprobar membresía y cliente activo en cada petición y refresh.
- `lib/draft.ts`: un borrador IndexedDB 24 h. Las imágenes que el usuario
  adjunta se incorporan explícitamente al borrador, sin confirmación separada.
  No guardar clipboard crudo, EXIF, imágenes no seleccionadas ni historial.
- `lib/tickets.ts`: rutas/contratos de API cerrados. Contrato compartido en
  `../../src/shared/capture-contract.ts`, sin imports de servidor.
- Los helpers/content entrypoints y Capture.tsx históricos se conservan sin
  ruta de ejecución desde UI/worker, sin permisos de inyección. Sus unit tests
  siguen útiles como regresión de contratos antiguos, no prueban la nueva UI.

## Fronteras y compatibilidad

`/session.maxImages` anuncia 5. Servidor viejo sin ese campo: sólo un PNG.
API v1 acepta `image` legacy O `images` (máximo 5), nunca ambos. No añadir
defaults ni transformar un envío pendiente antiguo: cambiaría su hash de recibo.
Backend normaliza, limita el agregado y crea ticket/evidencias/recibo atómicos.
Adjuntos privados; detalle web enumera imágenes. No hay migración DB nueva.
[API, cuota, backup y rollback](../../docs/chrome-delivery.md).

El token necesita extension:write humano, no credenciales de agente.
No ampliar permisos MCP ni consentimientos antiguos. No usar cookies owner
en API de extensión. No registrar DOM, URL privada, imagen, token o excepción.
Envío sólo con gesto; nunca cola/reintento automático.

Restaurar un artefacto antiguo puede rechazar/borrar un borrador multiimagen:
resolver o exportar primero cualquier borrador/operación pendiente. Mantener
misma ruta unpacked e ID y ambos PVCs; no desinstalar. No prometer downgrade de
datos locales 0.5 a 0.4.3. La web antigua puede no entender metadata upload.

## Validación y entrega

Desde raíz: `pnpm extension:build`, `extension:check`, `extension:lint`,
`extension:test`, `extension:e2e`, `extension:reproducible`.
`pnpm validate` integra API/DB/web y extensión; `extension:release` exige Git
limpio y todos los gates antes de crear ZIP/SHA/procedencia.

E2E: acción nativa sin acceso a página, imágenes PNG/JPEG/WebP, Ctrl+V real,
texto nativo, quitar/restaurar, rechazo de lotes, UI a 320/400 px, OAuth real,
dos imágenes privadas y reintento tras respuesta perdida. Las ramas del botón
con permisos denegados/vacío/success usan un fixture explícito; no simulan
el test nativo de Ctrl+V. Usar sólo imágenes sintéticas/perfiles efímeros.
Selectores: clic sobre opciones (no `selectOption`), teclado, filtros, nombres
largos, 320/400 px, persistencia, lectura tardía/error y bloqueo de envío incierto.

No versionar outputs, perfiles, reportes ni secretos. Cambio sólo de extensión
no requiere Kubernetes; la API multiimagen sí requiere despliegue por GitOps.
No afirmar soporte Edge/Brave/Store ni aceptación personal con tests automáticos.
