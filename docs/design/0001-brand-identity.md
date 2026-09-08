# 0001 · Identidad Issopen: apertura de seis piezas, bosque y menta

- Estado: **aceptada por el propietario** el 2026-09-07.
- Alcance: favicon, icono y paleta de toda la aplicación web.
- Sustituye: wordmark sin símbolo y paleta azul del contrato UI inicial.

## Decisión

La marca de Issopen es la apertura circular de **seis piezas curvas**, tres
verde oscuro y tres menta alternadas, con un check verde oscuro separado en
el centro. El propietario eligió expresamente la variante 07 después de la
exploración de colores y del refinamiento de cinco a seis piezas.

La referencia aprobada es
[`issopen-aperture-07-seis-piezas-verde-bosque.png`](../../src/web/public/assets/branding/icon-concepts/aperture-variants/issopen-aperture-07-seis-piezas-verde-bosque.png).
El asset de producto es
[`issopen-icon-v1.png`](../../src/web/public/assets/branding/issopen-icon-v1.png):
una copia idéntica del PNG aprobado, 1254 × 1254, con alpha. Cabeceras, favicon
y touch icon usan el mismo archivo; el navegador lo representa al tamaño
necesario. No se redibuja ni se cambia el número de piezas al integrarlo.

El componente `Brand` muestra símbolo y texto «Issopen» en ambas cabeceras.
La imagen es decorativa dentro del enlace llamado «Issopen home». En la
cabecera autenticada de hasta 420 px se muestra sólo el símbolo para dejar
espacio al menú y al propietario, manteniendo el nombre accesible del enlace.

## Paleta canónica

Los dos colores base se fijan a partir de la mediana RGB de regiones interiores
opacas del PNG elegido: bosque `(490,150)–(630,290)` y menta
`(720,210)–(860,350)`, ignorando píxeles con alpha ≤245. El raster generado tiene
variaciones; estos dos valores normalizan la paleta de la interfaz.

La fuente ejecutable es `@theme` en `src/web/styles.css`. No se añaden colores
de marca inline ni una paleta diferente por pantalla.

| Token | Valor | Uso |
| --- | --- | --- |
| `brand-forest` / `accent` | `#027067` | Marca, CTA, enlaces, controles seleccionados y progreso |
| `brand-mint` | `#6FD9B5` | Marca, navegación activa y acentos sobre superficies claras |
| `accent-hover` / `focus` | `#01534C` | Hover y foco visible |
| `accent-active` | `#01443E` | Acción presionada y texto sobre menta |
| `accent-soft` | `#E3F7EE` | Selecciones suaves, recomendaciones y confirmaciones |
| `on-accent` / `surface` | `#FFFFFF` | Texto del CTA / tarjetas y formularios |
| `app` | `#F3FAF7` | Fondo general y tablero |
| `subtle` | `#EEF7F3` | Sidebar, badges y superficies secundarias |
| `text` | `#142F29` | Texto principal y selección de texto |
| `muted` | `#46635B` | Ayuda, metadatos y placeholders |
| `border` | `#C5D9D1` | Divisores y límites decorativos |
| `control-border` | `#6F8A80` | Bordes identificables de campos y controles |
| `disabled` | `#DCE9E3` | Controles deshabilitados |

La menta no se usa para texto pequeño sobre blanco ni con texto blanco encima.
El texto sobre menta usa `text` o `accent-active`. La paleta es clara; esta
decisión no incorpora tema oscuro ni selector de temas.

## Semántica e interacción

- Los cinco estados del tablero y las prioridades mantienen etiquetas y
  superficies neutras; no dependen del color para expresar significado.
- Errores y revocación conservan `destructive: #B91C1C` con fondo `#FEF2F2`.
- Advertencias y preguntas bloqueantes conservan `warning: #9A3412`, borde
  `#B45309` y fondo `#FFF7ED`. Los colores semánticos complementan la marca.
- Hover, active, focus, selección, disabled y controles nativos forman parte
  de la paleta. Checkboxes, radios y progress usan el acento del producto.
- Las referencias antiguas a `--color-primary`, que no estaba definido,
  pasan a `--color-accent` en progreso, recomendaciones y comentarios agenticos.
- Se mantienen layout, etiquetas, navegación por teclado, tamaños táctiles,
  formularios, permisos y flujos existentes.

## Contraste

Se usan los umbrales de [WCAG 2.2, contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
y [contraste de componentes](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html):
4.5:1 para texto normal y 3:1 para las señales visuales necesarias de controles.
Los divisores decorativos no se confunden con los bordes de inputs.

Ejemplos calculados con luminancia relativa sRGB:

| Combinación | Ratio |
| --- | --- |
| Blanco / bosque (CTA) | 5.97:1 |
| Bosque / acento suave (enlaces) | 5.35:1 |
| Texto / fondo de aplicación | 13.50:1 |
| Texto muted / fondo de aplicación | 6.20:1 |
| Texto muted / acento suave | 5.88:1 |
| Borde de control / blanco | 3.73:1 |

Estos pares se verifican desde los tokens y los estados visibles. La revisión
de color no sustituye una auditoría completa de accesibilidad del producto.

## Entrega y evolución

El favicon declarado es PNG. `/favicon.ico` sirve el mismo PNG con su MIME real
para clientes que consultan la ruta convencional. El nombre versionado del
asset permite actualizar la identidad sin reutilizar una URL antigua.

La exploración se conserva como historia de diseño. Sólo la variante 07 es
marca aprobada. Nuevas pantallas deben reutilizar estos tokens y el componente
`Brand`; una nueva geometría o paleta requiere otra decisión del propietario.

El cambio de identidad es de fuente. Una publicación productiva requiere la
release GitOps correspondiente; aceptar esta decisión no cambia datos ni
infraestructura por sí mismo.

La identidad se publicó en producción el 2026-09-08 tras la autorización
«despliega», mediante la fuente `2b0bb5a` y el commit GitOps `a1956385`.
La evidencia y rollback se registran en
[quick 260908-ja5](../../.planning/quick/260908-ja5-desplegar-la-identidad-bosque-y-menta-de/260908-ja5-SUMMARY.md).
