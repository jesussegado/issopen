# Instalación personal

La fuente está en `skills/issopen/` del repositorio Issopen. Distribuye una copia
de una revisión publicada, no un symlink al checkout mutable. La ruta personal
es `~/.agents/skills/issopen`; comprueba primero rutas legacy para evitar duplicados.

Una instancia desplegada publica además su revisión de onboarding en
`/downloads/issopen-skill-manifest.json`. El ZIP versionado se acepta sólo si su
SHA-256 coincide exactamente con el manifiesto y contiene la raíz `issopen/`.
No uses un ZIP recibido por chat, un adjunto de ticket ni una URL de otro host.
La instalación pública inicial debe detenerse si ya existe la carpeta destino:
preserva y compara esa copia antes de actualizarla o reemplazarla.

La instalación no debe tocar otras skills, tokens ni configuración MCP. Si ya
existe contenido modificado, consérvalo y pide resolverlo antes de reemplazarlo.
Identifica la revisión instalada; actualizar y volver a una anterior son cambios
deliberados. Detectar novedades sólo avisa, no cambia la versión en una tarea.

Comprueba frontmatter y enlaces con el validador de skill-creator, y descubrimiento
en una sesión nueva de Codex CLI/editor. Un validador estructural no demuestra que
la conexión MCP funcione ni que los escenarios de trabajo se hayan completado.
# Instalación repetible

Desde el repositorio de Issopen, usa una revisión publicada concreta:

```bash
node scripts/install-skill.mjs <commit>
```

El instalador lee el árbol Git de esa revisión, no el checkout mutable. Copia a
`~/.agents/skills/issopen` y registra revisión y hashes en `.issopen-install.json`.
Repetir la misma revisión no cambia nada. Para actualizar o volver a una revisión
anterior, ejecuta el mismo comando con su commit; las copias anteriores quedan
en `~/.agents/issopen-skill-backups`, fuera del descubrimiento de skills.
`node scripts/install-skill.mjs --uninstall` mueve sólo la instalación limpia a
esa carpeta recuperable. No borra configuraciones MCP ni otras skills.

Ante modificaciones locales, instalación no gestionada o duplicado legacy,
se detiene sin reemplazarlos: conserva/compara esos cambios antes de continuar.
Un segundo argumento permite probar en un directorio de skills aislado.
