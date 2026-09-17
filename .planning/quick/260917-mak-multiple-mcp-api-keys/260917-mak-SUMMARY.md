---
quick_id: 260917-mak
status: complete
ticket: ISSOPEN-116
source_commit: f053a551261965bb8582c002c142f58bdccd8845
gitops_commit: 969b7c50e232014b86c2da657fdc9e5c9c2959ca
onboarding_commit: b120926500f683bdb1b1f9db5b8718cdb661e0ba
onboarding_gitops_commit: 2f449caac22cc9a6423829a04fc9fb7e7dac56e2
---

# Varias claves MCP por identidad de agente

## Resultado

Una identidad PAT puede tener hasta diez claves MCP activas, cada una con
nombre, expiración, último uso y revocación propios. Los permisos y proyectos no
se copian a las claves: se resuelven desde la identidad viva en cada petición.
El token sólo se revela al crearlo y su bearer continúa limitado a `/mcp`; no
autoriza las APIs REST humanas. OAuth y la revocación completa de la identidad
mantienen sus límites anteriores.

La migración 0032 convierte la credencial existente en `Primary` sin alterar su
hash, elimina el límite de una clave por identidad y exige nombres únicos sin
distinguir mayúsculas. La UI de Agents permite crear, listar y revocar una clave
concreta, separando visualmente esa acción de revocar toda la identidad. El
contrato operativo, rotación y rollback están en `docs/agent-credentials.md`.

## Verificación

- `pnpm validate`: 177 unit/web, 114 integration, 42 E2E web y 2 skips
  previstos; 16 Chrome unit y 13 Chrome E2E, builds reproducibles y secret scan
  de 435 ficheros PASS.
- `pnpm test:compose`: 1/1 PASS con PostgreSQL real e imagen de producción.
- Migración desde 0031: hash/fingerprint/token anterior conservados, etiqueta
  `Primary`, segunda clave admitida y duplicado case-insensitive rechazado.
- Backup previo en `.local/backups/issopen-mcp-keys/issopen-FuhFpu`; dump y
  adjuntos verificaron checksums y restauraron en PostgreSQL 18.6 aislado con
  los mismos 121 issues, 1110 eventos, 18 identidades, 18 credenciales,
  15 evidencias y 25 recibos.
- Imagen exacta de `f053a55`:
  `registry.serviciosegado.com/issopen:mcp-keys-f053a55` con digest
  `sha256:131ac46382fc02f7d4811eab0cdec62dbd1bfb5b315328df553148cf75c1a1c0`.
- GitOps `969b7c50`: Argo CD `Synced/Healthy`, pod
  `issopen-6ddd8bd74-rf9xg` Ready y 0 reinicios, readiness JSON OK.
- Los PVC conservaron los UID `cf93e0a7-b978-46c2-9c03-c77f902742b9`
  (PostgreSQL) y `c40b0035-0433-436f-91c4-feff7a20e754` (adjuntos).
- Smoke real del Owner: creó una clave de siete días, confirmó el revelado
  único, conectó por MCP, recibió 401 en REST, revocó sólo esa clave y comprobó
  que ya no autenticaba. La clave temporal quedó revocada y no existe ninguna
  clave de smoke activa.
- La conexión persistente anterior ejecutó `get_agent_context` después del
  rollout, confirmando que `Primary` mantuvo identidad, scopes y allowlist.

## Operación y rollback

Cada consumidor debe recibir su propia clave y nunca compartir `Primary`. La
rotación segura es crear, validar, sustituir y revocar la anterior. Revocar una
clave no afecta a sus hermanas; revocar la identidad las invalida todas. El
rollback de código consiste en volver a la imagen previa conservando la columna
y el índice aditivos; no se eliminan filas, Secrets ni PVCs.

## Seguimiento: onboarding público

La entrega `b120926` sincroniza el modelo de claves múltiples en la página
`/agent-onboarding`, la guía de texto, el contrato JSON, `llms.txt`, la guía
generada por identidad y la documentación interna. Explica una clave nombrada
por consumidor, límite de diez activas, `Primary`, revelado único, preflight,
rotación sin interrupción y diferencia entre revocar una clave o la identidad.
`AGENTS.md` obliga desde ahora a revisar todas esas superficies en cada cambio
de MCP o skill.

Gate completo: 177 unit/web, 114 integración, 42 E2E web y 2 skips previstos,
16 Chrome unit, 13 Chrome E2E, reproducibilidad y secret scan 436 PASS. Imagen
`agent-onboarding-keys-b120926` con digest
`sha256:a5d01acb21373fac9683be8220bfe044754db4f25fead604893a3634063bd525`;
GitOps `2f449caa`, Argo Synced/Healthy, pod Ready con 0 reinicios, readiness OK y
PVCs intactos. Smoke público desktop 1440 y móvil 360 PASS, sin overflow ni
errores de consola; texto, JSON y llms contienen el contrato esperado.
