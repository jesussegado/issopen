# Completar el Epic Chrome (22, 24–33)

Entrada GSD `init quick`, 2026-09-09. El propietario pide terminar lo pendiente
del Epic `ca26c29b-43ac-4ca0-b768-594d6779d6e7`, con despliegue verificado.
Derivado del tracker leído al comenzar: 22/24/26–33 v1, 25 v5; preguntas v2,
todas respondidas. 19–21/23 siguen en revisión. No iniciar 44 ni reabrir 43.

## Decisiones preservadas

- DOM del elemento y pocos ancestros; estructura saneada, sin valores de
  formulario ni texto/atributos arbitrarios. Selector estructural y límites
  explícitos; el usuario puede excluir DOM, elemento, imagen o metadatos.
- Proyecto y Epic recordados; ambos se pueden crear inline (decisión de 19).
  Prioridad Medium y estado Backlog por defecto.
- Sólo PNG final revisado, sin originales ni máscaras recuperables en servidor.
- Almacenamiento inicial privado en PVC detrás de una abstracción; retención
  mientras exista el ticket, cuota/uso, checksum, huérfanos y backup/restore.
- Un borrador saneado hasta 24 h; reintento manual con clave idempotente.
  No envío automático ni ampliación silenciosa de grants anteriores.
- Incógnito deshabilitado, `activeTab`, distribución unpacked antes de Store.

## Secuencia y gates

1. 24: contrato compartido, inspector con hover/ancestros/Escape, snapshot
   estructural acotado, preview y exclusión; pruebas de DOM hostil y Chrome.
2. 22/28: API humana versionada, permisos de escritura con nuevo consentimiento,
   creación de proyectos/Epics/ticket+evidencia idempotente y transaccional.
   PNG validado/normalizado, almacenamiento privado, acceso autorizado, límites,
   checksum, cuota, limpieza segura y restore probado; migraciones aditivas.
3. 25/26/27/30: revisión final, compositor, evidencias en la web, estados/errores,
   borrador de 24 h y recuperación; nunca persistir historial/original sensible.
4. 29/31: amenazas, validación negativa de secretos y permisos, contratos y E2E
   captura → edición → envío → detalle, offline/retry/refresh/revocación.
5. 32: versión/ZIP/checksum/commit, CI tras gates, compatibilidad y rollback.
6. Fuente commit/push, imagen del commit, backup previo, GitOps separado con PVC
   y digest. Verificar Argo, runtime, preservación de datos y restore aislado.
7. 33: cuatro modos contra producción, sin duplicados ni fugas, evidencias
   visibles y pruebas de rollback. Registrar la validación personal pendiente
   del owner sin simularla ni etiquetar toda la aceptación como Done.

Cada bloque tiene pruebas antes de avanzar; `pnpm validate` global y
`make validate` de homelab antes de publicación. Issopen conserva estados y
evidencias; estos ficheros son memoria derivada, no otro backlog.
