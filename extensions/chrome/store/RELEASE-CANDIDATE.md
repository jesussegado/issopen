# Release candidate 0.6.2

Estado: fuente preparada para generar el primer candidato Unlisted. El ZIP,
su SHA-256 y la procedencia exacta se crean desde un commit limpio con
`pnpm extension:release`; los artefactos quedan fuera de Git.

## Inventario auditado

- Manifest V3, Chrome 116 o posterior e incógnito deshabilitado.
- `sidePanel`: presenta el compositor de Issopen.
- `identity`: abre y recibe el OAuth PKCE de una instalación.
- `storage`: guarda sesión de instalación y preferencias locales.
- `clipboardRead`, opcional: se solicita únicamente al pulsar **Pegar imagen**.
- `https://issopen.serviciosegado.com/*`: único host; API, OAuth y enlaces al
  ticket de la instancia elegida.
- Iconos PNG exactos de 16, 48 y 128 px para manifest y toolbar.
- CSP sin `unsafe-*`, código remoto, `eval`, `new Function` ni scripts externos.
- Sin `activeTab`, `scripting`, `tabs`, `cookies`, `all_urls`, content scripts,
  código de captura, sourcemaps, fixtures, secretos o archivos no previstos.

El gate falla si el manifest, los tamaños, la lista de archivos o cualquiera
de estas fronteras cambia. Dos builds del mismo commit deben producir el mismo
árbol y el mismo SHA-256 del ZIP determinista.

## Compatibilidad de API

| Extensión | Servidor | Resultado seguro |
| --- | --- | --- |
| 0.6.2 | API v1 actual con `session.maxImages` | Hasta cinco imágenes; Owner/Member según membership; borrador e idempotencia completos. |
| 0.6.2 | API v1 anterior sin `session.maxImages` | Fallback a una imagen; no cambia ni reenvía automáticamente un borrador pendiente. |
| 0.6.2 | API ausente o versión incompatible | Error de versión/conexión visible; conserva el borrador y exige reintento humano. |
| 0.5.x/0.6.1 | API v1 actual | Sigue aceptada durante la actualización; `ownerId` permanece como alias transitorio. |

Servidor primero para cambios aditivos. Chrome no garantiza downgrade: el
rollback de extensión es una versión superior construida desde el código
anterior compatible. Nunca borrar datos o revocar invitaciones para resolver
una incompatibilidad de interfaz.

## Verificación del artefacto

```bash
git status --short                 # debe estar vacío
pnpm extension:release
cd extensions/chrome/.output/releases
sha256sum -c issopen-chrome-0.6.2-*.zip.sha256
unzip -l issopen-chrome-0.6.2-*.zip
```

El JSON contiguo registra versión, commit completo, API, número de archivos,
SHA-256, distribución y resultado del audit. El dashboard debe aceptar ese ZIP
sin modificarlo; subir otros bytes exige otra versión.
