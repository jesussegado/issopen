# Operación del canal Store — ticket 88

Estado: runbook preparado el 2026-09-13. La aceptación de 88 sigue pendiente
del piloto 87 y de un ensayo de actualización/recuperación del canal real.
Los restores/PKCE automatizados no demuestran una actualización Store.

## Responsables y referencias

Owner operativo: `serviciosegado@gmail.com`; publisher
`0c6be6e6-1d57-48de-acb3-66166bda94a3`, item
`eohpecaogeelnicbpeedjdganacfknok`. Consultar [estado y candidato](chrome-web-store.md).
Correo de soporte/alertas: el mismo. El owner conserva 2FA y recuperación;
no almacenar códigos ni sesiones Google en Git. Revisar correo de rechazo,
seguridad y vencimiento de staging durante cada entrega.

Fuente: `/home/jsegado/Projects/platform/apps/issopen`.
GitOps: `/home/jsegado/Projects/platform/homelab/apps/issopen`.
Historial de decisiones en Epic 7; no deducir aprobación de un ticket cerrado.

## Preflight y nueva versión

1. Abrir un ticket de release con alcance, versión anterior/nueva y rollback.
   Releer preguntas y aprobación. Conservar el ZIP anterior y su JSON/checksum.
2. Verificar Git limpio y compatibilidad API en
   [RELEASE-CANDIDATE.md](../extensions/chrome/store/RELEASE-CANDIDATE.md).
   Cambios del servidor se despliegan primero mediante source → imagen por
   digest → commit GitOps → Argo. Nunca `kubectl apply/patch` para una release.
3. Antes de desplegar, crear backup privado fuera del master con
   `scripts/backup-captures.ts` y el kubeconfig externo autorizado; seguir
   [backup y restore](chrome-delivery.md#volumen-cuota-backup-y-recuperación).
   No afirmar consistencia completa si se borran imágenes durante dump/tar:
   coordinar ausencia de borrados y comprobar todas las referencias/checksums
   tras restore aislado. Un manifiesto sin completar no es un backup válido.
4. Incrementar versión del paquete Chrome para cualquier cambio empaquetado,
   revisar manifest/permisos/privacy y ejecutar desde la fuente:

   ```bash
   git status --short
   pnpm validate
   pnpm test:compose
   # Commit/push explícito de la fuente validada; después, con Git limpio:
   pnpm extension:release
   ```

   Comprobar SHA-256 del ZIP exacto y JSON contiguo; registrar versión, commit,
   hash y digest del backend en el ticket. No compartir secretos/dumps/logs.
5. Validar el ZIP en un perfil de prueba independiente. Nunca recargar o
   reinstalar la extensión que tenga un envío/borrador del usuario pendiente.
6. En el mismo item, Package → Upload New Package, seleccionar ese ZIP;
   conservar Sin mostrar. Comparar permisos, ficha y test instructions con
   lo que hace el código. La cuenta revisora debe seguir funcionando.
7. Sólo con autorización de envío, Submit for Review, desmarcar publicación
   automática y confirmar. Comprobar estado real, registrar fecha y no prometer
   plazo de aprobación. Google documenta una ventana de 30 días para publicar
   un candidato aprobado/diferido; consultar el vencimiento del dashboard.
8. Tras aprobación, verificar ID/versión/candidato y autorización de publish.
   Publicar manualmente. Ejecutar [piloto 87](chrome-store-pilot.md), incluyendo
   actualización de una instalación previa, versión nueva, OAuth, borrador
   inocuo y un único ticket. Registrar evidencia antes de ampliar el piloto.

La actualización exige una versión superior y revisión; no es un reemplazo
arbitrario de bytes bajo 0.6.2. [Publicación](https://developer.chrome.com/docs/webstore/publish)
y [actualizaciones](https://developer.chrome.com/docs/webstore/update), consultadas
el 2026-09-13. No asumir rollout porcentual disponible para este piloto.

## Incidente, rechazo y recuperación

1. Registrar síntoma/versión/alcance sin tokens, congelar nuevos envíos piloto
   y conservar evidencia. No borrar datos para corregir un error de interfaz.
2. Review pendiente: mantener diferida. Cancelar/reemplazar review o retirar
   item sólo con autorización explícita y explicación de impacto. No cancelar
   una revisión sana porque haya cambiado documentación interna.
3. Rechazo: guardar razón no sensible en el ticket, corregir causa real,
   incrementar versión si cambia paquete y repetir gates. No ocultar funciones.
4. Servidor: revisar esquema y compatibilidad del digest anterior, proponer
   commit GitOps de rollback, validar render y esperar Argo Synced/Healthy.
   Conservar PostgreSQL, recibos, invitaciones y ambos PVCs. No downgrade a
   binarios anteriores a membresías/borrado lógico ni revertir SQL aditivo.
5. Extensión: preparar **forward rollback**, versión superior con código
   anterior compatible. Ensayar primero con borrador sintético/recibo en
   perfil aislado. No garantizar downgrade automático ni borradores 0.5→0.4.
6. Si existe compromiso, revocar el acceso afectado antes de reanudar. Tras
   recuperar, verificar un solo ticket/adjuntos y no sólo readiness.

## Revocar y rotar sin reconstruir el workspace

| Acceso afectado | Acción específica | Verificación |
| --- | --- | --- |
| Instalación Chrome | Cuenta → Desconectar o `/extensions` de esa persona | Siguiente petición/refresh falla, otras instalaciones no cambian. |
| Member piloto | Owner → `/members` → retirar miembro exacto | Sesiones y clientes/grants de esa persona revocados, datos/auditoría conservados. |
| Revisor local | Procedimiento `store-reviewer.ts revoke` en [acceso de revisión](chrome-review-access.md) | Cuenta marcada revocada; no retirar durante review sin sustituto funcional. |
| Google client secret | Crear secreto del cliente web correcto, actualizar almacén privado y Secret mediante operación autorizada; activar por GitOps y probar antes de revocar el anterior | Login Google correcto; no es el token Chrome ni PAT MCP. |
| PAT MCP | Owner → Agents → revocar identidad afectada, recrear sólo con scopes/allowlist aprobados | Siguiente llamada denegada; Chrome no usa ese PAT. |
| Publisher/Google comprometido | Owner recupera cuenta/2FA en Google y revisa accesos del proyecto y panel | Identidad operadora recuperada, cambios de item auditados antes de publicar. |

Importante: `scripts/provision-production-secrets.sh` **sólo crea Secrets
ausentes**, no rota los existentes. No ejecutarlo esperando una rotación ni
inventar un comando que exponga valores. La rotación productiva requiere un
procedimiento específico/autorizado; no se ejecuta por documentar este runbook.
Fuente privada local de Issopen: `.local/secrets/issopen-production.env` (0600),
no `../../.local`. Nombres externos: `issopen-env`, `issopen-postgres-env`,
`registry-serviciosegado`; nunca imprimir `kubectl get secret -o yaml`.

## Gate del ensayo pendiente

Registrar: par de versiones, commit/ZIP/digest, backup íntegro, restore aislado,
recuento de tickets/adjuntos y checksum, instalación Store actualizada,
reintento sin duplicado, revocación de una instalación de prueba, recuperación
y duración observada. No restaurar sobre producción como ensayo. Si falta
Store o autorización para rotación/retirada real, marcar ese paso pendiente;
no cerrar 88 ni el Epic con una simulación.
