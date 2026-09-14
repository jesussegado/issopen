# Epic 3 — usuarios, roles, colaboración e invitaciones

Estado: **implementación autorizada tras respuestas**. Fuente canónica:
[Epic 3 en Issopen](https://issopen.serviciosegado.com/epics/c3b6a630-824e-473a-add9-ac41bf63e38c).
Plan inicial: 14 tickets (94–107), 20 preguntas. El 2026-09-13 el propietario
respondió las 20 (v2) y pidió implementar. Se añade 108 para la base multiworkspace
seleccionada y109 para el menú móvil que tapaba el board, descubierto al validar.
Este archivo es un índice derivado, no una copia editable de
respuestas. Leer siempre los tickets/versiones actuales.

Primer bloque entregado el14/09/2026:94 contrato,100 sesiones propias,
104 detalle en vivo y109 navegación móvil. Fuente328a386/GitOps0ac6550d,
producción verificada y tickets Ready for Human Review sin claims. Doce tickets
siguen en Backlog; siguiente108→95. No se declara terminado el Epic.

## Contrato tras respuestas — ticket 94

| Área | Elección humana / alcance |
| --- | --- |
| Roles | Owner/Member por workspace; sin Admin ni Viewer de workspace |
| Tenancy | Varios workspaces; membresía explícita y selección autorizada |
| Proyectos | Permiso por proyecto: edición o sólo lectura; sin acceso por defecto |
| Miembros | Cero proyectos permitido; retirar/reinvitar, sin suspensión |
| Invitaciones | Correo + enlace manual; recordatorios sólo por acción del Owner |
| Onboarding | Único proyecto directo; selector si hay varios; espera si no hay ninguno |
| Perfil/directorio | Nombre y avatar; nombre/rol sin email de compañeros |
| Sesiones | Controles separados para web e instalaciones Chrome, sin cierre conjunto |
| Asignación | Una persona o ninguna; colaboradores con edición pueden reasignar |
| Preguntas/revisión | Destinatario opcional; colaboradores con edición validan/cierran |
| Avisos | Bandeja Issopen, sólo actividad dirigida; sin correo de actividad ni seguimiento |
| Concurrencia | Actualizar detalle limpio; conservar/avisar/comparar si hay borrador |
| Propiedad | Transferencia web protegida con reautenticación y doble confirmación |
| Auditoría | Sólo administración (Owner en los roles elegidos) |

Los roles del workspace y los permisos del proyecto son capas distintas: la
elección de lectura por proyecto en 95 no crea un Viewer global contrario a 94.
Owner administra su workspace y todos sus proyectos; Member tiene proyectos
asignados con permiso lectura/edición. Sólo lectura no crea, comenta, responde,
asigna ni revisa tickets; sí lee el contenido permitido. Cuenta/sesiones propias
no dependen del permiso de edición del proyecto. MCP conserva identidad, scopes
y allowlist propios; Chrome es humano y aplica la intersección con sus grants.

### Base multiworkspace (108)

Implementada en la fuente; validación/release en quick260914-jhl. Contrato y
compatibilidad en [multiworkspace](multiworkspace.md). Verificar GitOps antes de
afirmar su disponibilidad productiva. Los puntos siguientes son sus invariantes.

- Sustituir unicidad global de membresía por workspace/persona; conservar las
  filas existentes. La migración no añade miembros, proyectos ni privilegios.
- Identidad y sesión web son globales; cada petición/pestaña fija el workspace.
  Selector sólo de memberships propias, destino inválido se deniega sin fallback.
  Una sola membresía conserva navegación actual. Advertir antes de salir de un
  borrador; cambio en otra pestaña no puede redirigir silenciosamente escrituras.
- Unirse a otro workspace requiere invitación verificada. La misma identidad
  puede aceptar sin borrar su primera membresía. No abrir registro ni creación
  pública de workspaces; bootstrap/operación siguen siendo administrativos.
- Chrome fija un workspace por instalación/consentimiento; OAuth/MCP existentes
  no cambian de destino ni ganan proyectos al usar el selector web.
- Retirar una membresía sólo revoca acceso/grants de ese workspace. Cerrar una
  sesión propia sí afecta al navegador para todos los workspaces de esa persona.
- Adaptar bootstrap/recovery para rechazar ambigüedad. No dar por seguro el
  rollback al binario mono-workspace tras crear membresías múltiples: priorizar
  corrección hacia delante y backup/restore validado antes del despliegue.

Primero contrato 94 → 108 tenancy → 95 permisos → gestión/invitaciones y resto
dependiente. 100 puede entregar sesiones globales propias y 104 reconciliación
del detalle ya autorizado sin esperar nuevas tablas: su política está fijada
arriba. Su matriz se repetirá con multiworkspace/permisos en 107; no declarar
95/108 terminados por estas entregas. Todos los tickets siguen necesarios;
las ramas descartadas de opciones no se implementan. La configuración de correo
real se resolverá en 97 sin enviar invitaciones ni solicitar secretos por ticket.

## Base comprobada y límites

El Epic original no tenía hijos. El requisito explícito es colaboración con
acceso sólo por invitación; no se propone abrir signup. Ya se entregó en Epic 7:
Google OAuth (79), Owner/Member y allowlist por proyecto (80), invitación
hash-only de siete días y vinculación Google explícita (81), Chrome para miembros
(82), privacidad (83) y detalle Member (91). No mover/reabrir/duplicar esas tareas.

Evidencias de fuente inspeccionadas:

- [Membresías](workspace-memberships.md): una membresía por usuario,
  Owner canónico en workspace.owner_id; no es multiworkspace todavía.
- [Invitaciones](member-invitations.md): entrega manual, revelado único,
  rotación/revocación, sesión provisional sin datos y acceso por Google verificado.
- src/server/http/invitations.ts: lista, crear/reenviar/revocar y retirar miembro;
  falta una operación para editar proyectos de un miembro ya incorporado.
- src/web/routes/AccountRoute.tsx: datos de perfil de sólo lectura y vinculación
  Google; 100 añade ahora [sesiones propias](account-sessions.md).
- src/server/db/schema.ts: human_owner_id y claimed_by_agent_id no representan
  una asignación humana de trabajo; no hay modelo de assignee/notificación.
- El board SSE del ticket63 se reutiliza en104, junto con nuevos guards para
  respuestas/revisión y [reconciliación del detalle](detail-live.md) sin pisar
  borradores; permisos/membresías futuras aún deben integrarse en107.

El encargo inicial de planificación no autorizaba cambios de runtime; el nuevo
encargo sí pide implementación. Las pruebas no autorizan invitar personas reales,
enviar correos ni cambiar sus permisos o la configuración Google/DNS. El revisor de Store
conserva el acceso acordado. No se rehace el bucle agentico del Epic 6 ni la
política de saltar revisión del ticket 68 (Epic 5).

## Índice y dependencias

| Ticket | Preguntas | Dependencias de este Epic |
| --- | ---: | --- |
| [94-Cerrar el alcance de usuarios, roles y workspaces](https://issopen.serviciosegado.com/issues/1067fb51-4d24-416c-ac99-f6b2de6774b2) | 2 | — |
| [95-Aplicar la matriz de permisos a todas las superficies](https://issopen.serviciosegado.com/issues/63e3c11d-ad33-4037-9771-71fe63863b11) | 1 | 94, 108 |
| [96-Gestionar acceso de miembros ya incorporados](https://issopen.serviciosegado.com/issues/56cabba1-3173-4944-a8c6-c95753eb3500) | 2 | 94, 95 |
| [97-Completar la entrega y operación de invitaciones](https://issopen.serviciosegado.com/issues/3bf49049-f117-484b-a4af-eabdfee7c8c4) | 2 | 94, 95 |
| [98-Pulir el login y onboarding de personas invitadas](https://issopen.serviciosegado.com/issues/2f081d4e-1607-48ad-82ea-25f8b4a5beb3) | 1 | 94, 95 |
| [99-Añadir perfil editable y directorio mínimo de colaboradores](https://issopen.serviciosegado.com/issues/1a14f758-eb72-4229-9f65-9adaf0305e79) | 2 | 94, 95 |
| [100-Gestionar sesiones y dispositivos de la propia cuenta](https://issopen.serviciosegado.com/issues/2e7fcfe9-5c87-43ea-a150-ff44937ace83) | 1 | 94; repetir matriz 95/108 en107 |
| [101-Asignar responsables humanos a los tickets](https://issopen.serviciosegado.com/issues/6a6bd35e-a9d6-4d88-b527-bfcc491b8b91) | 2 | 94, 95, 96, 99 |
| [102-Dirigir preguntas y revisiones a personas concretas](https://issopen.serviciosegado.com/issues/2d0bdfbf-6e16-420c-bffb-09ec78f5fea5) | 2 | 94, 95, 99, 101 |
| [103-Añadir menciones y avisos de colaboración](https://issopen.serviciosegado.com/issues/ea956a9a-8e7f-4cc1-85d2-320436bdbf65) | 2 | 94, 95, 99, 101, 102 |
| [104-Sincronizar el detalle sin perder cambios de otros usuarios](https://issopen.serviciosegado.com/issues/865601e9-0ff4-4cf5-a46b-ba9fe572cd5c) | 1 | 94; repetir matriz 95/108 en107 |
| [105-Proteger la propiedad y recuperar acceso administrativo](https://issopen.serviciosegado.com/issues/5a349a29-b6d4-43c4-a4de-eb8327f21a58) | 1 | 94, 95, 96, 100 |
| [106-Mostrar auditoría de accesos y cambios de permisos](https://issopen.serviciosegado.com/issues/2429e1b5-f2dc-4a5a-b39f-c3789f196ef7) | 1 | 94, 95, 96, 100 |
| [107-Validar colaboración, aislamiento y entrega del Epic](https://issopen.serviciosegado.com/issues/ff185eaf-7904-4bb3-9d28-fcc799f5ab8e) | 0 | 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106 |
| [108-Implementar membresías y contexto multiworkspace](https://issopen.serviciosegado.com/issues/bb4f8210-0a43-4dd7-ba26-bbd459c9e186) | 0 | 94; base previa a95/dependientes |
| [109-Cerrar navegación móvil al cambiar de página](https://issopen.serviciosegado.com/issues/c77b06a1-c37d-4084-a317-57a887b878d0) | 0 | Hallazgo del gate 100/104 |

Responder primero 94 (roles/tenancy) y 95 (permisos). El resto se agrupa por
problema: gestión de accesos, invitación, onboarding, cuenta, sesiones,
asignaciones, preguntas/revisión, avisos, conflictos, continuidad y auditoría.
107 comprueba el conjunto aprobado y no repite las decisiones de sus dependencias.

La dependencia de 103 con correo 97 sólo existe si se elige canal email; la
bandeja interna puede avanzar sin él. 104 puede trabajar sobre el detalle actual
sin esperar asignaciones nuevas. 106 incorpora eventos de funciones opcionales
cuando se aprueben; no espera una transferencia o correo diferidos.

## Decisiones preparadas en Issopen

Las 20 preguntas tienen dos o tres opciones, recomendación explícita y el
campo Otro nativo para texto libre. No se han contestado en nombre del usuario.
Cubren roles nuevos, número de workspaces, rol por proyecto, cero proyectos,
suspensión, canal de invitación, recordatorios, destino tras alta, perfil y
privacidad del directorio, sesiones, cardinalidad/permisos de asignación,
destinatarios y revisión, canales/eventos de avisos, conflictos, transferencia
de propiedad y visibilidad de auditoría.

Histórico del plan previo a responder: Owner/Member y un workspace eran el punto de
partida recomendado. El contrato superior registra las elecciones explícitas y
sustituye esas recomendaciones para multiworkspace, avatar y transferencia.
Viewer/Admin, email de actividad, seguimiento y suspensión quedan fuera. Si dos respuestas
se contradicen, añadir una aclaración al ticket afectado antes de implementar;
no resolverlo concediendo permisos. Si se mantiene un workspace, multiworkspace
queda fuera; si se pide, concretar migración/contexto de sesión antes del código.

Los criterios de aceptación, casos negativos, anclas de archivos y exclusiones
están en cada ticket. El planteamiento técnico mantiene autorización en servidor
y checks en cada petición como recomienda
[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
La gestión de sesiones debe invalidar las sesiones revocadas y distinguir su
alcance del de otros tokens; referencia
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
Son guías técnicas, no una certificación ni una decisión de producto ya tomada.

## Ejecución posterior

1. Reread del Epic, tickets, preguntas y versiones antes de empezar.
2. Incorporar respuestas a criterios y marcar ramas diferidas sin simular PASS.
3. Reclamar sólo el trabajo autorizado y elegible; mantener los guards y la
   actividad atribuida, sin responder preguntas humanas mediante MCP.
4. Probar capacidades nuevas y negativas con cuentas/proyectos sintéticos.
   Google real necesita identidades controladas autorizadas; no usar el revisor
   Store para ensayar retiradas, cambios de rol o pérdida de acceso.
5. Migraciones con backup/restore aislado, contratos Chrome/MCP compatibles y
   release GitOps sólo después de la autorización de implementación.
6. La aprobación Store de Epic 7 no bloquea el desarrollo de la colaboración,
   pero las pruebas unpacked no cierran 87/88 ni la publicación real.

Trazabilidad GSD: quick 260913-vul. No se ha cambiado el roadmap.
