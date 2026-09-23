# Ticket 134 — Resumen

## Resultado

- PostgreSQL aislado, runtime/Member HTTP, MCP y OAuth Chrome tienen drivers
  pequeños por frontera.
- Las suites declaran sus propios actores, tablas, proyectos y grants.
- La ejecución conjunta de las cuatro suites demuestra que no comparten estado.
- El test de arquitectura evita regresar a SQL de reset copiado.
- Un fallo Git intencional ya no imprime un `fatal` en una suite correcta.

## Evidencia local

- Código: `81ed567`.
- Cuatro suites objetivo juntas: 64 tests: PASS.
- Integración completa: 22 ficheros, 118 tests: PASS.
- Unit/web: 46 ficheros, 212 tests: PASS.
- Caracterización: 76 tests: PASS.
- Lint, tipos, build, secret scan y 42 tablas sin drift: PASS.

## Producción

- Imagen `refactor-fixtures-aa1f88e`, digest
  `sha256:84c7a5b328d3c0a6e30187218c202af6eb1d2392c86f844fb9511635cc052aa8`.
- GitOps `1ba1d3cbd357e636987dc42542a04a719f6edae3`; Kustomize y 140 tests
  PASS. Una carrera ajena del socket Unix falló la primera ejecución; el caso
  aislado y la suite completa posterior pasaron sin modificar ese componente.
- Argo CD: revisión exacta, Synced y Healthy.
- Pod de aplicación Ready, 0 reinicios y digest exacto.
- `/health/ready` devuelve `{"status":"ok"}` y `/` devuelve 200.
- PVC PostgreSQL `cf93e0a7-b978-46c2-9c03-c77f902742b9` y attachments
  `c40b0035-0433-436f-91c4-feff7a20e754` siguen Bound y conservan volumen.
