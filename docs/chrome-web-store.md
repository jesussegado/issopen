# Chrome Web Store: contrato de publicación Unlisted

Estado reconsultado el 2026-09-13 a las 20:23 UTC: **Pendiente de revisión**.
Issopen 0.6.2 está enviado, con visibilidad **Sin mostrar (Unlisted)** y
publicación automática desactivada. No hay versión aprobada/publicada todavía.

- Publisher: `0c6be6e6-1d57-48de-acb3-66166bda94a3`.
- Item: `eohpecaogeelnicbpeedjdganacfknok`.
- Fuente del ZIP: `d4a0ae8be185fec921602fbc12a0fe723b01ff56`.
- SHA-256: `0e9c636c51407797e95697fa5cb1a8d679448d13775c7887161079f2e2fb177b`.
- [Estado en el dashboard](https://chrome.google.com/webstore/devconsole/0c6be6e6-1d57-48de-acb3-66166bda94a3/eohpecaogeelnicbpeedjdganacfknok/edit/status).
- [Operación del canal](chrome-store-operations.md) y [piloto](chrome-store-pilot.md).

## Objetivo y límites

Issopen se distribuirá como una extensión **Unlisted**. Chrome Web Store no la
mostrará en búsquedas, pero cualquier persona que conozca el enlace podrá
instalarla. Por eso el enlace no es un control de acceso: Issopen seguirá
denegando el uso a quien no tenga una invitación vigente. Unlisted, Private y
Public están sujetos a las mismas políticas y al mismo proceso de revisión.

El piloto no incluye publicación Public, captura de páginas o DOM, permisos
`all_urls`, credenciales MCP dentro de Chrome, billing ni SSO empresarial.

La cuenta operadora de Google Cloud y Chrome Web Store es
`serviciosegado@gmail.com`. El código y la documentación pueden nombrarla como
responsable, pero nunca guardar su contraseña, cookies, códigos de recuperación
o tokens.

## Estado comprobado de partida

| Superficie | Estado observado | Fuente de evidencia |
| --- | --- | --- |
| App pública | `https://issopen.serviciosegado.com`, HTTPS y HSTS | smoke HTTP del 2026-09-13 |
| Runtime | Deployment y PostgreSQL `Ready`; Argo CD `Synced/Healthy` | clúster `issopen`, revisión GitOps `c79be9e026800642aa687ccd980043b9021222bd` |
| Imagen activa | `chrome-listing-40cc4af` por digest `sha256:d85312e46ce4bc871becd1e6c7343c2f8363b1c574efde760f4459a40f6276a1` | Deployment observado |
| Datos | PostgreSQL y adjuntos PNG privados en PVC separados y retenidos | manifiestos y PVC `Bound` |
| Extensión base | MV3 0.6.2; panel lateral, OAuth PKCE por persona/instalación, acceso Owner/Member, imágenes elegidas por la persona, consentimiento y creación de tickets | manifest y paquete auditados, tickets 82–85 |
| Distribución actual | paquete local/desempaquetado; sin ficha Store aprobada | `extensions/chrome/.output/chrome-mv3` |
| Repositorio | fuente independiente, rama `main`; Forgejo privado | `http://192.168.2.165:3000/jsegado/issopen` |

## Borrador reproducible de la ficha

La fuente exacta de textos, privacy practices, permisos, instrucciones privadas
de revisión y checkpoint externo está en
[`extensions/chrome/store/LISTING.es.md`](../extensions/chrome/store/LISTING.es.md).
`pnpm store:assets` reconstruye icono 128×128, promo 440×280 y dos capturas
1280×800 de la interfaz real con datos sintéticos; `assets.json` fija sus
dimensiones, bytes y SHA-256. Las páginas públicas canónicas son `/chrome`,
`/support` y `/privacy`, renderizadas sin consultar una sesión.

El propietario completó registro y pago; el correo de contacto está verificado.
La declaración guardada es no operador, según su decisión explícita sobre el
uso actual no profesional. Si ese uso cambia debe revisarla personalmente.
La ficha y las instrucciones privadas del Member aislado se guardaron y se
comprobó su persistencia. El posterior envío fue autorizado con «enviala».
La aclaración del ticket 86 quedó respondida el 13/09 a las 20:21 UTC:
mantener el acceso Member local durante esta revisión. Conservamos la elección
anterior de Google de pruebas como historial, pero esta respuesta específica
resuelve qué acceso usa el envío actual. No quedan preguntas pendientes en 86;
falta el resultado de Google y la publicación manual, no otra decisión de
credenciales. Véase [acceso de revisión](chrome-review-access.md).

La revisión de GitOps y el digest observados mandan sobre descriptores locales
desactualizados. Antes de cada publicación se vuelve a consultar el clúster.

## Identidades que no deben mezclarse

| Identidad | Uso | Credencial y almacenamiento | Revocación |
| --- | --- | --- | --- |
| Sesión web humana | entrar en la app y actuar como miembro | cookie `HttpOnly`, emitida por Issopen | cerrar sesión, revocar sesiones o miembro |
| Google OpenID Connect | autenticar una persona invitada | cliente web y secreto sólo en Secret externo; tokens nunca llegan al bundle | Google Cloud y revocación local de sesión/miembro |
| OAuth de extensión | vincular una instalación concreta a la persona ya autenticada | cliente público dinámico, PKCE S256; acceso corto y refresh en `chrome.storage.local` sólo para contextos confiables | `/extensions` o API de desconexión |
| Agente MCP | automatización de tickets | PAT u OAuth con scopes y allowlist propios, fuera de Chrome y Git | panel Agents o revocación OAuth |

Google no sustituye el OAuth de la extensión y una sesión humana no concede
scopes de agente. La app debe comprobar membership y proyecto en cada petición,
no confiar en lo que oculte la interfaz.

## Datos tratados por la extensión

La extensión trata nombre de cuenta, identificadores de workspace/proyecto/Epic,
título, descripción, prioridad, estado, hasta cinco imágenes aportadas
explícitamente y el borrador local. No lee la página, historial, cookies,
formularios ni portapapeles en segundo plano. `clipboardRead` es opcional y se
solicita únicamente tras pulsar **Pegar imagen**.

Las imágenes y campos permanecen en un borrador local durante un máximo de 24
horas desde el último cambio. Sólo se transmiten por HTTPS cuando la persona
pulsa **Enviar ticket**. Issopen conserva la evidencia privada según la
[política operativa](privacy.md), publicada sin login en
`https://issopen.serviciosegado.com/privacy`. El uploader o el owner pueden
eliminar una imagen del almacenamiento activo desde el ticket; la UI advierte
que no alcanza descargas o backups anteriores. Las credenciales quedan
excluidas de logs, tickets, artefactos y capturas de prueba.

## Matriz de requisitos y evidencias

| Requisito | Evidencia exigida | Ticket propietario | Intervención externa |
| --- | --- | --- | --- |
| Contrato, inventario y orden de entrega | este documento, metadata del proyecto y enlaces oficiales revisados | 78-PUB-01 | ninguna |
| Login Google mínimo y reversible | tests de OIDC/sesión, callback productivo y secret scan | 79-AUTH-01 | Google Cloud + owner |
| Owner/Member y denegación por defecto | migración, matriz de endpoints y pruebas negativas | 80-AUTH-02 | ninguna |
| Invitación de un solo uso y vinculación segura | tests de caducidad/replay/colisión y actividad atribuida | 81-AUTH-03 | owner para emitir/invitar |
| Extensión usable por Member | E2E OAuth por instalación y proyectos permitidos | 82-EXT-PUB-01 | usuario piloto |
| Privacidad y consentimiento | `/privacy`, disclosure web/Chrome, retención, revocación y borrado individual de imagen | 83-PRIV-01 | owner revisa el texto antes del upload |
| Publisher y ficha Store | cuenta registrada, descripción, iconos/capturas, soporte e instrucciones de prueba | 84-STORE-01 | Google/owner |
| Permisos mínimos y ZIP reproducible | manifest auditado, gate verde, ZIP y SHA-256 ligados a commit | 85-STORE-02 | ninguna |
| Revisión y publicación Unlisted | item ID estable, resultado de revisión y enlace de instalación | 86-STORE-03 | Chrome review + owner |
| Onboarding externo completo | perfil limpio, invitación, instalación Store, ticket con imágenes y revocación | 87-VALID-01 | usuario piloto + owner |
| Actualización, incidente y rollback | runbook ensayado, matriz de compatibilidad y rotación de accesos | 88-OPS-01 | owner cuando afecte al canal Store |

## Orden de release y checkpoints

1. Cerrar 78 y congelar este contrato.
2. Implementar 79 y 80 sin retirar el acceso owner actual.
3. Implementar 81 y demostrar que OAuth sin invitación no da acceso.
4. Adaptar la extensión en 82 y cerrar las declaraciones de datos en 83.
5. Preparar ficha/propiedad en 84 y producir el candidato inmutable en 85.
6. El owner revisa textos, datos y cuenta; después 86 sube el ZIP y selecciona
   **Unlisted** con publicación diferida.
7. Chrome revisa el item. La revisión aprobada no se publica automáticamente:
   el owner verifica versión, item ID y ficha y realiza el publish dentro de la
   ventana indicada por el dashboard.
8. Ejecutar 87 desde un perfil u ordenador limpio. Sólo tras ese gate se
   comparte el enlace con el piloto.
9. Ensayar y documentar 88. El Epic no se cierra únicamente porque Store haya
   aceptado el ZIP.

Crear el proyecto Google Cloud, aceptar términos/pagos del publisher, enviar a
review, publicar o retirar el item son checkpoints externos. El agente puede
prepararlos y operar el navegador con autorización del owner, pero debe guardar
la evidencia del resultado real y no afirmar éxito por adelantado.

## Contrato del paquete

- El origen es un commit limpio de `main` y un manifest MV3 de producción.
- `pnpm extension:release` es el único empaquetado aceptado; desarrollo y
  sourcemaps quedan fuera.
- El ZIP contiene sólo el árbol generado, sin `.env`, claves, cookies, tokens,
  fixtures privadas ni archivos fuente innecesarios.
- La versión aumenta antes de cada upload. Chrome no admite reemplazar una
  versión ya subida por otros bytes.
- La evidencia mínima une commit fuente, versión, ruta del ZIP, SHA-256, item
  ID, fecha, estado de review y digest del servidor compatible.
- Los permisos se justifican individualmente: `sidePanel` para la UI,
  `identity` para OAuth, `storage` para conexión/borrador y `clipboardRead`
  opcional para una acción explícita. El único host es el origen HTTPS de
  Issopen.
- La allowlist del paquete excluye los entrypoints históricos de captura/DOM,
  sourcemaps y archivos auxiliares; manifest y toolbar usan PNG exactos de 16,
  48 y 128 px. La matriz completa vive en
  [`extensions/chrome/store/RELEASE-CANDIDATE.md`](../extensions/chrome/store/RELEASE-CANDIDATE.md).

## Rollback y parada segura

Antes de activar Google OAuth se conserva el login owner existente. Si falla
Google, se deshabilita el proveedor y se vuelve al acceso anterior sin borrar
usuarios, memberships ni sesiones válidas que no estén comprometidas.

Servidor: volver al digest compatible previo mediante GitOps, sin aplicar
manifiestos manualmente y sin revertir migraciones aditivas. Verificar PostgreSQL,
PVC de adjuntos, readiness y el OAuth de extensión.

Extensión: Chrome no garantiza downgrade. Se hace **forward rollback**: subir
una versión superior que contenga el código anterior comprobado. Mientras se
revisa, se puede cancelar una review pendiente o dejar el item sin publicar. Si
hay riesgo de datos, revocar las instalaciones afectadas y detener el piloto.

Una credencial comprometida se revoca en su sistema propietario y se rota en
el Secret externo; nunca se parchea dentro de Git o del ZIP. La cuenta publisher
y Google Cloud deben mantener recuperación y 2FA bajo control del owner.

## Fuentes oficiales

- [Visibilidad y distribución](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Publicar en Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/)
- [Políticas del programa](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Datos de usuario, disclosure y permisos mínimos](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

Las políticas pueden cambiar. Los tickets 83–86 deben volver a revisar estas
fuentes el día de preparar y subir el candidato.
