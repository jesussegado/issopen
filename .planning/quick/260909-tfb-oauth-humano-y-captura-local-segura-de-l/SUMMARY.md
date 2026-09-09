# Chrome Epic — progreso del corte

## 21 / OAuth humano

Implementado y verificado localmente: instalación pública individual, PKCE S256,
consentimiento, cuenta/proyectos en panel, renovación y revocación web/panel.
Access 300 s y caducidad absoluta 30 días; API humana separada de agentes.
Sin migraciones, nuevos Secrets, PVC ni cambios de permisos agenticos.

`pnpm validate`: 75 tests unit/web, 44 de integración, 8 E2E web/Chrome reales
(2 skips móviles previstos), 32 unitarios de extensión y 2 E2E de manifiesto y
acción real de toolbar. Lint/tipos/build y secretos pasan. Dos builds 0.2.0
reproducibles, 7 archivos, árbol SHA-256
`c7ab34f9439cead489f1b5bb2ae539255264966b39bdca669fe1c5b291cdd4bb`.

Producción publicada y comprobada: fuente `2d9b376447af840870f10fafd56f45ff49931f98`,
imagen `registry.serviciosegado.com/issopen:chrome-oauth-2d9b376` con digest
`sha256:08e480047c01e5771dfe3198e346ac484ffeceb04a0aba53ed0ec30723dcc8d9`.
GitOps `main` `5a6b2c2e62aac16b903a2326b46db434c331bb09` Synced/Healthy;
pod Ready sin reinicios, HTTPS readiness 200. PostgreSQL y PVC conservan sus UID;
no migraciones/Secrets nuevos. Registro canónico local `438bee2a`.

Google Chrome 152 real, perfil aislado: login normal del propietario, vínculo,
consentimiento, dos proyectos visibles en el panel, desconexión y revocación
comprobadas. La instalación de prueba queda revocada como rastro. Ticket 21
Ready for Review v7 tras enlazar el commit, claim null, releído por MCP; 4 criterios marcados y pruebas
registradas. No se han cambiado contraseñas ni permisos de agentes.

## 23 / captura y parte local de 25

Chrome 0.3.0: recorte/viewport/full-page, máscaras previas de controles y
superficies opacas, captura ligada al documento, rechazo de cambios durante
captura y restauración con watchdog. PNG local hasta 8 MiB / 32 megapíxeles;
full-page hasta 16.000 px CSS/20 tramos. Editor local con zoom, recorte,
ocultación opaca, cinco pasos undo/redo y descarga de PNG plano.

Dos E2E de captura en Chromium pasan: los tres modos, máscaras y restauración,
recorte exacto con DPR 1 y DPR 2 + zoom 125 %, Escape, exceso de tamaño y
mutación del DOM sin fugas ni pérdida de la imagen revisada anterior.
Contrato y límites en `docs/chrome-capture.md`. `pnpm validate` completo PASS:
75 unit/web, 44 integración, 8 E2E web/OAuth (2 skips móviles previstos),
40 unitarios de extensión y 4 E2E de extensión, lint y tipos. 171 pruebas pasan.
Escaneo de secretos: 203 archivos. Dos builds 0.3.0 idénticos, 7 archivos,
árbol SHA-256 `ef808eeb0eaadda2d71f739f77e232e0feff4d405c6870dc44c692d25be3e46d`.

Se corrigió la edición anticipada durante la decodificación del preview; los
controles esperan a `aria-busy=false`. Las pruebas esperan a la animación de
apertura nativa del panel (que cambia el viewport) y los dos E2E de captura
pasan también repetidos tres veces consecutivas (6/6). Tolerancia de un píxel
físico por redondeo nativo al usar zoom fraccionario.

Google Chrome 152.0.7977.82 de escritorio también verifica viewport, full-page,
restauración, recorte y ocultación. Ventana aislada 0.3 abierta para el propietario,
perfil `/tmp/issopen-chrome-03-AT69bo`, demo exclusivamente local con datos ficticios;
sin tocar el perfil personal ni guardar nuevas credenciales. No hay release
Kubernetes adicional porque este corte sólo modifica el bundle unpacked.

25 sigue parcial: faltan DOM 24 y conexión/verificación de la imagen enviada y
almacenada en 22/26/28. No declarar el Epic completo ni promover criterios de
upload por haber probado una descarga local. Próximo bloque: DOM 24 y contratos
de adjuntos 22/28 antes del compositor 26. No se declara 22–33 completos.
La skill 43 sigue cerrada y no se inicia la distribución/piloto 44.

## Publicación y handoff

Captura/editor publicados en `def529733fec43e7f78247c08732ca7753078028` en
`origin/main`. Commits enlazados desde los tickets en Forgejo privado.
Tracker releído al finalizar: 21 Ready for Review v7, 23 Ready for Review v7
(4 criterios verificados), 25 In Progress v5 (criterios de envío/almacenamiento
sin marcar); los tres claims null y cero preguntas bloqueantes sin respuesta.
Los comentarios detallan pruebas y próximos pasos. No se inicia todavía 24 ni
22/26/28; no hay envío de tickets desde la extensión.
