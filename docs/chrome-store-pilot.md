# Piloto Store — ticket 87

Estado: checklist preparado, **pendiente de una versión Store publicada**.
Las pruebas unpacked previas no satisfacen el gate de instalación Store.

## Preflight

1. Consultar 86 y el dashboard: aprobación, versión 0.6.2 (o candidato posterior
   validado), item `eohpecaogeelnicbpeedjdganacfknok`, Unlisted y publish manual.
   Copiar el enlace real desde el dashboard; no dar por instalable una URL
   construida a mano. No reenviar el enlace a personas fuera del piloto.
2. Confirmar con el owner la cuenta Google piloto que controla y un proyecto
   sintético asignado. No utilizar la cuenta del publisher ni prestar una
   sesión Owner. [Invitar desde la web](member-invitations.md).
3. Usar otro ordenador o perfil Chrome limpio, sin extensión unpacked ni
   credenciales copiadas. Registrar Chrome/OS, fecha y versión del servidor.
4. Preparar dos PNG inocuos. No copiar fotos, portapapeles ni datos reales.

## Recorrido y resultados esperados

| Acción | Resultado que debe observarse |
| --- | --- |
| Instalar desde el enlace real Store, sin modo desarrollador | ID Store exacto y versión aprobada. No reutilizar el ID unpacked. |
| Abrir invitación y Continue with Google con la cuenta invitada | Identidad verificada, consentimiento explícito y sólo proyecto asignado. |
| Abrir extensión → Cuenta → Conectar | OAuth PKCE humano; vuelve al panel conectado sin pedir PAT. |
| Elegir proyecto/Epic, pegar/subir dos PNG, título sintético | Preview de ambas imágenes; nada se envía antes del gesto. |
| Enviar y abrir enlace | Un solo ticket, dos adjuntos privados, autor humano correcto y actividad Chrome. |
| Abrir board y detalle como Owner | Ticket visible sin recarga manual; atribución diferente del Owner. |
| Abrir URL del adjunto sin sesión | No devuelve imagen ni permite enumerar datos. |
| Intentar proyecto/issue de otro proyecto no asignado | 404/denegación, sin nombres ni datos filtrados. |
| Miembro intenta administración o borrado de ticket | Acciones no visibles y REST denegada. |
| Desconectar instalación propia y reintentar | Acceso revocado, recuperación visible, sin envío automático. |
| Retirar miembro de prueba desde Owner → Members | Próxima petición/refresh falla; login no restaura grants. |

Antes de retirar al miembro, ensayar red interrumpida sólo en su perfil de
prueba: sin conexión el borrador no se pierde; si el resultado de Enviar es
incierto, reintentar manualmente el mismo envío y verificar un solo ticket.
No desconectar la red del master ni reenviar cambiando el UUID.

Comprobar teclado, foco, combobox, Cuenta/Escape, panel 320/400 px y errores
sin secretos. Pruebas automáticas complementarias: `pnpm test:integration`,
`pnpm extension:e2e` y `pnpm test:e2e`; mocks no equivalen a Google real.

## Evidencia y cierre

Registrar en 87 fecha, sistema, ID/versión Store, servidor, proyecto/issue
sintéticos, resultados por fila y cualquier paso no ejecutado. Capturas sólo
de UI inocua, nunca contraseña, consent URL con códigos ni network HAR crudo.
Revocar únicamente instalación/miembro piloto autorizado; mantener al revisor
de Google mientras siga necesitándolo. No borrar tickets, historial ni PVC.

No marcar Done hasta completar el recorrido Store real y la aceptación humana.
