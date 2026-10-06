import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import { ChileanDateField, visibleExpiry } from "./ChileanDateField";
import { AdminPublicationScreen } from "./PublicationScreens";
import { humanChileanDate, parseChileanDate } from "./dates";
import type {
  AdminValidation,
  AdminValidations,
  DriverChecklist,
  DriverDocuments,
  DriverProfile,
  DriverValidation,
  DriverValidations,
  Publication,
} from "./api-types";

const demoNotice =
  "Entorno de demostración: utiliza únicamente archivos sintéticos de prueba. No subas documentos reales.";

const states: Record<string, string> = {
  draft: "Preparando información",
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Requiere cambios",
  superseded: "Reemplazada",
};
const queueStates: Record<string, string> = {
  pending: "Pendientes",
  approved: "Aprobadas",
  rejected: "Necesitan cambios",
  superseded: "Reemplazadas",
  all: "Todas",
};

function statusLabel(state: string) {
  return states[state] ?? "Estado disponible";
}

function StatusBadge({ state }: { state: string }) {
  return (
    <span className={`status-badge status-${state}`}>{statusLabel(state)}</span>
  );
}

function errorText(error: unknown, checklist?: DriverChecklist | null): string {
  if (!(error instanceof ApiError))
    return "No pudimos completar la acción. Inténtalo de nuevo.";
  if (error.status === 409)
    return "La revisión cambió mientras la estabas revisando. Actualiza la información antes de continuar.";
  if (error.status === 404)
    return "Este documento o envío no está disponible para tu cuenta. Actualiza la información e inténtalo nuevamente.";
  if (error.status === 413)
    return `El archivo supera el tamaño máximo${checklist ? ` de ${checklist.max_bytes / (1024 * 1024)} MiB` : " permitido"}.`;
  if (error.status === 429)
    return "Hay demasiados intentos. Espera un momento y vuelve a intentarlo.";
  if (error.status === 401 || error.status === 403)
    return "Tu sesión no permite esta acción. Vuelve a iniciar sesión si es necesario.";
  const names = new Map(
    checklist?.items.map((item) => [item.kind, item.label]),
  );
  const details = Object.entries(error.fields).flatMap(([key, values]) =>
    values.map(
      (value) =>
        `${names.get(key) ?? { file: "Archivo", expires_on: "Vencimiento", display_name: "Nombre del servicio", service_summary: "Descripción", service_contact_email: "Correo de contacto", observations: "Observaciones" }[key] ?? "Información"}: ${value}`,
    ),
  );
  return details.length
    ? details.join(" ")
    : "Revisa los datos e inténtalo nuevamente.";
}

const dateText = humanChileanDate;

function fileType(type: string): string {
  return type === "application/pdf"
    ? "PDF"
    : type === "image/png"
      ? "PNG"
      : "JPEG";
}

function documentLabel(kind: string): string {
  return kind === "demo_identity_document"
    ? "Documento de identidad"
    : kind === "demo_vehicle_document"
      ? "Documento del vehículo"
      : kind === "demo_expiring_credential"
        ? "Credencial con vencimiento"
        : "Documento enviado";
}

function changeSummary(comparison: AdminValidation["comparison"]): string {
  if (comparison.previous_revision === null) return "Primera revisión";
  if (!comparison.has_material_changes) return "Sin cambios en la información";
  const documents = comparison.changed_document_count;
  const identity = comparison.changed_identity_field_count;
  return [
    documents
      ? `${documents} ${documents === 1 ? "documento modificado" : "documentos modificados"}`
      : "",
    identity
      ? `${identity} ${identity === 1 ? "dato del conductor modificado" : "datos del conductor modificados"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function download(api: AuthApi, id: number, admin: boolean) {
  const blob = await api.downloadDocument(id, admin);
  const suffix =
    blob.type === "application/pdf"
      ? "pdf"
      : blob.type === "image/png"
        ? "png"
        : "jpg";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `documento-furgoplus.${suffix}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Feedback = {
  area: string;
  message: string;
  error: boolean;
  fields?: Record<string, string[]>;
};
function Notice({
  feedback,
  area,
}: {
  feedback: Feedback | null;
  area: string;
}) {
  if (!feedback || feedback.area !== area) return null;
  return (
    <p
      id={
        area === "profile" || area === "decision" || area.startsWith("upload:")
          ? `${area}-notice`
          : undefined
      }
      className={`action-notice ${feedback.error ? "notice-error" : "notice-success"}`}
      role={feedback.error ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

function Confirmation({
  title,
  busy,
  onCancel,
  children,
  restoreFocus,
}: {
  title: string;
  busy: boolean;
  onCancel: () => void;
  children: React.ReactNode;
  restoreFocus?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    root.current?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (restoreFocus) restoreFocus();
        else if (trigger instanceof HTMLElement && trigger.isConnected)
          trigger.focus();
      });
    };
  }, []);
  return (
    <div
      className="validation-confirmation"
      role="alertdialog"
      aria-label={title}
      aria-describedby="validation-confirmation-description"
      tabIndex={-1}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <h3>{title}</h3>
      <div id="validation-confirmation-description">{children}</div>
      <button
        className="button button-outline"
        disabled={busy}
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  );
}

type DriverSection =
  | "profile"
  | "documents"
  | "validation"
  | "publication"
  | "routes"
  | "requests"
  | "summary"
  | "roster"
  | "payments";

const onboardingSteps = [
  { id: "profile", label: "Datos del servicio" },
  { id: "documents", label: "Documentos" },
  { id: "validation", label: "Revisión" },
] as const;

function reviewTitle(state: string) {
  return state === "pending"
    ? "Estamos revisando tu información"
    : state === "approved"
      ? "Tu información fue aprobada"
      : state === "rejected"
        ? "Necesitas hacer algunos cambios"
        : "Completa tu información";
}

function historyEvent(state: string) {
  return state === "approved"
    ? "Revisión aprobada"
    : state === "rejected"
      ? "Se solicitaron cambios"
      : state === "superseded"
        ? "Información reemplazada por cambios"
        : "Información enviada";
}

function nextStep(
  publication: Publication | null | undefined,
  profile: DriverProfile,
  blockers: string[],
) {
  if (publication?.eligible)
    return "Tu servicio ya está publicado. Los apoderados pueden encontrarlo mientras mantengas tus requisitos vigentes.";
  if (profile.validation_state === "pending")
    return "Espera el resultado de tu revisión.";
  if (profile.validation_state === "rejected")
    return "Revisa las correcciones solicitadas.";
  if (profile.validation_state !== "approved")
    return blockers[0] ?? "Envía tus documentos a revisión.";
  if (publication === null) return "Consultando el estado de tu servicio…";
  if (publication) {
    const otherBlockers = publication.blockers.filter(
      (item) => item.code !== "publication_not_requested",
    );
    const first = otherBlockers[0];
    if (first) {
      if (first.code === "subscription_missing")
        return "Pide al equipo de FurgoPlus que te asigne un plan vigente.";
      if (
        first.code === "subscription_inactive" ||
        first.code === "subscription_suspended" ||
        first.code === "subscription_expired"
      )
        return "Pide al equipo de FurgoPlus que revise la vigencia de tu plan.";
      if (first.code === "subscription_not_started")
        return "Tu plan aún no comienza. Podrás aparecer cuando llegue la fecha de inicio.";
      if (first.code === "active_route_missing")
        return "Crea una ruta activa y completa.";
      if (first.code === "profile_summary_missing")
        return "Completa la descripción del servicio.";
      if (first.code === "service_contact_email_missing")
        return "Agrega el correo de contacto del servicio.";
      if (first.code === "profile_display_name_missing")
        return "Agrega el nombre del servicio.";
      if (
        first.code === "required_document_missing" ||
        first.code === "required_document_expired"
      )
        return "Revisa y actualiza tus documentos.";
      if (
        first.code === "account_inactive" ||
        first.code === "driver_suspended" ||
        first.code === "driver_deactivated"
      )
        return "Contacta al equipo de FurgoPlus para revisar el estado de tu cuenta.";
      return first.message.endsWith(".") ? first.message : `${first.message}.`;
    }
    if (!publication.publication_requested)
      return "Tu configuración está lista. Solicita la publicación cuando quieras aparecer ante los apoderados.";
  }
  return "Tu solicitud está registrada. Tu servicio aún no aparece ante los apoderados.";
}

export function DriverOnboarding({
  api,
  activeSection,
  onSectionChange,
  showNavigation = true,
  publication,
  onRelevantChange,
}: {
  api: AuthApi;
  showNavigation?: boolean;
  activeSection?: DriverSection;
  onSectionChange?: (section: DriverSection) => void;
  publication?: Publication | null;
  onRelevantChange?: () => void;
}) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [checklist, setChecklist] = useState<DriverChecklist | null>(null);
  const [documents, setDocuments] = useState<DriverDocuments | null>(null);
  const [history, setHistory] = useState<DriverValidations | null>(null);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [expiryErrors, setExpiryErrors] = useState<Record<string, boolean>>({});
  const [submissionErrors, setSubmissionErrors] = useState<
    Record<string, string[]>
  >({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const submitTrigger = useRef<HTMLButtonElement>(null);
  const readGeneration = useRef(0);

  async function refresh() {
    const generation = ++readGeneration.current;
    const [p, c, d, h] = await Promise.all([
      api.driverProfile(),
      api.checklist(),
      api.documents(),
      api.validations(),
    ]);
    if (generation === readGeneration.current) {
      setProfile(p);
      setChecklist(c);
      setDocuments(d);
      setHistory(h);
    }
    return p;
  }
  useEffect(() => {
    let mounted = true;
    void refresh().catch((reason: unknown) => {
      if (mounted)
        setFeedback({ area: "page", message: errorText(reason), error: true });
    });
    return () => {
      mounted = false;
      readGeneration.current++;
    };
  }, []);

  async function perform(
    area: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(area);
    setFeedback(null);
    let confirmed = false;
    try {
      const result = await action();
      confirmed = true;
      if (area === "profile") setProfile(result as DriverProfile);
      if (area === "submit") {
        const submitted = result as DriverValidation;
        setProfile((previous) =>
          previous
            ? {
                ...previous,
                validation_state: submitted.state,
                current_validation_revision: submitted.revision,
              }
            : previous,
        );
        setHistory((previous) =>
          previous
            ? {
                ...previous,
                validation_state: submitted.state,
                current_validation_revision: submitted.revision,
                validations: [
                  submitted,
                  ...previous.validations.filter(
                    (item) => item.id !== submitted.id,
                  ),
                ],
              }
            : previous,
        );
      }
      if (area.startsWith("upload:")) {
        setFiles((previous) => ({ ...previous, [area.slice(7)]: undefined }));
        setExpiries((previous) => ({ ...previous, [area.slice(7)]: "" }));
      }
      if (!area.startsWith("download:")) {
        setConfirmSubmit(false);
        setSubmissionErrors({});
        const updated =
          area === "page" ? (result as DriverProfile) : await refresh();
        if (
          profile?.validation_state !== "draft" &&
          updated.validation_state === "draft"
        )
          success +=
            " Vuelve a enviar tu información para que revisemos los cambios.";
        onRelevantChange?.();
      }
      setFeedback({ area, message: success, error: false });
    } catch (reason) {
      setConfirmSubmit(false);
      if (area === "submit" && reason instanceof ApiError)
        setSubmissionErrors(reason.fields);
      setFeedback({
        area: confirmed ? "page" : area,
        message: confirmed
          ? "La acción fue guardada, pero no pudimos actualizar la información. Reintenta la carga para ver el estado actual."
          : errorText(reason, checklist),
        error: true,
        fields: reason instanceof ApiError ? reason.fields : undefined,
      });
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          await refresh();
        } catch {
          /* Keep the conflict visible if refresh fails. */
        }
      }
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  const current = new Map(
    documents?.documents
      .filter((item) => item.is_current)
      .map((item) => [item.kind, item]),
  );
  // This is a count of uploaded checklist items, never a submission eligibility predicate.
  const missingCount =
    checklist?.items.filter((item) => !current.has(item.kind)).length ?? 0;
  const lastChanges = history?.validations.find(
    (item) => item.state === "rejected" && item.observations,
  );
  const expiredNotice = publication?.blockers.some(
    (item) => item.code === "required_document_expired",
  );
  // Surface known obstacles from existing server data, not a local validation verdict.
  // Publication-only requirements (plan, routes, approval, etc.) do not block review.
  const reviewBlockers =
    publication?.blockers.filter(
      (item) =>
        item.code === "required_document_missing" ||
        item.code === "required_document_expired" ||
        item.code === "profile_display_name_missing",
    ) ?? [];
  const cannotSend =
    missingCount > 0 ||
    reviewBlockers.length > 0 ||
    Object.keys(submissionErrors).length > 0;
  const incompleteStep =
    missingCount > 0 ||
    reviewBlockers.some(
      (item) =>
        item.code === "required_document_missing" ||
        item.code === "required_document_expired",
    ) ||
    checklist?.items.some((item) => submissionErrors[item.kind])
      ? "documents"
      : reviewBlockers.some(
            (item) => item.code === "profile_display_name_missing",
          ) || submissionErrors.display_name
        ? "profile"
        : null;
  const nextAction =
    profile?.validation_state === "pending"
      ? "Tu información está siendo revisada."
      : profile?.validation_state === "rejected"
        ? "Revisa las observaciones y corrige tu información."
        : expiredNotice
          ? "Necesitas actualizar tus documentos: hay un documento requerido vencido."
          : profile?.validation_state === "approved"
            ? "Tu información fue aprobada."
            : missingCount
              ? `Te falta subir ${missingCount} ${missingCount === 1 ? "documento" : "documentos"}.`
              : "Tus documentos están cargados. Revisa el resumen y envía tu información.";
  function go(section: DriverSection) {
    setConfirmSubmit(false);
    onSectionChange?.(section);
    requestAnimationFrame(() => stepHeading.current?.focus());
  }

  return (
    <>
      <div hidden={activeSection !== "summary"}>
        {activeSection === "summary" && (
          <section
            className="panel onboarding-home"
            aria-label="Preparación de mi servicio"
          >
            <h2>Mi servicio</h2>
            <p>
              {profile ? nextAction : "Cargando el estado de tu información…"}
            </p>
            <Notice feedback={feedback} area="page" />
            <button
              className="button button-outline"
              onClick={() =>
                go(
                  profile?.validation_state === "pending" ||
                    profile?.validation_state === "approved" ||
                    profile?.validation_state === "rejected"
                    ? "validation"
                    : missingCount
                      ? "documents"
                      : "profile",
                )
              }
            >
              Ver mi información
            </button>
          </section>
        )}
      </div>
      <section
        hidden={activeSection === "summary"}
        className="screen onboarding-screen"
      >
        <div className="page-heading">
          <div>
            <p className="eyebrow">Mi servicio</p>
            <h1 ref={stepHeading} tabIndex={-1}>
              {activeSection === "publication" || activeSection === "routes"
                ? "Gestiona tu servicio"
                : "Prepara tu información"}
            </h1>
            <p className="intro">
              Completa los datos de tu servicio y los documentos de
              demostración. Luego envíalos a FurgoPlus para revisión.
            </p>
          </div>
          {profile && <StatusBadge state={profile.validation_state} />}
        </div>
        <p className="demo-notice">{demoNotice}</p>
        {profile && (
          <div className="next-step" role="status">
            <strong>Siguiente paso: </strong>
            {activeSection === "publication" || activeSection === "routes"
              ? nextStep(publication, profile, [nextAction])
              : nextAction}
          </div>
        )}
        <nav aria-label="Preparación de mi servicio">
          <ol className="onboarding-steps">
            {onboardingSteps.map(({ id, label }, index) => (
              <li key={id}>
                <button
                  type="button"
                  className="button button-outline"
                  aria-current={activeSection === id ? "step" : undefined}
                  onClick={() => go(id)}
                >
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    {label}
                    <small>
                      {id === "profile"
                        ? profile
                          ? "Datos guardados"
                          : "Cargando…"
                        : id === "documents"
                          ? checklist
                            ? `${checklist.items.length - missingCount} de ${checklist.items.length} cargados`
                            : "Cargando…"
                          : profile
                            ? statusLabel(profile.validation_state)
                            : "Cargando…"}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        {showNavigation && onSectionChange && (
          <nav
            className="section-nav"
            aria-label="Otras opciones de mi servicio"
          >
            <button
              className="button button-quiet"
              onClick={() => go("publication")}
            >
              Publicación
            </button>
            <button
              className="button button-quiet"
              onClick={() => go("routes")}
            >
              Rutas
            </button>
          </nav>
        )}
        <Notice feedback={feedback} area="page" />
        {feedback?.area === "page" && feedback.error && (
          <button
            className="button button-outline"
            disabled={!!busy}
            onClick={() =>
              void perform("page", refresh, "Información actualizada.")
            }
          >
            Reintentar carga
          </button>
        )}
        {!profile || !checklist || !documents || !history ? (
          <p className="loading-text">Cargando tu información…</p>
        ) : (
          <div className="content-stack">
            <section
              className="panel"
              aria-labelledby="profile-heading"
              hidden={!!activeSection && activeSection !== "profile"}
            >
              <div className="panel-heading">
                <span className="step-number">1</span>
                <div>
                  <h2 id="profile-heading">Datos del servicio</h2>
                  <p>
                    El nombre y la descripción podrán aparecer para los
                    apoderados cuando tu servicio esté publicado.
                  </p>
                </div>
              </div>
              <form
                className="profile-form"
                key={`${profile.display_name}-${profile.service_summary}-${profile.service_contact_email}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void perform(
                    "profile",
                    () =>
                      api.updateDriverProfile({
                        display_name: String(data.get("display_name") ?? ""),
                        service_summary: String(
                          data.get("service_summary") ?? "",
                        ),
                        service_contact_email: String(
                          data.get("service_contact_email") ?? "",
                        ),
                      }),
                    "Datos del servicio guardados.",
                  );
                }}
              >
                <label>
                  <span id="service-name-label">Nombre del servicio</span>
                  <input
                    aria-labelledby="service-name-label"
                    name="display_name"
                    defaultValue={profile.display_name}
                    required
                    maxLength={100}
                    aria-describedby="service-name-help profile-notice"
                    aria-invalid={!!feedback?.fields?.display_name}
                  />
                  <span id="service-name-help" className="helper-text">
                    Por ejemplo: Transporte escolar Los Aromos.
                  </span>
                </label>
                <label>
                  <span id="service-summary-label">
                    Descripción del servicio
                  </span>
                  <textarea
                    aria-labelledby="service-summary-label"
                    name="service_summary"
                    defaultValue={profile.service_summary}
                    maxLength={2000}
                    rows={3}
                    aria-describedby="service-summary-help profile-notice"
                    aria-invalid={!!feedback?.fields?.service_summary}
                  />
                  <span id="service-summary-help" className="helper-text">
                    Cuenta brevemente qué servicio ofreces. Por ejemplo:
                    traslados escolares de mañana y tarde en Concepción.
                  </span>
                </label>
                <label>
                  <span id="service-email-label">
                    Correo de contacto del servicio
                  </span>
                  <input
                    aria-labelledby="service-email-label"
                    name="service_contact_email"
                    type="email"
                    defaultValue={profile.service_contact_email}
                    aria-describedby="service-email-help profile-notice"
                    aria-invalid={!!feedback?.fields?.service_contact_email}
                  />
                  <span id="service-email-help" className="helper-text">
                    No aparece en la búsqueda. Se comparte con el apoderado
                    cuando aceptas su solicitud de contacto. Puede ser distinto
                    al correo de tu cuenta.
                  </span>
                </label>
                {(profile.validation_state === "approved" ||
                  profile.validation_state === "pending") && (
                  <p className="inline-warning profile-warning">
                    {profile.validation_state === "approved"
                      ? "Si cambias el nombre del servicio que ya fue aprobado, tendremos que revisarlo nuevamente."
                      : "Si cambias el nombre mientras está en revisión, tendrás que enviar tu información nuevamente."}{" "}
                    Cambiar la descripción o el correo no reinicia la revisión.
                  </p>
                )}
                <div className="action-line">
                  <button className="button button-primary" disabled={!!busy}>
                    {busy === "profile" ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <Notice feedback={feedback} area="profile" />
                  {onSectionChange && (
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={!!busy}
                      onClick={() => go("documents")}
                    >
                      Continuar a documentos
                    </button>
                  )}
                </div>
              </form>
            </section>
            <section
              className="panel"
              aria-labelledby="documents-heading"
              hidden={!!activeSection && activeSection !== "documents"}
            >
              <div className="panel-heading">
                <span className="step-number">2</span>
                <div>
                  <h2 id="documents-heading">Documentos requeridos</h2>
                  <p>
                    {checklist.items.length - missingCount} de{" "}
                    {checklist.items.length} documentos cargados. Tus archivos
                    son privados: tú y los administradores autorizados pueden
                    descargarlos.
                  </p>
                  <p>
                    Formatos:{" "}
                    {checklist.allowed_content_types.map(fileType).join(", ")}.
                    Máximo {checklist.max_bytes / (1024 * 1024)} MiB por
                    archivo.
                  </p>
                </div>
              </div>
              {expiredNotice && (
                <p className="inline-warning">
                  El servidor informa que hay un documento requerido vencido.
                  Revisa las fechas y reemplázalo.
                </p>
              )}
              <div className="document-grid">
                {checklist.items.map((item) => {
                  const file = current.get(item.kind);
                  const selected = files[item.kind];
                  const area = `upload:${item.kind}`;
                  const sent =
                    profile.validation_state === "pending" &&
                    history.validations.some(
                      (entry) =>
                        entry.revision ===
                          profile.current_validation_revision &&
                        entry.state === "pending" &&
                        entry.documents.some((doc) => doc.id === file?.id),
                    );
                  const serverProblem = submissionErrors[item.kind];
                  return (
                    <article
                      className="document-card"
                      key={item.kind}
                      aria-label={item.label}
                    >
                      <div className="document-title">
                        <h3>{item.label}</h3>
                        <span
                          className={`file-state ${file && !serverProblem ? "file-ready" : "file-missing"}`}
                        >
                          {serverProblem
                            ? "! Requiere atención"
                            : sent
                              ? "◷ En revisión"
                              : file
                                ? "✓ Archivo cargado"
                                : "! Falta subir"}
                        </span>
                      </div>
                      {file ? (
                        <p className="document-meta">
                          Archivo actual · {fileType(file.content_type)} ·{" "}
                          {file.expires_on
                            ? `Vencimiento: ${visibleExpiry(file.expires_on)}`
                            : "No requiere fecha de vencimiento"}
                        </p>
                      ) : (
                        <p className="document-meta">
                          Aún no has subido este documento.
                        </p>
                      )}
                      {serverProblem && (
                        <p className="inline-warning">
                          {serverProblem.join(" ")}
                        </p>
                      )}
                      {file && (
                        <button
                          className="button button-link"
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            void perform(
                              `download:${file.id}`,
                              () => download(api, file.id, false),
                              "Descarga iniciada.",
                            )
                          }
                        >
                          Descargar documento
                        </button>
                      )}
                      <div className="upload-controls">
                        <label className="button button-outline file-picker">
                          {file
                            ? "Seleccionar reemplazo"
                            : "Seleccionar archivo"}
                          <input
                            type="file"
                            key={`${item.kind}:${file?.id ?? "missing"}`}
                            disabled={!!busy}
                            accept={checklist.allowed_content_types.join(",")}
                            aria-label={`Archivo para ${item.label}`}
                            aria-describedby={`${area}-notice`}
                            aria-invalid={
                              feedback?.area === area && feedback.error
                            }
                            onChange={(event) =>
                              setFiles((previous) => ({
                                ...previous,
                                [item.kind]: event.target.files?.[0],
                              }))
                            }
                          />
                        </label>
                        {selected && (
                          <p className="selected-file">
                            Seleccionado: <strong>{selected.name}</strong>
                          </p>
                        )}
                        {item.requires_expiry && selected && (
                          <ChileanDateField
                            id={`expiry-${item.kind}`}
                            value={expiries[item.kind] ?? ""}
                            error={!!expiryErrors[item.kind]}
                            onChange={(value) => {
                              setExpiries((previous) => ({
                                ...previous,
                                [item.kind]: value,
                              }));
                              setExpiryErrors((previous) => ({
                                ...previous,
                                [item.kind]: false,
                              }));
                            }}
                          />
                        )}
                        {file && selected && (
                          <p className="helper-text">
                            El reemplazo será el archivo actual. Los documentos
                            de envíos anteriores se conservan en el historial.
                          </p>
                        )}
                        {selected &&
                          (profile.validation_state === "approved" ||
                            profile.validation_state === "pending") && (
                            <p className="inline-warning">
                              Al reemplazar este documento, tendrás que enviar
                              tu información nuevamente para revisión.
                            </p>
                          )}
                        {selected && (
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={
                              !!busy ||
                              !!(item.requires_expiry && !expiries[item.kind])
                            }
                            onClick={() => {
                              const expiresOn = item.requires_expiry
                                ? parseChileanDate(expiries[item.kind] ?? "")
                                : "";
                              if (item.requires_expiry && !expiresOn) {
                                setExpiryErrors((previous) => ({
                                  ...previous,
                                  [item.kind]: true,
                                }));
                                return;
                              }
                              void perform(
                                area,
                                () =>
                                  api.upload(
                                    item.kind,
                                    expiresOn ?? "",
                                    selected,
                                  ),
                                file
                                  ? "Documento reemplazado. Los envíos anteriores conservan sus documentos."
                                  : "Documento cargado correctamente.",
                              );
                            }}
                          >
                            {busy === area
                              ? "Subiendo…"
                              : file
                                ? "Reemplazar documento"
                                : "Subir documento"}
                          </button>
                        )}
                        <Notice feedback={feedback} area={area} />
                        {file && (
                          <Notice
                            feedback={feedback}
                            area={`download:${file.id}`}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {onSectionChange && (
                <button
                  className="button button-outline step-continue"
                  disabled={!!busy}
                  onClick={() => go("validation")}
                >
                  Ver resumen de revisión
                </button>
              )}
            </section>
            <section
              className="panel validation-panel"
              aria-labelledby="validation-heading"
              hidden={!!activeSection && activeSection !== "validation"}
            >
              <div className="panel-heading">
                <span className="step-number">3</span>
                <div>
                  <h2 id="validation-heading">
                    {reviewTitle(profile.validation_state)}
                  </h2>
                </div>
              </div>
              <div className="status-summary">
                <StatusBadge state={profile.validation_state} />
                <p>
                  {profile.validation_state === "pending"
                    ? "No necesitas enviarla nuevamente mientras esté en revisión."
                    : profile.validation_state === "approved"
                      ? "Si haces cambios importantes, es posible que debamos revisarla nuevamente. La aprobación de FurgoPlus no publica tu servicio automáticamente."
                      : profile.validation_state === "rejected"
                        ? "Revisa lo que necesitamos que corrijas antes de volver a enviar."
                        : "Guarda los datos del servicio y carga los documentos del checklist."}
                </p>
              </div>
              {lastChanges && profile.validation_state !== "approved" && (
                <div className="correction-note">
                  <strong>Cambios solicitados en la última revisión</strong>
                  <p>{lastChanges.observations}</p>
                  {onSectionChange && (
                    <button
                      className="button button-outline"
                      disabled={!!busy}
                      onClick={() => go("profile")}
                    >
                      Corregir información
                    </button>
                  )}
                </div>
              )}
              {profile.validation_state !== "pending" &&
                profile.validation_state !== "approved" && (
                  <div className="submit-area">
                    <h3>Antes de enviar</h3>
                    <ul className="submission-summary">
                      <li>
                        Nombre guardado:{" "}
                        {profile.display_name || "Sin nombre informado"}
                      </li>
                      {checklist.items.map((item) => (
                        <li key={item.kind}>
                          {current.has(item.kind)
                            ? "✓ Archivo cargado: "
                            : "! Falta subir: "}
                          {item.label}
                          {current.get(item.kind)?.expires_on &&
                            ` · Vencimiento: ${visibleExpiry(current.get(item.kind)!.expires_on)}`}
                        </li>
                      ))}
                    </ul>
                    <p className="helper-text">
                      FurgoPlus comprobará los datos, documentos y fechas
                      requeridas al enviar. Si falta algo, te indicaremos qué
                      corregir.
                    </p>
                    {cannotSend && (
                      <div className="blockers" role="alert">
                        <strong>Aún no puedes enviar</strong>
                        {(reviewBlockers.length > 0 ||
                          Object.keys(submissionErrors).length > 0) && (
                          <ul>
                            {reviewBlockers.map((item) => (
                              <li key={item.code}>{item.message}</li>
                            ))}
                            {Object.entries(submissionErrors).map(
                              ([key, values]) => (
                                <li key={key}>
                                  {checklist.items.find(
                                    (item) => item.kind === key,
                                  )?.label ??
                                    (key === "display_name"
                                      ? "Nombre del servicio"
                                      : "Información")}
                                  : {values.join(" ")}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                        {onSectionChange && incompleteStep && (
                          <button
                            className="button button-outline"
                            disabled={!!busy}
                            onClick={() => go(incompleteStep)}
                          >
                            {incompleteStep === "documents"
                              ? "Completar documentos"
                              : "Completar datos del servicio"}
                          </button>
                        )}
                      </div>
                    )}
                    {!cannotSend &&
                      (!confirmSubmit ? (
                        <button
                          className="button button-primary button-large"
                          disabled={!!busy}
                          ref={submitTrigger}
                          onClick={() => setConfirmSubmit(true)}
                        >
                          Enviar a revisión
                        </button>
                      ) : (
                        <Confirmation
                          title="Enviar tu información a revisión"
                          restoreFocus={() =>
                            (
                              submitTrigger.current ?? stepHeading.current
                            )?.focus()
                          }
                          onCancel={() => setConfirmSubmit(false)}
                          busy={!!busy}
                        >
                          <p>
                            FurgoPlus revisará esta versión de tu información y
                            documentos.
                          </p>
                          <button
                            className="button button-primary"
                            disabled={!!busy}
                            onClick={() =>
                              void perform(
                                "submit",
                                () => api.submitValidation(),
                                "Información enviada a revisión.",
                              )
                            }
                          >
                            {busy === "submit"
                              ? "Enviando…"
                              : "Confirmar envío"}
                          </button>
                        </Confirmation>
                      ))}
                  </div>
                )}
              <Notice feedback={feedback} area="submit" />
            </section>
            <section
              className="panel history-panel"
              aria-labelledby="history-heading"
              hidden={!!activeSection && activeSection !== "validation"}
            >
              <h2 id="history-heading">Historial de revisiones</h2>
              <p className="panel-subtitle">
                Consulta los envíos, documentos y observaciones anteriores.
              </p>
              {history.validations.length === 0 ? (
                <p>Aún no has enviado información a revisión.</p>
              ) : (
                <div className="history-list">
                  {history.validations.map((item) => (
                    <details className="history-item" key={item.id}>
                      <summary>
                        <span>
                          <strong>{historyEvent(item.state)}</strong>
                          <small>
                            {dateText(item.reviewed_at ?? item.submitted_at)}
                          </small>
                        </span>
                        <StatusBadge state={item.state} />
                        <span className="details-hint">Ver detalles</span>
                      </summary>
                      <div className="history-details">
                        <p>
                          Información enviada: {dateText(item.submitted_at)}
                        </p>
                        {item.reviewed_at && (
                          <p>Decisión: {dateText(item.reviewed_at)}</p>
                        )}
                        <p>Nombre enviado: {item.display_name_snapshot}</p>
                        <p className="helper-text">Revisión {item.revision}</p>
                        {item.observations && (
                          <p className="retained-observations">
                            <strong>Observaciones:</strong> {item.observations}
                          </p>
                        )}
                        <h3>Documentos enviados</h3>
                        {item.documents.map((doc) => (
                          <div className="history-document" key={doc.id}>
                            <span>
                              {checklist.items.find(
                                (entry) => entry.kind === doc.kind,
                              )?.label ?? "Documento"}{" "}
                              · Versión {doc.version} ·{" "}
                              {fileType(doc.content_type)}
                              {doc.expires_on &&
                                ` · Vencimiento: ${visibleExpiry(doc.expires_on)}`}
                            </span>
                            <button
                              className="button button-link"
                              disabled={!!busy}
                              onClick={() =>
                                void perform(
                                  `download:${doc.id}`,
                                  () => download(api, doc.id, false),
                                  "Descarga iniciada.",
                                )
                              }
                            >
                              Descargar
                            </button>
                            <Notice
                              feedback={feedback}
                              area={`download:${doc.id}`}
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </>
  );
}

type PendingDecision = {
  id: number;
  revision: number;
  state: "pending";
  name: string;
  submittedAt: string;
  action: "approve" | "reject";
  observations: string;
};

export function AdminValidationScreen({ api }: { api: AuthApi }) {
  const [state, setState] = useState("pending");
  const [queue, setQueue] = useState<AdminValidations | null>(null);
  const [detail, setDetail] = useState<AdminValidation | null>(null);
  const [observations, setObservations] = useState("");
  const [confirmation, setConfirmation] = useState<PendingDecision | null>(
    null,
  );
  const [detailSection, setDetailSection] = useState<
    "validation" | "publication"
  >("validation");
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const queueGeneration = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const decisionTrigger = useRef<HTMLButtonElement>(null);
  const changesTrigger = useRef<HTMLButtonElement>(null);
  const decisionAction = useRef<"approve" | "reject">("approve");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function refresh(selected?: number, filter = state) {
    const generation = ++queueGeneration.current;
    const list = await api.adminValidations(filter);
    if (generation !== queueGeneration.current) return;
    setQueue(list);
    if (selected) {
      const updated = await api.adminValidation(selected);
      if (generation === queueGeneration.current) setDetail(updated);
    }
  }
  useEffect(() => {
    let active = true;
    setQueue(null);
    void refresh(undefined, state).catch((reason: unknown) => {
      if (active)
        setFeedback({ area: "queue", message: errorText(reason), error: true });
    });
    return () => {
      active = false;
      queueGeneration.current++;
    };
  }, [state]);
  useEffect(() => {
    if (detail) heading.current?.focus();
  }, [detail?.id]);

  async function open(id: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy("open");
    setFeedback(null);
    setConfirmation(null);
    try {
      setDetail(await api.adminValidation(id));
      setDetailSection("validation");
      setObservations("");
    } catch (reason) {
      setFeedback({ area: "queue", message: errorText(reason), error: true });
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  function prepareDecision(action: "approve" | "reject") {
    if (
      !detail ||
      detail.state !== "pending" ||
      lock.current ||
      !observations.trim()
    )
      return;
    decisionAction.current = action;
    // Freeze the immutable submission target and note. Queue/detail refresh never retargets it.
    setConfirmation({
      id: detail.id,
      revision: detail.revision,
      state: "pending",
      name: detail.display_name_snapshot,
      submittedAt: detail.submitted_at,
      action,
      observations: observations.trim(),
    });
  }

  async function act() {
    const target = confirmation;
    if (!target || lock.current) return;
    if (
      detail?.id !== target.id ||
      detail.revision !== target.revision ||
      detail.state !== target.state
    ) {
      setConfirmation(null);
      setFeedback({
        area: "decision",
        message: "Esta revisión cambió. Vuelve a revisarla antes de decidir.",
        error: true,
      });
      return;
    }
    lock.current = true;
    setBusy("decision");
    setFeedback(null);
    try {
      const decided = await api.adminDecision(target.id, target.action, {
        observations: target.observations,
      });
      setDetail(decided);
      setConfirmation(null);
      setObservations("");
      setFeedback({
        area: "decision",
        message: "Decisión guardada correctamente.",
        error: false,
      });
      try {
        await refresh();
      } catch {
        setFeedback({
          area: "decision",
          message:
            "Decisión guardada. No pudimos actualizar la cola; vuelve a intentarlo.",
          error: true,
        });
      }
    } catch (reason) {
      setConfirmation(null);
      if (reason instanceof ApiError && reason.status === 409) {
        setObservations("");
        try {
          await refresh(target.id);
        } catch {
          /* Never replace the captured target with a newer submission. */
        }
      }
      setFeedback({
        area: "decision",
        message: errorText(reason),
        error: true,
        fields: reason instanceof ApiError ? reason.fields : undefined,
      });
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  async function downloadSubmitted(id: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy(`download:${id}`);
    setFeedback(null);
    try {
      await download(api, id, true);
      setFeedback({
        area: `download:${id}`,
        message: "Descarga iniciada.",
        error: false,
      });
    } catch (reason) {
      setFeedback({
        area: `download:${id}`,
        message: errorText(reason),
        error: true,
      });
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy("refresh");
    try {
      await refresh(detail?.id);
    } catch (reason) {
      setFeedback({ area: "queue", message: errorText(reason), error: true });
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  return (
    <section className="screen admin-screen admin-validation-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Área de administración</p>
          <h1>Validaciones de conductores</h1>
          <p className="intro">
            Revisa cada envío y comunica al conductor el resultado.
          </p>
        </div>
      </div>
      <p className="demo-notice">{demoNotice}</p>
      <div className="validation-workspace-actions">
        {detail && (
          <button
            className="button button-outline"
            disabled={!!busy || !!confirmation}
            onClick={() => {
              setDetail(null);
              setObservations("");
              setConfirmation(null);
              requestAnimationFrame(() =>
                document.getElementById("queue-heading")?.focus(),
              );
            }}
          >
            Volver a validaciones
          </button>
        )}
        <button
          className="button button-outline"
          disabled={!!busy}
          onClick={() => void reload()}
        >
          {busy === "refresh" ? "Actualizando…" : "Actualizar validaciones"}
        </button>
      </div>
      {detail && <Notice feedback={feedback} area="queue" />}
      <div className="admin-layout">
        <section
          className="panel queue-panel"
          aria-labelledby="queue-heading"
          hidden={!!detail}
        >
          <div className="queue-heading">
            <div>
              <h2 id="queue-heading" tabIndex={-1}>
                Solicitudes
              </h2>
              <p>
                {queue
                  ? `${queue.results.length} ${queue.results.length === 1 ? "resultado" : "resultados"}`
                  : "Cargando solicitudes…"}
              </p>
            </div>
            <label>
              Mostrar
              <select
                value={state}
                disabled={!!busy || !!confirmation}
                onChange={(event) => {
                  setConfirmation(null);
                  setObservations("");
                  setState(event.target.value);
                  setDetail(null);
                }}
              >
                {Object.entries(queueStates).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Notice feedback={feedback} area="queue" />
          {queue &&
            (queue.results.length ? (
              <div className="queue-list">
                {queue.results.map((item) => (
                  <article
                    className={`queue-item ${detail?.id === item.id ? "queue-selected" : ""}`}
                    key={item.id}
                  >
                    <div>
                      <h3>{item.display_name_snapshot}</h3>
                      <p>{item.driver.email}</p>
                      <p>Información enviada: {dateText(item.submitted_at)}</p>
                      <p className="queue-change-summary">
                        {changeSummary(item.comparison)}
                      </p>
                    </div>
                    <div className="queue-actions">
                      <StatusBadge state={item.state} />
                      <button
                        className="button button-outline"
                        disabled={!!busy}
                        onClick={() => void open(item.id)}
                      >
                        {busy === "open" ? "Abriendo…" : "Revisar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No hay solicitudes en este estado.</p>
            ))}
        </section>
        <section
          className="panel detail-panel"
          aria-labelledby="detail-heading"
          hidden={!detail}
        >
          {!detail ? (
            <div className="empty-detail">
              <h2 id="detail-heading">Selecciona una revisión</h2>
              <p>
                Elige una solicitud para ver sus documentos y tomar una
                decisión.
              </p>
            </div>
          ) : (
            <>
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">
                    Información enviada: {dateText(detail.submitted_at)}
                  </p>
                  <h2 id="detail-heading" ref={heading} tabIndex={-1}>
                    {detail.display_name_snapshot}
                  </h2>
                  <p className="helper-text">Revisión {detail.revision}</p>
                  <p>{detail.driver.email}</p>
                </div>
                <StatusBadge state={detail.state} />
              </div>
              <nav
                className="section-nav detail-nav"
                aria-label="Secciones del conductor seleccionado"
              >
                <button
                  type="button"
                  className={`section-nav-button ${detailSection === "validation" ? "is-current" : ""}`}
                  aria-current={
                    detailSection === "validation" ? "page" : undefined
                  }
                  disabled={!!busy || !!confirmation}
                  onClick={() => setDetailSection("validation")}
                >
                  Validación
                </button>
                <button
                  type="button"
                  className={`section-nav-button ${detailSection === "publication" ? "is-current" : ""}`}
                  aria-current={
                    detailSection === "publication" ? "page" : undefined
                  }
                  disabled={!!busy || !!confirmation}
                  onClick={() => setDetailSection("publication")}
                >
                  Plan y publicación
                </button>
              </nav>
              <div hidden={detailSection !== "validation"}>
                <dl className="review-facts">
                  <div>
                    <dt>Enviada</dt>
                    <dd>{dateText(detail.submitted_at)}</dd>
                  </div>
                  <div>
                    <dt>Nombre del servicio en este envío</dt>
                    <dd>{detail.display_name_snapshot}</dd>
                  </div>
                  {detail.reviewed_at && (
                    <div>
                      <dt>Decisión</dt>
                      <dd>{dateText(detail.reviewed_at)}</dd>
                    </div>
                  )}
                </dl>
                {detail.driver.display_name !==
                  detail.display_name_snapshot && (
                  <p className="helper-text">
                    Nombre actual del servicio: {detail.driver.display_name}. La
                    decisión corresponde al nombre de este envío.
                  </p>
                )}
                {detail.observations && (
                  <div className="correction-note">
                    <strong>Observaciones de esta revisión</strong>
                    <p>{detail.observations}</p>
                  </div>
                )}
                <details
                  className="revision-comparison"
                  aria-labelledby="comparison-heading"
                >
                  <summary id="comparison-heading">
                    {detail.comparison.previous_revision === null
                      ? "Primera revisión"
                      : `Cambios desde la revisión ${detail.comparison.previous_revision}`}
                  </summary>
                  {detail.comparison.previous_revision === null ? (
                    <p>Este es el primer envío del conductor.</p>
                  ) : (
                    <>
                      <p className="comparison-summary">
                        {detail.comparison.has_material_changes
                          ? `${detail.comparison.changed_document_count} ${detail.comparison.changed_document_count === 1 ? "documento modificado" : "documentos modificados"} · ${detail.comparison.unchanged_document_count} sin cambios`
                          : "Sin cambios en la información respecto del envío anterior."}
                      </p>
                      <div className="comparison-list">
                        {detail.comparison.document_changes.map((change) => (
                          <div
                            className={`comparison-item ${change.status === "unchanged" ? "comparison-unchanged" : "comparison-changed"}`}
                            key={change.kind}
                          >
                            <div className="comparison-title">
                              <strong>{documentLabel(change.kind)}</strong>
                              <span className="change-badge">
                                {change.status === "unchanged"
                                  ? "SIN CAMBIOS"
                                  : change.status === "added"
                                    ? "AGREGADO"
                                    : change.status === "removed"
                                      ? "ELIMINADO"
                                      : "CAMBIADO"}
                              </span>
                            </div>
                            <p>
                              {change.previous_version && change.current_version
                                ? change.status === "unchanged"
                                  ? `Versión ${change.current_version}`
                                  : `Versión ${change.previous_version} → Versión ${change.current_version}`
                                : change.current_version
                                  ? `Versión ${change.current_version}`
                                  : `Versión ${change.previous_version}`}
                              {change.previous_content_type !==
                                change.current_content_type && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {change.previous_content_type
                                    ? fileType(change.previous_content_type)
                                    : "Sin archivo"}{" "}
                                  →{" "}
                                  {change.current_content_type
                                    ? fileType(change.current_content_type)
                                    : "Sin archivo"}
                                </>
                              )}
                              {change.previous_expires_on !==
                              change.current_expires_on ? (
                                <>
                                  {" "}
                                  · Vence:{" "}
                                  {visibleExpiry(
                                    change.previous_expires_on,
                                  )} →{" "}
                                  {visibleExpiry(change.current_expires_on)}
                                </>
                              ) : change.current_expires_on ? (
                                <>
                                  {" "}
                                  · vence{" "}
                                  {dateText(change.current_expires_on, true)}
                                </>
                              ) : null}
                            </p>
                          </div>
                        ))}
                      </div>
                      {detail.comparison.identity_changes.length > 0 && (
                        <div className="identity-changes">
                          <h4>Datos del conductor modificados</h4>
                          {detail.comparison.identity_changes.map((change) => (
                            <p key={change.field}>
                              <strong>
                                {change.field === "display_name"
                                  ? "Nombre del servicio"
                                  : "Dato del servicio"}
                                :
                              </strong>{" "}
                              <span>
                                “{change.previous_value}” → “
                                {change.current_value}”
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <p className="comparison-explanation">
                    Los cambios se comparan con la revisión anterior. La
                    aprobación siempre corresponde a la revisión completa
                    mostrada.
                  </p>
                </details>
                <div className="review-documents">
                  <h3>Documentos enviados</h3>
                  {detail.documents.map((document) => (
                    <div className="review-document" key={document.id}>
                      <div>
                        <strong>{documentLabel(document.kind)}</strong>
                        <p>✓ Archivo de este envío</p>
                        <p>
                          Versión {document.version} ·{" "}
                          {fileType(document.content_type)} ·{" "}
                          {document.expires_on
                            ? `Vence: ${visibleExpiry(document.expires_on)}`
                            : "Sin vencimiento"}
                        </p>
                      </div>
                      <button
                        className="button button-outline"
                        disabled={!!busy}
                        onClick={() => {
                          void downloadSubmitted(document.id);
                        }}
                      >
                        {busy === `download:${document.id}`
                          ? "Descargando…"
                          : "Descargar"}
                      </button>
                      <Notice
                        feedback={feedback}
                        area={`download:${document.id}`}
                      />
                    </div>
                  ))}
                </div>
                {detail.state === "pending" && !confirmation && (
                  <div className="decision-section">
                    <h3>Comentario y decisión</h3>
                    <label htmlFor="review-comment">
                      Comentario para el conductor
                    </label>
                    <p id="decision-help">
                      Escribe brevemente el resultado de la revisión. Este
                      mensaje será visible para el conductor.
                    </p>
                    <p id="decision-required" className="helper-text">
                      El comentario es obligatorio para ambas decisiones.
                    </p>
                    <textarea
                      id="review-comment"
                      value={observations}
                      maxLength={1000}
                      aria-required="true"
                      aria-describedby={`decision-help decision-required${feedback?.area === "decision" ? " decision-notice" : ""}`}
                      aria-invalid={
                        feedback?.area === "decision" &&
                        !!feedback.fields?.observations
                      }
                      rows={3}
                      onChange={(event) => setObservations(event.target.value)}
                    />
                    <div className="decision-actions">
                      <button
                        className="button button-positive"
                        disabled={!!busy || !observations.trim()}
                        ref={decisionTrigger}
                        onClick={() => prepareDecision("approve")}
                      >
                        {busy === "decision" ? "Guardando…" : "Aprobar"}
                      </button>
                      <button
                        className="button button-text-danger"
                        disabled={!!busy || !observations.trim()}
                        ref={changesTrigger}
                        onClick={() => prepareDecision("reject")}
                      >
                        Solicitar cambios
                      </button>
                    </div>
                    <Notice feedback={feedback} area="decision" />
                  </div>
                )}
                {confirmation && (
                  <Confirmation
                    title={
                      confirmation.action === "approve"
                        ? "¿Aprobar esta revisión?"
                        : "¿Solicitar cambios al conductor?"
                    }
                    busy={!!busy}
                    restoreFocus={() =>
                      (
                        (decisionAction.current === "approve"
                          ? decisionTrigger.current
                          : changesTrigger.current) ?? heading.current
                      )?.focus()
                    }
                    onCancel={() => setConfirmation(null)}
                  >
                    <p>
                      Servicio: {confirmation.name}. Información enviada:{" "}
                      {dateText(confirmation.submittedAt)}.
                    </p>
                    <p className="helper-text">
                      Revisión {confirmation.revision}. Esta decisión
                      corresponde únicamente a este envío.
                    </p>
                    <p>
                      {confirmation.action === "approve"
                        ? "Se aprobará la información y los documentos de este envío. Esto no publica el servicio automáticamente."
                        : "El conductor recibirá estas observaciones y deberá corregir su información antes de volver a enviarla."}
                    </p>
                    <p className="retained-observations">
                      <strong>Comentario para el conductor:</strong>{" "}
                      {confirmation.observations}
                    </p>
                    <button
                      className={`button ${confirmation.action === "approve" ? "button-positive" : "button-danger"}`}
                      disabled={!!busy}
                      onClick={() => void act()}
                    >
                      {busy === "decision"
                        ? "Guardando…"
                        : confirmation.action === "approve"
                          ? "Confirmar aprobación"
                          : "Confirmar solicitud de cambios"}
                    </button>
                  </Confirmation>
                )}
                {(detail.state !== "pending" || confirmation) && (
                  <Notice feedback={feedback} area="decision" />
                )}
              </div>
              <div hidden={detailSection !== "publication"}>
                <AdminPublicationScreen
                  key={`${detail.driver.id}:${detail.state}:${detail.revision}`}
                  api={api}
                  driverId={detail.driver.id}
                  driverName={detail.driver.display_name}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
