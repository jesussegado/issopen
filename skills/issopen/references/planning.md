# Planificar por resultados funcionales

1. Confirma el resultado y Epic pedidos, el modo planificación y los permisos.
   Lee Epic, todas las páginas de tickets del Epic/proyecto y detalles relevantes.
   No crees trabajo mientras falten páginas: un ticket existente puede aparecer
   después. Preguntas/respuestas actuales prevalecen sobre resúmenes antiguos.
2. Compara intención, alcance y criterios, no sólo títulos. Clasifica cada resultado:
   ya cubierto (enlazar), parcialmente cubierto (ampliar el ticket existente sin
   borrar contenido humano) o nuevo (crear). Un ticket Done no se duplica por
   repetir el encargo; una necesidad realmente nueva puede ser otro resultado.
   Una duda sobre equivalencia se aclara antes de crear. Dos agentes planificando
   deben coordinar alcance/releer justo antes de crear; idempotencia no evita por
   sí sola dos operaciones independientes semánticamente iguales.
3. Un ticket debe producir algo observable y comprobable independientemente.
   No dividir por capas «hacer DB/backend/frontend» si ninguna entrega tiene un
   resultado verificable. Detalla dentro sus pasos técnicos y pruebas.
4. Usa el contrato de `scripts/plans.mjs`: objetivo, alcance/no alcance, decisiones
   guardadas con IDs/versiones de pregunta, diseño, pasos, aceptación, dependencias,
   verificaciones, prioridad razonada y siguiente paso. También se puede redactar
   manualmente respetando esas secciones. No basta un enlace a `.planning`.
5. Para editar, relee y usa guards de [seguridad](safety.md); conserva los párrafos
   humanos que no cambian y explica ampliaciones importantes en un comentario
   atribuido. Para crear, usa `create_issue` con projectId/Epic correctos y clave
   estable; el estado inicial es Backlog. Relee antes de repetir el mismo encargo.
6. Sólo crea preguntas que cambien el trabajo y aún no estén resueltas; sigue
   el contrato de preguntas del MCP. No rellenes respuestas por el usuario ni uses
   recomendaciones como decisiones. Si falta permiso para comentar/preguntar,
   informa de la limitación; no cambies de identidad silenciosamente.
7. Dependencias: enlaces UUID reales con etiqueta `número-título` y condición de
   desbloqueo. Son referencias en texto, no relaciones estructuradas del backend.
   Detecta ciclos y requisitos externos antes de proponer orden. Ready exige
   alcance completo, decisiones resueltas, dependencias verificadas con sus
   condiciones de desbloqueo satisfechas y autorización;
   no mover todo a Ready por haber redactado descripciones.
8. El Epic conserva mapa/orden/resumen y enlaces, no copias divergentes de todos
   los tickets. Descripción máxima de Epic 20.000 caracteres, ticket 50.000;
   divide por resultados si no cabe. Nunca truncar decisiones o criterios.

Entrega enlaces a lo reutilizado/creado, orden razonado y preguntas pendientes.
No iniciar código, claims de ejecución ni despliegues por una petición de plan.
