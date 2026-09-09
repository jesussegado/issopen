---
type: quick
status: in_progress
canonical_issue: https://issopen.serviciosegado.com/issues/5c69ca94-a189-42cf-8e23-2eb2c3f12fb2
source_issue_version: 13
source_question_versions: []
---

# Ticket 43 — continuar la aceptación nativa

Plan derivado del ticket 43, no una autoridad alternativa. Encargo del owner:
completar la aceptación pendiente antes de publicar o iniciar el piloto 44.
GSD quick inicializado con el CLI legacy instalado: `gsd-sdk` no está disponible.
Ejecución inline, sin subagentes, conforme a la configuración del proyecto.

## 1. Consolidar la evidencia de ejecución ya observada

- Archivos: `docs/codex-skill-acceptance.md`, `.planning/STATE.md`.
- Contrastar el informe final privado con código/test/eventos guardados.
- Registrar en Issopen consulta, ejecución y reanudación tras reabrir el editor;
  distinguir registro operador por SDK de acciones del modelo nativo.
- Verificar: Ready for Review, claim nulo, un comentario, test real 1/1,
  sólo greeting.mjs cambiado y configuración global conservada.

## 2. Probar planificación y decisiones cambiadas

- Archivos: `scripts/verify-native-skill.mjs`, tests asociados si corresponde.
- Extender el fixture aislado para un Epic vacío, reutilización de un resultado
  existente, otro resultado nuevo y una pregunta pendiente. Repetir el encargo
  y comprobar IDs/contenido, no sólo recuentos o frases.
- Reanudar tras cambiar una respuesta sintética mediante la web, verificando
  su versión independiente y que se conserva el trabajo/plan anterior.
- Mantener aprobación interactiva de escrituras. El operador no pulsa Allow.
- Verificar con PostgreSQL real y estado Git independiente; no afirmar que
  preparar el fixture o un test de SDK equivalen a aceptación nativa.

## 3. Completar matriz y entregar el estado real

- Revisar escenarios de fallo y gates aún pendientes con evidencia identificada.
- Ejecutar lint, tipos y tests relevantes; inspeccionar diff/secretos.
- Registrar checkpoint canónico y liberar claim si hay que esperar al owner.
- No declarar 43 Done hasta validar todos sus criterios; no publicar tags,
  instalar la skill personal, desplegar ni iniciar el piloto 44.
