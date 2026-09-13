# Google OpenID Connect

Estado: contrato implementado para 79 / AUTH-01. El proveedor sólo aparece si
las dos credenciales de Google están presentes en runtime.

## Flujo y límites

La web inicia `signIn.social` con el proveedor `google`. Better Auth 1.7.2 usa
el documento OIDC de Google y ejecuta Authorization Code con PKCE S256,
`state` y `nonce`. El ID token debe superar firma, issuer, audience, expiración
y el enlace del `nonce`; además se exige email verificado.

Los únicos scopes son `openid email profile`. Issopen no pide Gmail, Drive,
Calendar, refresh token de Google ni acceso offline. El secreto nunca llega al
navegador, al bundle de Chrome, a logs ni a Git.

`disableSignUp` permanece activo: Google autentica una identidad, pero no
autoriza el alta. Sólo una cuenta local existente —y, tras 81 / AUTH-03, una
invitación válida— puede obtener sesión. Email/contraseña y recuperación del
owner siguen disponibles durante el piloto y son el rollback inmediato.

## Google Cloud

Cuenta operadora: `serviciosegado@gmail.com`. Debe usar un proyecto dedicado
llamado **Issopen** y dos clientes OAuth de tipo **Web application**:

| Entorno | Origen autorizado | Redirect URI exacta |
| --- | --- | --- |
| Desarrollo | `http://localhost:8080` | `http://localhost:8080/api/auth/callback/google` |
| Producción | `https://issopen.serviciosegado.com` | `https://issopen.serviciosegado.com/api/auth/callback/google` |

No se reutilizan clientes de otras apps. La pantalla de consentimiento usa
nombre Issopen, email de soporte del operador y sólo los scopes no sensibles de
identidad. Mientras el proyecto esté en Testing, las cuentas piloto se añaden
explícitamente como test users; esa lista de Google no sustituye la invitación
de Issopen.

## Configuración y activación

- Desarrollo: guardar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` sólo en el
  `.env` ignorado. Ambos deben pertenecer al cliente de desarrollo.
- Producción: guardar ambos valores en
  `../../.local/secrets/issopen-production.env`, modo `0600`, y reconciliar el
  Secret externo `issopen-env` con el provisionador. El Deployment referencia
  las claves por nombre; ningún valor se declara en manifiestos.
- Definir sólo una variable es un error de arranque. Omitir ambas mantiene el
  login previo y oculta el botón Google.
- Un cambio de Secret requiere una nueva reconciliación declarativa del
  Deployment para que el proceso lea el valor nuevo.

Callback productivo que debe copiarse literalmente en Google Cloud:

```text
https://issopen.serviciosegado.com/api/auth/callback/google
```

## Comprobación

1. `GET /api/public/auth-providers` devuelve `{"google":true}` sin IDs ni
   secretos.
2. El botón **Continue with Google** genera una URL `accounts.google.com` con
   `response_type=code`, PKCE, `state`, `nonce` y scopes mínimos.
3. Cancelar vuelve a `/sign-in` con un mensaje accionable y conserva el login
   por contraseña.
4. Una cuenta existente y autorizada entra y puede cerrar sesión; una identidad
   sin acceso no crea usuario ni sesión.
5. Un callback sin estado, repetido o manipulado no emite cookie de sesión.
6. `pnpm validate` y `pnpm test:secrets` no encuentran credenciales reales.

## Rotación y rollback

Para rotar, crear primero un secreto nuevo en el cliente correcto, actualizar
la fuente local protegida, reconciliar `issopen-env`, publicar/reiniciar el
Deployment por GitOps y probar login/logout. Revocar el secreto anterior sólo
después de esa prueba.

Para detener Google sin afectar datos, retirar del Deployment las dos
referencias y publicar por GitOps. La aplicación vuelve a contraseña; no se
borran usuarios, cuentas vinculadas, sesiones no comprometidas ni PVC. Si hubo
compromiso, revocar el secreto en Google, rotar `BETTER_AUTH_SECRET` según el
runbook y revocar las sesiones afectadas.

## Fuentes

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [OAuth 2.0 para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth)
