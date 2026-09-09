# Chrome Epic — OAuth humano y captura local

Entrada GSD `init quick`, 2026-09-09. El propietario pide continuar los tickets
del Epic de Chrome y mantiene la autorización de desplegar cambios verificados.
Canon: Epic `ca26c29b-43ac-4ca0-b768-594d6779d6e7`; releído: 19/20 en revisión,
21–33 pendientes, ninguna pregunta bloqueante sin respuesta. No iniciar 44 ni
reabrir 43. Este plan deriva del Epic aprobado, no cierra fases históricas.

## Secuencia verificable

1. 21: vincular cada instalación mediante el proveedor Better Auth existente,
   código PKCE S256, state aleatorio, callback Chromium exacto. Cliente público
   distinto por instalación, consentimiento humano, permisos de recurso humano
   separados de MCP; acceso corto, renovación y caducidad absoluta de 30 días.
   Panel con conectar/desconectar, web con listado y revocación individual.
   Nada de contraseñas, tokens de agente ni credenciales en mensajes al panel.
2. Comprobar login/denegación, verificador erróneo, replay, aislamiento de
   audiencia/usuario, renovación, expiración y revocación en PostgreSQL real;
   probar Chrome real antes de declarar 21 listo.
3. Continuar las capacidades independientes 23/24/25: captura explícita,
   selección, saneado y previsualización/redacción locales. Sin subida
   automática ni persistencia de imágenes originales. Releer cada ticket al
   empezar; no etiquetar completos los criterios aún pendientes.
4. Conectar el corte de envío 22/26/27/28 sólo con almacenamiento privado,
   validación e idempotencia comprobados. Las migraciones/persistencia requieren
   compatibilidad, backup y rollback, además de cambios GitOps separados.
5. Por bloque: tests/lint/tipos, evidencia y estados en Issopen. Release fuente
   inmutable + GitOps cuando cambie servidor, extensión unpacked independiente.

## Contrato de vinculación

- Usar `chrome.identity.launchWebAuthFlow`, sin OAuth de Google ni secreto de
  cliente embebido. La página propia de vinculación registra un cliente público
  después del login; Better Auth sigue emitiendo/verificando el código OAuth.
- Cada instalación tiene nombre, propietario y fecha máxima; revocar una no
  desconecta otras ni cambia scopes de los agentes existentes.
- API humana dedicada; no ampliar las rutas owner-cookie ni relajar CSRF.
- Credenciales sólo en almacenamiento local de extensión limitado a contextos
  confiables; nunca chrome.storage.sync, content scripts, URL de web o logs.
- UI HTML en español, marca aprobada, controles accesibles a 320 px, errores
  accionables. Cancelar o fallo de red no anuncia una conexión completada.

Fuentes consultadas: documentación oficial Better Auth MCP/OAuth Provider y
Chrome Identity, contrastada con la cohorte instalada 1.7.2.
