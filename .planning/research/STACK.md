# Technology Stack — Issopen

**Project:** Issopen  
**Domain:** issue tracker visual para personas y agentes externos, con extensión Chromium y Remote MCP  
**Researched:** 2026-08-23  
**Mode:** ecosystem / stack decision  
**Overall confidence:** HIGH para la arquitectura y las familias principales; MEDIUM para piezas jóvenes (`@modelcontextprotocol/*` v2, Better Auth MCP y el proveedor S3 incluido en Compose)

## Recomendación ejecutiva

Issopen debería ser un **monolito modular TypeScript sobre Node.js 24 LTS**: un único backend Hono expone REST, autenticación y Remote MCP, y sirve el artefacto estático de una SPA React/Vite. La extensión se construye aparte con WXT y consume la misma API. PostgreSQL es la única fuente de estado transaccional y los ficheros privados se guardan detrás de una interfaz S3.

Esta investigación **no recomienda Next.js**. Issopen es una aplicación autenticada, no necesita SSR para su bucle principal y ya necesita un backend público independiente para la extensión y MCP. Next.js añadiría un segundo modelo de servidor, routing y caché sin eliminar Hono. React 19.2 sobre Vite 8 produce un artefacto estático que el mismo contenedor Hono puede servir, reduciendo la instalación Community a `app + postgres + object storage`.

Tampoco recomienda hacer de Supabase la plataforma de aplicación. Supabase puede ser, si interesa en Cloud, un PostgreSQL gestionado al que se accede por `DATABASE_URL`; Issopen no debe depender de Supabase Auth, Storage, RLS, Edge Functions ni `supabase-js`. El contrato portable debe ser PostgreSQL normal, S3 compatible, SMTP y OAuth/OIDC estándar. Así Cloud y Community ejecutan el mismo código y la edición self-hosted no es una reconstrucción tardía.

Sí se mantienen tres intuiciones del brief: Hono es una buena frontera HTTP portable, WXT sigue siendo el framework adecuado para Manifest V3, y Drizzle es una capa SQL razonable siempre que se versionen y revisen migraciones SQL. La propuesta MCP cambia de forma importante: en 2026 el endpoint remoto debe implementar el perfil MCP `2026-07-28`, Streamable HTTP y el flujo OAuth descubierto por RFC 9728; un bearer token propietario no basta como única experiencia si se quiere interoperabilidad real.

## Decisiones que deben fijarse ahora

| Área | Decisión | Motivo y efecto sobre self-hosting | Confianza |
|---|---|---|---|
| Runtime | Node.js 24 LTS, ESM | Es la línea LTS actual; Node 26 sigue en `Current` hasta octubre de 2026. Un runtime único reduce diferencias entre Cloud, Compose y homelab. | HIGH |
| Lenguaje | TypeScript 6.0.x inicialmente | TS 7.0 es estable y mucho más rápido, pero todavía no expone una API programática estable. TS 6 es el ancla compatible para WXT y tooling hasta probar TS 7.1. | HIGH |
| Web | React SPA + Vite; no Next.js | No hay requisito SSR/SEO en el producto autenticado. El resultado estático se sirve desde el backend y funciona igual en cualquier host. | HIGH |
| Backend | Hono sobre Node; REST `/api/v1` + `/mcp` en el mismo proceso | Hono usa `Request`/`Response` Web Standard y tiene adaptador oficial Node y adaptador oficial MCP. Un solo deployable, sin microservicios. | HIGH |
| Contratos | Zod 4 como validación en frontera + OpenAPI 3.1 como contrato externo | Web y extensión pueden compartir schemas publicados; clientes externos no dependen de inferencia TypeScript interna. | HIGH |
| MCP | Especificación `2026-07-28`, SDK TypeScript v2, Streamable HTTP stateless | Es el transporte Remote MCP vigente; el modo stateless evita afinidad de sesión/Redis y escala igual en Compose o Cloud. | HIGH |
| Auth web | Better Auth sobre las tablas PostgreSQL de Issopen | Soporta GitHub, magic link y adaptador Drizzle sin un servicio de identidad propietario. | HIGH |
| Auth MCP | Better Auth MCP + CIMD + OAuth 2.1/RFC 9728; PAT como vía adicional, no sustitutiva | Entrega discovery y tokens ligados al recurso. Community opera su propio authorization server dentro del mismo backend. | MEDIUM-HIGH |
| Datos | PostgreSQL 18; Drizzle ORM y migraciones SQL versionadas | Es portable entre contenedor y proveedores gestionados. No se requiere extensión propietaria. | HIGH |
| Ficheros | API S3 mediante AWS SDK v3; SeaweedFS sólo como default de Compose | El código funciona con SeaweedFS, S3, R2, B2 u otro S3 compatible. El proveedor está fuera del dominio. | HIGH para el contrato; MEDIUM para SeaweedFS como default |
| Monorepo | pnpm workspaces + Turborepo | Hay tres artefactos reales y contratos compartidos. Turbo sólo coordina tareas/caché; no define arquitectura ni exige cache remoto. | HIGH |
| Observabilidad | JSON a stdout con Pino + trazas/métricas OTLP opcionales | Funciona sin SaaS y puede conectarse a cualquier collector. Los eventos de auditoría siguen siendo datos del producto. | HIGH |
| Distribución | Una imagen OCI para web/API/MCP; ZIP/CRX separado para la extensión | Cloud y Community prueban el mismo binario. Las migraciones se ejecutan como comando/job explícito. | HIGH |

## Versiones de referencia verificadas

Las versiones siguientes son el baseline observado el 2026-08-23 en documentación, repositorios canónicos y el registro npm. Son **versiones exactas de referencia**, no permiso para usar rangos abiertos. Al comenzar la fase de foundation se deben volver a consultar, probar como cohortes y fijar exactamente en `package.json`, `pnpm-lock.yaml` e imágenes por digest.

### Runtime y toolchain

| Tecnología | Baseline exacto | Política de adopción | Uso |
|---|---:|---|---|
| Node.js | `24.19.0` LTS | Adoptar ahora; `engines: >=24 <25`; imagen exacta y digest | Runtime de API, build web/extension, migraciones y tests |
| pnpm | `11.22.0` | Fijar en `packageManager` con hash de integridad | Instalación reproducible y workspaces |
| TypeScript | `6.0.3` | Fijar ahora; reevaluar TS `7.1+`, no TS `7.0.2` en foundation | Typecheck y emisión del backend |
| Turborepo | `2.10.11` | Fijar patch; caché local/CI, sin dependencia de Vercel Remote Cache | Grafo `dev/build/test/typecheck` |
| Biome | `2.5.10` | Fijar patch | Formato y lint sintáctico; `tsc` conserva el typecheck |

Node publica `24.19.0` como Latest LTS y `26.7.0` como Current, y recomienda producción únicamente sobre líneas LTS. Node 24 queda soportado hasta abril de 2028. [Node.js releases](https://nodejs.org/en/about/previous-releases) · [calendario oficial](https://github.com/nodejs/Release/blob/main/schedule.json)

pnpm 11 exige Node 22 o superior, es ESM y endurece por defecto la cadena de suministro. Se debe conservar `packageManager` con versión e integridad y el lockfile, nunca instalar `latest` implícitamente en CI. [pnpm 11](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/11.0.md) · [Corepack package pinning](https://github.com/nodejs/corepack/blob/main/README.md)

TypeScript 7.0.2 es la versión upstream más nueva, pero Microsoft confirma que 7.0 aún no ofrece API programática estable y documenta el uso paralelo de TS 6 para tooling que la necesita. Para una foundation que combina WXT, generadores y linting, `6.0.3` es la elección conservadora; se debe abrir una prueba de actualización cuando exista 7.1 estable. [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) · [release 6.0.3](https://github.com/microsoft/TypeScript/releases/tag/v6.0.3)

### Aplicación web

| Tecnología | Baseline exacto | Uso | Nota de portabilidad |
|---|---:|---|---|
| React / React DOM | `19.2.8` | UI de web y extensión | Misma versión exacta en ambos artefactos |
| Vite | `8.2.2` | Dev server y build SPA | Produce estáticos; no impone plataforma de hosting |
| `@vitejs/plugin-react` | `6.1.0` | React Refresh/transform | Fijar junto con Vite |
| TanStack Router | `1.170.32` | Routing tipado de la SPA | Sólo cliente; las reglas de acceso siguen en API |
| TanStack Query | `5.102.1` | Estado remoto, invalidación y mutaciones | No usarlo como estado de dominio |
| Tailwind CSS | `4.3.3` | Estilos | Build local; ninguna CDN runtime |
| shadcn CLI | `4.19.0` | Copiar componentes iniciales | Ejecutar sólo al incorporar componentes y versionar el código generado |
| Radix primitives | familia `1.x` | Accesibilidad de componentes complejos | Añadir únicamente primitivas realmente usadas |
| dnd-kit | `@dnd-kit/core 6.3.1`, `@dnd-kit/sortable 10.0.0` | Kanban accesible por puntero/teclado | Debe verificarse con Playwright y teclado real |

React mantiene `19.2` como versión documentada y Vite 8 es la línea estable actual. Vite 8 usa Rolldown y requiere Node `20.19+` o `22.12+`, por lo que Node 24 cumple holgadamente. [React versions](https://react.dev/versions) · [Vite 8](https://vite.dev/blog/announcing-vite8) · [Vite 8.1](https://vite.dev/blog/announcing-vite8-1)

**Decisión contra Next.js:** Next.js 16.3 es actual y técnicamente válido, pero sus ventajas de React Server Components, SSR, caché del servidor y routing full-stack no resuelven el consumo de la API desde WXT ni Remote MCP. Issopen ganaría un segundo runtime y otro modelo de autorización/caché. Mantener una SPA Vite hace que el contenedor Community sea más pequeño conceptualmente y evita que Cloud y self-hosted sigan caminos diferentes. [Next.js 16.x releases](https://nextjs.org/blog)

### API, contratos y dominio

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Hono | `4.13.3` | Router HTTP y middleware | El dominio no importa tipos de Hono |
| `@hono/node-server` | `2.1.1` | Adaptador Node y servicio de estáticos | Único entrypoint de producción |
| Zod | `4.4.3` | Validación de env, requests, responses, payloads MCP | Parsear en toda frontera; tipos TS no sustituyen validación |
| `@hono/zod-openapi` | `1.6.1` | REST versionada y OpenAPI | Generar y comprobar el documento en CI |
| Pino | `10.3.1` | Logs JSON estructurados | Redactar cookies, authorization, tokens, DOM y URLs firmadas |

Hono funciona sobre Web Standards y dispone de adaptador Node y servicio de estáticos. La propia documentación de Hono advierte que su RPC tipado acopla las versiones de Hono entre cliente y servidor; Issopen debe preferir schemas Zod compartidos y OpenAPI para no ligar la extensión ni consumidores externos al tipo interno `AppType`. [Hono Web Standards](https://hono.dev/docs/concepts/web-standard) · [Hono en Node.js](https://hono.dev/docs/getting-started/nodejs) · [caveat de Hono RPC](https://hono.dev/docs/guides/rpc) · [Hono Zod OpenAPI](https://hono.dev/examples/zod-openapi)

El paquete `packages/contracts` debe contener sólo schemas y DTOs sin acceso a DB ni framework. Los handlers REST, MCP y jobs llaman a los mismos servicios de aplicación. OpenAPI es el contrato público; compartir Zod dentro del monorepo es una optimización, no el único contrato.

### Remote MCP

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| MCP protocol | `2026-07-28` | Revisión de protocolo ofrecida por `/mcp` | Conservar compatibilidad legacy stateless mientras los clientes reales la necesiten |
| `@modelcontextprotocol/server` | `2.0.0` | `McpServer`, tools y `createMcpHandler` | No usar el monolítico `@modelcontextprotocol/sdk` v1 |
| `@modelcontextprotocol/hono` | `2.0.0` | Adaptador oficial del handler Web Standard a Hono | Misma versión que server/core/client |
| `@modelcontextprotocol/client` | `2.0.0` | Tests automáticos de interoperabilidad | No es dependencia de producción del servidor |
| `@better-auth/mcp` | `1.7.1` | Authorization server/protected resource MCP | Fijar junto con todo Better Auth |
| `@better-auth/cimd` | `1.7.1` | Client ID Metadata Documents | Usar perfil `mcp-2026-07-28` |

El SDK v2 divide el antiguo paquete monolítico, implementa la especificación `2026-07-28` y ofrece un handler stateless capaz de atender también la era 2025. Para Issopen, cada request debe construir el contexto de actor y workspace a partir del token verificado; no debe existir estado de autorización global en la instancia MCP. [SDK TypeScript v2](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/README.md) · [servir MCP por HTTP](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md) · [versiones de protocolo](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)

La autorización remota MCP exige discovery de protected resource y OAuth cuando se ofrece autorización. Better Auth 1.7 ya compone OAuth 2.1, RFC 9728, tokens ligados al recurso, CIMD y verificación de scopes. Esto es preferible a construir un authorization server propio. Los PAT con hash, scopes, expiración y revocación siguen siendo útiles para automatización, pero deben coexistir con el endpoint estándar, no reemplazarlo. [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) · [Better Auth MCP](https://better-auth.com/docs/plugins/mcp) · [upgrade Better Auth 1.7](https://better-auth.com/docs/guides/1-7-upgrade-guide)

### Extensión Chromium

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| WXT | `0.21.4` | Build, entrypoints, manifest y packaging | Target único MV3/Chromium en v1 |
| `@wxt-dev/module-react` | `1.2.2` | React dentro de popup/editor/content UI | React exacto compartido con web |
| Manifest | `manifest_version: 3` | Service worker y content scripts | Nada de background page persistente ni código remoto |
| Chrome APIs | `activeTab`, `scripting`, `tabs.captureVisibleTab`, `identity.launchWebAuthFlow` | Captura iniciada por gesto y login | No pedir `<all_urls>` por defecto |

WXT sigue siendo una elección adecuada, pero no debe ocultar las restricciones de MV3: el service worker puede terminar en cualquier momento y el código ejecutado debe ir empaquetado. El flujo de captura debe obtener permiso temporal mediante `activeTab`; no se deben declarar host permissions globales para “uso futuro”. [WXT releases](https://github.com/wxt-dev/wxt/releases) · [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) · [`activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) · [`captureVisibleTab`](https://developer.chrome.com/docs/extensions/reference/api/tabs) · [`launchWebAuthFlow`](https://developer.chrome.com/docs/extensions/reference/api/identity)

El `minimum_chrome_version` se debe decidir en la fase de extensión a partir de las APIs realmente usadas y probarse también en Edge y Brave. No conviene inventar hoy una cifra que WXT no necesita. El login debe ser una autorización iniciada por el usuario y terminar en un token/sesión de extensión revocable; no se deben copiar cookies de la web ni guardar un PAT de larga duración como si fuera una cookie.

### PostgreSQL, ORM y migraciones

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| PostgreSQL | `18.6` | Estado transaccional, auth, cuotas, auditoría | Misma major en dev/CI/Compose; Cloud puede ser servicio gestionado compatible |
| Drizzle ORM | `0.45.2` | Schema y queries tipadas | No esconder SQL complejo; constraints viven en DB |
| Drizzle Kit | `0.31.10` | Generación/check/aplicación de migraciones | `generate` + revisión + `migrate`; nunca `push` en entornos compartidos |
| Postgres.js | `3.4.9` | Driver PostgreSQL de Node | Pool limitado y configurable; una sola implementación de driver |

PostgreSQL 18.6 es el minor actual y la política upstream recomienda mantener cada major en su último minor. PostgreSQL 18 está soportado hasta noviembre de 2030. [PostgreSQL versioning](https://www.postgresql.org/support/versioning/) · [release 18](https://www.postgresql.org/docs/current/release-18.html)

Drizzle se acepta porque mantiene el schema cerca de TypeScript sin imponer proxy o runtime propietario. La fuente de cambio desplegable debe ser SQL versionado: generar, revisar constraints/índices/locks, comprobar colisiones y aplicar con un job/command explícito. `drizzle-kit push` sólo cabe en una base local desechable. [Drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases) · [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) · [migration fundamentals](https://orm.drizzle.team/docs/migrations)

La conexión debe ser una URL PostgreSQL convencional. No usar APIs de datos HTTP, branching o pooling de un proveedor dentro del dominio. Si Cloud exige PgBouncer, se valida el modo de prepared statements en esa topología y se documenta como configuración de infraestructura.

### Autenticación humana, agentes y correo

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Better Auth | `1.7.1` | Sesiones web, GitHub OAuth, magic link y OAuth MCP | Tablas en el mismo PostgreSQL; secretos sólo por entorno |
| Nodemailer | `9.0.5` | Transporte SMTP para magic links | Community configura cualquier SMTP; Mailpit en local |

Better Auth soporta PostgreSQL mediante adaptador Drizzle, proveedores sociales como GitHub y plugin de magic link. Debe gestionar identidad y sesiones, no autorización de negocio: membresía, rol de workspace, scope de token y acceso a proyecto se comprueban en los servicios de dominio en cada request. [instalación Better Auth](https://better-auth.com/docs/installation) · [GitHub/social OAuth](https://better-auth.com/docs/basic-usage) · [magic link](https://better-auth.com/docs/plugins/magic-link)

Las migraciones de las tablas de Better Auth deben convertirse al mismo historial SQL revisado que el resto del schema; no ejecutar automigración opaca al arrancar. GitHub OAuth y SMTP son configuración opcional del operador, pero al menos un método de login debe quedar validado en el instalador Community.

### Almacenamiento de capturas y adjuntos

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| `@aws-sdk/client-s3` | `3.1116.0` | Cliente S3 portable | Fijar toda la cohorte AWS SDK en el mismo release |
| `@aws-sdk/s3-request-presigner` | `3.1116.0` | PUT/GET firmados de vida corta | Bucket siempre privado; el API decide key, tamaño y TTL |
| `file-type` | `22.0.2` | Comprobación de tipo por contenido | No confiar en extensión ni `Content-Type` del cliente |
| Sharp | `0.35.3` | Re-encode/normalización de imágenes | Validar binarios amd64/arm64 en CI antes de adoptarlo |
| SeaweedFS | `4.41` | Proveedor S3 incluido en Docker Compose Community | Servicio interno; no publicar UIs/admin al exterior |

La aplicación sólo conoce S3: endpoint, región, bucket, credentials, path-style y TLS son configuración. Las cargas usan URLs firmadas, pero el servidor crea previamente una intención de upload y confirma después tamaño/tipo/hash antes de publicar el attachment. Los objetos no son públicos y MCP recibe metadata más una URL corta autorizada, nunca base64 de la imagen. AWS documenta tanto presigned URLs como multipart upload en el SDK v3. [AWS SDK v3 S3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-s3.html) · [presigned upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)

**SeaweedFS, no MinIO, para el Compose de referencia.** SeaweedFS 4.41 sigue publicando releases, tiene licencia Apache-2.0 y ofrece `weed mini` con endpoint S3 para desarrollo/single-node. En producción pequeña debe quedar dentro de la red Compose y sus puertos administrativos no deben exponerse. Para alta disponibilidad, el operador puede sustituirlo por un S3 externo sin cambiar Issopen. [SeaweedFS releases](https://github.com/seaweedfs/seaweedfs/releases) · [`weed mini` y Docker](https://github.com/seaweedfs/seaweedfs/blob/master/README.md) · [licencia](https://github.com/seaweedfs/seaweedfs/blob/master/LICENSE)

MinIO Community no debe aparecer en el Compose: el repositorio fue archivado, la edición Community pasó a distribución sólo como fuente y sus releases finales quedaron afectados por una vulnerabilidad corregida únicamente en AIStor. [estado oficial de MinIO Community](https://github.com/minio/minio/blob/master/README.md) · [archivo de releases](https://github.com/minio/minio/releases) · [advisory oficial](https://github.com/minio/minio/security/advisories/GHSA-xh8f-g2qw-gcm7)

### Testing

| Tecnología | Baseline exacto | Cobertura prioritaria |
|---|---:|---|
| Vitest | `4.1.11` | Dominio, authz, cuotas, sanitización DOM, selectors y handlers |
| `@vitest/browser-playwright` | `4.1.11` | Componentes con navegador real cuando aporte valor |
| Playwright | `1.62.1` | E2E web y extensión MV3 empaquetada |
| Testcontainers PostgreSQL | `12.1.0` | Integración con PostgreSQL 18 real y migraciones desde cero |
| MSW | `2.15.0` | Simular API sólo en tests de UI/extension, no en aceptación E2E |
| MCP client SDK | `2.0.0` | Tests de initialize/discovery, auth, tools, errores y scopes |

Vitest 4 ofrece Browser Mode estable. Para la extensión, Playwright exige Chromium con contexto persistente y advierte que Chrome/Edge ya no admiten los flags de sideload empleados por estos tests; los tests automatizados deben usar el Chromium que trae Playwright y la aceptación manual debe cubrir Chrome, Edge y Brave reales. [Vitest 4](https://vitest.dev/blog/vitest-4) · [Playwright Chrome extensions](https://playwright.dev/docs/next/chrome-extensions)

No usar SQLite como sustituto de PostgreSQL en tests de repositorio o authz: oculta constraints, transacciones, locking y SQL incompatible. La suite crítica debe levantar PostgreSQL 18.6 y un S3 real compatible. MCP debe probarse con el SDK cliente y al menos dos clientes reales antes de declarar interoperabilidad.

### Observabilidad

| Tecnología | Baseline exacto | Uso | Regla |
|---|---:|---|---|
| Pino | `10.3.1` | Logs JSON stdout | Siempre disponible, incluso sin collector |
| OpenTelemetry API | `1.9.1` | API neutral de instrumentación | No acoplar el dominio al SDK |
| OpenTelemetry Node SDK | `0.221.0` | Trazas y métricas | Activación por env; export OTLP configurable |
| OTel auto-instrumentations | `0.79.0` | HTTP/PostgreSQL y runtime | Lista explícita de instrumentaciones, no “todo” sin revisar |

OpenTelemetry JS declara trazas y métricas estables, pero logs aún en desarrollo y la instrumentación browser experimental. Por ello Issopen usa Pino como contrato de logs y limita OTel al backend para trazas/métricas; no obliga a Community a desplegar un collector. [estado OTel JavaScript](https://opentelemetry.io/docs/languages/js/) · [exportadores OTLP](https://opentelemetry.io/docs/languages/js/exporters/) · [Pino releases](https://github.com/pinojs/pino/releases)

Métricas mínimas: latencia/errores por ruta, fallos auth, tool calls MCP, uploads, jobs de limpieza y conexiones DB. Nunca usar labels con workspace, issue, URL o token. El activity/audit log consultable por usuarios es persistencia de dominio, no telemetría desechable.

## Layout recomendado

```text
apps/issopen/
├── apps/
│   ├── api/             # Hono: REST, auth mount, MCP mount, static SPA
│   ├── web/             # React/Vite; artefacto estático
│   └── extension/       # WXT/React/MV3
├── packages/
│   ├── contracts/       # Zod DTOs + OpenAPI-facing schemas
│   ├── db/              # Drizzle schema, repositories, committed SQL migrations
│   └── domain/          # use cases, authz, quotas, transitions, audit attribution
├── compose.yaml         # app, postgres, seaweedfs; mailpit en perfil dev
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

No crear `packages/auth`, `packages/ui`, `packages/shared` o `packages/mcp` vacíos. Auth y MCP comienzan como módulos del backend; UI compartida nace dentro de `apps/web` y sólo se extrae si web y extensión comparten componentes reales. Esta regla evita convertir el diagrama del brief en arquitectura accidental.

## Topología portable

```text
Chromium extension ─┐
React SPA ──────────┼── HTTPS ──> Hono/Node 24
MCP clients ────────┘                ├── REST /api/v1
                                    ├── Better Auth / OAuth discovery
                                    ├── Streamable HTTP /mcp
                                    ├── PostgreSQL 18
                                    └── S3-compatible private bucket
```

### Community / Docker Compose

- Una imagen `issopen` contiene el JS del backend y los estáticos Vite.
- `postgres:18.6` usa volumen y healthcheck; backup/restore se documenta antes del release Community.
- `seaweedfs:4.41` ejecuta el modo S3 single-node con volumen; sólo el endpoint S3 queda accesible a la red interna.
- Mailpit se habilita sólo con perfil de desarrollo; producción exige SMTP real.
- El comando de migración es explícito e idempotente; la app no modifica el schema en startup.
- Ningún dominio, GitHub OAuth app, SMTP ni storage credential viene hardcodeado.

### Issopen Cloud

- Ejecuta la misma imagen y el mismo comando de migración.
- Puede usar PostgreSQL y S3 gestionados, pero sólo mediante los contratos estándar.
- CDN, WAF, backups, autoscaling y lifecycle del bucket son infraestructura, no imports del producto.
- Multi-tenancy se mantiene lógica por workspace en las mismas tablas; no se crea una variante Cloud del dominio.

### Homelab / Kubernetes posterior

La app podrá envolverse con el chart común del monorepo cuando exista un despliegue aprobado, sin introducir Kubernetes dentro de `apps/issopen`. El artefacto, health endpoints, migración y variables son los mismos que en Compose. Esta investigación no habilita ningún despliegue.

## Configuración portable mínima

Nombres orientativos que la fase de implementación debe confirmar y documentar; nunca incluyen valores reales:

```text
APP_BASE_URL
DATABASE_URL
AUTH_SECRET / AUTH_PREVIOUS_SECRETS
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
SMTP_URL
MAIL_FROM
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE
OTEL_EXPORTER_OTLP_ENDPOINT        # opcional
LOG_LEVEL
```

El arranque debe validar este contrato con Zod y fallar con nombres de variables ausentes, sin imprimir valores. Cloud puede inyectar secretos desde su backend; Community puede usar secrets de Compose/Kubernetes o env files fuera de Git.

## Cohortes que deben actualizarse juntas

| Cohorte | Paquetes/versiones de referencia | Verificación obligatoria |
|---|---|---|
| React | `react`, `react-dom` `19.2.8` | Build web + extension, hydration no aplica |
| Vite | `vite 8.2.2`, plugin React `6.1.0` | Build production y HMR web |
| MCP | todos `@modelcontextprotocol/* 2.0.0` | protocolo moderno + fallback legacy decidido explícitamente |
| Better Auth | `better-auth`, `@better-auth/mcp`, `@better-auth/cimd` `1.7.1` | migración schema, web login, consent y cliente MCP real |
| AWS SDK | S3 client/presigner `3.1116.0` | SeaweedFS + proveedor Cloud elegido |
| OTel | SDK/exporters `0.221.0`; API `1.9.1` | startup ESM, shutdown y export deshabilitado |
| Vitest | core/browser `4.1.11` | unit + browser mode |
| Drizzle | ORM `0.45.2`, Kit `0.31.10`, driver `3.4.9` | generar, DB vacía, upgrade y rollback ensayado |

## Dependencias iniciales propuestas

Comandos de referencia para la fase foundation; volver a verificar patches y usar `--save-exact`:

```bash
# Workspace tooling
pnpm add -Dw --save-exact typescript@6.0.3 turbo@2.10.11 @biomejs/biome@2.5.10 vitest@4.1.11 @playwright/test@1.62.1

# API/domain
pnpm --filter api add --save-exact hono@4.13.3 @hono/node-server@2.1.1 zod@4.4.3 @hono/zod-openapi@1.6.1 pino@10.3.1

# Database/auth/MCP/storage
pnpm --filter api add --save-exact drizzle-orm@0.45.2 postgres@3.4.9 better-auth@1.7.1 @better-auth/mcp@1.7.1 @better-auth/cimd@1.7.1 @modelcontextprotocol/server@2.0.0 @modelcontextprotocol/hono@2.0.0 @aws-sdk/client-s3@3.1116.0 @aws-sdk/s3-request-presigner@3.1116.0
pnpm --filter db add -D --save-exact drizzle-kit@0.31.10

# Web
pnpm --filter web add --save-exact react@19.2.8 react-dom@19.2.8 @tanstack/react-router@1.170.32 @tanstack/react-query@5.102.1 tailwindcss@4.3.3
pnpm --filter web add -D --save-exact vite@8.2.2 @vitejs/plugin-react@6.1.0

# Extension
pnpm --filter extension add --save-exact react@19.2.8 react-dom@19.2.8
pnpm --filter extension add -D --save-exact wxt@0.21.4 @wxt-dev/module-react@1.2.2
```

No instalar todas las dependencias de UI, storage processing u observabilidad en la primera tarea. Se añaden en el corte vertical que las usa. Los comandos anteriores fijan el núcleo, no autorizan crear paquetes vacíos.

## Qué evitar explícitamente

| Evitar | Por qué | Usar en su lugar |
|---|---|---|
| Next.js 16 como web principal | Duplica servidor/routing/caché y no evita la API requerida por extensión/MCP; SSR no valida el producto. | React 19 SPA + Vite 8, servida por Hono |
| Supabase Auth/Storage/RLS como arquitectura | Convierte Community en una instalación de Supabase o en una implementación distinta; reparte authz entre API y políticas proveedor-específicas. | Better Auth + PostgreSQL normal + S3 API; Supabase sólo podría ser un PG gestionado |
| MinIO Community en Compose | Proyecto archivado/source-only y releases finales con vulnerabilidad sin parche Community. | SeaweedFS 4.41 por defecto; cualquier S3 externo soportado |
| Node 26 en producción ahora | Sigue en Current el 2026-08-23. | Node 24 LTS; evaluar Node 26 tras LTS y matriz de dependencias |
| TypeScript 7.0.2 en foundation | No tiene todavía API programática estable; riesgo innecesario con tooling. | TS 6.0.3; spike de TS 7.1 cuando exista |
| SDK MCP v1 / endpoint SSE antiguo | Es la línea/protocolo anterior y obliga a migración inmediata. | Paquetes v2 + Streamable HTTP `2026-07-28` |
| OAuth MCP casero o PAT-only | Reduce interoperabilidad, discovery y seguridad; construir un AS correcto es trabajo especializado. | Better Auth MCP/CIMD; PAT adicional con hash/scopes |
| Hono RPC como único contrato | Acopla cliente y servidor a la misma versión/tipos y no sirve a terceros. | REST OpenAPI + Zod compartido; MCP schemas separados |
| `drizzle-kit push` en staging/prod | Cambia schema sin historial SQL revisable ni plan de rollout. | `generate`, revisar, commit, `migrate` explícito |
| SQLite en tests de persistencia | Oculta comportamiento PostgreSQL y aislamiento real. | Testcontainers con PostgreSQL 18.6 |
| Bun/Deno/Workers como runtime canónico | Aumenta la matriz de auth/driver/storage sin aportar al MVP. | Node 24; Hono conserva una posible portabilidad futura |
| Bucket público o proxy de base64 por MCP | Rompe privacidad y dispara memoria/ancho de banda. | Bucket privado + URLs firmadas cortas + metadata MCP |
| `<all_urls>` en la extensión | Acceso persistente excesivo y warning de instalación. | `activeTab` + `scripting` después de gesto explícito |
| Service worker MV3 como estado durable | Chrome puede terminarlo; produce pérdidas y carreras. | Estado transitorio en `chrome.storage`/IndexedDB y servidor como autoridad |
| Sentry u otro SaaS obligatorio | Community deja de ser autónomo. | stdout JSON + OTLP opcional; adaptadores Cloud opcionales |
| Kubernetes/microservicios/colas en el producto inicial | No validan captura → issue → MCP y empeoran Community. | Un proceso Node y jobs DB-driven sólo cuando haya necesidad medida |

## Política de pinning para la implementación

1. Repetir `npm view <package> version`, revisar release notes oficiales y ejecutar una instalación limpia el día que comience foundation.
2. Guardar todas las dependencias directas con versión exacta y commitear `pnpm-lock.yaml`; no usar `latest`, `*` ni rangos amplios en imágenes o CI.
3. Fijar `pnpm@11.22.0` (o el patch aprobado entonces) con hash en `packageManager`; CI usa `pnpm install --frozen-lockfile`.
4. Fijar `node:24.19.0-...` y las imágenes PostgreSQL/SeaweedFS por tag exacto **y digest** después de confirmar soporte amd64/arm64. Los digests no se inventan en investigación.
5. Actualizar cohortes juntas y hacer smoke tests de web, API, extensión, migraciones, OAuth MCP y S3 antes de aceptar Renovate/Dependabot.
6. Mantener un fixture que migre desde DB vacía y otro desde el release anterior. El rollback de aplicación no puede asumir rollback destructivo de schema.
7. Ejecutar SBOM y escaneo de imagen/dependencias en CI; un lockfile no sustituye advisories.
8. Revisar trimestralmente Node LTS, PostgreSQL minor, Chrome Web Store policies y MCP spec. Los cambios de protocolo/auth/browser requieren fase de investigación, no update automático.

## Riesgos y comprobaciones pendientes

| Tema | Riesgo | Acción antes de adoptar | Confianza |
|---|---|---|---|
| Better Auth 1.7 + MCP SDK 2 | Ambos releases son recientes y la superficie OAuth/CIMD es sensible. | Spike con Codex y Claude reales, consent, refresh, revocación, scopes y DPoP; revisar migrations generadas. | MEDIUM |
| TypeScript 7 | TS 7.0 no tiene API programática; retrasarlo pierde rendimiento, adoptarlo puede romper tooling. | Repetir matriz con WXT, Drizzle, Vite, Biome y SDK MCP cuando 7.1 sea estable. | HIGH sobre el riesgo |
| SeaweedFS `weed mini` | Adecuado para dev/single-node, no demuestra HA ni hardening; UIs administrativas requieren aislamiento. | Compose sólo publica app; backup/restore y upgrade probados; documentar S3 externo para producción seria. | MEDIUM |
| S3 compatibility | “S3-compatible” no garantiza idéntico CORS, checksums, signed POST, path-style o multipart. | Suite contractual contra SeaweedFS y el proveedor Cloud elegido. | HIGH |
| WXT 0.x | Sigue antes de 1.0 y puede introducir cambios de tooling. | Pin exacto; fixture build/package y upgrade notes antes de actualizar. | MEDIUM-HIGH |
| Drizzle ORM 0.x | API aún 0.x y Kit tiene versionado separado. | Pin cohortes, revisar SQL y no dejar migrations en manos del startup. | MEDIUM-HIGH |
| Sharp | Binarios nativos y formatos de imagen amplían superficie. | Probar amd64/arm64; límites de pixels, decode time y memoria; considerar omitirlo en el primer upload vertical. | MEDIUM |

## Fuentes primarias adicionales

- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [pnpm releases](https://github.com/pnpm/pnpm/releases)
- [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [React versions](https://react.dev/versions)
- [Vite releases](https://vite.dev/blog)
- [Hono releases](https://github.com/honojs/hono/releases)
- [WXT releases](https://github.com/wxt-dev/wxt/releases)
- [Zod releases](https://github.com/colinhacks/zod/releases)
- [Drizzle repository/releases](https://github.com/drizzle-team/drizzle-orm)
- [Better Auth releases](https://github.com/better-auth/better-auth/releases)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [PostgreSQL supported versions](https://www.postgresql.org/support/versioning/)
- [Vitest releases](https://vitest.dev/blog)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)

## Confidence assessment

| Área | Nivel | Motivo |
|---|---|---|
| Runtime/toolchain | HIGH | LTS y releases oficiales claros; TS 7 documenta explícitamente su límite de API. |
| Web/API | HIGH | React/Vite/Hono son estables; la elección SPA deriva directamente del producto autenticado y del backend obligatorio. |
| Extension | MEDIUM-HIGH | WXT está activo y Chrome APIs están documentadas, pero WXT sigue 0.x y las políticas Web Store evolucionan. |
| Database/migrations | HIGH | PostgreSQL 18.6 y el flujo de migraciones están documentados oficialmente. |
| Auth | MEDIUM-HIGH | Better Auth cubre el alcance y es portable, pero 1.7/MCP requieren spike de seguridad e interoperabilidad. |
| MCP | MEDIUM-HIGH | Spec y SDK v2 son actuales y oficiales, pero muy recientes al 2026-08-23. |
| Storage | HIGH para S3; MEDIUM para el default Compose | El contrato AWS es estable; SeaweedFS debe validarse operacionalmente y no prometer HA con `weed mini`. |
| Testing/observability | HIGH | Herramientas y límites están documentados; OTel browser se excluye por su estado experimental. |

**Conclusión:** adoptar Node 24 + React/Vite + Hono + PostgreSQL/Drizzle + Better Auth + S3 + WXT, con MCP SDK v2 y OAuth estándar. La portabilidad no se añade en una fase final: queda garantizada desde el primer corte al no importar SDKs de Supabase, no necesitar Next.js/Vercel y probar el mismo binario contra PostgreSQL y S3 reales.
