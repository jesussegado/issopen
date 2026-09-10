# Issopen para Chrome — piloto 0.5.2

Crea tickets con imágenes de tu herramienta de recorte favorita.
Ya no hace falta capturar la página ni concederle acceso a cada web.

## Uso

1. Abre Issopen desde su icono en Chrome.
2. En **Cuenta**, conecta con Issopen si aún no lo has hecho.
   OAuth se completa en la web; la extensión no pide tu contraseña.
3. Recorta o prepara la imagen con tu herramienta habitual y cópiala como imagen.
4. Haz clic en el panel y pulsa **Ctrl+V** (⌘V en Mac), o **Pegar imagen**.
   El botón puede pedir permiso de lectura del portapapeles; si lo rechazas,
   siguen disponibles Ctrl+V y **Subir imágenes**.
5. **Subir imágenes** permite seleccionar varios archivos. Repite para añadir
   más y usa **×** en cada miniatura para quitarla.
6. Elige proyecto/Epic, título y descripción; pulsa **Enviar ticket**.
   También puedes crear proyecto/Epic desde los botones del compositor.
   Verás el enlace al ticket; no se abre automáticamente.

Los selectores de proyecto, Epic, prioridad y estado abren sus opciones dentro
del panel, evitando que Chrome las muestre fuera de la ventana. Haz clic en una
opción o usa flechas y Enter/Espacio. Escape o Tab cierran sin cambiar el valor;
también puedes escribir las primeras letras. Los campos Buscar filtran los
destinos. Cambiar de proyecto limpia el Epic anterior; volver a elegir el mismo
proyecto lo conserva. Durante un envío pendiente siguen bloqueados.

Hasta **5 imágenes**, PNG/JPEG/WebP estáticos, **8 MiB en total** después de
convertir a PNG. Cada archivo de entrada también debe ocupar como máximo 8 MiB,
y cada imagen hasta 32 MP. No admite SVG, GIF ni animaciones. Copiar un enlace
o texto no descarga ninguna imagen; el texto se pega normalmente en los campos.

Las miniaturas y campos se conservan como un borrador local 24 h desde el último
cambio. No se lee tu página ni el portapapeles automáticamente. Las imágenes
se suben **sólo al enviar el ticket**. Revisa/oculta datos sensibles antes de
adjuntarlas: ya no hay editor de recorte/redacción dentro de Issopen.
Cuenta se abre como diálogo, sin perder lo escrito ni las imágenes.

El aviso informativo inicial se cierra con **×** y recuerda tu elección en este
perfil de Chrome, incluso al volver a abrir el panel. Su contenido permanece
siempre en **Cuenta → Ayuda e información**, aunque no hayas iniciado sesión.
Cerrar el aviso no borra el borrador, no desconecta ni oculta errores operativos.
No usa notificaciones del sistema ni permisos nuevos. Si Chrome no permite
guardar la preferencia, se cierra en esa vista y se indica que podría reaparecer.

Si falla la conexión después de enviar, reintenta manualmente: se conservan
el mismo payload/UUID incluso tras recargar o reconectar, evitando duplicados.

## Instalación y actualización

Desde la raíz de Issopen, Node 24 y pnpm 11.22.0:

```bash
pnpm install --frozen-lockfile
pnpm extension:build
```

Abre `chrome://extensions`, activa Modo de desarrollador, Cargar descomprimida
y selecciona `extensions/chrome/.output/chrome-mv3`. Fija el icono.
No se publica en Chrome Web Store ni se instala en tu perfil personal automáticamente.

Para actualizar: conserva la misma ruta absoluta unpacked y pulsa Recargar.
Cambiarla puede cambiar el ID y perder acceso al almacenamiento anterior.
No pulses Eliminar. Cierra primero el panel y resuelve envíos pendientes.
Las instalaciones 0.4 con escritura conservan su sesión; 0.2/0.3 necesitan
desconectar/reconectar para el consentimiento de escritura.

**Actualizar servidor primero:** `/session.maxImages:5` habilita varias imágenes.
Con backend antiguo, el compositor sólo permite enviar una. API v1 sigue
aceptando capturas anteriores y borradores pendientes sin alterar su hash.
[Contrato, privacidad, backup y rollback](../../docs/chrome-delivery.md).

Rollback: conservar ZIP anterior, reemplazar en la misma ruta y recargar sólo
tras resolver/exportar cualquier borrador. **0.4.3 no entiende borradores
multiimagen 0.5 y podría descartarlos**; no hacer downgrade con uno pendiente.
Conservar DB, recibos y ambos PVCs. El binario web antiguo puede no representar
metadata upload nueva; no borrar datos para revertir una UI.
Histórico de captura: [chrome-capture.md](../../docs/chrome-capture.md).

## Desarrollo y validación

```bash
pnpm extension:dev
pnpm extension:validate
# Git limpio, todos los gates de app/API/DB/extensión y paquete:
pnpm extension:release
```

Desarrollo usa `.output/chrome-mv3-dev`; no distribuirlo. Producción sin
sourcemaps. ZIP determinista, SHA-256 y JSON con commit/API en
`.output/releases`, ignorados en Git. Desde ese directorio:
`sha256sum -c <archivo>.sha256`. Extraer y validar primero en carpeta temporal,
después actualizar la misma ruta cargada, conservando artefacto anterior.

Los tests usan Chromium de Playwright y cuentas/imágenes sintéticas.
Incluyen pegado nativo, archivos múltiples, borrador, fallos sin pérdida,
panel estrecho, OAuth/API real y reintento tras commit con respuesta perdida.
El botón de portapapeles tiene pruebas UI con permisos simulados; no equivalen
a aceptación manual de todos los entornos. Si falta Chromium:
`pnpm exec playwright install chromium`. No se afirma soporte Edge/Brave.
El criterio personal del ticket 33 sigue requiriendo al owner.

## Permisos

| Permiso | Uso |
| --- | --- |
| sidePanel | Panel lateral |
| identity | Ventana/callback OAuth |
| storage | Sesión confiable, sin sync |
| host de Issopen | Sólo API de la instancia |
| clipboardRead (opcional) | Sólo al pulsar Pegar imagen |

No activeTab, scripting, all_urls, cookies, captura ni inspección de DOM.
No hay lecturas periódicas, uploads automáticos ni telemetría.
La CSP limita red a Issopen y decodificación a imágenes locales data/blob.
La marca aprobada se conserva sin generar nuevos assets.
