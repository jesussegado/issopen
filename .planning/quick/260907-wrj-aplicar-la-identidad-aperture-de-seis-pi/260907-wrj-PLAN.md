---
mode: quick
task: 260907-wrj
status: complete
---

# Aplicar la identidad elegida a Issopen

## Decisiones autorizadas

El propietario aprueba la variante 07 de seis piezas y solicita usar su logo,
favicon y dos verdes en toda la web, con una decisión de diseño persistente.
Se mantiene la interfaz clara, semántica y responsive; la autorización cubre
esta implementación visual. Se ejecuta GSD quick en el agente actual.

## Tareas

1. Documentar la identidad y paleta en `docs/design/0001-brand-identity.md`,
   enlazar desde AGENTS/README y actualizar el contrato UI previo que pedía
   texto sin logo y azul. Promover una copia exacta de la variante elegida a un
   asset canónico y usarla en cabeceras pública/privada, favicon y touch icon.
2. Centralizar paleta y estados en `styles.css`: bosque `#027067`, menta
   `#6fd9b5`, fondos y neutros derivados, hover/active/focus/selección,
   controles nativos, progreso y estados semánticos. Corregir las referencias
   de color primario sin token definido. Mantener avisos y errores legibles.
3. Verificar contraste, carga real del favicon y logo, navegación móvil y
   desktop, login, tablero, detalle, Epics, agentes y consentimiento. Ejecutar
   lint, typecheck, suite y build del repositorio y validación de workspace.
   Guardar evidencia visual con datos sintéticos y commits locales separados
   del control plane. Esta tarea no incluye publicar ni desplegar.

## Criterios de aceptación

- Logo canónico idéntico al PNG aprobado, con seis piezas y los dos verdes.
- Cabeceras y favicon usan ese asset, servido con tipo de imagen correcto.
- Verde oscuro para acciones y enlaces; menta para acentos y selección con
  texto más oscuro. Texto normal ≥4.5:1 y límites de controles ≥3:1.
- Todos los estados visuales usan tokens definidos y conservan etiquetas,
  foco y comportamiento. La página no desborda en móvil.
- Decisión canónica localizable; código y documentación previa coherentes.
- Validaciones y límites registrados; sin cambios en datos ni GitOps.
