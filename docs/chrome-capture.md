# Captura local — Chrome 0.3.0

Nota histórica del motor 0.3; los límites técnicos siguen aplicando. DOM, envío,
evidencias y borrador ya se integran en [0.4](chrome-delivery.md).

Entrega derivada del ticket 23 y parte de 25 del Epic Chrome. No sustituye el
tracker: ese corte aún no incluía DOM/elemento, API/adjuntos, composición/envío,
evidencias web ni borradores; se añadieron en 0.4.

## Uso y datos

Desde el icono de Issopen en la pestaña, elegir recorte, área visible o página
completa. Una instalación nueva comienza con recorte; se recuerda únicamente
el último modo que terminó correctamente. No hay captura automática.

El panel recibe un PNG y origen sin ruta/query/hash. El usuario puede ampliar
el preview, recortar, tapar zonas con negro opaco, deshacer/rehacer cinco pasos,
descartar o descargar. Las zonas se modifican en los píxeles del PNG final:
no se exportan capas ni máscaras recuperables. El historial y el original sí
existen temporalmente en RAM para deshacer; no se guardan en storage ni se suben.
La descarga queda en el sistema de archivos elegido por el usuario y hay que
protegerla como cualquier evidencia. Cerrar el panel pierde el trabajo.

«Mostrar origen» sólo alterna el resumen local, no es aún el contrato de
exclusión de metadatos del envío. No hay upload, DOM ni botón Enviar en 0.3.

## Motor y protección

- Worker con emisor de panel validado, mensaje estricto sin tabId/URL arbitrarios,
  acceso `activeTab`, documento fijo mediante `documentId`, top frame aislado.
- Antes de obtener píxeles se ocultan con opacidad cero los controles de
  formulario, contenteditable, iframes/embeds, hosts con Shadow DOM abierto y
  elementos personalizados. Estos últimos se omiten completos aunque no
  contengan campos. Shadow DOM cerrado en hosts nativos, texto normal,
  canvas e imágenes pueden contener datos sensibles: **revisión humana siempre**.
  Esto no es un detector universal de secretos.
- Páginas conocidas de acceso/consentimiento/callback se rechazan; también
  páginas internas, tiendas, esquemas no HTTP(S) e incógnito.
- Full-page desplaza y compone tramos; omite fixed/sticky completos para
  evitar repeticiones. Pausa animaciones CSS y transiciones, no scripts de la web.
- Un MutationObserver invalida la captura si el DOM cambia tras la preparación.
  Navegar, cambiar de pestaña, tamaño o DPR también aborta. Webs dinámicas que
  mutan constantemente pueden no capturarse: esperar a que se estabilicen.
- Restauración de propiedades/scroll en `finally`, también en error; watchdog
  en el documento a 25 s por si el worker se interrumpe. Selección con Escape,
  cancelación al redimensionar/salir y timeout de 30 s.
- Separación de llamadas de captura de 550 ms, compartida entre intentos.
  Escala calculada desde dimensiones reales del bitmap, no sólo DPR.
- CSP permite red sólo al origen Issopen y `data:` para decodificar imágenes;
  no nuevos permisos globales ni almacenamiento remoto por esta entrega.

## Límites iniciales explícitos

Full-page: 16.000 px CSS, 20 tramos, sin scroll horizontal. Todas las imágenes:
ancho máximo 8.192 px, alto 32.000 px, 32 megapíxeles y PNG de 8 MiB. Documentos
de más de 20.000 elementos se rechazan. PNG lossless preserva texto; si excede
el límite, elegir un área menor. No prometer páginas infinitas, vídeo congelado
ni compatibilidad universal. El contrato de backend de 22 debe respetar o
reconciliar estos límites antes de habilitar envío.

## Verificación

`pnpm extension:validate` incluye geometría a escalas 0.8, 1, 1.25, 1.5, 2 y 3;
dos casos de captura en Chromium real con acción de toolbar: tres modos,
coincidencia de recorte a DPR 1 y DPR 2 con zoom 125 %, máscaras previas,
restauración de scroll/estilos, PNG final, ocultación opaca, deshacer/rehacer,
recorte posterior, zoom de preview, Escape, límites y DOM cambiante. Se comprueba
que la captura/edición no genera peticiones HTTP externas ni escrituras de red.
OAuth tiene su propia suite de integración y Chrome E2E.

Verificación adicional en Google Chrome 152 de escritorio: viewport, full-page,
recorte, restauración y ocultación pasan. El editor bloquea cambios mientras
decodifica el preview. Las pruebas esperan la animación nativa del panel y su
redimensionado antes de elegir coordenadas; los dos E2E de captura pasan tres
veces consecutivas. Se admite un píxel físico de redondeo con zoom fraccionario.

No declarar cerrados los criterios de 25 sobre **imagen enviada/almacenada**
hasta conectar y comprobar 22/24/26/28. No desplegar Kubernetes por este cambio
exclusivo del bundle Chrome; recargar la extensión unpacked y reabrir el panel.

Referencia: [Chrome captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab).
