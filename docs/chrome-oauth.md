# Chrome 0.2 — vinculación humana

0.4 conserva este flujo y añade `extension:write` mediante nuevo consentimiento
para proyectos/Epics/tickets. Los clientes anteriores siguen siendo sólo lectura;
desconectar/reconectar para autorizar escritura. Ver [contrato actual](chrome-delivery.md).

Implementa 21 / EXT-03. El proveedor OAuth ya existente de Better Auth 1.7.2
emite los códigos y tokens; no se añade un segundo servidor ni OAuth de Google.

## Uso

1. Recargar la extensión unpacked (`extensions/chrome/.output/chrome-mv3`).
2. Abrir el icono de Issopen y pulsar **Conectar con Issopen**.
3. Iniciar sesión en la web, dar nombre a esta instalación, continuar y aceptar
   los permisos. No copiar contraseñas ni tokens al panel.
4. Chrome cierra la ventana OAuth y el panel muestra la cuenta y los proyectos.
5. **Desconectar esta instalación** revoca su cliente. En la web, la sección
   **Extensiones Chrome** (`/extensions`) permite revocarlo individualmente.

Este corte lee proyectos; no crea tickets ni envía imágenes todavía. El menú
«Connect ChatGPT» y los agentes conservan su funcionamiento y permisos previos.

## Contrato y límites

- El worker genera UUID de instalación, state y verifier aleatorios de 256 bits.
  Sólo el challenge S256 y el state salen a la URL de vinculación; nunca tokens
  ni verifier. Chrome acepta únicamente su callback exacto y state único.
- Registro de cliente público después de autenticar al owner y con CSRF. El
  callback HTTPS tiene el ID real de la extensión: no necesita clave estable
  ni registro en Google Cloud. Permite reinstalar desde otro directorio sin
  conceder callbacks globales. Máximo 20 instalaciones activas por persona;
  las canceladas tras el registro pueden revocarse desde la lista.
- Recurso `https://<instancia>/api/extension/v1`, scopes `extension:read` y
  `offline_access`. Sin MCP, roles de agente ni acceso a `/api/v1` con bearer.
- Firma JWT, issuer, audiencia, expiración, scope, propietario de cliente y
  workspace se verifican en servidor. La fila de cliente se relee siempre:
  revocación y caducidad no esperan a expirar el JWT.
- Access token de 5 minutos, refresh rotatorio y máximo absoluto de 30 días
  desde vinculación, también en el endpoint de renovación. Recuperación de
  cuenta, revocación o rechazo del proveedor pueden exigir reconectar antes.
- `chrome.storage.local`, acceso TRUSTED_CONTEXTS, no sync. Es almacenamiento
  del perfil, no una caja fuerte frente al propietario del equipo o malware.
  Panel recibe sólo estado/cuenta/proyectos; no recibe credenciales.
- Peticiones únicamente a la instancia fija del build, sin cookies, caché ni
  redirects. El manifiesto concede ese host, identity y storage; los demás
  sitios siguen bajo activeTab. Ni captura ni inspección de fondo.
- Fallo al desconectar no anuncia éxito: se puede reintentar o revocar en web.
  Cancelar la ventana OAuth no vincula la extensión. No hay envío automático.

## Validación y rollback

`tests/integration/extensions.test.ts` ejecuta PostgreSQL real: login, consent,
PKCE, denegación, replay, aislamiento de cookie/bearer/origen, renovación,
revocación y caducidad (form y JSON). `tests/e2e/extension-oauth.spec.ts` carga
MV3 en Chromium real, usa `launchWebAuthFlow`, acepta el consentimiento y
comprueba el regreso al panel y la desconexión; sin mocks del proveedor.
`extensions/chrome/tests/unit/account.test.ts` prueba PKCE/state/callback y
ausencia de secretos en respuestas. `pnpm validate` integra estas pruebas.

El test E2E compila una copia loopback en `.output/oauth-test`, distinta del
artefacto productivo. Nunca distribuir esa copia como producción.

No hay migración de esquema ni nuevo PVC: usa oauthClient/Resource/RefreshToken
existentes. Rollback de binario/GitOps restaura la release previa y deshabilita
la interfaz/API nueva; conservar las filas OAuth, no borrar datos ni PVC.
Antes de reinstalar 0.1, revocar las conexiones desde la web si se quiere
eliminar su acceso. La extensión de 0.2 necesita el backend de esta release.

Referencias: [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity),
[Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[OAuth Provider](https://better-auth.com/docs/plugins/oauth-provider).
