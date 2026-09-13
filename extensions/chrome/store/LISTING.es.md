# Ficha Chrome Web Store — Issopen

Estado: fuentes del borrador 0.6.2. Copiar estos valores al dashboard sólo
desde la cuenta `serviciosegado@gmail.com`. No guardar credenciales ni datos de
pago en el repositorio.

## Store listing

- Nombre: `Issopen`
- Resumen: `Pega o sube imágenes y crea tickets en tus proyectos y Epics de Issopen.`
- Idioma principal: `Español`
- Categoría: `Productividad > Trabajo y planificación`
- Visibilidad: `Unlisted`
- Regiones: `Todas las regiones`
- Homepage: `https://issopen.serviciosegado.com/chrome`
- Soporte: `https://issopen.serviciosegado.com/support`
- Privacidad: `https://issopen.serviciosegado.com/privacy`
- Contenido para adultos: `No`

Descripción detallada:

> Issopen convierte las imágenes que eliges en tickets de un proyecto
> autorizado, directamente desde el panel lateral de Chrome.
>
> Pega un recorte o selecciona hasta cinco imágenes, elige proyecto y Epic,
> añade título, descripción, prioridad y estado y revisa el borrador antes de
> enviarlo. Nada se transmite hasta que pulsas «Enviar ticket».
>
> La extensión está pensada para equipos invitados a una instancia privada de
> Issopen. Cada persona se identifica en la web y sólo recibe los proyectos que
> tiene asignados. No lee páginas, historial, cookies ni formularios, y no
> captura la pantalla.
>
> La primera distribución es Unlisted y requiere tanto el enlace de instalación
> como una invitación válida de Issopen.

Assets reproducibles en `store/assets`:

- `store-icon-128.png`: icono PNG 128×128 con arte 96×96 y padding transparente.
- `promo-small-440x280.png`: promo PNG sin claims textuales.
- `screenshot-composer-1280x800.png`: flujo real de imágenes y composición.
- `screenshot-account-1280x800.png`: cuenta, acceso y ayuda de privacidad.
- `assets.json`: dimensiones, tamaño y SHA-256 de cada recurso.

## Privacy practices

Propósito único:

> Permitir que una persona invitada pegue o seleccione imágenes, revise un
> borrador y cree un ticket en un proyecto Issopen autorizado desde el panel
> lateral de Chrome.

Remote code: `No, I am not using remote code.` Todo JavaScript ejecutable viaja
dentro del ZIP; HTTPS se usa sólo para API y OAuth de la instancia Issopen.

Justificación de permisos:

| Permiso | Texto para el dashboard |
| --- | --- |
| `sidePanel` | Muestra el compositor de imágenes y tickets en el panel lateral iniciado por la persona. |
| `identity` | Abre el flujo OAuth PKCE de Issopen y devuelve la autorización a esta instalación sin exponer la contraseña a la extensión. |
| `storage` | Conserva localmente la conexión revocable, preferencias y un borrador de hasta 24 horas. |
| `clipboardRead` (opcional) | Se solicita únicamente tras pulsar «Pegar imagen» para leer una imagen elegida del portapapeles. No se usa en segundo plano. |
| `https://issopen.serviciosegado.com/*` | Limita OAuth y API al único backend Issopen usado para proyectos, Epics y envío explícito del ticket. |

Tipos de datos que deben declararse:

- Información de identificación personal: nombre, email e identificadores de
  la cuenta autenticada.
- Información de autenticación: tokens revocables de esta instalación; nunca
  contraseña de Google o Issopen.
- Contenido del sitio web: categoría del dashboard usada para los campos del
  ticket e imágenes aportados explícitamente; no hay una categoría independiente
  de contenido generado por el usuario en el formulario observado. Esta
  declaración no significa que la extensión lea páginas.
- No marcar historial, actividad de navegación, datos de
  formularios, comunicaciones personales, ubicación, salud o finanzas: esta
  versión no los obtiene.

Certificar las declaraciones Limited Use y enlazar la política pública. Las
declaraciones deben coincidir con el manifest del ZIP que se suba, no con una
versión futura.

## Instrucciones privadas para revisión

No almacenar aquí una cuenta o invitación temporal. En el campo privado del
dashboard explicar:

1. instalar y abrir Issopen desde el icono de la barra;
2. pulsar **Conectar con Issopen**;
3. autenticarse en la web con la identidad de revisión proporcionada;
4. autorizar la instalación y volver al panel;
5. seleccionar el proyecto de revisión, pegar/subir una imagen de prueba y
   pulsar **Enviar ticket**;
6. abrir el ticket creado y, al terminar, desconectar la instalación.

El acceso enviado usa un Member local aislado, sin Google ni 2FA del revisor.
Seguir [el procedimiento de revisión](../../../docs/chrome-review-access.md),
incluida su retirada explícita al terminar. La respuesta posterior de 86 pide
Google de pruebas: aclarar y verificar cualquier sustituto antes del relevo.

## Checkpoint externo

Registro/pago completados por el propietario y correo verificado. Item
`eohpecaogeelnicbpeedjdganacfknok`, 0.6.2, enviado el 13/09/2026: Pendiente de
revisión, Sin mostrar y publicación diferida. No volver a subir el mismo ZIP
ni afirmar que la aceptación del paquete equivale a aprobación de políticas.
