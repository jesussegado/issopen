# Owner workspaces

Estado: implementado en el ticket 114. Este flujo amplía la instancia privada
sin convertir Issopen en un registro público ni compartir datos entre clientes.

## Modelo

- `instance_owner` continúa siendo un singleton y actúa como administrador de
  la instalación. Es la única identidad que puede generar invitaciones de
  Owner.
- Cada `workspace` conserva exactamente un Owner canónico y cada identidad
  puede ser Owner de un único workspace.
- Un Owner invitado administra sólo su workspace: puede crear proyectos e
  invitar Members con los permisos de proyecto existentes.
- El administrador de la instancia no recibe membresía implícita ni acceso a
  los proyectos del workspace creado.
- Los Owners invitados no pueden crear otros Owners. Esta capacidad no se
  deriva del rol `owner`; exige pertenecer a `instance_owner`.

## Alta de un Owner

1. El administrador abre **Owner workspaces** y especifica el email exacto de
   Google y el nombre del workspace.
2. Issopen genera un enlace privado de un solo uso válido durante siete días.
   Sólo persiste SHA-256 del token; el enlace se muestra únicamente al crearlo
   o rotarlo y se comparte manualmente por un canal de confianza.
3. La persona abre el enlace. Si el email ya pertenece a una cuenta real debe
   iniciar sesión con ella; una identidad provisional sólo se permite cuando
   no tiene proveedor, membresía, ownership ni otra invitación activa.
4. Google debe verificar el mismo email después de reclamar la invitación.
5. La aceptación crea de forma atómica el workspace, la membresía `owner`, el
   evento de membresía y el evento de invitación. Después emite una sesión
   normal y abre el nuevo workspace.
6. Desde ese workspace, el nuevo Owner crea sus proyectos y usa **Members**
   para invitar a quienes quiera a proyectos concretos.

No se envía el enlace por email automáticamente. El panel permite copiarlo,
rotarlo mientras no se haya reclamado y revocarlo. La rotación invalida el
token anterior.

## Seguridad y auditoría

- Signup público y linking implícito siguen deshabilitados.
- Crear, listar, rotar y revocar responde `403` salvo para el
  `instance_owner`, incluso si el solicitante es Owner de otro workspace.
- La aceptación exige email exacto, Google enlazado después del claim,
  expiración vigente y ausencia de otro workspace propio.
- Locks transaccionales y restricciones únicas evitan dos Owners para un
  workspace, dos workspaces propios o replays concurrentes.
- `owner_workspace_invitation_event` registra creación, claim, rotación,
  revocación y aceptación; su trigger impide UPDATE/DELETE.
- Los endpoints y páginas con tokens usan `Cache-Control: no-store` y
  `Referrer-Policy: no-referrer`.
- Nunca deben copiarse enlaces activos, cookies, credenciales Google o tokens
  a Git, logs, tickets o documentación.

## Recuperación

- Enlace pendiente/expirado: usar **Create new link** y compartir sólo el nuevo.
- Enlace reclamado por la identidad equivocada: revocarlo y crear otra
  invitación; no reutilizar la sesión provisional.
- Cuenta ya existente: iniciar sesión primero y reabrir el enlace.
- Cuenta que ya posee un workspace: no puede aceptar otra propiedad. Puede ser
  Member de otros workspaces mediante el flujo normal.
- Invitación aceptada: no se puede reutilizar. La administración posterior del
  Owner usa el flujo protegido de transferencia de ownership, no esta tabla.

## Validación mínima

1. El administrador ve **Owner workspaces** y otro Owner no.
2. Crear una invitación devuelve una sola vez un enlace y la base no contiene
   el token en claro.
3. Sin Google posterior al claim, aceptar falla sin crear workspace.
4. Tras verificar Google se crea un solo workspace y el invitado figura como
   Owner; el administrador no aparece como Member.
5. El nuevo Owner crea un proyecto e invita a un Member.
6. El nuevo Owner recibe `403` si intenta usar `/api/v1/owner-invitations`.
7. Repetir, expirar, revocar o usar otro email no concede acceso.

