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
    if (step.title === "Datos y documentos") {
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
      }
    }
    if (
      step.title === "Ruta y publicación" &&
      (codes.includes("active_route_missing") ||
        publication.active_route_count === 0)
    ) {
      action = "Configurar una ruta";
      destination = "routes";
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
  const waiting = (step: (typeof steps)[number]) =>
    step.title === "Revisión del equipo" &&
    publication.validation_state === "pending";
  const next =
    steps.find((step) => !step.complete && !waiting(step)) ??
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
  currentDestination,
}: {
  publication: Publication;
  onNavigate?: (destination: DriverDestination) => void;
  currentDestination?: DriverDestination;
}) {
  const { steps } = homeStatus(publication);
  const brief: Record<string, string> = {
    "Datos y documentos": "Completa la información de tu servicio.",
    "Revisión del equipo":
      publication.validation_state === "pending"
        ? "El equipo está revisando tu información."
        : publication.validation_state === "rejected"
          ? "Revisa las observaciones del equipo."
          : "Envía tu información al equipo para revisión.",
    "Plan vigente": "Revisa la vigencia del plan con el equipo.",
    "Ruta y publicación":
      "Prepara una ruta e indica que quieres aparecer en la búsqueda.",
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
              <span>
                {step.complete
                  ? "Completado"
                  : step.title === "Revisión del equipo" &&
                      publication.validation_state === "pending"
                    ? "En revisión"
                    : "Pendiente"}
              </span>
            </div>
            {!step.complete && <p>{brief[step.title]}</p>}
            {!step.complete &&
              step.destination !== currentDestination &&
              onNavigate && (
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

export function ServicePreparation({
  publication,
  onNavigate,
  currentDestination,
}: {
  publication: Publication;
  onNavigate?: (destination: DriverDestination) => void;
  currentDestination?: DriverDestination;
}) {
  const { steps } = homeStatus(publication);
  const complete = steps.filter((step) => step.complete).length;
  return (
    <details
      className="panel activation-section service-preparation"
      aria-label="Preparación del servicio"
    >
      <summary>Ver preparación del servicio</summary>
      <p>
        {complete} de {steps.length} requisitos completados
      </p>
      <progress
        aria-label="Requisitos completados"
        max={steps.length}
        value={complete}
      />
      <HomeRequirements
        publication={publication}
        onNavigate={onNavigate}
        currentDestination={currentDestination}
      />
    </details>
  );
}
