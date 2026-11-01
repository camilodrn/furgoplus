import { useId } from "react";
import cookies from "./legal/cookies.md?raw";

/** Audited current product inventory. Adding an optional integration requires a
 * consent gate and revocation implementation before adding it to this registry. */
export const storageTechnologies = [
  {
    id: "session",
    name: "Acceso a tu cuenta",
    purpose: "Mantiene tu sesión y aplica los permisos de tu cuenta.",
    duration: "Hasta 12 horas desde el inicio de sesión",
    technical:
      "Cookie sessionid · servidor FurgoPlus · HttpOnly · SameSite=Lax · Path=/ · sin Domain compartido",
  },
  {
    id: "csrf",
    name: "Protección de solicitudes",
    purpose: "Ayuda a impedir que otro sitio envíe solicitudes en tu nombre.",
    duration: "Hasta 52 semanas; puede renovarse al obtener la protección CSRF",
    technical:
      "Cookie csrftoken · servidor FurgoPlus · HttpOnly · SameSite=Lax · Path=/ · sin Domain compartido",
  },
  {
    id: "logout",
    name: "Cierre de sesión seguro",
    purpose:
      "Evita restaurar una sesión cuyo cierre todavía no se pudo confirmar.",
    duration: "Hasta confirmar el cierre o terminar la sesión de esta pestaña",
    technical:
      "sessionStorage · furgoplus-signed-out · aplicación FurgoPlus · marcador sin contraseñas ni tokens",
  },
] as const;

// Empty by design: no analytics, advertising or optional third-party SDK is installed.
export const optionalTechnologies: readonly { id: string; purpose: string }[] =
  [];

export function StoragePrivacy({ onPrivacy }: { onPrivacy: () => void }) {
  const policyId = useId();
  const blocks = cookies
    .trim()
    .split(/\n\s*\n/)
    .slice(1);
  return (
    <div className="storage-privacy">
      <section
        className="storage-summary"
        aria-labelledby="storage-summary-title"
      >
        <span className="storage-necessary">Solo tecnologías necesarias</span>
        <h2 id="storage-summary-title">Tu acceso, protegido</h2>
        <p>
          Usamos cookies técnicas y un marcador temporal para mantener tu sesión
          y proteger tus solicitudes.
        </p>
        <p className="storage-optional-status">
          Esta versión no utiliza analítica, publicidad ni seguimiento opcional.
          No hay preferencias opcionales que activar o rechazar.
        </p>
      </section>
      <section aria-labelledby="storage-uses-title">
        <h2 id="storage-uses-title">Qué guardamos y para qué</h2>
        <div className="storage-inventory">
          {storageTechnologies.map((item, index) => (
            <article
              className="storage-technology"
              key={item.id}
              aria-labelledby={`${policyId}-${item.id}`}
            >
              <span className="storage-purpose-icon" aria-hidden="true">
                {index === 0 ? "01" : index === 1 ? "02" : "03"}
              </span>
              <div>
                <h3 id={`${policyId}-${item.id}`}>{item.name}</h3>
                <p>{item.purpose}</p>
                <p className="storage-duration">{item.duration}</p>
                <details>
                  <summary>Detalles técnicos</summary>
                  <p>{item.technical}</p>
                  {item.id !== "logout" && (
                    <p>
                      La configuración de producción activa Secure con HTTPS; el
                      desarrollo local HTTP lo desactiva. Los atributos del
                      despliegue deben verificarse por separado.
                    </p>
                  )}
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section
        className="storage-controls"
        aria-labelledby="storage-control-title"
      >
        <h2 id="storage-control-title">Tus opciones</h2>
        <p>
          Puedes volver a esta información desde Cookies y almacenamiento, en el
          acceso o en tu cuenta. No guardamos una decisión de consentimiento
          porque no hay tecnologías opcionales.
        </p>
        <p>
          Puedes borrar el almacenamiento desde tu navegador. Esto puede cerrar
          tu sesión; no elimina tu cuenta ni los registros del servicio.
        </p>
        <button
          type="button"
          className="button button-outline"
          onClick={onPrivacy}
        >
          Leer Privacidad
        </button>
      </section>
      <details className="storage-policy">
        <summary>Información detallada y revisión legal</summary>
        <article aria-label="Información íntegra de cookies y almacenamiento">
          {blocks.map((block, index) =>
            block.startsWith("## ") ? (
              <h2 key={index}>{block.slice(3)}</h2>
            ) : (
              <p key={index}>{block.replace(/\n/g, " ")}</p>
            ),
          )}
        </article>
      </details>
    </div>
  );
}
