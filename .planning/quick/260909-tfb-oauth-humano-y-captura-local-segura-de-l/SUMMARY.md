# Chrome Epic — progreso del corte

## 21 / OAuth humano

Implementado y verificado localmente: instalación pública individual, PKCE S256,
consentimiento, cuenta/proyectos en panel, renovación y revocación web/panel.
Access 300 s y caducidad absoluta 30 días; API humana separada de agentes.
Sin migraciones, nuevos Secrets, PVC ni cambios de permisos agenticos.

`pnpm validate`: 75 tests unit/web, 44 de integración, 8 E2E web/Chrome reales
(2 skips móviles previstos), 32 unitarios de extensión y 2 E2E de manifiesto y
acción real de toolbar. Lint/tipos/build y secretos pasan. Dos builds 0.2.0
reproducibles, 7 archivos, árbol SHA-256
`c7ab34f9439cead489f1b5bb2ae539255264966b39bdca669fe1c5b291cdd4bb`.

Producción: pendiente de publicación y comprobación GitOps en este punto.
Siguiente bloque: captura local, tickets 23/24/25. No se declara 22–33 completos.
La skill 43 sigue cerrada y no se inicia la distribución/piloto 44.
