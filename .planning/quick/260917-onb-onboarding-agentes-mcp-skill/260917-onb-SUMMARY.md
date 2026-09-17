---
quick_id: 260917-onb
status: complete
ticket: ISSOPEN-115
source_commit: 5131c6420b1de5ef6130ba77b2a50f35e176aa3f
gitops_commit: cbf58075d77cd10a1305c5856f57c27f24f1c1c6
---

# Onboarding autocontenido para agentes, MCP y skill

## Resultado

Issopen publica ahora una entrada compartible y sin secretos en
`/agent-onboarding`, con variantes de texto, JSON y `llms.txt`. La build genera
la skill 0.2.0 como ZIP determinista, manifiesto y SHA-256. Desde **Agents**, el
Owner puede crear una guía específica con identidad, proyectos, scopes, MCP,
instalación, preflight y prompt inicial; el PAT nunca aparece en ella y continúa
entregándose una sola vez por un canal separado.

## Verificación

- `pnpm validate`: 177 unit/web, 112 integration, 40 E2E (2 skips previstos),
  16 Chrome unit y 13 Chrome E2E; build, reproducibilidad y secret scan PASS.
- `pnpm test:compose`: 1/1 PASS con PostgreSQL real e imagen de producción.
- Skill 0.2.0: 21 ficheros, SHA-256
  `82252e0c2891da7cb97381200897a5ac324cbb1dd6a86370ec38be3133c50570`.
- Imagen OCI:
  `registry.serviciosegado.com/issopen:agent-onboarding-5131c64@sha256:432ed2ca7ea79d5dd5d4c5cb1990b2dc441e5934c5e4ec4fe41e1793886877c7`.
- Argo CD: `Synced/Healthy` en GitOps `cbf58075`; pod Ready y 0 reinicios.
- PostgreSQL y adjuntos conservaron los PVC UID
  `cf93e0a7-b978-46c2-9c03-c77f902742b9` y
  `c40b0035-0433-436f-91c4-feff7a20e754`.
- Producción: readiness, HTML/texto/JSON/llms, manifiesto, descarga y digest
  PASS; API privada anónima devuelve 401. Desktop 1440 y móvil 390 sin overflow
  ni errores de consola. MCP autenticado confirmó identidad, allowlist y scopes.
- La guía personalizada web se validó con base de datos efímera; no se rotó ni
  modificó una credencial humana de producción para automatizar ese smoke.

## Operación y rollback

El contrato completo está en `docs/agent-onboarding.md`. Un enlace de Issopen
aporta contexto, no autorización. Codex usa el PAT acotado desde
`ISSOPEN_AGENT_TOKEN`; ChatGPT usa OAuth. El rollback consiste en revertir los
tres descriptores GitOps a la imagen anterior; no requiere migración ni cambios
de Secret o PVC.
