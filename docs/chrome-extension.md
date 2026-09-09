# Extensión Chrome — alcance y secuencia de entrega

Canon: [Epic 1](https://issopen.serviciosegado.com/epics/ca26c29b-43ac-4ca0-b768-594d6779d6e7),
tickets 19–33. Decisiones aprobadas por el propietario el 2026-09-09, conservando
su respuesta anterior de crear proyectos y Epics desde la extensión.
Este documento deriva del tracker, no lo sustituye.

## Flujo aprobado

1. Pulsar el icono de Issopen en una pestaña web: abre el panel lateral y concede
   acceso temporal `activeTab`. No inspeccionar páginas en segundo plano.
2. Vincular una instalación a la cuenta humana mediante OAuth authorization
   code + PKCE S256 y consentimiento web. No PAT de agente ni contraseña en la
   extensión. Access token corto y renovación con caducidad a 30 días;
   revocación individual por instalación y desconexión explícita.
3. Elegir viewport, página completa, recorte o elemento. Empezar por recorte y
   recordar el último modo. Full-page es por scroll/stitch con límites y
   restauración de posición, sin prometer páginas infinitas ni iframes ajenos.
4. Revisar imagen y contexto antes del envío. Recortar y ocultar zonas con
   píxeles irreversibles; el original no llega al servidor. DOM limitado al
   elemento y ancestros, saneado y opcional; nunca scripts, handlers, tokens,
   cookies, storage ni valores de formularios. Se pueden omitir los metadatos.
5. Elegir proyecto obligatorio y Epic opcional, o crearlos desde el panel.
   Recordar ambos, mostrándolos antes de enviar; cambiar de proyecto limpia un
   Epic incompatible. Título obligatorio, descripción, prioridad y estado;
   valores iniciales Medium / Backlog. Validaciones no descartan la captura.
6. Enviar sólo por acción explícita. Crear ticket + evidencias con idempotencia
   y autorización humana, sin reutilizar scopes/identidades de agentes.
7. Confirmar proyecto, número y enlace; botones para abrir o hacer otra captura,
   sin navegar automáticamente. El front muestra `number-name`; la clave de
   proyecto sigue siendo metadato interno.

## Interrupciones y privacidad

- Escape cancela una selección y restaura la página; descartar elimina el
  borrador local y pide confirmación si se pierde trabajo.
- Panel cerrado/reabierto: borrador saneado autoguardado hasta 24 horas. No
  persistir una imagen original sensible junto a su versión redaccionada.
- Fallo de red: conservar borrador y ofrecer reintento manual con la misma
  clave idempotente. No cola que envíe automáticamente sin revisión.
- Sesión caducada: reautenticar sin perder el borrador; revocación invalida
  acceso y renovación. Ningún token en URL de página, captura, DOM o logs.
- Páginas internas, tiendas de extensiones, otros esquemas o permisos
  insuficientes: error explícito sin ampliar permisos globalmente.
- Incógnito deshabilitado; no capturar pestañas privadas.
- Imágenes/adjuntos privados tras la API y permisos de proyecto; almacenamiento
  inicial mediante adaptador de PVC de Issopen, retenidos mientras exista el
  ticket. Borrado y huérfanos requieren política comprobada y backup/restore.
- Límites concretos de dimensiones/bytes/tiempo/DOM se fijan con pruebas en
  sus tickets; rechazarlos de forma explícita, nunca truncar silenciosamente.

## Cortes de implementación

| Ticket | Entrega | Depende de |
| --- | --- | --- |
| 19 / EXT-01 | Alcance, decisiones y flujo verificable | — |
| 20 / EXT-02 | WXT MV3 instalable, panel y mensajería tipada | 19 |
| 21 / EXT-03 | OAuth PKCE y vinculación humana revocable | 19, 20 |
| 22 / EXT-04 | API de captura/adjuntos e idempotencia | 19, 21 |
| 23 / EXT-05 | Viewport, página completa y recorte | 20 |
| 24 / EXT-06 | Selección de elemento y DOM saneado | 20 |
| 25 / EXT-07 | Previsualización y ocultación irreversible | 23, 24 |
| 26 / EXT-08 | Composición, alta de proyecto/Epic y envío | 21, 22, 25 |
| 27 / EXT-09 | Evidencia privada visible en la web | 22 |
| 28 / EXT-10 | Almacenamiento, retención y recuperación | 22 |
| 29 / EXT-11 | Seguridad y mínimos permisos | 21, 23–25, 28 |
| 30 / EXT-12 | Borradores de 24 h y reintento manual | 21, 22, 26 |
| 31 / EXT-13 | Regresión, contratos y Chromium E2E | 20–30 |
| 32 / EXT-14 | Artefacto versionado y guía unpacked | 29, 31 |
| 33 / EXT-15 | Dogfooding completo contra producción | 19–32 |

La primera entrega sólo incluye 19–20. No se declara el Epic completo por tener
un scaffold instalable. La distribución comienza unpacked; Chrome Web Store,
Firefox/Safari, anotaciones con flechas/texto y envío automático quedan fuera
de este MVP. Edge/Brave requieren pruebas propias antes de declarar soporte.

## Cambios respecto al roadmap histórico

La instrucción actual prioriza este Epic sin cerrar ficticiamente fases previas.
Las decisiones del Epic añaden full-page (antes diferida en CAP2-01) y posponen
anotaciones (CAPT-07); PVC es el adaptador inicial, no despliegue inmediato de
S3/SeaweedFS. Se conserva el roadmap general como historial y no se marcan sus
requisitos globales como completos por esta entrega parcial.

## Arquitectura del primer corte

Workspace `extensions/chrome`, sin repositorio Git adicional, WXT 0.21.4,
module-react 1.2.2 y React/TypeScript alineados con la app. Panel lateral React,
service worker MV3 y script inyectado en mundo aislado, sólo en el frame
principal tras acción explícita. Mensajes internos versionados, con schemas de
entrada/salida y validación del emisor; nada de `window.postMessage` confiable
por defecto. No dependencias del servidor dentro del bundle del navegador.

La base únicamente comprueba origen (sin ruta/query/hash), viewport y DPR;
no captura imagen ni DOM, no inicia red ni guarda datos. Los siguientes cortes
añaden capacidades conforme a sus pruebas, no permisos preventivos.

Fuentes técnicas: [WXT manifest](https://wxt.dev/guide/essentials/config/manifest.html),
[scripts bajo demanda](https://wxt.dev/guide/essentials/scripting),
[Chrome sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel),
[activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab),
[pruebas de extensiones](https://playwright.dev/docs/chrome-extensions).
