# Epic 3 — usuarios, roles, colaboración e invitaciones

Estado: **planificación, sin implementación**. Fuente canónica:
[Epic 3 en Issopen](https://issopen.serviciosegado.com/epics/c3b6a630-824e-473a-add9-ac41bf63e38c).
Inventario del 2026-09-13: 14 tickets (94–107), 20 preguntas bloqueantes sin
responder, 13 tickets con preguntas y uno de validación sin decisiones propias.
Todos en Backlog; sin claims. Este archivo es un índice derivado, no una copia
editable de respuestas. Leer siempre los tickets/versiones actuales.

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
  Google; no hay inventario de sesiones web en esta pantalla.
- src/server/db/schema.ts: human_owner_id y claimed_by_agent_id no representan
  una asignación humana de trabajo; no hay modelo de assignee/notificación.
- El board SSE del ticket 63 y los guards de detalle existentes se reutilizan;
  el trabajo nuevo incluye reconciliar cambios remotos sin pisar borradores.

No se autoriza implementar, migrar, invitar personas, enviar correo, cambiar
Google/DNS/permisos ni desplegar con esta planificación. El revisor de Store
conserva el acceso acordado. No se rehace el bucle agentico del Epic 6 ni la
política de saltar revisión del ticket 68 (Epic 5).

## Índice y dependencias

| Ticket | Preguntas | Dependencias de este Epic |
| --- | ---: | --- |
| [94-Cerrar el alcance de usuarios, roles y workspaces](https://issopen.serviciosegado.com/issues/1067fb51-4d24-416c-ac99-f6b2de6774b2) | 2 | — |
| [95-Aplicar la matriz de permisos a todas las superficies](https://issopen.serviciosegado.com/issues/63e3c11d-ad33-4037-9771-71fe63863b11) | 1 | 94 |
| [96-Gestionar acceso de miembros ya incorporados](https://issopen.serviciosegado.com/issues/56cabba1-3173-4944-a8c6-c95753eb3500) | 2 | 94, 95 |
| [97-Completar la entrega y operación de invitaciones](https://issopen.serviciosegado.com/issues/3bf49049-f117-484b-a4af-eabdfee7c8c4) | 2 | 94, 95 |
| [98-Pulir el login y onboarding de personas invitadas](https://issopen.serviciosegado.com/issues/2f081d4e-1607-48ad-82ea-25f8b4a5beb3) | 1 | 94, 95 |
| [99-Añadir perfil editable y directorio mínimo de colaboradores](https://issopen.serviciosegado.com/issues/1a14f758-eb72-4229-9f65-9adaf0305e79) | 2 | 94, 95 |
| [100-Gestionar sesiones y dispositivos de la propia cuenta](https://issopen.serviciosegado.com/issues/2e7fcfe9-5c87-43ea-a150-ff44937ace83) | 1 | 94, 95 |
| [101-Asignar responsables humanos a los tickets](https://issopen.serviciosegado.com/issues/6a6bd35e-a9d6-4d88-b527-bfcc491b8b91) | 2 | 94, 95, 96, 99 |
| [102-Dirigir preguntas y revisiones a personas concretas](https://issopen.serviciosegado.com/issues/2d0bdfbf-6e16-420c-bffb-09ec78f5fea5) | 2 | 94, 95, 99, 101 |
| [103-Añadir menciones y avisos de colaboración](https://issopen.serviciosegado.com/issues/ea956a9a-8e7f-4cc1-85d2-320436bdbf65) | 2 | 94, 95, 99, 101, 102 |
| [104-Sincronizar el detalle sin perder cambios de otros usuarios](https://issopen.serviciosegado.com/issues/865601e9-0ff4-4cf5-a46b-ba9fe572cd5c) | 1 | 94, 95 |
| [105-Proteger la propiedad y recuperar acceso administrativo](https://issopen.serviciosegado.com/issues/5a349a29-b6d4-43c4-a4de-eb8327f21a58) | 1 | 94, 95, 96, 100 |
| [106-Mostrar auditoría de accesos y cambios de permisos](https://issopen.serviciosegado.com/issues/2429e1b5-f2dc-4a5a-b39f-c3789f196ef7) | 1 | 94, 95, 96, 100 |
| [107-Validar colaboración, aislamiento y entrega del Epic](https://issopen.serviciosegado.com/issues/ff185eaf-7904-4bb3-9d28-fcc799f5ab8e) | 0 | 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106 |

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

Recomendaciones no son decisiones: Owner/Member y un workspace son el punto de
partida. Viewer/Admin, multiworkspace, avatar, email de actividad, seguimiento,
suspensión y transferencia requieren respuesta afirmativa. Si dos respuestas
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
