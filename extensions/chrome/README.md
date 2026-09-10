# Issopen para Chrome — piloto 0.4.3

Flujo del [Epic de Chrome](https://issopen.serviciosegado.com/epics/ca26c29b-43ac-4ca0-b768-594d6779d6e7):
OAuth humano, capturas y DOM saneado, revisión, creación de proyecto/Epic/ticket,
adjuntos privados y borrador recuperable con reintento sin duplicados.
[Contrato, límites y operación](../../docs/chrome-delivery.md).

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
6. Pulsa el botón de usuario **Cuenta**, arriba a la derecha, y después
   **Conectar con Issopen**. Inicia sesión en la ventana web, nombra la
   instalación y acepta el consentimiento. El diálogo muestra tu cuenta/proyectos.
   Ciérralo con **×** o **Escape** para volver a capturar. Desde el mismo botón
   puedes consultar la caducidad y desconectar; también puedes revocar desde
   «Extensiones Chrome» en Issopen. Abrir/cerrar Cuenta no pierde la captura ni
   el borrador, no desconecta y no repite el consentimiento. El botón muestra
   el estado de acceso incluso con el diálogo cerrado.
   [Detalles y pruebas de OAuth](../../docs/chrome-oauth.md).
7. En **Captura y previsualización**, elige recorte (predeterminado), área
   visible, página completa o elemento y pulsa **Capturar página**. Para recortar,
   arrastra sobre la página; Escape cancela. Se recuerda el último modo usado.
8. Revisa la imagen, amplíala, recórtala o tapa zonas con la herramienta negra.
   Arrastra sobre el preview o usa X/Y/Ancho/Alto y **Aplicar** con el teclado.
   Puedes deshacer/rehacer cinco cambios y descargar el PNG final revisado.
   En elemento: hover, ↑ ancestro, ↓ volver, Enter y Escape.
9. Elige qué incluir y pulsa **Confirmar captura revisada**: sólo el PNG final
   se conserva en un borrador local durante 24 h; originales/historial no.
   Una captura sin confirmar se pierde al cerrar. Puedes excluir imagen, DOM,
   descriptor, metadatos o toda la evidencia. El borrador restaurado es editable.
10. Elige proyecto/Epic o usa los botones **Crear proyecto** y **Crear Epic**
   al principio de **Crear ticket**. Cada botón abre/cierra su formulario; el
   color verde indica cuál está abierto y alternarlos conserva lo escrito.
   Completa el título del ticket y pulsa **Enviar ticket**.
   Se muestra número y enlace, sin navegación automática. Si se pierde la red,
   reintenta manualmente; conserva payload/UUID incluso al recargar o reconectar.
   [Privacidad, límites y pruebas](../../docs/chrome-capture.md).

Si abres el panel desde el selector de paneles de Chrome, puede no haber permiso
para la página. Pulsa el icono de Issopen en esa pestaña y reintenta. Si navegas
a otro origen o cambias de pestaña, vuelve a concederlo desde el icono. Las
páginas internas, tiendas, archivos locales e incógnito no están soportados.

### Entender un fallo de captura

Desde 0.4.2 el aviso muestra una causa identificada y pasos concretos:

- **No podemos acceder a esta pestaña**: vuelve a la web y pulsa el icono de
  Issopen en la barra de Chrome antes de capturar. El login de Issopen y el
  permiso para leer la pestaña son cosas distintas.
- **La página cambió mientras capturábamos**: espera a que termine de actualizarse;
  si ofrece una opción para pausar actualizaciones, úsala. Recortar no evita la
  protección que impide capturar contenido nuevo aún no ocultado.
- **Ha cambiado el tamaño de la página**: ajusta ventana/panel/zoom antes de
  iniciar; repite sin redimensionar durante la captura.
- **No se pudo completar la captura**: causa desconocida, sin inventar un fallo
  de permisos o de red. Indica el modo y los pasos para reproducirlo.

Los fallos de captura no envían una imagen al servidor y conservan la
previsualización anterior. Cerrar el panel sigue perdiendo una captura aún no
confirmada: revisa ese aviso antes de recargar. Las excepciones crudas de Chrome
no se muestran ni registran; sólo códigos permitidos y textos estáticos.
Referencia: [permiso temporal activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).

Para actualizar: vuelve a construir, pulsa **Recargar** en `chrome://extensions`
y cierra/reabre el panel. Desactivar/eliminar la extensión revierte esta entrega;
revoca primero la instalación si quieres retirar también su acceso al servidor.
La API 0.4 usa migración aditiva 0013 y volumen privado; el binario viejo puede
revertirse conservando esquema y ambos PVCs. Las conexiones 0.2/0.3 requieren
**desconectar y reconectar** para autorizar escritura. No se instala en tu perfil personal
automáticamente y no hay publicación en Chrome Web Store.

## Desarrollo y validación

```bash
pnpm extension:dev
# Cargar .output/chrome-mv3-dev manualmente y conservar este proceso abierto.
# Ctrl+C lo detiene. No usar este artefacto para distribución.

pnpm extension:validate
```

La validación incluye lint, TypeScript estricto, tests unitarios de contratos
y worker, tests E2E de artefacto/Chromium y recorrido completo OAuth/API, dos builds comparados byte a byte y
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
`.wxt` están ignorados en Git. Con Git limpio, `pnpm extension:release` ejecuta
todos los gates y genera `.output/releases/issopen-chrome-<version>-<commit>.zip`,
SHA-256 y JSON de procedencia. Verifica `sha256sum -c <archivo>.sha256`, extrae en
carpeta nueva y carga descomprimida en la instalación inicial. Para actualizar
una instalación existente, valida y extrae primero en una carpeta de preparación;
cierra su panel/Chrome, conserva la carpeta cargada anterior en otra ubicación y
pon el nuevo artefacto en **la misma ruta absoluta cargada originalmente**.
Abre Chrome y pulsa Recargar. Cambiar esa ruta puede cambiar el ID unpacked y
perder acceso al almacenamiento de la instalación anterior. No pulses Eliminar.
Para rollback, repite conservando la versión nueva y restaurando el artefacto
anterior en esa misma ruta. 0.3 no puede enviar tickets ni interpretar el borrador
0.4, pero al volver a 0.4 se conserva el almacenamiento si no se desinstala.
Verificado en Chrome 152: 0.4 → 0.3 → 0.4 con mismo ID, panel operativo y marcador
local conservado; la suite prueba por separado la recuperación del borrador.
El criterio 33 de validación personal sigue requiriendo al owner.

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
sincronización. Sólo el PNG confirmado y campos escritos por el usuario entran
en un borrador IndexedDB acotado de 24 h; el historial permanece en RAM. Se
recuerdan modo, proyecto y Epic. No hay envío automático. El símbolo
se copia byte a byte del PNG blanco aprobado de la app, sin generar otra marca.
