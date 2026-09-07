---
mode: quick
task: 260907-wrj
status: complete
completed: 2026-09-07
source_commit: d206bc68f43172e7ef71b5cbfb050b13a6b7ad3c
---

# Identidad bosque y menta aplicada a Issopen

La variante 07 aprobada se usa en las cabeceras pública y autenticada, favicon
y touch icon. La paleta de toda la web parte de bosque `#027067` y menta
`#6FD9B5`, con fondos y neutros derivados, estados interactivos y colores
semánticos explícitos para errores y advertencias.

## Decisión y alcance

- [Decisión de diseño 0001](../../../docs/design/0001-brand-identity.md):
  aprobación, geometría, colores, muestreo del PNG, usos y contraste.
- `Brand.tsx` centraliza símbolo y nombre. En la cabecera autenticada de hasta
  420 px se conserva el icono y el nombre accesible, dejando espacio al menú.
- `styles.css` centraliza los colores y cubre login, navegación, tablero,
  formularios, preguntas, comentarios, Epics, agentes y conexión OAuth/MCP.
- Se corrigieron referencias al color primario inexistente en progress,
  recomendaciones y comentarios agenticos, y se definió el radio de panel
  usado por el detalle de preguntas.
- `index.html` declara favicon, touch icon y color de navegador.
  `/favicon.ico` sirve el PNG aprobado con `image/png`.
- AGENTS, README, PROJECT y contrato UI previo apuntan a la decisión aprobada.
  Las exploraciones se conservan e identifican la variante promovida.

## Verificación

`pnpm validate` completado correctamente:

| Comprobación | Resultado |
| --- | --- |
| Biome | 75 archivos, sin errores ni advertencias |
| TypeScript | Correcto |
| Tests unitarios y web | 31 pruebas, 10 archivos |
| Tests de integración | 31 pruebas, 6 archivos, PostgreSQL efímera |
| Build Vite y servidor | Correcto |
| Playwright | 5 aprobadas; 1 omitida intencionalmente |
| Escaneo de secretos | Correcto, 107 archivos comprobados durante validate |

La prueba dogfood se ejecuta una vez en escritorio y omite por diseño su
duplicado móvil. Los recorridos de tracker y branding sí pasan en ambos.
Los tests verifican logo cargado, identidad binaria con el PNG seleccionado,
MIME de favicon, tokens resueltos, contraste de texto y controles, foco y
ausencia de desbordamiento. Los recorridos existentes cubren creación,
preguntas, movimientos por teclado, revisión, agentes y consentimiento local.

Revisión adicional en Chromium del build real, con propietario, workspace,
Epic, issues y comentarios sintéticos en una PostgreSQL aislada:

- 24 comprobaciones de layout: tablero, ticket, Epic, agentes, conexión y
  ajustes a 320, 360, 768 y 1440 px; ninguna página desborda horizontalmente.
- Se inspeccionaron las ocho capturas guardadas en `evidence/`.
- Navegación móvil activa comprobada con el fondo menta canónico.
- Servidor de revisión detenido y contenedor efímero eliminado al finalizar.

Validación del workspace:

- `make validate` de homelab: 190 tests aprobados; aplicaciones y landings
  validadas. Ansible y Helm no están instalados, por lo que sus comprobaciones
  opcionales se omitieron; no se modificaron recursos de estos sistemas.
- `workspace validate --checkouts`: 31 repositorios correctos.
- `git diff --check` y revisión del diff de fuente: correctos.

## Evidencia visual

| Pantalla | Captura |
| --- | --- |
| Acceso | [Escritorio](./evidence/sign-in-desktop.png) |
| Tablero | [Escritorio](./evidence/board-desktop.png), [móvil](./evidence/board-mobile.png) |
| Navegación | [Móvil abierta](./evidence/navigation-mobile.png) |
| Ticket y preguntas | [Escritorio](./evidence/issue-desktop.png) |
| Epic y progreso | [Escritorio](./evidence/epic-desktop.png) |
| Agentes | [Escritorio](./evidence/agents-desktop.png) |
| Conexión | [Escritorio](./evidence/connect-desktop.png) |

[Medidas de layout](./evidence/layout-checks.json). El borde de foco visible
en los títulos corresponde al foco inicial de navegación existente.

## Entrega y límites

- Fuente: `d206bc68f43172e7ef71b5cbfb050b13a6b7ad3c`.
- GitOps: sin cambios ni commit asociado. No se publicó ni desplegó.
- El icono sigue siendo el PNG aprobado de 1254 × 1254 (737125 bytes),
  compartido por cabeceras y favicon y escalado por el navegador.
- Esta revisión no añade un tema oscuro ni constituye una auditoría completa
  de accesibilidad del producto.
- Rollback de fuente: revertir `d206bc6` recupera la identidad anterior. Los
  conceptos originales y las capturas de esta tarea permanecen disponibles.
- Sin bloqueos pendientes para el alcance de implementación solicitado.
