import type { Publication } from "./api-types";
import {
  activationSteps,
  publicationBlocker,
  type DriverDestination,
} from "./DriverExperience";

export function homeSteps(publication: Publication) {
  return activationSteps(publication).map((step) => {
    const codes = step.pending.map((item) => item.code);
    let action = step.action;
    let destination = step.destination;
    if (step.title === "Información aprobada") {
      if (
        codes.some(
          (code) =>
            code.startsWith("profile_") ||
            code === "service_contact_email_missing",
        )
      ) {
        action = "Completar datos del servicio";
        destination = "profile";
      } else if (
        codes.includes("required_document_missing") ||
        codes.includes("required_document_expired")
      ) {
        action = "Completar documentos";
        destination = "documents";
      } else action = "Revisar validación";
    }
    return {
      ...step,
      complete: publication.eligible || step.complete,
      action,
      destination,
    };
  });
}

export function homeStatus(publication: Publication) {
  const steps = homeSteps(publication);
  const account = steps.find((step) => step.title === "Estado de tu servicio");
  const next =
    account ??
    steps.find((step) => !step.complete && step.pending.length) ??
    steps.find((step) => !step.complete);
  const suspended =
    publication.profile_status === "suspended" ||
    publication.blockers.some((item) => item.code === "driver_suspended");
  return {
    steps,
    next,
    title: publication.eligible
      ? "Tu servicio está visible"
      : suspended
        ? "Servicio suspendido"
        : publication.publication_requested ||
            publication.validation_state === "pending"
          ? "Publicación pendiente"
          : "Servicio no publicado",
    explanation: publication.eligible
      ? "Los apoderados pueden encontrarte en FurgoPlus."
      : suspended
        ? "Revisa el estado con el equipo antes de volver a publicar."
        : "Resuelve los requisitos pendientes para que las familias puedan encontrarte.",
    action: publication.eligible
      ? "Ver estado de publicación"
      : (next?.action ?? "Revisar publicación"),
    destination: publication.eligible
      ? ("publication" as DriverDestination)
      : (next?.destination ?? ("publication" as DriverDestination)),
  };
}

export function HomeRequirements({
  publication,
  onNavigate,
}: {
  publication: Publication;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const { steps, next } = homeStatus(publication);
  const brief: Record<string, string> = {
    "Información aprobada":
      publication.validation_state === "pending"
        ? "El equipo está revisando tu información."
        : "Datos, documentos y revisión del servicio.",
    "Plan vigente": "Revisa la vigencia del plan con el equipo.",
    "Ruta activa y completa":
      "Necesitas una ruta con horario, destino, cupos y cobertura.",
    "Solicitud de publicación": "Indica que quieres aparecer en la búsqueda.",
    "Estado de tu servicio": "Revisa las condiciones de tu cuenta y servicio.",
  };
  return (
    <ol
      className="home-requirements"
      aria-label="Pasos para aparecer en FurgoPlus"
    >
      {steps.map((step) => (
        <li
          key={step.title}
          className={step.complete ? "step-complete" : "step-pending"}
        >
          <span
            className={`step-marker ${step.complete ? "home-complete" : ""}`}
            aria-hidden="true"
          >
            {step.complete ? "✓" : "○"}
          </span>
          <div>
            <div className="home-requirement-heading">
              <h3>{step.title}</h3>
              <span>{step.complete ? "Completado" : "Pendiente"}</span>
            </div>
            {!step.complete && <p>{brief[step.title]}</p>}
            {!step.complete && step.title !== next?.title && onNavigate && (
              <button
                type="button"
                className="button button-link"
                onClick={() => onNavigate(step.destination)}
              >
                {step.action}
              </button>
            )}
            <details>
              <summary>Ver detalles de {step.title.toLowerCase()}</summary>
              {step.pending.length ? (
                <ul>
                  {step.pending.map((item) => (
                    <li key={item.code}>{publicationBlocker(item)}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  {step.complete
                    ? "Este requisito está confirmado en el estado actual del servicio."
                    : "Consulta el estado del servicio para completar este requisito."}
                </p>
              )}
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}
