# Issopen para Chrome — desarrollo 0.3.0

Primer corte del [Epic de Chrome](https://issopen.serviciosegado.com/epics/ca26c29b-43ac-4ca0-b768-594d6779d6e7):
tickets 19–21, 23 y parte de 25. Conecta la cuenta humana mediante OAuth PKCE,
muestra proyectos y permite capturar/editar imágenes localmente.
**Todavía no crea tickets ni captura DOM.**
El [alcance completo](../../docs/chrome-extension.md) explica los siguientes cortes.

## Instalar y probar

Desde la raíz del repositorio de Issopen, con Node 24 y pnpm 11.22.0:

```bash
pnpm install --frozen-lockfile
pnpm extension:build
```

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y elige
   `extensions/chrome/.output/chrome-mv3` dentro del repositorio.
3. Fija **Issopen** en la barra de extensiones y abre una página HTTP/HTTPS.
4. Pulsa su icono (o `Alt+Shift+I`, si el atajo está disponible) para abrir el
   panel y conceder acceso temporal a esa pestaña.
5. Pulsa **Comprobar página**: verás origen, viewport y densidad de píxeles.
   No recoge rutas, query, fragmentos, título, DOM, formularios ni imágenes.
   **Borrar comprobación** limpia el resultado; cerrar el panel también lo pierde.
6. Pulsa **Conectar con Issopen**, inicia sesión en la ventana web, nombra la
   instalación y acepta el consentimiento. El panel muestra tu cuenta/proyectos.
   Desconecta desde el panel o revoca desde «Extensiones Chrome» en Issopen.
   [Detalles y pruebas de OAuth](../../docs/chrome-oauth.md).
7. En **Captura y previsualización**, elige recorte (predeterminado), área
   visible o página completa y pulsa **Capturar página**. Para recortar,
   arrastra sobre la página; Escape cancela. Se recuerda el último modo usado.
8. Revisa la imagen, amplíala, recórtala o tapa zonas con la herramienta negra.
   Arrastra sobre el preview o usa X/Y/Ancho/Alto y **Aplicar** con el teclado.
   Puedes deshacer/rehacer cinco cambios y descargar el PNG final revisado.
   Cerrar el panel pierde la captura; todavía no hay borrador persistente.
   [Privacidad, límites y pruebas](../../docs/chrome-capture.md).

Si abres el panel desde el selector de paneles de Chrome, puede no haber permiso
para la página. Pulsa el icono de Issopen en esa pestaña y reintenta. Si navegas
a otro origen o cambias de pestaña, vuelve a concederlo desde el icono. Las
páginas internas, tiendas, archivos locales e incógnito no están soportados.

Para actualizar: vuelve a construir, pulsa **Recargar** en `chrome://extensions`
y cierra/reabre el panel. Desactivar/eliminar la extensión revierte esta entrega;
revoca primero la instalación si quieres retirar también su acceso al servidor.
No hay migraciones de esquema. No se instala en tu perfil personal
automáticamente y no hay publicación en Chrome Web Store.

## Desarrollo y validación

```bash
pnpm extension:dev
# Cargar .output/chrome-mv3-dev manualmente y conservar este proceso abierto.
# Ctrl+C lo detiene. No usar este artefacto para distribución.

pnpm extension:validate
```

La validación incluye lint, TypeScript estricto, tests unitarios de contratos
y worker, 4 tests E2E de artefacto/Chromium, dos builds comparados byte a byte y
escaneo de secretos. `pnpm validate` integra estas comprobaciones con las de la
app. Si falta Chromium en una máquina nueva:

```bash
pnpm exec playwright install chromium
```

Los E2E usan el Chromium empaquetado con Playwright 1.62.1 (comprobado en
151.0.7922.34), perfil efímero y servidor de fixture en loopback. Nunca usan
cuentas ni pestañas del navegador personal. La acción se dispara mediante
`Extensions.triggerAction` de CDP sobre el target **tab**; no se falsifican
permisos ni se ejecuta el handler para simular su concesión.
Chrome mínimo declarado: 116 por `sidePanel.open`; no se afirma todavía
validación de todas las versiones intermedias ni Edge/Brave.

Artefacto productivo en `.output/chrome-mv3`, con versión del package de la
extensión. Sourcemaps sólo en desarrollo (`chrome-mv3-dev`); ambos outputs y
`.wxt` están ignorados en Git. El ZIP de distribución, checksum publicado,
política de actualización y aceptación completa pertenecen a 32–33.

## Permisos y aislamiento

| Permiso | Necesidad actual |
| --- | --- |
| `activeTab` | Acceso temporal a la pestaña elegida mediante acción explícita |
| `scripting` | Inyectar un archivo local en el frame principal/mundo aislado |
| `sidePanel` | Mostrar el panel de Issopen |
| `identity` | Ventana OAuth y callback Chromium |
| `storage` | Credenciales limitadas a contextos confiables, sin sync |
| host de Issopen | Llamar sólo a la instancia autorizada |

No `<all_urls>`, scripts globales, cookies ni permisos pedidos para funciones
futuras. La CSP productiva permite conexiones de red sólo a Issopen y decodificar
imágenes locales `data:`; bloquea código
remoto/inline. El modo dev de
WXT sí incorpora permisos/hot reload local: no distribuirlo.

La apertura se maneja explícitamente en `action.onClicked` y luego
`sidePanel.open`; `openPanelOnActionClick: true` no concedía activeTab en la
prueba real. Se mantiene `false` y se verifica que el icono sí da acceso sin
ampliar permisos. Los mensajes sólo se aceptan del panel de esta extensión,
sin destinos arbitrarios, con schemas de entrada/salida y descarte si cambia
la pestaña. Errores de Chrome no se reenvían porque pueden contener URLs.

La comprobación de página sólo vive en memoria; las credenciales OAuth viven
en storage local confiable del worker, no en el panel. No hay telemetría,
sincronización ni borradores persistentes. Capturas e historial permanecen en
memoria del panel; sólo se recuerda el modo elegido, sin contenido. El símbolo
se copia byte a byte del PNG blanco aprobado de la app, sin generar otra marca.
