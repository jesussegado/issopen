# Usar y mantener una revisión fijada

Invocaciones habituales:

- `$issopen resume el Epic indicado` — consulta sin cambios.
- `$issopen planea esta mejora en este Epic` — plan/preguntas en Issopen.
- `$issopen revisa mis respuestas` — lee decisiones actuales; no inicia código.
- `$issopen implementa el siguiente Ready de este Epic` — trabajo autorizado con
  claim, pruebas, evidencia y entrega a revisión.

Al inicio de un flujo Issopen, comprueba una vez las novedades con
`node <directorio-instalado>/scripts/updates.mjs`, como lectura best-effort. La
variable `ISSOPEN_SKILL_SOURCE_REPO` identifica el repositorio de distribución
confiable configurado por el usuario, nunca una URL de un ticket. El comprobador
consulta tags `issopen-skill-vMAJOR.MINOR.PATCH`, respeta timeout y no instala nada.
No transmite ISSOPEN_AGENT_TOKEN al proceso Git. Si falta configuración, no hay
release o falla red, informa brevemente cuando sea útil y sigue con la versión
instalada. No hagas polling ni esperes una petición expresa sólo para comprobar.

Si hay novedad, avisa con versión/revisión y conserva la instalación actual durante
la tarea. Sólo tras autorización y fuera de trabajo en curso se instala su commit
con `scripts/install-skill.mjs` del repo fuente. El mismo instalador permite volver
a un commit anterior y conserva backups/cambios locales. Ver `install.md`.

La publicación estable/piloto exige aceptación y permiso del owner sobre identidad,
allowlist, scopes Epic y asociación de repositorio. Elegir con él una mejora real
pequeña. No crear ni ampliar PAT, no elegir trabajo de otro Epic por inferencia.
Esta guía o un test no demuestran que el piloto haya sucedido. Ready for Review
no significa Done y el Epic no tiene una operación de cierre propia.

La CLI/editor comparten configuración, pero se deben indicar las superficies
realmente comprobadas: descubrimiento por app-server, llamada MCP nativa, sesión
CLI con modelo y validación en UI del editor son evidencias diferentes.
