---
type: quick
mode: inline
date: 2026-09-16
tickets: [97, 98, 107]
---

# Correo de Gremiox y piloto Google

Decisión explícita del propietario: reutilizar por ahora el correo configurado
en Gremiox. El propietario realizará la prueba Google; entregar los pasos.
No modificar Gremiox, sus cuentas, DNS o envíos; no elegir destinatarios reales.
GSD quick se ejecuta inline con el CLI existente (gsd-sdk no está instalado).

## Tareas

1. Verificar configuración SMTP existente y autenticación TLS sin enviar correo.
   Leer sólo los campos necesarios, mantener credenciales fuera de Git/salidas.
   Examinar el provisionado soportado por GitOps y conservar secretos actuales.
2. Preparar configuración privada independiente para Issopen y publicación de
   privacidad antes de activar envíos. Provisionar únicamente con el mecanismo
   autorizado, sin sobrescribir Secrets existentes. Desplegar configuración e
   imagen por GitOps si la validación y el proveedor lo permiten; si falla una
   credencial/proveedor, mantener el correo deshabilitado y explicar el bloqueo.
3. Documentar prueba humana paso a paso: proyecto sintético, invitación por el
   Owner, otra cuenta Google, verificación explícita, aislamiento y evidencias
   sin secretos. Actualizar tickets y STATE sin dar por aceptado el piloto.

## Verificación

- SMTP verify con TLS validado no equivale a entrega de un correo.
- Credenciales y clave independiente sólo en ficheros privados ignorados 0600.
- Pruebas proporcionales a cambios; secret scan y diff check antes de commits.
- Cualquier despliegue: revisión/digest real, Argo Healthy/Synced, readiness y
  persistencia intacta. No cambiar permisos reales, revisor Store o datos.
- 97/98/107 conservan pendiente la evidencia externa que no hayamos observado.

## Ajuste descubierto durante la verificación

El smoke público móvil detectó que el grid del PublicShell heredaba el mínimo
de620px de la tabla y ensanchaba toda la página. Se añade una regresión E2E
desktop/móvil (incluye viewport y scroll local) y un arreglo acotado al grid y
su panel antes de repetir la entrega. No cambia el transporte ni los permisos.
