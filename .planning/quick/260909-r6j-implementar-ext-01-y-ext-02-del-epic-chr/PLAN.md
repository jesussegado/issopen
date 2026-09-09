# Chrome Epic — primer corte EXT-01 + EXT-02

Estado: aprobado por el propietario el 2026-09-09; ejecución secuencial.
Entrada GSD: `init quick` → `260909-r6j`. Canon: Epic
`ca26c29b-43ac-4ca0-b768-594d6779d6e7`, tickets 19–33 en Issopen.

## Autorización y precedencia

El propietario solicita desarrollar el Epic de Chrome y aprueba las opciones
recomendadas de sus 16 preguntas pendientes. Se conserva su respuesta previa
«Crear proyecto y Epic». No se inventan respuestas ni se amplían permisos MCP:
las decisiones explícitas se registran por el flujo web del propietario y las
mutaciones de trabajo mediante la identidad de agente.

Este corte prioriza explícitamente el Epic de Chrome frente al orden histórico
del roadmap. No declara completadas las fases 1–4, la aceptación de ChatGPT ni
la distribución/piloto de la skill (44). El 43 sigue cerrado por el propietario.

## Tareas y verificación

1. EXT-01 / 19: releer preguntas, conservar respuestas existentes, registrar
   las aprobadas y concretar flujo, cancelación, errores, dependencias y límites
   en `docs/chrome-extension.md`. Verificar las 17 respuestas vía MCP antes de
   mover el alcance a revisión.
2. EXT-02 / 20: workspace `extensions/chrome`, WXT MV3 + React/TypeScript,
   service worker, panel lateral y script inyectado sólo bajo permiso activeTab.
   Mensajes versionados y validados; ninguna petición a Issopen ni captura de
   DOM, imagen, valores de formularios o credenciales en este primer corte.
3. Pruebas: contratos y permisos con casos negativos; build productivo
   reproducible sin sourcemaps; carga real en Chromium, panel, gesto de usuario,
   comunicación con pestaña permitida, error antes del permiso y páginas
   restringidas. Typecheck, lint, regresión web/servidor y escaneo de secretos.
4. README de instalación unpacked, AGENTS local y evidencia de verificación.
   Registrar evidencia y estados por ticket en Issopen; sólo revisión, no Done
   automático. No desplegar servidores por un artefacto exclusivamente local.

## Contrato UI de este corte

- Panel vertical de 320 px o más, sin scroll horizontal; semántica HTML nativa,
  idioma español, foco visible, controles ≥44 px y estados anunciados.
- Reutiliza símbolo de seis piezas y tokens bosque/menta de diseño 0001.
- Muestra claramente «Base de desarrollo»: aún no conecta ni crea tickets.
- Acción «Comprobar página» precedida por explicación de datos consultados
  (origen de la página, viewport y DPR; no rutas, query, fragmentos ni título).
- Resultado reemplazable y borrable, nunca almacenado; error accionable si falta
  permiso o la página está restringida. No solicitudes de permisos globales.
- Las capacidades futuras no se presentan como botones que aparenten funcionar.

## Fuera del primer corte, dentro del Epic

OAuth PKCE humano, adjuntos privados, modos de captura, selección/saneado DOM,
redacción irreversible, composición con alta de proyecto y Epic, borradores,
reintentos y aceptación end-to-end: tickets 21–33. No cerrar el Epic con un
scaffold. Chrome primero; no afirmar Edge/Brave sin pruebas reales.
