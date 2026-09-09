# Issopen para Chrome — base 0.1.0

Primer corte del [Epic de Chrome](https://issopen.serviciosegado.com/epics/ca26c29b-43ac-4ca0-b768-594d6779d6e7):
tickets 19 y 20. Es una base instalable, **todavía no captura imágenes, conecta
la cuenta ni crea tickets**. Comprueba la comunicación panel → worker → pestaña.
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

Si abres el panel desde el selector de paneles de Chrome, puede no haber permiso
para la página. Pulsa el icono de Issopen en esa pestaña y reintenta. Si navegas
a otro origen o cambias de pestaña, vuelve a concederlo desde el icono. Las
páginas internas, tiendas, archivos locales e incógnito no están soportados.

Para actualizar: vuelve a construir, pulsa **Recargar** en `chrome://extensions`
y cierra/reabre el panel. Desactivar/eliminar la extensión revierte esta entrega;
no hay datos en el servidor ni migraciones. No se instala en tu perfil personal
automáticamente y no hay publicación en Chrome Web Store.

## Desarrollo y validación

```bash
pnpm extension:dev
# Cargar .output/chrome-mv3-dev manualmente y conservar este proceso abierto.
# Ctrl+C lo detiene. No usar este artefacto para distribución.

pnpm extension:validate
```

La validación incluye lint, TypeScript estricto, 27 tests unitarios de contratos
y worker, 2 tests E2E de artefacto/Chromium, dos builds comparados byte a byte y
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

No `host_permissions`, `<all_urls>`, scripts globales, cookies, storage,
identity ni permisos pedidos para funciones futuras. La CSP productiva bloquea
conexiones de red (`connect-src 'none'`) y código remoto/inline. El modo dev de
WXT sí incorpora permisos/hot reload local: no distribuirlo.

La apertura se maneja explícitamente en `action.onClicked` y luego
`sidePanel.open`; `openPanelOnActionClick: true` no concedía activeTab en la
prueba real. Se mantiene `false` y se verifica que el icono sí da acceso sin
ampliar permisos. Los mensajes sólo se aceptan del panel de esta extensión,
sin destinos arbitrarios, con schemas de entrada/salida y descarte si cambia
la pestaña. Errores de Chrome no se reenvían porque pueden contener URLs.

Los datos sólo viven en memoria del panel; no hay telemetry, sincronización,
peticiones API, autenticación, borradores ni capturas en este corte. El símbolo
se copia byte a byte del PNG blanco aprobado de la app, sin generar otra marca.
