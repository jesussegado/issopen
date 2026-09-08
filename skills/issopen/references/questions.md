# Preguntas y continuidad solicitada

Lee `get_issue` antes de preguntar y al recibir «ya he respondido» o «continúa».
Comprueba IDs/versiones y respuestas actuales con `scripts/questions.mjs` y el
stamp de contexto. Una respuesta válida tiene answeredAt y una opción existente
o texto Other no vacío. recommendedOptionId/preselección nunca equivalen a respuesta.
No ignores un Other ni lo sustituyas por la recomendación original.

Antes de `ask_question`, busca una pregunta equivalente y las decisiones ya
guardadas. Pregunta sólo lo que cambie alcance/resultado o requiera autorización.
Expón contexto, una recomendación razonada y opciones excluyentes con consecuencias;
normalmente 2–3 opciones, máximo 6. La web ya añade Other: no lo dupliques dentro
de options. Marca blocking sólo si impide ese resultado. Usa la misma clave/payload
al reintentar, sin crear copias al repetir una petición de continuar.

La web guarda la única respuesta actual y actividad conserva historial. El MCP
`list_activity` es un resumen paginado, no todas las respuestas históricas.
Nunca uses owner/SQL para responder en nombre del usuario. Una recomendación
autónoma del agente se guarda como recomendación, no como decisión aceptada.

Tras cambios, compara el conjunto de preguntas, versiones, answeredAt y respuesta;
identifica pasos/criterios/dependencias afectados y actualiza el plan con guards.
El mismo issue.version no prueba que las decisiones sigan iguales. Si una respuesta
nueva contradice otra, deja explícita la duda y no ejecutes la parte dependiente.

Un bloqueo afecta al ticket y a sus dependientes. Mantén sin empezar en Backlog
con dependencia/enlace y continúa otro trabajo independiente dentro del mismo
encargo autorizado. Si ya estaba en curso, publica checkpoint del trabajo parcial
y libera tu claim al pausar. No inventes una columna Blocked ni cierres el Epic.

No hay polling permanente ni autoejecución al responder. Sólo relee/retoma cuando
el usuario lo pida, conservando el modo previo: una consulta de respuestas no
inicia código. Indica qué cambió, qué puede seguir y qué pregunta continúa pendiente.
