import { PublicShell } from "../components/Shell.js";
import { PageHeading } from "../components/ui.js";

const privacyEmail = "serviciosegado@gmail.com";

export function PrivacyRoute() {
  return (
    <PublicShell>
      <article className="privacy-notice">
        <p className="eyebrow">Versión 1.1 · vigente desde 15/09/2026</p>
        <PageHeading>Privacidad y datos de Issopen</PageHeading>
        <p>
          Issopen es un gestor privado de tickets. Su extensión de Chrome tiene
          una única finalidad: permitirte elegir o pegar imágenes, revisarlas y
          crear un ticket en un proyecto al que ya tienes acceso. Esta política
          cubre la web y la extensión de esta instancia.
        </p>

        <section aria-labelledby="privacy-controller">
          <h2 id="privacy-controller">Responsable y contacto</h2>
          <p>
            La instancia está operada por Servicio Segado. Para acceder,
            corregir o solicitar la eliminación de tus datos, escribe a{" "}
            <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. Incluye la
            cuenta de Issopen afectada, pero nunca envíes contraseñas, tokens ni
            imágenes sensibles por correo.
          </p>
        </section>

        <section aria-labelledby="privacy-data">
          <h2 id="privacy-data">Qué datos tratamos y durante cuánto tiempo</h2>
          <div className="privacy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Datos</th>
                  <th>Finalidad y almacenamiento</th>
                  <th>Retención y control</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Cuenta e identidad</th>
                  <td>
                    Nombre, email verificado, avatar e identificadores de
                    cuenta. Se guardan en PostgreSQL para autenticar,
                    invitaciones, permisos y atribución. Google recibe el flujo
                    de autenticación; Issopen no solicita acceso a Drive, Gmail
                    ni otros datos de Google.
                  </td>
                  <td>
                    Las sesiones caducan o se revocan. La cuenta y su historial
                    se conservan mientras sean necesarios para operar y auditar
                    el workspace. El owner puede retirar una membresía; para
                    borrar o corregir la cuenta, usa el contacto anterior.
                  </td>
                </tr>
                <tr>
                  <th>Perfil compartido</th>
                  <td>
                    Puedes editar tu nombre y elegir un avatar local desde
                    Cuenta. La imagen se prepara como PNG de hasta 128×128
                    píxeles y 96 KiB, sin metadatos auxiliares, y se guarda en
                    PostgreSQL sólo al pulsar «Save profile». No cargamos URLs
                    externas de avatar. El directorio de cada proyecto muestra
                    nombre, rol, permiso y avatar a sus colaboradores actuales;
                    no muestra emails ni identificadores del proveedor de login.
                  </td>
                  <td>
                    Se conserva sólo el avatar actual. «Remove avatar» seguido
                    de «Save profile» lo retira de la base activa; backups y
                    copias previas pueden conservarlo. Cambiar el nombre no
                    reescribe la atribución histórica ni cambia el email de
                    acceso. Retirar acceso a un proyecto bloquea nuevas
                    consultas a su directorio e imágenes, pero no borra copias
                    ya vistas o descargadas.
                  </td>
                </tr>
                <tr>
                  <th>Conexión de Chrome</th>
                  <td>
                    Nombre e identificador de instalación, scopes OAuth y tokens
                    de acceso/renovación. Los tokens de esa instalación
                    permanecen en <code>chrome.storage.local</code> y su estado
                    autorizado en Issopen.
                  </td>
                  <td>
                    El acceso dura 5 minutos y la vinculación hasta 30 días.
                    Puedes desconectarla desde la extensión o revocarla en{" "}
                    <a href="/extensions">Extensiones conectadas</a>; revocar
                    invalida también la renovación.
                  </td>
                </tr>
                <tr>
                  <th>Tickets y colaboración</th>
                  <td>
                    Proyecto, Epic, título, descripción, prioridad, estado,
                    preguntas, respuestas, comentarios, enlaces y actividad. Se
                    guardan en PostgreSQL para prestar y auditar el servicio.
                  </td>
                  <td>
                    Se conservan mientras el workspace los necesita. El borrado
                    web de un ticket lo oculta y bloquea su acceso, pero hoy es
                    lógico: su contenido y auditoría pueden permanecer en el
                    almacenamiento activo y backups. Solicita borrado permanente
                    mediante el contacto anterior.
                  </td>
                </tr>
                <tr>
                  <th>Imágenes elegidas por ti</th>
                  <td>
                    Hasta cinco imágenes pegadas o subidas explícitamente. El
                    navegador las normaliza a PNG y el servidor elimina
                    metadatos auxiliares antes de guardarlas en un volumen
                    privado; PostgreSQL conserva sólo su referencia e
                    integridad.
                  </td>
                  <td>
                    Antes de enviar forman parte de un borrador local con un
                    máximo de 24 horas desde el último cambio. Tras enviar,
                    permanecen con el ticket. Quien subió una imagen o el owner
                    puede eliminarla permanentemente desde el ticket. Esto la
                    retira del almacenamiento activo, no de copias ya
                    descargadas ni de backups previos del operador.
                  </td>
                </tr>
                <tr>
                  <th>Seguridad y operación</th>
                  <td>
                    Identificadores técnicos, hashes de idempotencia, recibos de
                    operaciones y errores sin payload sensible. Issopen no
                    registra el contenido de imágenes, tokens ni contraseñas en
                    sus logs de aplicación.
                  </td>
                  <td>
                    La idempotencia MCP caduca a las 24 horas. Los recibos de
                    Chrome y la actividad se conservan para evitar duplicados y
                    mantener la auditoría. Los logs del contenedor rotan por la
                    configuración de la plataforma; Issopen no crea una copia
                    analítica adicional.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="privacy-boundary">
          <h2 id="privacy-boundary">Cuándo se transmiten los datos</h2>
          <ul>
            <li>
              La extensión no lee la página, el historial, las cookies, los
              formularios ni el portapapeles en segundo plano.
            </li>
            <li>
              El permiso opcional de portapapeles se solicita sólo al pulsar
              «Pegar imagen». Subir o pegar no envía nada todavía.
            </li>
            <li>
              Los campos y las imágenes seleccionadas se transmiten por HTTPS
              únicamente cuando pulsas «Enviar ticket».
            </li>
            <li>
              La app usa Google para autenticar y Cloudflare para transporte y
              protección de la instancia. No vende datos, no incluye publicidad
              ni comparte datos con brokers.
            </li>
          </ul>
        </section>

        <section id="limited-use" aria-labelledby="privacy-limited-use">
          <h2 id="privacy-limited-use">Uso limitado</h2>
          <p>
            El uso de información recibida de las APIs de Google cumple la
            política de datos de usuario de Chrome Web Store, incluidos sus
            requisitos de Limited Use. Sólo usamos los datos necesarios para
            autenticarte y prestar la finalidad única descrita; no se usan para
            publicidad personalizada, evaluación crediticia ni venta de datos.
            Una persona sólo accede al contenido cuando lo requiere la propia
            colaboración del workspace, una solicitud concreta de soporte, la
            seguridad del servicio o una obligación legal.
          </p>
          <p lang="en">
            Issopen&apos;s use of information received from Google APIs will
            adhere to the Chrome Web Store User Data Policy, including the
            Limited Use requirements.
          </p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">Tus decisiones y derechos</h2>
          <p>
            Puedes no adjuntar imágenes, quitar cualquiera antes de enviar,
            descartar el borrador local, revocar una instalación y eliminar del
            almacenamiento activo una imagen ya enviada. También puedes pedir
            acceso, rectificación, oposición, limitación, portabilidad o
            supresión por email. Verificaremos la identidad y responderemos
            según la normativa aplicable. Si resides en la UE, puedes acudir a
            tu autoridad de protección de datos.
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">Cambios en esta política</h2>
          <p>
            La versión y fecha aparecen al inicio. Un cambio material sobre los
            datos tratados se mostrará antes de aplicarlo y, cuando proceda,
            requerirá una nueva decisión. Esta descripción operativa no
            sustituye asesoramiento jurídico.
          </p>
        </section>
      </article>
    </PublicShell>
  );
}
