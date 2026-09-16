# Privacidad operativa de Issopen

Estado: implementación del ticket 83, pendiente de revisión humana antes del
envío a Chrome Web Store. Política pública canónica:
`https://issopen.serviciosegado.com/privacy`.

## Contrato comprobado

La finalidad única de la extensión es convertir imágenes que la persona elige
o pega en un ticket de un proyecto Issopen autorizado. No existe lectura de
página, DOM, historial, cookies, formularios o portapapeles en segundo plano.
`clipboardRead` es opcional y sólo se solicita tras pulsar **Pegar imagen**. El
borrador se guarda localmente durante un máximo de 24 horas desde su último
cambio y no sale del navegador hasta **Enviar ticket**.

La ruta `/privacy` es parte del bundle web, se renderiza antes de consultar una
sesión y por tanto funciona sin login. La enlazan el footer público, la
navegación autenticada, Cuenta, Extensiones, la pantalla de consentimiento y el
panel Chrome. La versión y fecha visibles son las que deben copiarse al
dashboard de Google/Chrome; no mantener otro texto contradictorio.

## Inventario técnico

| Dato | Origen | Almacenamiento | Retención/control |
| --- | --- | --- | --- |
| nombre, email, avatar e IDs humanos | login local o Google OIDC | `user`, `account`, `session` en PostgreSQL | sesión hasta caducidad/revocación; membresía revocable; corrección/supresión completa por petición verificada |
| perfil y avatar local opcional | edición explícita en Cuenta | `user.name`, `user_profile` en PostgreSQL, un PNG validado de hasta128×128/96KiB | nombre y avatar visibles sólo a colaboradores actuales del proyecto; guardar reemplaza el avatar activo; quitar+guardar elimina el activo, no backups/cachés previos |
| membresías y proyectos permitidos | invitación/owner | PostgreSQL | hasta retirada; retirarla bloquea acceso al workspace y su OAuth Chrome, sin revocar sesiones web globales ni otros workspaces (108) |
| instalación, cliente y tokens Chrome | OAuth PKCE explícito | `oauth_client`/tokens en PostgreSQL y `chrome.storage.local` | access 5 min, vínculo/refresh máximo 30 días; desconectar o revocar elimina acceso y renovación |
| proyecto/Epic/ticket, preguntas, comentarios, links y actividad | persona o agente autorizado | PostgreSQL | mientras el workspace lo necesite; borrar ticket es lógico y se declara como tal |
| imágenes elegidas | pegado/subida explícitos | borrador IndexedDB; luego PNG normalizado en PVC privado y referencia en PostgreSQL | borrador máximo 24 h; uploader u owner pueden borrar cada imagen del almacenamiento activo |
| recibos e idempotencia | mutaciones explícitas | PostgreSQL | MCP 24 h; recibos Chrome sin caducidad automática para impedir duplicados |
| logs | runtime | stdout/containerd | sólo startup/error sin payload sensible; rotación de plataforma, sin analítica propia |
| invitación y entrega opcional97 | acción explícita Owner; Gmail SMTP del operador | token hash en invitación, payload temporal AES-GCM en outbox, clave independiente fuera de DB; Google recibe dirección, enlace y texto mínimo | enlace7d; purga payload al enviar/fallo final/revocación/rotación/caducidad; eventos, buzones y backups pueden conservar copias |

El 16/09/2026 el propietario autoriza reutilizar el correo de Gremiox: Google
Gmail SMTP y remitente serviciosegado@gmail.com. La política pública 1.2 declara
dirección destinataria, enlace privado y texto mínimo, sin contenido de
proyectos/tickets ni imágenes. No se lee el Gmail del invitado ni se añaden
scopes Google. Borrar la cola o revocar el enlace no retira mensajes ya enviados.
La autenticación SMTP se comprobó sin enviar mensajes. La recepción real y el
piloto Google requieren la [prueba humana](google-pilot.md). Ver también
[entrega97](invitation-delivery.md). El despliegue publica esta política antes
de permitir envíos; no se cambia ni reenvía la ficha Store por esta entrega web.

El endpoint `DELETE /api/v1/evidence/:id` es sólo sesión web y same-origin. El
servidor vuelve a comprobar workspace, proyecto y que la persona sea uploader u
owner; elimina la fila, retira el PNG del volumen activo y registra
`capture.evidence_deleted` sin contenido de la imagen. El GET anuncia
`canDelete` por evidencia para que la UI no ofrezca una acción denegada. Las
copias descargadas y backups anteriores quedan fuera del alcance técnico de esa
acción y se advierte antes de confirmar.

99 actualiza el inventario técnico público a1.1 (15/09/2026), sin cambiar finalidades
de Chrome ni permisos del paquete enviado0.6.2. La vista de perfil no usa URLs de
Google como imágenes compartidas, no edita email/proveedor ni reescribe actividad
histórica. Directorio paginado sólo por proyecto autorizado, sin emails del equipo.
La web hace explícito cuándo se guarda y que los backups previos pueden conservar
el avatar retirado. No se modificó el dashboard Store durante esta entrega web.

## RGPD básico para el piloto UE

Esta es una revisión de producto, no asesoramiento jurídico. El flujo se apoya
en la prestación solicitada por la persona para autenticación y tickets; en el
interés legítimo del operador para autorización, seguridad, idempotencia y
auditoría; y en una acción afirmativa para cada envío de imágenes. La política
ofrece contacto para acceso, rectificación, oposición, limitación, portabilidad
y supresión. Antes de ampliar el piloto, el owner debe validar identidad legal,
plazos de respuesta, contratos con Google/Cloudflare, transferencias y una
retención de backups documentada.

No se vende información, no hay publicidad, scoring ni analítica oculta. Google
se usa para autenticación y envío SMTP explícito de invitaciones desde la cuenta
del operador; Cloudflare para transporte/protección. Los humanos
sólo acceden al contenido para la colaboración elegida, soporte solicitado,
seguridad u obligación legal.

## Gates de coherencia

- La política pública, Privacy practices de Chrome y ficha Store deben declarar
  las mismas categorías y la misma finalidad única.
- El dashboard no debe marcar browsing activity, website content, historial o
  datos financieros/sanitarios: la versión 0.6.2 no los obtiene.
- Declarar autenticación, información personal (nombre/email), contenido
  generado por el usuario e imágenes aportadas explícitamente.
- Justificar `sidePanel`, `identity`, `storage`, host único y
  `clipboardRead` opcional; no añadir permisos para funcionalidad futura.
- Comprobar con red vacía que abrir la extensión, pegar/subir y editar no
  transmite el borrador; sólo **Enviar ticket** produce el POST.
- Probar revocación, borrado físico de imagen, autorización negativa y acceso
  público a `/privacy` en cada release candidate.

Fuentes oficiales revisadas el 2026-09-13:

- https://developer.chrome.com/docs/webstore/program-policies/limited-use
- https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements
- https://developer.chrome.com/docs/webstore/program-policies/data-handling
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
