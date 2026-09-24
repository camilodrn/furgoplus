import { useEffect, useState } from "react";
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
  DriverValidations,
  Publication,
} from "./api-types";

const demoNotice =
  "Entorno de demostración: utiliza únicamente archivos sintéticos de prueba. No subas documentos reales.";

const states: Record<string, string> = {
  draft: "Borrador",
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Requiere correcciones",
  superseded: "Reemplazada",
};
const queueStates: Record<string, string> = {
  pending: "Pendientes",
  approved: "Aprobadas",
  rejected: "Rechazadas",
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
  if (error.status === 413)
    return "El archivo supera el tamaño máximo de 10 MB.";
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
        `${names.get(key) ?? (key === "file" ? "Archivo" : key === "expires_on" ? "Vencimiento" : "Revisión")}: ${value}`,
    ),
  );
  return details.length
    ? details.join(" ")
    : "Revisa los datos e inténtalo nuevamente.";
}

function santiagoToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (part: string) =>
    parts.find((item) => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
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
        : kind;
}

function changeSummary(comparison: AdminValidation["comparison"]): string {
  if (comparison.previous_revision === null) return "Primera revisión";
  if (!comparison.has_material_changes) return "Sin cambios materiales";
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
  link.download = `documento-${id}.${suffix}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Feedback = { area: string; message: string; error: boolean };
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
      className={`action-notice ${feedback.error ? "notice-error" : "notice-success"}`}
      role={feedback.error ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

type DriverSection =
  | "profile"
  | "documents"
  | "validation"
  | "publication"
  | "routes"
  | "requests";
const driverSections: { id: DriverSection; label: string }[] = [
  { id: "profile", label: "Perfil" },
  { id: "documents", label: "Documentos" },
  { id: "validation", label: "Validación" },
  { id: "publication", label: "Publicación" },
  { id: "routes", label: "Rutas" },
  { id: "requests", label: "Solicitudes" },
];

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
        return "Agrega tu nombre visible.";
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
  publication,
  onRelevantChange,
}: {
  api: AuthApi;
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [expiryErrors, setExpiryErrors] = useState<Record<string, boolean>>({});
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  async function refresh() {
    const [p, c, d, h] = await Promise.all([
      api.driverProfile(),
      api.checklist(),
      api.documents(),
      api.validations(),
    ]);
    setProfile(p);
    setChecklist(c);
    setDocuments(d);
    setHistory(h);
  }
  useEffect(() => {
    void refresh().catch((reason: unknown) =>
      setFeedback({ area: "page", message: errorText(reason), error: true }),
    );
  }, []);

  async function perform(
    area: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    if (busy) return;
    setBusy(area);
    setFeedback(null);
    try {
      await action();
      if (area.startsWith("upload:"))
        setFiles((previous) => ({ ...previous, [area.slice(7)]: undefined }));
      if (!area.startsWith("download:")) await refresh();
      if (!area.startsWith("download:")) onRelevantChange?.();
      setFeedback({ area, message: success, error: false });
    } catch (reason) {
      setFeedback({ area, message: errorText(reason, checklist), error: true });
      if (reason instanceof ApiError && reason.status === 409) await refresh();
    } finally {
      setBusy("");
    }
  }

  const current = new Map(
    documents?.documents
      .filter((item) => item.is_current)
      .map((item) => [item.kind, item]),
  );
  const blockers =
    checklist?.items.flatMap((item) => {
      const file = current.get(item.kind);
      if (!file) return [`Falta subir ${item.label}.`];
      if (item.requires_expiry && !file.expires_on)
        return [`Falta la fecha de vencimiento de ${item.label}.`];
      if (file.expires_on && file.expires_on < santiagoToday())
        return [`${item.label} está vencido.`];
      return [];
    }) ?? [];
  if (profile && !profile.display_name.trim())
    blockers.unshift("Falta tu nombre visible.");
  const ready = blockers.length === 0;

  return (
    <section className="screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tu cuenta de conductor</p>
          <h1>
            {activeSection === "publication" || activeSection === "routes"
              ? "Gestiona tu servicio"
              : "Completa tu validación"}
          </h1>
          <p className="intro">
            {activeSection === "publication" || activeSection === "routes"
              ? "Consulta tu visibilidad y mantén al día tus rutas."
              : "Prepara tu perfil y los documentos. Luego envíalos para que podamos revisarlos."}
          </p>
        </div>
        {profile && <StatusBadge state={profile.validation_state} />}
      </div>
      <p className="demo-notice">{demoNotice}</p>
      {activeSection && onSectionChange && (
        <>
          <nav
            className="section-nav driver-section-nav"
            aria-label="Secciones del conductor"
          >
            {driverSections.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`section-nav-button ${activeSection === id ? "is-current" : ""}`}
                aria-current={activeSection === id ? "page" : undefined}
                onClick={() => onSectionChange(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <nav
            className="section-selector"
            aria-label="Selector de sección"
            onKeyDown={(event) => {
              if (event.key === "Escape" && sectionMenuOpen) {
                setSectionMenuOpen(false);
                event.currentTarget.querySelector("button")?.focus();
              }
            }}
          >
            <span className="section-selector-label">Sección</span>
            <button
              type="button"
              className="section-selector-trigger"
              aria-label={`Sección: ${driverSections.find((item) => item.id === activeSection)?.label}`}
              aria-expanded={sectionMenuOpen}
              aria-controls="driver-section-list"
              onClick={() => setSectionMenuOpen((open) => !open)}
            >
              <span>
                {
                  driverSections.find((item) => item.id === activeSection)
                    ?.label
                }
              </span>
              <span aria-hidden="true">▾</span>
            </button>
            <div
              id="driver-section-list"
              className="section-selector-options"
              hidden={!sectionMenuOpen}
            >
              {driverSections.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={activeSection === id ? "page" : undefined}
                  onClick={() => {
                    onSectionChange(id);
                    setSectionMenuOpen(false);
                  }}
                >
                  {label}
                  {activeSection === id ? " (actual)" : ""}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
      {activeSection && profile && checklist && documents && (
        <p className="next-step">
          <strong>Siguiente paso: </strong>
          {nextStep(publication, profile, blockers)}
        </p>
      )}
      {!activeSection && (
        <ol className="progress-guide" aria-label="Pasos de la validación">
          <li>
            <span>1</span> Perfil
          </li>
          <li>
            <span>2</span> Documentos
          </li>
          <li>
            <span>3</span> Enviar revisión
          </li>
        </ol>
      )}
      <Notice feedback={feedback} area="page" />
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
                <h2 id="profile-heading">Perfil del servicio</h2>
                <p>
                  Estos datos nos ayudan a identificarte durante la revisión.
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
                  "Cambios guardados correctamente.",
                );
              }}
            >
              <label>
                Nombre visible
                <input
                  name="display_name"
                  defaultValue={profile.display_name}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Descripción del servicio
                <textarea
                  name="service_summary"
                  defaultValue={profile.service_summary}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <label>
                Correo de contacto del servicio
                <input
                  name="service_contact_email"
                  type="email"
                  defaultValue={profile.service_contact_email}
                />
              </label>
              {profile.validation_state === "approved" && (
                <p className="inline-warning profile-warning">
                  Si cambias tu nombre visible, tu validación deberá revisarse
                  nuevamente.
                </p>
              )}
              <div className="action-line">
                <button className="button button-primary" disabled={!!busy}>
                  {busy === "profile" ? "Guardando…" : "Guardar cambios"}
                </button>
                <Notice feedback={feedback} area="profile" />
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
                  Sube un archivo PDF, JPEG o PNG por documento. Máximo 10 MB
                  cada uno.
                </p>
              </div>
            </div>
            <div className="document-grid">
              {checklist.items.map((item) => {
                const file = current.get(item.kind);
                const selected = files[item.kind];
                const area = `upload:${item.kind}`;
                return (
                  <article className="document-card" key={item.kind}>
                    <div className="document-title">
                      <h3>{item.label}</h3>
                      <span
                        className={`file-state ${file ? "file-ready" : "file-missing"}`}
                      >
                        {file ? "✓ Documento cargado" : "Falta subir"}
                      </span>
                    </div>
                    {file ? (
                      <p className="document-meta">
                        Versión {file.version} · {fileType(file.content_type)} ·{" "}
                        {file.expires_on
                          ? `Vence: ${visibleExpiry(file.expires_on)}`
                          : "Sin vencimiento"}
                      </p>
                    ) : (
                      <p className="document-meta">
                        Aún no has subido este documento.
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
                        {file ? "Seleccionar reemplazo" : "Seleccionar archivo"}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          aria-label={`Archivo para ${item.label}`}
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
                      {item.requires_expiry && (
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
                      {file &&
                        profile.validation_state === "approved" &&
                        selected && (
                          <p className="inline-warning">
                            Al reemplazar este documento, tu validación deberá
                            revisarse nuevamente.
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
                                ? "Documento reemplazado. Se guardó una nueva versión."
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
          </section>

          <section
            className="panel validation-panel"
            aria-labelledby="validation-heading"
            hidden={!!activeSection && activeSection !== "validation"}
          >
            <div className="panel-heading">
              <span className="step-number">3</span>
              <div>
                <h2 id="validation-heading">Estado de tu validación</h2>
                <p>Revisión {profile.current_validation_revision}</p>
              </div>
            </div>
            <div className="status-summary">
              <StatusBadge state={profile.validation_state} />
              <p>
                {profile.validation_state === "pending"
                  ? "Tu información fue enviada. Estamos revisándola."
                  : profile.validation_state === "approved"
                    ? "Tu validación fue aprobada."
                    : profile.validation_state === "rejected"
                      ? "Necesitamos que corrijas algunos datos o documentos antes de volver a enviarlos."
                      : "Completa los datos pendientes para enviar tu revisión."}
              </p>
            </div>
            {profile.validation_state === "rejected" &&
              history.validations.find((item) => item.state === "rejected")
                ?.observations && (
                <div className="correction-note">
                  <strong>Correcciones solicitadas</strong>
                  <p>
                    {
                      history.validations.find(
                        (item) => item.state === "rejected",
                      )?.observations
                    }
                  </p>
                </div>
              )}
            {blockers.length > 0 && (
              <div className="blockers">
                <strong>Para continuar, falta:</strong>
                <ul>
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.validation_state !== "pending" &&
              profile.validation_state !== "approved" && (
                <div className="submit-area">
                  <button
                    className="button button-primary button-large"
                    disabled={!!busy || !ready}
                    onClick={() =>
                      void perform(
                        "submit",
                        () => api.submitValidation(),
                        "Documentos enviados a revisión. Te avisaremos cuando haya una decisión.",
                      )
                    }
                  >
                    {busy === "submit"
                      ? "Enviando…"
                      : "Enviar documentos a revisión"}
                  </button>
                  <Notice feedback={feedback} area="submit" />
                  {ready && (
                    <p className="helper-text">
                      Después de enviarlos, la revisión quedará en espera de una
                      decisión.
                    </p>
                  )}
                </div>
              )}
          </section>

          <section
            className="panel history-panel"
            aria-labelledby="history-heading"
            hidden={!!activeSection && activeSection !== "validation"}
          >
            <h2 id="history-heading">Historial de revisiones</h2>
            <p className="panel-subtitle">
              Puedes consultar los documentos y decisiones de cada envío.
            </p>
            {history.validations.length === 0 ? (
              <p>Aún no hay revisiones enviadas.</p>
            ) : (
              <div className="history-list">
                {history.validations.map((item) => (
                  <details className="history-item" key={item.id}>
                    <summary>
                      <span>
                        <strong>Revisión {item.revision}</strong>
                        <small>Enviada: {dateText(item.submitted_at)}</small>
                      </span>
                      <StatusBadge state={item.state} />
                      <span className="details-hint">Ver detalles</span>
                    </summary>
                    <div className="history-details">
                      {item.reviewed_at && (
                        <p>Decisión: {dateText(item.reviewed_at)}</p>
                      )}
                      {item.observations && (
                        <p>
                          <strong>Observaciones:</strong> {item.observations}
                        </p>
                      )}
                      <h3>Documentos enviados</h3>
                      {item.documents.map((document) => (
                        <div className="history-document" key={document.id}>
                          <span>
                            {checklist.items.find(
                              (entry) => entry.kind === document.kind,
                            )?.label ?? "Documento"}{" "}
                            · Versión {document.version} ·{" "}
                            {fileType(document.content_type)}
                          </span>
                          <button
                            className="button button-link"
                            disabled={!!busy}
                            onClick={() =>
                              void perform(
                                `download:${document.id}`,
                                () => download(api, document.id, false),
                                "Descarga iniciada.",
                              )
                            }
                          >
                            Descargar
                          </button>
                          <Notice
                            feedback={feedback}
                            area={`download:${document.id}`}
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
  );
}

export function AdminValidationScreen({ api }: { api: AuthApi }) {
  const [state, setState] = useState("pending");
  const [queue, setQueue] = useState<AdminValidations | null>(null);
  const [detail, setDetail] = useState<AdminValidation | null>(null);
  const [observations, setObservations] = useState("");
  const [decisionMode, setDecisionMode] = useState<"approve" | "reject">(
    "approve",
  );
  const [detailSection, setDetailSection] = useState<
    "validation" | "publication"
  >("validation");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function refresh(selected?: number, filter = state) {
    const list = await api.adminValidations(filter);
    setQueue(list);
    if (selected) setDetail(await api.adminValidation(selected));
  }
  useEffect(() => {
    setQueue(null);
    void refresh(undefined, state).catch((reason: unknown) =>
      setFeedback({ area: "queue", message: errorText(reason), error: true }),
    );
  }, [state]);

  async function open(id: number) {
    setBusy("open");
    setFeedback(null);
    try {
      setDetail(await api.adminValidation(id));
      setDetailSection("validation");
      setObservations("");
      setDecisionMode("approve");
    } catch (reason) {
      setFeedback({ area: "queue", message: errorText(reason), error: true });
    } finally {
      setBusy("");
    }
  }

  async function act(action: "approve" | "reject") {
    if (!detail || busy || !observations.trim()) return;
    setBusy("decision");
    setFeedback(null);
    try {
      await api.adminDecision(detail.id, action, { observations });
      await refresh(detail.id);
      setObservations("");
      setFeedback({
        area: "decision",
        message: "Decisión guardada correctamente.",
        error: false,
      });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        await refresh(detail.id);
      setFeedback({
        area: "decision",
        message: errorText(reason),
        error: true,
      });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="screen admin-screen">
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
      <div className="admin-layout">
        <section className="panel queue-panel" aria-labelledby="queue-heading">
          <div className="queue-heading">
            <div>
              <h2 id="queue-heading">Solicitudes</h2>
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
                onChange={(event) => {
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
                      <h3>{item.driver.display_name}</h3>
                      <p>{item.driver.email}</p>
                      <p>
                        Revisión {item.revision} · Enviada:{" "}
                        {dateText(item.submitted_at)}
                      </p>
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
                  <p className="eyebrow">Revisión {detail.revision}</p>
                  <h2 id="detail-heading">{detail.driver.display_name}</h2>
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
                    <dt>Nombre informado</dt>
                    <dd>{detail.display_name_snapshot}</dd>
                  </div>
                  {detail.reviewed_at && (
                    <div>
                      <dt>Decisión</dt>
                      <dd>{dateText(detail.reviewed_at)}</dd>
                    </div>
                  )}
                </dl>
                {detail.observations && (
                  <div className="correction-note">
                    <strong>Observaciones de esta revisión</strong>
                    <p>{detail.observations}</p>
                  </div>
                )}
                <section
                  className="revision-comparison"
                  aria-labelledby="comparison-heading"
                >
                  <h3 id="comparison-heading">
                    {detail.comparison.previous_revision === null
                      ? "Primera revisión"
                      : `Cambios desde la revisión ${detail.comparison.previous_revision}`}
                  </h3>
                  {detail.comparison.previous_revision === null ? (
                    <p>Este es el primer envío del conductor.</p>
                  ) : (
                    <>
                      <p className="comparison-summary">
                        {detail.comparison.has_material_changes
                          ? `${detail.comparison.changed_document_count} ${detail.comparison.changed_document_count === 1 ? "documento modificado" : "documentos modificados"} · ${detail.comparison.unchanged_document_count} sin cambios`
                          : "Sin cambios materiales respecto de la revisión anterior."}
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
                                  ? "Nombre visible"
                                  : change.field}
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
                </section>
                <div className="review-documents">
                  <h3>Documentos enviados</h3>
                  {detail.documents.map((document) => (
                    <div className="review-document" key={document.id}>
                      <div>
                        <strong>{documentLabel(document.kind)}</strong>
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
                          setBusy(`download:${document.id}`);
                          setFeedback(null);
                          void download(api, document.id, true)
                            .then(() =>
                              setFeedback({
                                area: `download:${document.id}`,
                                message: "Descarga iniciada.",
                                error: false,
                              }),
                            )
                            .catch((reason: unknown) =>
                              setFeedback({
                                area: `download:${document.id}`,
                                message: errorText(reason),
                                error: true,
                              }),
                            )
                            .finally(() => setBusy(""));
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
                {detail.state === "pending" && (
                  <div className="decision-section">
                    <h3>Decisión</h3>
                    {decisionMode === "reject" ? (
                      <>
                        <p>
                          Explica al conductor qué debe corregir antes de enviar
                          una nueva revisión.
                        </p>
                        <label>
                          Indica qué debe corregir el conductor
                          <textarea
                            value={observations}
                            maxLength={1000}
                            required
                            rows={4}
                            onChange={(event) =>
                              setObservations(event.target.value)
                            }
                          />
                        </label>
                        <div className="decision-actions">
                          <button
                            className="button button-danger"
                            disabled={!!busy || !observations.trim()}
                            onClick={() => void act("reject")}
                          >
                            {busy === "decision"
                              ? "Guardando…"
                              : "Enviar correcciones"}
                          </button>
                          <button
                            className="button button-quiet"
                            disabled={!!busy}
                            onClick={() => {
                              setDecisionMode("approve");
                              setObservations("");
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>
                          Si todos los documentos están correctos, añade una
                          nota breve y aprueba la revisión.
                        </p>
                        <label>
                          Nota para la aprobación
                          <textarea
                            value={observations}
                            maxLength={1000}
                            required
                            rows={3}
                            onChange={(event) =>
                              setObservations(event.target.value)
                            }
                          />
                        </label>
                        <div className="decision-actions">
                          <button
                            className="button button-positive"
                            disabled={!!busy || !observations.trim()}
                            onClick={() => void act("approve")}
                          >
                            {busy === "decision"
                              ? "Guardando…"
                              : "Aprobar validación"}
                          </button>
                          <button
                            className="button button-text-danger"
                            disabled={!!busy}
                            onClick={() => {
                              setDecisionMode("reject");
                              setObservations("");
                            }}
                          >
                            Solicitar correcciones
                          </button>
                        </div>
                      </>
                    )}
                    <Notice feedback={feedback} area="decision" />
                  </div>
                )}
                {detail.state !== "pending" && (
                  <Notice feedback={feedback} area="decision" />
                )}
              </div>
              <div hidden={detailSection !== "publication"}>
                <AdminPublicationScreen
                  key={`${detail.driver.id}:${detail.state}:${detail.revision}`}
                  api={api}
                  driverId={detail.driver.id}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
