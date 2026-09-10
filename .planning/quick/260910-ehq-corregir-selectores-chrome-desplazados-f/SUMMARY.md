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

Pendiente: gate completo de release desde Git limpio, ZIP/SHA/procedencia,
publicación privada y recarga del mismo ID/ruta sólo con borrador confirmado.
La instalación actual conserva una imagen real; no leer clipboard ni enviarla.
No requiere Kubernetes. Ticket personal 33 y cambios ajenos de homelab intactos.
