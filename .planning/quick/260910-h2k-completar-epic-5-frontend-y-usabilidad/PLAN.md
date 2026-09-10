# Quick plan — Completar Epic 5: frontend y usabilidad

## Objetivo

Implementar y validar los tickets 57, 58 y 59 del Epic 5 usando Issopen/MCP
como fuente de estado y desplegar el corte conjunto mediante GitOps.

## Alcance

1. Simplificar las tarjetas/listados compactos de Epics para que no muestren
   la descripción; el detalle y la edición conservan el dato.
2. Permitir adjuntar varias imágenes al crear un ticket desde la web normal,
   con límites, previsualización, retirada y un flujo seguro ante errores.
3. Mantener una acción visible para crear otro ticket relacionado desde el
   detalle de un Epic, incluso cuando el Epic ya contiene tickets.
4. Añadir cobertura unitaria, de integración y E2E para los tres flujos.
5. Ejecutar el gate completo, backup y restauración aislada, publicar imagen
   inmutable, actualizar GitOps y comprobar producción sin mutar datos reales.
6. Enlazar commit y evidencia en cada ticket, moverlos a Ready for Human
   Review y liberar los claims; el cierre queda para la revisión humana.

## Contratos y seguridad

- Los adjuntos web requieren sesión humana owner y pertenencia al mismo
  workspace; no amplían permisos MCP ni de la extensión.
- Se reutilizan el almacenamiento privado, límites y evidencia existentes.
- Si el ticket se crea pero falla la subida, la UI no vuelve a crear otro:
  ofrece reintentar sólo los adjuntos o abrir el ticket ya creado.
- Ninguna descripción ni evidencia almacenada se elimina por este cambio.

## Verificación

- Tests enfocados por ticket durante la implementación.
- `DEBUG= pnpm validate` y `DEBUG= pnpm test:compose`.
- Backup completo reciente y restore aislado de PostgreSQL + adjuntos.
- `make validate` en el repositorio GitOps.
- Argo CD `Synced/Healthy`, pod Ready por digest, readiness pública y smoke UI
  autenticado con un contexto aislado.
