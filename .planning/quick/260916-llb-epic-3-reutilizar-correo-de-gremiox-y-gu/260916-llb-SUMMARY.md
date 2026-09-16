# Reutilización de Gmail y guía del piloto Google

## Decisiones y alcance

El 16/09 el propietario pidió reutilizar la configuración de Gremiox y realizar
personalmente el piloto Google. Se leyó sólo el SMTP relevante del CRM, sin
modificar ese proyecto ni enviar mensajes. Gmail smtp.gmail.com:587, STARTTLS
obligatorio, usuario/remitente serviciosegado@gmail.com. Autenticación comprobada
localmente y desde el pod del máster; ninguna prueba usa sendMail.

Secret externo nuevo `issopen-mail-env`, ocho claves explícitas en el Deployment.
Fuente de recuperación `.local/secrets/issopen-mail.env`, ignorada y 0600,
directorio0700, clave AES-GCM independiente de32 bytes. Helper canónico GitOps
invocado mediante `provision-production-secrets.sh --mail-only`; crea sólo si
falta, nunca sobrescribe y transmite valores por stdin, no argv/logs/manifiestos
durables. Segunda invocación real confirmó no-op. No se tocaron secretos de
auth, Google OAuth, DB, registry ni Gremiox. La credencial Gmail compartida tiene
el mismo ciclo de revocación/cuota: futura separación requiere operación propia.

Privacidad pública1.2 informa de proveedor, dirección destinataria, enlace y
texto mínimo; no se envían datos de proyectos/tickets/adjuntos. El Owner conserva
entrega manual y solicita cada email. Se documentaron los pasos en
docs/google-pilot.md y en un comentario nativo del98. No se seleccionó una cuenta
piloto por inferencia ni se modificó el revisor o la ficha Store.

## Verificación técnica

- pnpm validate:167 unit/web,111 integración,36 E2E web y2 skips esperados;
  extensión16 unit/13 E2E, mismo paquete0.6.3 reproducible, secret scan412 PASS.
- pnpm test:compose PASS. Primera prueba del nuevo encabezado detectó falta de
  scope de fila: corregido con scope=row antes del gate completo satisfactorio.
- GitOps:140 pruebas Python,6 pruebas del helper, bash -n, kustomize y diff PASS.
  Este checkout GitOps no tiene Makefile; se ejecutó su suite real, sin cambiar
  el checkout canónico sucio ni publicar sus cambios locales.
- Backup gmail-activation-20260916/issopen-DCVxrQ; restore aislado PG18.6 sin red:
  113 issues,1041 eventos,13 imágenes con bytes/SHA256 correctos,19 recibos.
- Antes del rollout: cola0, ambos PVC Bound sin cambios, SMTP desde máster PASS.

## Publicación

Fuente6005ace5a688a1e9547bd2d2959611f9da60cd12, GitOps5186bb76 (helper) y
33a99f6e8ad47b09b2517e1258b06b9799801496 (activación), publicados. Imagen construida
desde git archive exacto con label completo, tag gmail-6005ace y digest remoto
sha256:17dead1b4e2da4e33c8898192b8c95cf8b748eeb9af4fd927707aa554c1d2bc4.
Sin migraciones nuevas, misma colocación y persistencia. Se espera reconciliación
automática, no sync/patch/restart imperativos.

La activación fue observada Synced/Healthy el16Sep13:49UTC, podReady0reinicios,
digest17dead1b exacto, readinessJSONok, PVCs intactos y SMTP verify usando el
entorno real del pod PASS; cola0. El primer smoke encontró desbordamiento de la
política en móvil (no fallo de SMTP). Regresión E2E reprodujo el problema antes
de corregir min-content del grid; fuente f5dbbc40be071734c748bbfeb2c9ebf597c7142a
añade dos reglas CSS y regresión desktop/móvil. Gate completo repetido:
167 unit/web,111 integración,38 E2E web+2 skips,Chrome16+13,reproducible0.6.3,
scan414 PASS. GitOps a3704a4a8066c18d0a57e97bbf6716ea28a35347 / imagen
gmail-mobile-f5dbbc4 / digest65141db397abc146423a5f08aab473b0bba0369c78e51d0571a3f6aa1e0345ab
publicados; repetir smoke tras sincronización. No modificó correo/permisos/datos.

Resultado final16Sep14:00UTC: Argoa3704a4a Synced/Healthy, podReady sin reinicios,
digest65141db3 exacto, readinessJSONok, correo habilitado y ambos PVCs intactos.
Compose final también PASS. Segundo smoke productivo PASS: política1.2 pública
a1440/360 sin desbordamiento; login Member, perfil/directorio, cuenta/sesiones,
preguntas/asignación/inbox/ownership, imagen privada, acceso ajeno404 y admin403,
revocación únicamente de la sesión de prueba recién creada y limpieza del detalle.
Los401 finales son esperados tras esa revocación. No tickets, grants, revisor ni
sesiones preexistentes modificados. Evidencia ignorada:
.local/gmail-mobile-browser-VZzgEp. El primer intento fallido queda conservado
en .local/gmail-browser-znWfpu; no se presenta como aprobado.

## Aceptación pendiente

97: recepción real del mensaje solicitado por el Owner.98: invitado con otra
cuenta Google y acceso aislado, reentrada.107: evidencia de colaboración del
piloto. La autenticación SMTP no demuestra entrega; fixtures no demuestran Google.
Las decisiones de proveedor y operador están resueltas, no hay que repetir esas
preguntas. No cerrar por haber escrito una guía.13 tickets del Epic ya están en
revisión humana; los tres anteriores conservan la aceptación externa pendiente.
