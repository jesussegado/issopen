# 53 — Selectores dentro del panel Chrome

## Causa reproducida

Datos cargados, ningún control deshabilitado, sesión conectada. En Chrome
152 Linux 0.5.1, click Proyecto abre un popup nativo X11 en X=2592, ancho 271,
mientras Chrome ocupa X=0..2560. AX expanded=true y CSS `:open` confirman
que el click llega: el menú está fuera de la ventana, no falta la respuesta API.

## Cambio 0.5.2

SelectField compartido: lista HTML en flujo dentro del panel, alto acotado,
etiquetas largas ajustadas, roles combobox/listbox/option, selección por clic
o Enter/Espacio. Flechas/Home/End/letras navegan; Escape/Tab/fuera cancelan.
Foco vuelve al campo. Sin nuevas dependencias, permisos, API ni schema de draft.
Respeta bloqueos de envío incierto. Reseleccionar proyecto conserva Epic;
cambiar proyecto limpia su Epic. Lecturas tardías se ignoran al cambiar destino.
Un Epic guardado pendiente de cargar no se muestra falsamente como «Sin Epic».

## Validación anterior a empaquetado

- Typecheck raíz/extensión y lint PASS.
- Tres E2E de selectores PASS: clic, filtros, teclado, nombres largos,
  320/400 px, persistencia, lecturas tardías y error/reintento manual.
- OAuth nativo/API/DB real PASS: creación inline, clic sobre proyectos/Epics,
  dos imágenes privadas, respuesta perdida/reintento y bloqueos en recarga.
  Fixture aislado, sin imágenes personales ni escrituras productivas de prueba.
- La primera ejecución del test OAuth detectó un locator antiguo ambiguo
  (getByLabel también encontraba el listbox oculto); actualizado a combobox
  por rol, sin eliminar assertions. Rerun PASS.

## Entrega

Fuente `fb11c419281cf8a3dc7834b205b3dfc793f00a43` publicada en origin/main.
`pnpm extension:release` desde Git limpio PASS: 78 unit/web + 46 integración +
8 E2E app + 76 unit extensión + 10 E2E extensión = **218 tests**, dos skips
móviles previstos. Lint/TS/secret scan PASS. Build reproducible, ocho archivos:
tree SHA `1508f6f08fd19c2030866931a6f81c37eb7f82f8770c487771e1f63afbe1edd5`.

ZIP ignorado `extensions/chrome/.output/releases/issopen-chrome-0.5.2-fb11c419281c.zip`:
SHA256 `a78205ba59953048dfdef7f338af3af338e45b863ad06919e01358a19b97414f`.
Checksum y unzip -t PASS; extracción temporal idéntica al build.
Artefacto previo 0.5.1 retenido y checksum verificado. Sin downgrade de datos.

`make validate` homelab: 197 PASS; Ansible y Helm no instalados, se omitieron
sus checks. No hay cambios nuestros de GitOps/control plane ni redeploy backend.

Chrome gestionado 152 recargado a **0.5.2**, mismo perfil/ruta/ID. Antes:
formulario/imagen confirmados en IndexedDB, sin envío pendiente ni campos
transitorios. Después: conectado, fingerprint de cuenta/form/evidencia/pending
idéntico (comparación en memoria, sin imprimir datos). Conserva una imagen real.
Los cuatro selectores abiertos y opción actual clicada: Proyecto 3, Epic 5,
Prioridad 4 y Estado 5 opciones, listas dentro del viewport y cero select nativos.
No lectura de clipboard ni envío de imagen/ticket del owner.

Ticket 53 reread vía MCP: Ready for Review v6, claim null, cero preguntas,
commit/evidencia enlazados. Ticket personal 33 y cambios ajenos intactos.
