# 56 — Enlace destacado y acciones apiladas

Ticket `5ee9fd22-7ce8-437a-b85e-960e0bd4ed84`, Epic Chrome. El owner muestra
la confirmación del ticket 55 con enlace y botones amontonados.

## Cambio 0.5.4

Sólo CSS del compositor: enlace de éxito como tarjeta menta/bosque, borde,
flecha externa, hover/foco y 48px mínimos. Preparar otro ticket/Descartar
y Enviar/Reintentar/Descartar son bloques a ancho completo con margen 12px.
No afecta botones de imágenes, creación inline ni opciones de combobox.
No cambia markup, handlers, permisos, contratos, datos ni backend.

## Comprobaciones previas

- Lint/TypeScript extensión PASS. Dos tests de compositor PASS.
- Fixture explícito de éxito: geometría sin colisiones a 320/400px, ancho común,
  gap >=12px, altura >=44px, href/target/rel, navegación Tab y preparación nueva
  conservando proyecto sin repetir envío. Ninguna petición HTTP en el fixture.
- make validate homelab: 197 PASS. Ansible/Helm no instalados, checks omitidos.
- Chrome real leído sin mutaciones: el owner ya está en formulario nuevo,
  conectado, cero imágenes; no hay confirmación visible en ese instante.

## Entrega verificada

Fuente publicada `c76a591620c773c50dd7a590b2a9617106c225e6`.
`pnpm extension:release` desde Git limpio PASS: 78 unit/web + 46 integración +
8 E2E app + 76 unit extensión + 12 E2E extensión = **220 tests**, dos skips
móviles previstos. Lint/TypeScript/secret scan PASS. Ocho archivos reproducibles,
tree SHA `043a4d0f2ce0e6df6853bfda3aaeef8e95974fe46de290c6126c0ab3cdd0b4b4`.

ZIP ignorado `extensions/chrome/.output/releases/issopen-chrome-0.5.4-c76a591620c7.zip`.
SHA256 `b6de1897e7fb5201b29c7da9c05e45ece6cd04e55a1ace6bb62efe84d2699657`.
Checksum/unzip -t PASS y extracción temporal idéntica al build. Artefacto 0.5.3
retenido y comprobado. Ningún despliegue backend/GitOps.

Antes de actualizar se releyó Chrome: había de nuevo una confirmación y una
imagen en RAM. Se eligió la vía segura prevista: cargar el CSS exacto 0.5.4
desde el mismo origen de la extensión en el panel abierto, sin recargar ni
reemplazar estado. Se comparó en memoria el fingerprint de campos/confirmación/
imagen, idéntico; sin imprimir datos. Cuenta conectada, tres acciones con
ancho común y gap >=12px en la vista real. No se hizo click en Enviar/Descartar
ni se leyó el clipboard. Se verificó además la tarjeta en capturas sintéticas.

**Distinción de versiones:** diseño nuevo aplicado en vivo; Chrome aún
identifica el runtime como **0.5.3**. El paquete completo **0.5.4** está publicado
y disponible en la misma ruta unpacked para una recarga posterior segura.
No afirmar que se recargó el runtime ni hacerlo mientras esa vista siga siendo
útil al owner. La confirmación no se persiste ni se simula al reiniciar.

Ticket 56 reread: Ready for Review v6, claim null, cero preguntas, commit y
evidencias enlazados. Ticket 33, datos del owner y cambios ajenos intactos.
