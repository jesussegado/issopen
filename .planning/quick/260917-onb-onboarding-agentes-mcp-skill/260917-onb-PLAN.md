---
quick_id: 260917-onb
status: complete
ticket: ISSOPEN-115
epic: 4
---

# Onboarding autocontenido para agentes, MCP y skill

## Objetivo

Permitir que una persona comparta una única URL de Issopen con un agente nuevo y
que éste entienda el producto, instale una revisión verificable de la skill,
configure el MCP y compruebe su identidad y permisos sin recibir secretos en la
URL, el prompt o la documentación pública.

## Must haves

- `/agent-onboarding`, `/agent-onboarding.txt`, `/llms.txt` y un contrato JSON
  público describen el mismo flujo y apuntan al MCP canónico.
- La skill se distribuye como un ZIP determinista versionado con manifiesto y
  SHA-256, sin secretos ni configuración privada.
- La pantalla Agents genera instrucciones específicas para cada identidad con
  proyectos, scopes, URL MCP, instalación, prompt inicial y preflight
  `get_agent_context`; nunca incluye el PAT.
- ChatGPT OAuth y Codex PAT quedan claramente separados, y un enlace de
  ticket/Epic se presenta sólo como contexto, nunca como autorización.
- Las rutas públicas no intentan leer una sesión y la experiencia funciona en
  escritorio y móvil.

## Tareas

### 1. Publicar el contrato y paquete de onboarding

**Files:** `src/server/agent-onboarding.ts`, `src/server/app.ts`,
`scripts/package-skill.ts`, `package.json`, `Dockerfile`,
`skills/issopen/version.json`

**Action:** añadir documentos públicos HTML/texto/JSON, empaquetado ZIP
determinista y exposición estática del manifiesto y artefacto.

**Verify:** tests unitarios del contrato, build reproducible y secret scan.

**Done:** una instalación externa puede descubrir URL MCP, descargar la skill y
verificar su digest sin autenticarse ni recibir credenciales.

### 2. Añadir la experiencia web pública y personalizada

**Files:** `src/web/routes/AgentOnboardingRoute.tsx`,
`src/web/lib/agent-onboarding.ts`, `src/web/routes/AgentsRoute.tsx`,
`src/web/App.tsx`, `src/web/components/Shell.tsx`, `src/web/styles.css`

**Action:** crear la guía pública y el panel Owner por agente con instrucciones,
prompt y acciones de copia seguras.

**Verify:** pruebas React de ruta pública, ausencia de sesión, personalización,
copiado y exclusión del PAT.

**Done:** el Owner puede copiar una guía específica y cualquier agente puede
abrir la URL general en móvil o escritorio.

### 3. Documentar, validar y desplegar

**Files:** `docs/agent-onboarding.md`, `README.md`, `AGENTS.md`, tests y
artefactos GSD.

**Action:** documentar operación/actualización/rollback, ejecutar gates,
commitear, publicar imagen por digest y reconciliar por GitOps.

**Verify:** suites del servidor/web/integración/E2E relevantes, Argo
Synced/Healthy, pod Ready y smoke de rutas pública y autenticada.

**Done:** ticket 115 enlaza código y evidencia y queda Ready for Human Review.
