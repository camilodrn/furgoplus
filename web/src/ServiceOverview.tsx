import type { Ref } from "react";
import type {
  DriverChecklist,
  DriverDocuments,
  DriverProfile,
  Publication,
} from "./api-types";
import {
  blockerAction,
  ServiceAvailabilityNotice,
  type DriverDestination,
} from "./DriverExperience";
import { visibleExpiry } from "./ChileanDateField";

export function ServiceOverview({
  profile,
  checklist,
  documents,
  publication,
  onNavigate,
  headingRef,
  observations,
}: {
  profile: DriverProfile;
  checklist: DriverChecklist;
  documents: DriverDocuments;
  publication?: Publication | null;
  onNavigate: (destination: DriverDestination) => void;
  headingRef: Ref<HTMLHeadingElement>;
  observations?: string | null;
}) {
  const approved = profile.validation_state === "approved";
  const pending = profile.validation_state === "pending";
  const rejected = profile.validation_state === "rejected";
  const current = new Map(
    documents.documents
      .filter((item) => item.is_current)
      .map((item) => [item.kind, item]),
  );
  const fields: [string, string][] = [
    ["Nombre", profile.display_name],
    ["Descripción", profile.service_summary],
    ["Correo de contacto", profile.service_contact_email],
  ];
  const missingData = fields.some(([, value]) => !value.trim());
  const missingDocuments = checklist.items.some((item) => {
    const file = current.get(item.kind);
    return !file || (item.requires_expiry && !file.expires_on);
  });
  const expired = publication?.blockers.some(
    (item) => item.code === "required_document_expired",
  );
  const unavailable =
    publication &&
    (publication.profile_status !== "active" ||
      publication.blockers.some((item) =>
        ["account_inactive", "driver_suspended", "driver_deactivated"].includes(
          item.code,
        ),
      ));
  const action: [string, DriverDestination] = unavailable
    ? ["Consultar publicación", "publication"]
    : rejected
      ? ["Revisar cambios solicitados", "validation"]
      : expired
        ? ["Actualizar documentos", "documents"]
        : pending
          ? ["Ver revisión", "validation"]
          : missingData
            ? ["Completar datos del servicio", "profile"]
            : missingDocuments
              ? ["Completar documentos", "documents"]
              : approved
                ? ["Consultar publicación", "publication"]
                : ["Revisar y enviar información", "validation"];
  const warnings =
    publication?.blockers.filter(
      (item) =>
        ![
          "publication_not_requested",
          "validation_not_approved",
          "account_inactive",
          "driver_suspended",
          "driver_deactivated",
        ].includes(item.code),
    ) ?? [];
  const needsAttention =
    unavailable ||
    rejected ||
    missingData ||
    missingDocuments ||
    warnings.length > 0 ||
    (!approved && !pending);
  // Order the existing API data for reading; never infer validity from today's date.
  // A publication blocker does not identify which individual file is expired.
  const documentRows = checklist.items
    .map((item) => ({ item, file: current.get(item.kind) }))
    .sort((left, right) => {
      const rank = ({ item, file }: typeof left) =>
        !file || (item.requires_expiry && !file.expires_on)
          ? 0
          : file.expires_on
            ? 1
            : 2;
      return (
        rank(left) - rank(right) ||
        (left.file?.expires_on ?? "").localeCompare(
          right.file?.expires_on ?? "",
        )
      );
    });
  const primaryAction = (
    <button
      className={`button ${!needsAttention && approved && publication?.eligible ? "button-outline" : "button-primary"}`}
      onClick={() => onNavigate(action[1])}
    >
      {action[0]}
    </button>
  );

  return (
    <section
      className="screen service-overview"
      aria-label="Resumen de mi servicio"
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Mi servicio</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {approved
              ? "Resumen de tu servicio"
              : pending
                ? "Tu información está en revisión"
                : rejected
                  ? "Revisa los cambios solicitados"
                  : "Prepara tu información"}
          </h1>
          <p className="intro">{profile.display_name}</p>
        </div>
      </div>
      <nav className="driver-tabs" aria-label="Mi servicio">
        <button className="button button-link" aria-current="page">
          Resumen
        </button>
        <button
          className="button button-link"
          onClick={() => onNavigate("profile")}
        >
          Datos
        </button>
        <button
          className="button button-link"
          onClick={() => onNavigate("documents")}
        >
          Documentos
        </button>
        <button
          className="button button-link"
          onClick={() => onNavigate("validation")}
        >
          Revisión e historial
        </button>
      </nav>
      <div className="service-status-bar">
        <dl className="service-state-summary">
          <div>
            <dt>Revisión de información</dt>
            <dd className={`status-badge status-${profile.validation_state}`}>
              {approved
                ? "Aprobado"
                : pending
                  ? "En revisión"
                  : rejected
                    ? "Requiere cambios"
                    : "Sin enviar"}
            </dd>
          </div>
          <div>
            <dt>Publicación</dt>
            <dd
              className={publication?.eligible ? "service-visible" : undefined}
            >
              {!publication
                ? "Sin confirmar"
                : publication.eligible
                  ? "Visible para apoderados"
                  : publication.publication_requested
                    ? "No visible · publicación solicitada"
                    : "No visible · sin solicitar"}
            </dd>
          </div>
        </dl>
        <div className="service-context-actions">
          {!needsAttention && primaryAction}
          {action[1] !== "publication" && (
            <button
              className="button button-link"
              onClick={() => onNavigate("publication")}
            >
              Consultar publicación
            </button>
          )}
        </div>
      </div>
      {pending && !needsAttention && (
        <p className="service-review-note">
          Puedes consultar el envío y tus documentos mientras esperas el
          resultado.
        </p>
      )}
      {needsAttention && (
        <section className="service-attention" aria-label="Acciones necesarias">
          <h2>Requiere atención</h2>
          {publication && (
            <ServiceAvailabilityNotice publication={publication} />
          )}
          {rejected && (
            <div className="service-corrections">
              <h3>Cambios solicitados</h3>
              <p className="service-observations">
                {observations?.trim() ||
                  "Consulta las observaciones antes de corregir y volver a enviar."}
              </p>
            </div>
          )}
          {(missingData || missingDocuments) && (
            <ul className="service-requirements">
              {missingData && (
                <li>Completa los datos pendientes del servicio.</li>
              )}
              {missingDocuments && (
                <li>
                  Completa los documentos pendientes y sus fechas requeridas.
                </li>
              )}
            </ul>
          )}
          {!approved &&
            !pending &&
            !rejected &&
            !missingData &&
            !missingDocuments && (
              <p>Revisa tu información antes de enviarla.</p>
            )}
          {warnings.length > 0 && (
            <ul className="service-blockers">
              {warnings.map((item) => {
                const [message, label, destination] = blockerAction(item);
                return (
                  <li key={item.code}>
                    {message}{" "}
                    {destination !== action[1] && (
                      <button
                        className="button button-link"
                        onClick={() => onNavigate(destination)}
                      >
                        {label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="service-context-actions">
            {primaryAction}
            {rejected && action[1] !== "validation" && (
              <button
                className="button button-outline"
                onClick={() => onNavigate("validation")}
              >
                Revisar cambios solicitados
              </button>
            )}
            {rejected && (
              <button
                className="button button-outline"
                onClick={() => onNavigate("profile")}
              >
                Corregir información
              </button>
            )}
          </div>
        </section>
      )}
      <div className="service-overview-columns">
        <section
          className="service-documents"
          aria-labelledby="service-documents-summary"
        >
          <div className="service-section-heading">
            <h2 id="service-documents-summary">Documentos</h2>
            <p>
              {checklist.items.filter((item) => current.has(item.kind)).length}{" "}
              de {checklist.items.length} cargados
            </p>
          </div>
          <ul className="service-document-list">
            {documentRows.map(({ item, file }) => {
              const incomplete =
                !file || (item.requires_expiry && !file.expires_on);
              return (
                <li key={item.kind}>
                  <h3>{item.label}</h3>
                  <div
                    className={
                      incomplete
                        ? "service-document-pending"
                        : file.expires_on
                          ? "service-document-expiry"
                          : "service-document-loaded"
                    }
                  >
                    {!file ? (
                      "Pendiente"
                    ) : item.requires_expiry && !file.expires_on ? (
                      "Falta fecha de vencimiento"
                    ) : file.expires_on ? (
                      <>
                        Vencimiento:{" "}
                        <time dateTime={file.expires_on}>
                          {visibleExpiry(file.expires_on)}
                        </time>
                      </>
                    ) : (
                      "Cargado"
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            className="button button-outline"
            onClick={() => onNavigate("documents")}
          >
            Revisar documentos
          </button>
        </section>
        <section
          className="service-data"
          aria-labelledby="service-data-summary"
        >
          <div className="service-section-heading">
            <h2 id="service-data-summary">Datos del servicio</h2>
            {!missingData && (
              <span className="service-data-complete">Datos completos</span>
            )}
          </div>
          <dl className="service-data-list">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd
                  className={
                    !value.trim() ? "service-document-pending" : undefined
                  }
                >
                  {value.trim() ? value : "Pendiente"}
                </dd>
              </div>
            ))}
          </dl>
          <button
            className="button button-outline"
            onClick={() => onNavigate("profile")}
          >
            Editar datos
          </button>
        </section>
      </div>
      <nav className="service-management" aria-label="Gestión de mi servicio">
        <div>
          <h2>Revisión e historial</h2>
          <button
            className="button button-outline"
            onClick={() => onNavigate("validation")}
          >
            Ver revisión e historial
          </button>
        </div>
        <div>
          <h2>Rutas</h2>
          <button
            className="button button-outline"
            onClick={() => onNavigate("routes")}
          >
            Ver rutas
          </button>
        </div>
      </nav>
    </section>
  );
}
