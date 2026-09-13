import { PublicShell } from "../components/Shell.js";
import { AppLink, PageHeading } from "../components/ui.js";

const supportEmail = "serviciosegado@gmail.com";

export function ChromeExtensionRoute() {
  return (
    <PublicShell>
      <article className="public-product-page">
        <p className="eyebrow">Extensión de Chrome · piloto por invitación</p>
        <PageHeading>Issopen para Chrome</PageHeading>
        <p className="public-product-lead">
          Convierte las imágenes que eliges en tickets de Issopen, directamente
          desde el panel lateral del navegador.
        </p>
        <div className="public-feature-grid">
          <section>
            <h2>De una imagen a un ticket</h2>
            <p>
              Pega un recorte o selecciona hasta cinco imágenes, elige proyecto
              y Epic y completa el ticket sin abandonar la pestaña.
            </p>
          </section>
          <section>
            <h2>Tú decides cuándo enviar</h2>
            <p>
              El borrador permanece local hasta que pulsas «Enviar ticket». La
              extensión no lee páginas, historial, formularios ni cookies.
            </p>
          </section>
          <section>
            <h2>Acceso limitado</h2>
            <p>
              Sólo las personas invitadas pueden vincular la extensión y sólo
              ven los proyectos que tienen asignados.
            </p>
          </section>
        </div>
        <p className="status-banner">
          La distribución inicial será Unlisted: necesitarás el enlace de Chrome
          Web Store y una invitación válida de Issopen.
        </p>
        <div className="page-actions">
          <AppLink className="button button-primary" href="/sign-in">
            Entrar en Issopen
          </AppLink>
          <AppLink className="button button-secondary" href="/support">
            Ayuda y soporte
          </AppLink>
          <AppLink className="button button-secondary" href="/privacy">
            Privacidad y datos
          </AppLink>
        </div>
      </article>
    </PublicShell>
  );
}

export function SupportRoute() {
  return (
    <PublicShell>
      <article className="public-product-page">
        <p className="eyebrow">Soporte de Issopen</p>
        <PageHeading>Ayuda para la extensión de Chrome</PageHeading>
        <p>
          Si la instalación, el acceso o el envío de un ticket no funciona,
          escribe a <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. No
          envíes contraseñas, tokens, códigos de recuperación ni imágenes
          sensibles por correo.
        </p>
        <section>
          <h2>Antes de contactar</h2>
          <ol>
            <li>Comprueba que puedes entrar en la web de Issopen.</li>
            <li>
              Abre Cuenta en la extensión y revisa que la instalación siga
              conectada y que aparezca tu proyecto.
            </li>
            <li>
              Si el acceso fue retirado, pide al owner una invitación nueva y
              vuelve a conectar la instalación.
            </li>
            <li>
              Conserva el mensaje de error visible y la versión de la extensión;
              no adjuntes datos privados que no sean necesarios.
            </li>
          </ol>
        </section>
        <section>
          <h2>Privacidad y eliminación</h2>
          <p>
            Puedes descartar el borrador antes de enviarlo, revocar la
            instalación desde Issopen y eliminar una imagen enviada desde el
            ticket si la subiste tú o eres owner. Consulta el alcance exacto en
            la <AppLink href="/privacy">política de privacidad y datos</AppLink>
            .
          </p>
        </section>
        <div className="page-actions">
          <AppLink className="button button-primary" href="/chrome">
            Volver a Issopen para Chrome
          </AppLink>
          <AppLink className="button button-secondary" href="/sign-in">
            Entrar en Issopen
          </AppLink>
        </div>
      </article>
    </PublicShell>
  );
}
