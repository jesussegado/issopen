# Compositor Chrome 0.4.1

Accesos Crear proyecto / Crear Epic juntos al principio de Crear ticket, antes
del aviso y los campos. Botones con iconos +/−, foco visible, estado expandido y
paneles semánticos. Conserva nombres, guards, destino y contratos existentes.
Actualizar Epics mantiene separación de bloque respecto al título del ticket.

Primeras verificaciones: lint de ficheros propios, TypeScript, build, 46 unitarias
y E2E OAuth/API real completo pasan. Nuevo E2E de compositor pasa a 320/400 px,
incluyendo posición, teclado, ocultación, conservación y permisos. Inspección
visual del screenshot a 320 px realizada. El E2E compartido encontró dos fallos
en cambios paralelos ajenos de errores de captura; no se modifican ni incluyen
en este commit. Verificar este parche de forma aislada antes de cargarlo.

Sólo artefacto de extensión; no reiniciar/desplegar web, Kubernetes o base de
datos. La aceptación humana 33 sigue pendiente. Verificación final a continuación.
