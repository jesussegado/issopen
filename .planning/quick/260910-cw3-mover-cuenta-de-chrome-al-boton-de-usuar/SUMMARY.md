# Cuenta de Chrome desde la cabecera

Ticket 50 (`01919640-7f8c-4a7b-a36b-fd2b3235febe`), Epic Chrome 1.

## Implementación

- Botón de usuario «Cuenta» arriba a la derecha, con estado textual de acceso.
- Diálogo nativo cerrado por defecto: conserva los datos, proyectos, acciones
  de conexión/desconexión y enlace de gestión. Botón ×, Escape, foco inicial en
  cierre, fondo inerte y retorno del foco. Anchura acotada y scroll vertical.
- La cuenta se consulta al montar; abrir/cerrar el diálogo no repite esa
  consulta. `main.tsx` comparte su resultado con `Workspace` sin desmontar el
  compositor ni el editor. Sin cambios de permisos, API, storage o backend.
- Versión del artefacto 0.4.3. Guía de instalación y AGENTS actualizados.

## Evidencia previa a empaquetar

- Test UI con cuenta desconectada simulada: 320/400 px, teclado, fondo inerte,
  Escape/×, retorno del foco, una sola consulta y borradores conservados: PASS.
  Capturas visuales inspeccionadas; sin overflow horizontal.
- Test OAuth real con Hono/PostgreSQL efímeros: conectar desde Cuenta, crear
  proyecto/Epic, captura de elemento, abrir/cerrar conservando píxeles sin
  revisar, ocultar/revisar, conservar formulario/destinos/PNG, recuperar envío
  incierto tras recarga y desconectar desde Cuenta: PASS.
- Los otros ocho E2E de extensión pasan. La prueba de UI aísla únicamente el
  estado de cuenta porque una pestaña de preview no es un side panel confiable;
  las pruebas foundation/OAuth conservan el gesto real y la frontera del worker.
- Homelab `make validate`: 197 PASS; catálogo/checkouts PASS (31 repos).
  Ansible y Helm ausentes: sus comprobaciones se omiten. Ningún cambio GitOps.

Pendiente de registrar: gate completo del ZIP, SHA/checksum y disponibilidad en
Chrome. La validación personal del Epic sigue en 33; no se cierra ni se responde.

## Rollback

Restaurar el artefacto validado 0.4.2 en la misma ruta unpacked, conservando el
nuevo en otra carpeta. No eliminar la extensión ni su almacenamiento. El
servidor no cambia y no requiere despliegue ni rollback.
