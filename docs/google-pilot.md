# Prueba humana de invitaciones y Google — tickets 97, 98 y 107

El propietario realizará esta prueba (decisión del 16/09/2026). No hay que crear
otro cliente OAuth ni compartir contraseñas. Usa otra cuenta Google que controles,
distinta del Owner y del revisor de Chrome Web Store, que todavía no sea miembro
de este workspace. Puede tener cuenta Issopen en otro workspace. No retires los
permisos de una persona real sólo para repetir el alta. Todos los datos de prueba
deben ser sintéticos. La prueba no está superada hasta registrar su resultado.

## 1. Preparación como Owner

1. Abre https://issopen.serviciosegado.com con tu sesión habitual.
2. Crea un proyecto llamado `Prueba Google` sin datos reales. Conserva otro
   proyecto sin asignarlo al invitado para comprobar aislamiento después.
3. Abre **Members** (https://issopen.serviciosegado.com/members) en el workspace
   correcto. En **Invite a member**, escribe el email exacto de la otra cuenta
   en **Google account email** y marca únicamente `Prueba Google`.
4. En **Delivery method**, elige **Send email and show link** y pulsa
   **Create invitation**. Se solicita un solo correo; no hay recordatorios
   automáticos. Si la opción está deshabilitada, recarga tras el despliegue;
   **Copy a private link** permite probar Google sin validar entrega SMTP.
5. Comprueba la bandeja de entrada y spam del destinatario. El remitente es
   `serviciosegado@gmail.com`. Puedes pulsar **Refresh invitations and members**
   para consultar el estado: **Accepted by mail server** no demuestra que haya
   llegado a la bandeja. No crees ni reenvíes repetidamente mientras está en cola.

## 2. Aceptación con la cuenta invitada

1. Abre otro perfil de Chrome o una ventana de incógnito. Mantén el Owner en
   su ventana original; no hace falta cerrar esa sesión.
2. Abre el enlace del correo en esta segunda ventana. Es privado: no lo pegues
   en tickets, chats ni capturas. Caduca a los siete días y deja de servir al
   aceptar o revocar. Si se interrumpe, permite reanudar sólo la verificación.
3. Pulsa **Continue securely** y después **Verify with Google**. Selecciona
   exactamente la cuenta invitada y completa la verificación en Google.
   Hazlo seguido: la sesión provisional de verificación dura 15 minutos.
4. Si esa cuenta ya tenía una identidad Issopen, la pantalla puede pedir primero
   iniciar sesión con ella y después continuar la invitación. No uses la cuenta
   Owner. Si cancelas Google, usa la opción de volver a verificar.
5. Al volver debes entrar directamente en `Prueba Google`. En **Members** del
   Owner, la invitación debe figurar aceptada y la persona como **Member**.
6. Cierra sólo la sesión Issopen de la cuenta invitada y vuelve a iniciar con
   **Continue with Google**. Debes conservar el mismo acceso sin otra invitación.

## 3. Comprobaciones rápidas de colaboración

- El invitado ve sólo los proyectos asignados. Abre en su ventana la URL de un
  proyecto no asignado: no debe mostrar sus datos ni permitir acciones.
- Crea un ticket sintético en `Prueba Google` y añade un comentario. En la
  ventana Owner deben aparecer con la identidad del invitado, no como Owner.
- Asigna ese ticket al invitado; añade una pregunta dirigida y una mención
  seleccionada. Comprueba sus avisos personales y que puede responder.
- Abre el mismo ticket en ambas ventanas. Mantén un cambio sin guardar en una,
  guarda otro en la otra y vuelve a guardar el primero: debe avisar del conflicto
  y conservar el borrador para comparar, no sobrescribir silenciosamente.
- Comprueba en un móvil o ventana estrecha que puedes abrir el ticket y navegar.
  No transfieras propiedad ni modifiques el revisor Store para probar esto.

## Si algo falla

- Cuenta equivocada: usa la salida de esa sesión que ofrece Issopen y elige la
  cuenta exacta; nunca modifiques el email de la invitación para saltar el control.
- Enlace caducado/revocado: como Owner revoca esa invitación de prueba y crea
  otra. Si sólo se interrumpió la sesión provisional, reabre el mismo enlace y
  pulsa **Resume verification**; se invalida la sesión provisional anterior.
- Google bloquea el acceso: indica el texto visible y la hora. No desactives
  protecciones ni cambies el OAuth; primero distinguiremos cuenta no habilitada,
  configuración, cancelación y error de callback.
- SMTP fallido: indica el estado visible y hora. El enlace manual sirve para
  continuar la prueba Google; la entrega de correo seguirá pendiente.

## Resultado que necesitamos

Comenta en el ticket 98: `Correo recibido: sí/no (bandeja o spam); Google:
correcto/error; proyecto permitido: sí/no; proyecto ajeno bloqueado: sí/no;
segundo login: sí/no`, junto con fecha/hora y navegador. Añade lo comprobado de
colaboración al 107. Si falla, incluye el mensaje visible o una captura sin
barra de direcciones privada, email personal, códigos, cookies ni tokens.

No marques 97/98/107 como terminados sólo por seguir esta guía. Después de la
prueba puedes retirar únicamente este Member de prueba desde Members si no
quieres conservar su acceso. Retirarlo no borra su contenido ni otros workspaces.
