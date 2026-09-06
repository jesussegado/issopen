# Phase 1: Private Single-Owner Dogfooding MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 01-private-single-owner-dogfooding-mvp
**Areas discussed:** Primer arranque, sistemas soportados, cambio al MVP vertical, modelo de acceso inicial

---

## Selección inicial de áreas

El usuario seleccionó las cuatro áreas presentadas: primer arranque, sistemas
soportados, servicios locales incluidos y configuración y errores. La discusión
se interrumpió durante la segunda área porque el usuario decidió que cerrar una
matriz de compatibilidad antes del producto retrasaba el objetivo real.

## Primer arranque

### Inicio del entorno

| Option | Description | Selected |
|--------|-------------|----------|
| Un único comando | Valida requisitos, prepara configuración local, levanta servicios y muestra la URL. | ✓ |
| Dos pasos explícitos | Preparar/configurar primero y arrancar después. | |
| Procedimiento manual | Copiar variables, migrar y levantar Compose por separado. | |

**User's choice:** Un único comando.

### Configuración inicial

| Option | Description | Selected |
|--------|-------------|----------|
| Configuración local segura | Parte de una plantilla, crea sólo secretos locales aleatorios y deja integraciones externas opcionales. | ✓ |
| Asistente interactivo | Pregunta cada valor antes de arrancar. | |
| Configuración manual | Se detiene hasta que el operador cree y complete el fichero local. | |

**User's choice:** Generar una configuración local segura.

### Confirmación de arranque

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal y página mínima | Muestra URL, versión y estado general sin revelar secretos. | ✓ |
| Sólo terminal | Imprime URL y comprobaciones. | |
| Sólo endpoint técnico | Expone `/health` sin página visible. | |

**User's choice:** Resumen en terminal y página mínima.

### Ejecuciones repetidas

| Option | Description | Selected |
|--------|-------------|----------|
| Reanudar sin perder datos | Reutiliza configuración y volúmenes y recrea sólo lo necesario. | ✓ |
| Recrear contenedores | Reconstruye siempre servicios, conservando volúmenes. | |
| Preguntar cada vez | Permite elegir continuar, reconstruir o limpiar. | |

**User's choice:** Reanudar sin perder datos.

**Notes:** Estas preferencias se conservan únicamente como el camino Compose
mínimo del MVP. No implican todavía una promesa amplia de distribución o soporte.

---

## Sistemas soportados

### Hosts Docker

| Option | Description | Selected |
|--------|-------------|----------|
| Linux, macOS y Windows con Docker Desktop/WSL2 | Soporte Community amplio mediante contenedores. | ✓ inicialmente |
| Linux oficial; resto best effort | Linux probado, otros hosts sin garantía completa. | |
| Sólo Linux | Matriz inicial mínima. | |

### Arquitecturas de imagen

| Option | Description | Selected |
|--------|-------------|----------|
| `amd64` y `arm64` | Servidores habituales, Apple Silicon y equipos ARM. | ✓ inicialmente |
| Sólo `amd64` | Primera entrega simplificada. | |
| `amd64` oficial y build local ARM | ARM sin imagen preconstruida garantizada. | |

### Superficie del producto

**User's clarification:** “Trabajemos sobre html nada de escritorio”.

Se aclaró que Docker Desktop era sólo un host de contenedores, no una aplicación
de escritorio. El usuario fijó que Issopen debe ser una web HTML y seleccionó
compatibilidad con Chrome, Edge, Brave, Firefox y Safari modernos. Antes de
elegir una política formal de versiones, pidió dejar estas decisiones de lado y
priorizar el MVP.

**Outcome:** La web responsive y la ausencia de aplicación de escritorio sí
quedan bloqueadas. La matriz formal de hosts, arquitecturas y navegadores queda
diferida y no debe retrasar la fase 1.

---

## Cambio al MVP vertical

**User's request:** Construir cuanto antes un MVP web con tablero de tickets y
MCP para empezar a usarlo, aceptando escalar, ampliar o rehacer después según la
evidencia.

Se propuso sustituir la fase horizontal de portabilidad por un corte con:

- web responsive;
- tablero de cinco estados;
- Remote MCP para ChatGPT;
- identidad separada para un agente de código;
- actividad mínima y revisión humana;
- Docker Compose sencillo;
- dogfooding con una mejora real de Issopen.

El usuario aceptó explícitamente esta reordenación.

## Modelo de acceso inicial

| Option | Description | Selected |
|--------|-------------|----------|
| Privado y single-owner | Acceso sencillo protegido; colaboración y multiusuario posteriores. | ✓ |
| Usuarios y colaboración desde el inicio | Más completo, pero retrasa el primer uso. | |

**User's choice:** MVP privado para un único propietario.

---

## the agent's Discretion

- Mecanismo concreto de bootstrap, sesión segura y recuperación del owner.
- Implementación exacta de OAuth 2.1/PKCE que se validará con ChatGPT Work.
- Codex como primer agente real y mecanismo operativo de entrega de su PAT
  separado, respetando almacenamiento con hash y revocación.
- Cohorte exacta de dependencias, estructura interna, nombres de comandos,
  apariencia mínima y pruebas.
- Hostname HTTPS: debe ser configurable y requerirá autorización explícita del
  operador; no se inventa ningún dominio o registro.

## Deferred Ideas

- Compatibilidad formal entre hosts, arquitecturas y versiones de navegador.
- Colaboración y autenticación humana multiusuario.
- Adjuntos, captura Chromium y auditorías.
- Portabilidad amplia, backup/restore, release Community y Cloud Free.
- Escalado y refactors hasta disponer de uso real del MVP.
