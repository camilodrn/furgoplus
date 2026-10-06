import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type {
  AdminDriver,
  AdminDrivers,
  AdminDriverHistory,
  AdminDriverValidations,
  ProfileStatusInput,
} from "./api-types";
import { AdminPublicationScreen } from "./AdminPlanControls";
import { humanChileanDate } from "./dates";
import { ActionNotice, useActionFeedback } from "./ActionFeedback";
import {
  AdminBadge,
  AdminFocusPanel,
  AdminServiceSummary,
  AdminStatusBadges,
  adminError,
  adminLabels,
  adminRetryable,
  profileActions,
  profileExplanation,
  profileResults,
  visibilityFeedback,
} from "./AdminExperience";

const filterDefinitions = [
  [
    "profile_status",
    "Estado del perfil",
    ["active", "suspended", "deactivated"],
  ],
  [
    "validation_state",
    "Estado de validación",
    ["draft", "pending", "approved", "rejected"],
  ],
  ["publication", "Visibilidad", ["eligible", "blocked"]],
  [
    "subscription_status",
    "Estado del plan",
    ["missing", "inactive", "active", "suspended"],
  ],
  ["plan_code", "Plan asignado", ["basic", "pro", "elite"]],
] as const;
const driverPageSize = 25;
const historyPageSize = 25;
const historyBatchSize = 3;
const validationPageSize = 25;
const validationBatchSize = 3;
export function AdminControlScreen({
  api,
  onValidations,
  rootNavigationKey = 0,
}: {
  api: AuthApi;
  onValidations?: () => void;
  rootNavigationKey?: number;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [queue, setQueue] = useState<AdminDrivers | null>(null);
  const [selection, setSelection] = useState<{
    driverId: number;
    rootNavigationKey: number;
  } | null>(null);
  // A root navigation removes the detail in this render, before any late read
  // can apply. Queue state stays owned by this mounted, identity-keyed screen.
  const selected =
    selection?.rootNavigationKey === rootNavigationKey
      ? selection.driverId
      : null;
  useEffect(() => {
    setSelection(null);
  }, [rootNavigationKey]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    setQueue(null);
    setError("");
    setRetryable(false);
    const params = new URLSearchParams({
      ...applied,
      offset: String(offset),
      limit: String(driverPageSize),
    });
    void api
      .adminDrivers(params)
      .then((data) => {
        if (live) setQueue(data);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(adminError(cause));
        setRetryable(adminRetryable(cause));
        if (cause instanceof ApiError && cause.code === "not_authenticated") {
          setSelection(null);
          setFilters({});
          setApplied({});
        }
      });
    return () => {
      live = false;
    };
  }, [api, applied, offset, refreshKey]);
  function back() {
    setSelection(null);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      document.scrollingElement?.scrollTo?.({ top: 0, behavior: "instant" });
      heading.current
        ?.closest("main")
        ?.scrollTo?.({ top: 0, behavior: "instant" });
    });
  }
  return (
    <section className="screen admin-control-screen">
      <div hidden={selected !== null}>
        <div className="admin-section-heading">
          <h1 tabIndex={-1} ref={heading}>
            Conductores
          </h1>
          <button
            className="button button-quiet"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Actualizar lista
          </button>
        </div>
        <p>Encuentra un conductor y revisa el estado de su servicio.</p>
        <form
          noValidate
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setApplied(
              Object.fromEntries(
                Object.entries(filters).filter(([, value]) => value),
              ),
            );
          }}
        >
          <div className="admin-search-row">
            <label>
              Buscar conductor
              <input
                type="search"
                placeholder="Nombre del servicio o correo"
                maxLength={100}
                value={filters.q || ""}
                onChange={(event) =>
                  setFilters({ ...filters, q: event.target.value })
                }
              />
            </label>
            <button className="button button-primary">Buscar</button>
          </div>
          <details className="admin-filter-panel">
            <summary>
              Filtros{" "}
              {Object.entries(applied).filter(([key]) => key !== "q").length > 0
                ? `(${Object.entries(applied).filter(([key]) => key !== "q").length} aplicados)`
                : ""}
            </summary>
            <div className="admin-filter-fields">
              {filterDefinitions.map(([name, title, values]) => (
                <label key={name}>
                  {title}
                  <select
                    value={filters[name] || ""}
                    onChange={(event) =>
                      setFilters({ ...filters, [name]: event.target.value })
                    }
                  >
                    <option value="">Todos</option>
                    {values.map((value) => (
                      <option key={value} value={value}>
                        {adminLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button className="button button-outline">Aplicar filtros</button>
          </details>
          {Object.keys(applied).length > 0 && (
            <div
              className="admin-applied-filters"
              aria-label="Filtros aplicados"
            >
              {Object.entries(applied).map(([key, value]) => (
                <span key={key}>
                  {key === "q"
                    ? `Búsqueda: ${value}`
                    : `${filterDefinitions.find(([name]) => name === key)?.[1]}: ${adminLabels[value as keyof typeof adminLabels]}`}
                </span>
              ))}
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setFilters({});
                  setApplied({});
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </form>
        {error && (
          <div role="alert">
            <p>{error}</p>
            {retryable && (
              <button onClick={() => setRefreshKey((key) => key + 1)}>
                Reintentar carga de conductores
              </button>
            )}
          </div>
        )}
        {!queue && !error && <p role="status">Cargando conductores…</p>}
        {queue && (
          <section aria-label="Lista de conductores">
            <p role="status">
              {queue.count} {queue.count === 1 ? "conductor" : "conductores"}
            </p>
            {!queue.results.length && (
              <div className="panel empty-state">
                <h2>No hay conductores con estos filtros.</h2>
                <p>Prueba otro nombre o cambia los filtros de la lista.</p>
              </div>
            )}
            <div className="admin-driver-list">
              {queue.results.map((driver) => (
                <article className="panel admin-driver-card" key={driver.id}>
                  <div>
                    <h2>{driver.display_name || "Servicio sin nombre"}</h2>
                    <AdminStatusBadges publication={driver.publication} />
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setSelection({ driverId: driver.id, rootNavigationKey });
                    }}
                  >
                    Ver conductor
                  </button>
                </article>
              ))}
            </div>
            <nav
              className="admin-pagination"
              aria-label="Páginas de conductores"
            >
              <button
                className="button button-outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - driverPageSize))}
              >
                ← Anterior
              </button>
              <span>
                {queue.count > 0
                  ? `Página ${Math.floor(offset / driverPageSize) + 1} de ${Math.ceil(queue.count / driverPageSize)}`
                  : "0 resultados"}
              </span>
              <button
                className="button button-outline"
                disabled={offset + driverPageSize >= queue.count}
                onClick={() => setOffset(offset + driverPageSize)}
              >
                Siguiente →
              </button>
            </nav>
          </section>
        )}
      </div>
      {selected !== null && (
        <DriverControl
          key={selected}
          api={api}
          driverId={selected}
          onBack={back}
          onValidations={onValidations}
          onChanged={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </section>
  );
}
type ProfileDraft = ProfileStatusInput & { name: string };
function DriverControl({
  api,
  driverId,
  onChanged,
  onBack,
  onValidations,
}: {
  api: AuthApi;
  driverId: number;
  onChanged: () => void;
  onBack: () => void;
  onValidations?: () => void;
}) {
  const [driver, setDriver] = useState<AdminDriver | null>(null);
  const [history, setHistory] = useState<AdminDriverHistory | null>(null);
  const [validations, setValidations] = useState<AdminDriverValidations | null>(
    null,
  );
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyPages, setHistoryPages] = useState<
    Record<number, AdminDriverHistory["results"]>
  >({});
  const [visibleHistoryCount, setVisibleHistoryCount] =
    useState(historyBatchSize);
  const historyEvents = Object.entries(historyPages)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, events]) => events)
    .filter(
      (entry, index, entries) =>
        entries.findIndex((other) => other.id === entry.id) === index,
    );
  const lastLoadedHistoryOffset = Math.max(
    0,
    ...Object.keys(historyPages).map(Number),
  );
  const visibleHistory = historyEvents.slice(0, visibleHistoryCount);
  const hasOlderHistory =
    historyEvents.length > visibleHistory.length ||
    (!!history && lastLoadedHistoryOffset + historyPageSize < history.count);
  const [validationOffset, setValidationOffset] = useState(0);
  const [validationPages, setValidationPages] = useState<
    Record<number, AdminDriverValidations["results"]>
  >({});
  const [visibleValidationCount, setVisibleValidationCount] =
    useState(validationBatchSize);
  // Keep the backend's newest-revision-first order across authoritative pages.
  const validationEntries = Object.entries(validationPages)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, entries]) => entries)
    .filter(
      (entry, index, entries) =>
        entries.findIndex((other) => other.id === entry.id) === index,
    );
  const lastLoadedValidationOffset = Math.max(
    0,
    ...Object.keys(validationPages).map(Number),
  );
  const visibleValidations = validationEntries.slice(0, visibleValidationCount);
  const hasOlderValidations =
    validationEntries.length > visibleValidations.length ||
    (!!validations &&
      lastLoadedValidationOffset + validationPageSize < validations.count);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [retainedReason, setRetainedReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [readError, setReadError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState(-1);
  const alive = useRef(false);
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const profileTrigger = useRef<HTMLButtonElement | null>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const [reasonError, setReasonError] = useState("");
  const feedback = useActionFeedback();
  useEffect(() => () => feedback.clear(), [feedback.clear]);
  const timeline = useRef<HTMLOListElement>(null);
  const historyFocusIndex = useRef<number | null>(null);
  const validationList = useRef<HTMLOListElement>(null);
  const validationFocusIndex = useRef<number | null>(null);
  useEffect(() => {
    const index = validationFocusIndex.current;
    if (index !== null && index < visibleValidations.length) {
      validationFocusIndex.current = null;
      validationList.current?.querySelectorAll("h3")[index]?.focus();
    }
  }, [visibleValidations.length]);
  useEffect(() => {
    const index = historyFocusIndex.current;
    if (index !== null && index < visibleHistory.length) {
      historyFocusIndex.current = null;
      timeline.current?.querySelectorAll("h3")[index]?.focus();
    }
  }, [visibleHistory.length]);
  useEffect(() => {
    alive.current = true;
    heading.current?.focus();
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);
  function clearPrivate() {
    setDriver(null);
    setHistory(null);
    setHistoryPages({});
    historyFocusIndex.current = null;
    setVisibleHistoryCount(historyBatchSize);
    setValidations(null);
    setValidationPages({});
    validationFocusIndex.current = null;
    setVisibleValidationCount(validationBatchSize);
    setDraft(null);
    setPending(null);
    setError("");
    setRetainedReason("");
    setReasonError("");
    feedback.clear();
  }
  useEffect(() => {
    let live = true;
    const request = ++generation.current;
    setReadError("");
    setRetryable(false);
    setLoading(true);
    void Promise.all([
      api.adminDriver(driverId),
      api.adminDriverHistory(driverId, historyOffset),
      api.adminDriverValidations(driverId, validationOffset),
    ])
      .then(([current, audit, revisions]) => {
        if (!live || request !== generation.current) return;
        setDriver(current);
        setHistory(audit);
        setHistoryPages((pages) => ({
          ...pages,
          [historyOffset]: audit.results,
        }));
        setValidations(revisions);
        setValidationPages((pages) => ({
          ...pages,
          [validationOffset]: revisions.results,
        }));
        setLoadedKey(refreshKey);
        // Never overwrite an action draft or confirmation during history reads.
      })
      .catch((cause: unknown) => {
        if (!live || request !== generation.current) return;
        setReadError(adminError(cause));
        setRetryable(adminRetryable(cause));
        if (cause instanceof ApiError && cause.code === "not_authenticated")
          clearPrivate();
      })
      .finally(() => {
        if (live && request === generation.current) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, driverId, historyOffset, validationOffset, refreshKey]);
  function changed() {
    generation.current += 1;
    setHistoryOffset(0);
    setHistoryPages({});
    historyFocusIndex.current = null;
    setVisibleHistoryCount(historyBatchSize);
    setValidationOffset(0);
    setValidationPages({});
    validationFocusIndex.current = null;
    setVisibleValidationCount(validationBatchSize);
    setRefreshKey((key) => key + 1);
    onChanged();
  }
  function closeProfile() {
    setDraft(null);
    setPending(null);
    setReasonError("");
  }
  async function mutate() {
    if (!pending || busyRef.current) return;
    const { name: _name, ...input } = pending;
    busyRef.current = true;
    setBusy(true);
    setError("");
    feedback.clear();
    generation.current += 1;
    try {
      const current = await api.changeProfileStatus(driverId, input);
      if (!alive.current) return;
      setDriver(current);
      setRetainedReason("");
      closeProfile();
      feedback.show({
        kind: "success",
        title: profileResults[input.status],
        message: visibilityFeedback(current.publication),
      });
      changed();
    } catch (cause) {
      if (
        !alive.current ||
        (cause instanceof ApiError && cause.code === "stale_request")
      )
        return;
      setRetainedReason(input.reason);
      setPending(null);
      setError(adminError(cause));
      feedback.show({
        kind: "error",
        title: "No pudimos actualizar el perfil",
        message:
          cause instanceof ApiError && cause.status === 409
            ? "Revisa el estado actual antes de volver a intentarlo."
            : "Revisa la información de esta acción.",
      });
      if (cause instanceof ApiError && cause.code === "not_authenticated")
        clearPrivate();
      else if (cause instanceof ApiError && cause.status === 409) {
        const request = ++generation.current;
        try {
          const current = await api.adminDriver(driverId);
          if (!alive.current || request !== generation.current) return;
          setDriver(current);
          // Keep the reason, but a new explicit action/confirmation is required.
          setDraft(null);
          setError(
            `${adminError(cause)} Actualizamos los datos. Revisa el estado actual antes de intentarlo de nuevo.`,
          );
          changed();
        } catch (refreshError) {
          if (!alive.current || request !== generation.current) return;
          setReadError(adminError(refreshError));
          setRetryable(adminRetryable(refreshError));
          closeProfile();
          if (
            refreshError instanceof ApiError &&
            refreshError.code === "not_authenticated"
          )
            clearPrivate();
        }
      }
    } finally {
      if (alive.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section className="admin-driver-detail" aria-label="Detalle del conductor">
      <ActionNotice feedback={feedback.local} />
      <div className="admin-section-heading">
        <button
          className="button button-quiet"
          disabled={busy}
          onClick={onBack}
        >
          Volver a conductores
        </button>
        <button
          className="button button-quiet"
          disabled={busy}
          onClick={() => {
            closeProfile();
            setRetainedReason("");
            setError("");
            changed();
          }}
        >
          Actualizar conductor
        </button>
      </div>
      <header>
        <h1 tabIndex={-1} ref={heading}>
          {driver?.display_name || "Detalle del conductor"}
        </h1>
        {driver && <AdminStatusBadges publication={driver.publication} />}
      </header>
      {loading && !readError && <p role="status">Cargando conductor…</p>}
      {readError && (
        <div role="alert">
          <p>{readError}</p>
          {retryable && (
            <button
              onClick={() => {
                closeProfile();
                changed();
              }}
            >
              Reintentar carga del conductor
            </button>
          )}
        </div>
      )}
      {error && !draft && !pending && <p role="alert">{error}</p>}
      {driver && (
        <>
          <AdminServiceSummary publication={driver.publication} />
          <section className="panel" aria-label="Estado del perfil">
            <div className="admin-section-heading">
              <h2>Estado del perfil</h2>
              <AdminBadge
                positive={driver.publication.profile_status === "active"}
              >
                {adminLabels[driver.publication.profile_status]}
              </AdminBadge>
            </div>
            <p>{profileExplanation[driver.publication.profile_status]}</p>
            <p className="helper-text">Correo de la cuenta: {driver.email}</p>
            <div
              className="admin-profile-actions"
              hidden={!!draft || !!pending}
            >
              {(driver.publication.profile_status === "deactivated"
                ? (["active"] as const)
                : driver.publication.profile_status === "suspended"
                  ? (["active", "deactivated"] as const)
                  : (["suspended", "deactivated"] as const)
              ).map((status) => (
                <button
                  key={status}
                  className={`button ${status === "active" ? "button-outline" : "button-danger"}`}
                  disabled={
                    busy || loading || loadedKey !== refreshKey || !!readError
                  }
                  onClick={(event) => {
                    profileTrigger.current = event.currentTarget;
                    setError("");
                    setReasonError("");
                    setDraft({
                      status,
                      reason: retainedReason,
                      expected_status: driver.publication.profile_status,
                      expected_version: driver.profile_version,
                      name: driver.display_name,
                    });
                  }}
                >
                  {profileActions[status]}
                </button>
              ))}
            </div>
            {draft && !pending && (
              <AdminFocusPanel
                title={`${profileActions[draft.status]}: ${draft.name}`}
                busy={busy}
                onClose={closeProfile}
                restoreFocus={() => {
                  if (
                    profileTrigger.current?.isConnected &&
                    !profileTrigger.current.closest("[hidden]")
                  )
                    profileTrigger.current.focus();
                  else if (heading.current?.isConnected)
                    heading.current.focus();
                }}
              >
                <p>
                  Estado actual: {adminLabels[draft.expected_status]}. Estado
                  resultante: {adminLabels[draft.status]}.
                </p>
                <ProfileConsequence status={draft.status} />
                {error && <p role="alert">{error}</p>}
                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (busyRef.current) return;
                    if (!draft.reason.trim()) {
                      setReasonError("Ingresa el motivo del cambio.");
                      reasonField.current?.focus();
                      return;
                    }
                    setReasonError("");
                    setPending({ ...draft });
                  }}
                >
                  <label>
                    Motivo del cambio de perfil
                    <textarea
                      ref={reasonField}
                      aria-required="true"
                      aria-invalid={!!reasonError}
                      aria-describedby={
                        reasonError ? "profile-reason-error" : undefined
                      }
                      maxLength={1000}
                      value={draft.reason}
                      onChange={(event) =>
                        setDraft({ ...draft, reason: event.target.value })
                      }
                    />
                  </label>
                  {reasonError && (
                    <p
                      id="profile-reason-error"
                      className="field-error"
                      role="alert"
                    >
                      {reasonError}
                    </p>
                  )}
                  <button
                    className={`button ${draft.status === "active" ? "button-primary" : "button-danger"}`}
                    disabled={busy}
                  >
                    Revisar cambio de perfil
                  </button>
                </form>
              </AdminFocusPanel>
            )}
            {pending && (
              <AdminFocusPanel
                key="confirmation"
                title="Confirmar cambio de perfil"
                confirmation
                busy={busy}
                onClose={closeProfile}
                restoreFocus={() => {
                  if (
                    profileTrigger.current?.isConnected &&
                    !profileTrigger.current.closest("[hidden]")
                  )
                    profileTrigger.current.focus();
                  else if (heading.current?.isConnected)
                    heading.current.focus();
                }}
              >
                <p>
                  <strong>Servicio: {pending.name}</strong>
                </p>
                <p>
                  Estado actual al elegir la acción:{" "}
                  {adminLabels[pending.expected_status]}.
                </p>
                <p>
                  Estado resultante:{" "}
                  <strong>{adminLabels[pending.status]}</strong>.
                </p>
                <ProfileConsequence status={pending.status} />
                <p>Motivo: {pending.reason}</p>
                <button
                  className={`button ${pending.status === "active" ? "button-primary" : "button-danger"}`}
                  disabled={busy}
                  onClick={() => void mutate()}
                >
                  {busy ? "Guardando…" : "Confirmar cambio"}
                </button>
              </AdminFocusPanel>
            )}
          </section>
          <AdminPublicationScreen
            api={api}
            driverId={driverId}
            driverName={driver.display_name}
            refreshKey={refreshKey}
            onChanged={changed}
            showServiceSummary={false}
            onPublicationChange={(publication) =>
              setDriver((current) =>
                current ? { ...current, publication } : current,
              )
            }
          />
          <details className="panel admin-disclosure">
            <summary>
              <strong>Validación y observaciones</strong>
              <span>{adminLabels[driver.publication.validation_state]}</span>
            </summary>
            <p>
              La revisión de documentos y las decisiones se realizan en
              Validaciones.
            </p>
            {onValidations && (
              <button className="button button-outline" onClick={onValidations}>
                Ir a Validaciones
              </button>
            )}
            {validations && !validations.count && (
              <p>Sin información enviada para revisión.</p>
            )}
            <ol
              className="admin-validation-list"
              id="admin-validation-entries"
              ref={validationList}
            >
              {visibleValidations.map((revision) => (
                <ValidationContext
                  key={`${refreshKey}:${revision.id}`}
                  revision={revision}
                />
              ))}
            </ol>
            <p role="status" aria-live="polite" aria-atomic="true">
              {validations
                ? `Mostrando ${visibleValidations.length} de ${validations.count} validaciones. Más recientes primero.`
                : "Cargando validaciones…"}
            </p>
            {hasOlderValidations && (
              <div className="admin-pagination">
                <button
                  className="button button-outline"
                  aria-controls="admin-validation-entries"
                  disabled={busy || loading || !!readError}
                  onClick={() => {
                    validationFocusIndex.current = visibleValidations.length;
                    if (validationEntries.length > visibleValidations.length) {
                      setVisibleValidationCount(
                        Math.min(
                          validationEntries.length,
                          visibleValidationCount + validationBatchSize,
                        ),
                      );
                    } else {
                      setVisibleValidationCount(
                        visibleValidationCount + validationBatchSize,
                      );
                      setValidationOffset(
                        lastLoadedValidationOffset + validationPageSize,
                      );
                    }
                  }}
                >
                  {loading
                    ? "Cargando validaciones…"
                    : "Ver validaciones anteriores"}
                </button>
              </div>
            )}
          </details>
          <details className="panel admin-disclosure">
            <summary>
              <strong>Historial administrativo</strong>
              <span>{history?.count ?? "…"} acciones</span>
            </summary>
            <p>Acciones más recientes primero.</p>
            {history && !history.count && <p>Sin acciones administrativas.</p>}
            <ol
              className="admin-timeline"
              id="admin-history-events"
              ref={timeline}
            >
              {visibleHistory.map((entry) => (
                <HistoryEvent key={`${refreshKey}:${entry.id}`} entry={entry} />
              ))}
            </ol>
            <p role="status" aria-live="polite" aria-atomic="true">
              {history
                ? `Mostrando ${visibleHistory.length} de ${history.count} acciones.`
                : "Cargando historial…"}
            </p>
            {hasOlderHistory && (
              <div className="admin-pagination">
                <button
                  className="button button-outline"
                  aria-controls="admin-history-events"
                  disabled={busy || loading || !!readError}
                  onClick={() => {
                    historyFocusIndex.current = visibleHistory.length;
                    if (historyEvents.length > visibleHistory.length) {
                      setVisibleHistoryCount(
                        Math.min(
                          historyEvents.length,
                          visibleHistoryCount + historyBatchSize,
                        ),
                      );
                    } else {
                      setVisibleHistoryCount(
                        visibleHistoryCount + historyBatchSize,
                      );
                      setHistoryOffset(
                        lastLoadedHistoryOffset + historyPageSize,
                      );
                    }
                  }}
                >
                  {loading ? "Cargando acciones…" : "Ver acciones anteriores"}
                </button>
              </div>
            )}
          </details>
        </>
      )}
    </section>
  );
}
function ValidationContext({
  revision,
}: {
  revision: AdminDriverValidations["results"][number];
}) {
  const [observationOpen, setObservationOpen] = useState(false);
  const date = revision.reviewed_at || revision.submitted_at;
  const observationId = `admin-validation-observation-${revision.id}`;
  return (
    <li>
      <article className="admin-validation-context">
        <h3 tabIndex={-1}>{adminLabels[revision.state]}</h3>
        <p>
          <time dateTime={date || undefined}>{humanChileanDate(date)}</time>
        </p>
        {revision.observations ? (
          <>
            <button
              className="button button-quiet"
              aria-expanded={observationOpen}
              aria-controls={observationId}
              onClick={() => setObservationOpen((open) => !open)}
            >
              {observationOpen ? "Ocultar observación" : "Ver observación"}
            </button>
            <p
              className="admin-validation-observation"
              id={observationId}
              hidden={!observationOpen}
            >
              {observationOpen ? revision.observations : null}
            </p>
          </>
        ) : (
          <p className="helper-text">Sin observaciones.</p>
        )}
      </article>
    </li>
  );
}
function ProfileConsequence({
  status,
}: {
  status: ProfileStatusInput["status"];
}) {
  return (
    <p className="admin-action-consequence">
      {status === "active"
        ? "Reactivar el perfil vuelve a comprobar todos los requisitos. El servicio será visible solo si cumple validación, plan, publicación y rutas."
        : `Al ${status === "suspended" ? "suspender" : "desactivar"} el perfil, el servicio no aparecerá para los apoderados.`}
    </p>
  );
}
const actionLabels = {
  profile_status_changed: "Estado del perfil actualizado",
  subscription_changed: "Plan actualizado",
  validation_approved: "Validación aprobada",
  validation_rejected: "Se solicitaron cambios en la validación",
  document_read: "Documento consultado",
};
const targetLabels = {
  driver_profile: "Perfil",
  subscription: "Plan",
  validation: "Validación",
  document: "Documento",
};
function auditState(state: AdminDriverHistory["results"][number]["before"]) {
  const parts: string[] = [];
  if (state.plan_code && adminLabels[state.plan_code])
    parts.push(adminLabels[state.plan_code]);
  if (state.status)
    parts.push(
      adminLabels[state.status as keyof typeof adminLabels] ||
        "Estado sin descripción",
    );
  if (state.starts_at || state.ends_at)
    parts.push(
      `${humanChileanDate(state.starts_at ?? null)} → ${humanChileanDate(state.ends_at ?? null)}`,
    );
  return parts.join(" · ") || "Sin estado registrado";
}
function HistoryEvent({
  entry,
}: {
  entry: AdminDriverHistory["results"][number];
}) {
  const [changesOpen, setChangesOpen] = useState(false);
  const profileTitle =
    entry.action === "profile_status_changed" &&
    ["active", "suspended", "deactivated"].includes(entry.after.status ?? "")
      ? profileResults[entry.after.status as keyof typeof profileResults]
      : null;
  return (
    <li>
      <article>
        <time dateTime={entry.occurred_at}>
          {humanChileanDate(entry.occurred_at)}
        </time>
        <h3 tabIndex={-1}>{profileTitle ?? actionLabels[entry.action]}</h3>
        <p>Por: {entry.actor.display_name}</p>
        {entry.reason && entry.target_type !== "document" && (
          <p>Motivo: {entry.reason}</p>
        )}
        <details
          className="admin-event-changes"
          onToggle={(event) => setChangesOpen(event.currentTarget.open)}
        >
          <summary>Ver cambios</summary>
          {changesOpen && (
            <>
              {entry.target_type !== "document" && (
                <dl className="admin-event-states">
                  <div>
                    <dt>Antes</dt>
                    <dd>{auditState(entry.before)}</dd>
                  </div>
                  <div>
                    <dt>Después</dt>
                    <dd>{auditState(entry.after)}</dd>
                  </div>
                </dl>
              )}
              <details className="admin-technical">
                <summary>Detalles técnicos</summary>
                <p>Acción: {entry.action}</p>
                <p>
                  {targetLabels[entry.target_type]} #{entry.target_id}
                </p>
                <p>Referencia: {entry.correlation_id}</p>
              </details>
            </>
          )}
        </details>
      </article>
    </li>
  );
}
