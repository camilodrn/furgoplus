import { useEffect, useId, useRef, useState } from "react";
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
import { planValidity } from "./PlanValidity";
import { ActionNotice, useActionFeedback } from "./ActionFeedback";
import {
  AdminBadge,
  AdminFocusPanel,
  AdminStatusBadges,
  adminBlocker,
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
    "Estado administrativo del plan",
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
  pendingOnly = false,
}: {
  api: AuthApi;
  onValidations?: (id?: number) => void;
  rootNavigationKey?: number;
  pendingOnly?: boolean;
}) {
  const [revoked, setRevoked] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>(
    pendingOnly ? { validation_state: "pending" } : {},
  );
  const [applied, setApplied] = useState<Record<string, string>>(
    pendingOnly ? { validation_state: "pending" } : {},
  );
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
  const previousPendingOnly = useRef(pendingOnly);
  useEffect(() => {
    if (previousPendingOnly.current === pendingOnly) return;
    previousPendingOnly.current = pendingOnly;
    setFilters(pendingOnly ? { validation_state: "pending" } : {});
    setApplied(pendingOnly ? { validation_state: "pending" } : {});
    setOffset(0);
  }, [pendingOnly]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const filterPanel = useRef<HTMLDivElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const filterPanelId = useId();
  const filterTitleId = useId();
  const filterHintId = useId();
  const searchHintId = useId();
  const appliedFilterCount = filterDefinitions.filter(
    ([name]) => applied[name],
  ).length;
  const hasFilterChanges = filterDefinitions.some(
    ([name]) => (filters[name] || "") !== (applied[name] || ""),
  );
  function closeFilters() {
    setFiltersOpen(false);
    filterTrigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!filtersOpen) return;
    filterPanel.current?.querySelector("select")?.focus();
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !filterPanel.current?.contains(event.target) &&
        !filterTrigger.current?.contains(event.target)
      ) {
        // Return focus before the pointer's default action focuses its target.
        if (filterPanel.current?.contains(document.activeElement))
          filterTrigger.current?.focus({ preventScroll: true });
        setFiltersOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [filtersOpen]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (revoked) return;
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
        if (live) {
          if (offset > 0 && offset >= data.count)
            setOffset(
              Math.max(
                0,
                Math.floor((data.count - 1) / driverPageSize) * driverPageSize,
              ),
            );
          else setQueue(data);
        }
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(adminError(cause));
        setRetryable(adminRetryable(cause));
        if (cause instanceof ApiError && cause.code === "not_authenticated") {
          setRevoked(true);
          setSelection(null);
          setFilters({});
          setApplied({});
        }
      });
    return () => {
      live = false;
    };
  }, [api, applied, offset, refreshKey, revoked]);
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
          <div className="admin-list-title">
            <h1 tabIndex={-1} ref={heading}>
              Conductores
            </h1>
            {queue && (
              <p role="status">
                {queue.count} {queue.count === 1 ? "conductor" : "conductores"}
              </p>
            )}
          </div>
          <button
            className="button button-quiet"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Actualizar lista
          </button>
        </div>
        <p id={searchHintId} className="sr-only">
          Busca y filtra en todos los conductores por nombre del servicio o
          correo.
        </p>
        <div
          className="admin-search"
          onKeyDown={(event) => {
            if (filtersOpen && event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeFilters();
            }
          }}
        >
          <form
            noValidate
            className="admin-search-row"
            onSubmit={(event) => {
              event.preventDefault();
              setOffset(0);
              // Searching must not silently apply an advanced filter draft.
              const { q: _previousQuery, ...advanced } = applied;
              setApplied({
                ...advanced,
                ...(filters.q ? { q: filters.q } : {}),
              });
            }}
          >
            <label>
              Buscar conductor
              <input
                ref={searchField}
                type="search"
                aria-describedby={searchHintId}
                placeholder="Nombre del servicio o correo"
                maxLength={100}
                value={filters.q || ""}
                onChange={(event) =>
                  setFilters({ ...filters, q: event.target.value })
                }
              />
            </label>
            <button className="button button-primary">Buscar</button>
            <button
              ref={filterTrigger}
              type="button"
              className="button button-outline"
              aria-label={
                appliedFilterCount
                  ? `Filtros (${appliedFilterCount} ${appliedFilterCount === 1 ? "aplicado" : "aplicados"})`
                  : "Filtros"
              }
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-controls={filterPanelId}
              onClick={() => {
                if (filtersOpen) closeFilters();
                else setFiltersOpen(true);
              }}
            >
              Filtros
              {appliedFilterCount > 0 && (
                <span className="admin-filter-count" aria-hidden="true">
                  ({appliedFilterCount})
                </span>
              )}
            </button>
          </form>
          <div
            ref={filterPanel}
            id={filterPanelId}
            hidden={!filtersOpen}
            role="dialog"
            aria-labelledby={filterTitleId}
            aria-describedby={filterHintId}
            className="admin-filter-panel"
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget) &&
                !filterTrigger.current?.contains(event.relatedTarget)
              )
                setFiltersOpen(false);
            }}
          >
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                setOffset(0);
                setApplied(
                  Object.fromEntries(
                    Object.entries(filters).filter(([, value]) => value),
                  ),
                );
                closeFilters();
              }}
            >
              <h2 id={filterTitleId}>Filtros de conductores</h2>
              <p id={filterHintId} className="helper-text">
                Aplica para actualizar el listado. Cerrar conserva los cambios
                sin aplicar.
              </p>
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
              {hasFilterChanges && (
                <p className="helper-text" role="status">
                  Cambios sin aplicar
                </p>
              )}
              <div className="admin-filter-actions">
                <button className="button button-primary">
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setFilters(filters.q ? { q: filters.q } : {})}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={closeFilters}
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="admin-list-context">
          {(Object.keys(applied).length > 0 ||
            Object.values(filters).some(Boolean)) && (
            <div className="admin-applied-filters">
              {Object.keys(applied).length > 0 && (
                <div
                  className="admin-filter-tokens"
                  role="group"
                  aria-label="Filtros aplicados"
                >
                  {Object.entries(applied).map(([key, value]) => (
                    <span key={key}>
                      {key === "q"
                        ? `Búsqueda: ${value}`
                        : `${filterDefinitions.find(([name]) => name === key)?.[1]}: ${adminLabels[value as keyof typeof adminLabels]}`}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setFilters({});
                  setApplied({});
                  setOffset(0);
                  searchField.current?.focus();
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
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
                    {selected === null && (
                      <p className="helper-text">{driver.email}</p>
                    )}
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
const detailSections = [
  ["summary", "Resumen"],
  ["status", "Estado"],
  ["plan", "Plan"],
  ["validations", "Validaciones"],
  ["history", "Historial"],
] as const;
type DetailSection = (typeof detailSections)[number][0];
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
  onValidations?: (id?: number) => void;
}) {
  const [section, setSection] = useState<DetailSection>("summary");
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const focusSection = useRef(false);
  function navigate(next: DetailSection, focusContent = true) {
    historyFocusIndex.current = null;
    validationFocusIndex.current = null;
    focusSection.current = focusContent && section !== next;
    if (focusContent && section === next) sectionHeading.current?.focus();
    setSection(next);
  }
  useEffect(() => {
    if (focusSection.current) {
      sectionHeading.current?.focus();
      focusSection.current = false;
    }
  }, [section]);
  const [driver, setDriver] = useState<AdminDriver | null>(null);
  const [history, setHistory] = useState<AdminDriverHistory | null>(null);
  const [validations, setValidations] = useState<AdminDriverValidations | null>(
    null,
  );
  const [recentHistory, setRecentHistory] = useState<
    AdminDriverHistory["results"][number] | null
  >(null);
  const [recentValidation, setRecentValidation] = useState<
    AdminDriverValidations["results"][number] | null
  >(null);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyPages, setHistoryPages] = useState<
    Record<number, AdminDriverHistory["results"]>
  >({});
  const [visibleHistoryCount, setVisibleHistoryCount] =
    useState(historyBatchSize);
  const historyReturnToEnd = useRef(false);
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
  const visibleHistory = historyEvents.slice(
    visibleHistoryCount - historyBatchSize,
    visibleHistoryCount,
  );
  const hasOlderHistory =
    historyEvents.length > visibleHistoryCount ||
    (!!history && lastLoadedHistoryOffset + historyPageSize < history.count);
  const [validationOffset, setValidationOffset] = useState(0);
  const [validationPages, setValidationPages] = useState<
    Record<number, AdminDriverValidations["results"]>
  >({});
  const [visibleValidationCount, setVisibleValidationCount] =
    useState(validationBatchSize);
  const validationReturnToEnd = useRef(false);
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
  const visibleValidations = validationEntries.slice(
    visibleValidationCount - validationBatchSize,
    visibleValidationCount,
  );
  const hasOlderValidations =
    validationEntries.length > visibleValidationCount ||
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
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const profileDisclosure = useRef<HTMLDetailsElement>(null);
  const moreActionsTrigger = useRef<HTMLElement>(null);
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
    if (
      section === "validations" &&
      index !== null &&
      index < visibleValidations.length
    ) {
      validationFocusIndex.current = null;
      validationList.current?.querySelectorAll("h3")[index]?.focus();
    }
  }, [
    visibleValidationCount,
    visibleValidations.length,
    lastLoadedValidationOffset,
  ]);
  useEffect(() => {
    const index = historyFocusIndex.current;
    if (
      section === "history" &&
      index !== null &&
      index < visibleHistory.length
    ) {
      historyFocusIndex.current = null;
      timeline.current?.querySelectorAll("h3")[index]?.focus();
    }
  }, [visibleHistoryCount, visibleHistory.length, lastLoadedHistoryOffset]);
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
    setRecentHistory(null);
    setRecentValidation(null);
    setHistoryPages({});
    historyReturnToEnd.current = false;
    historyFocusIndex.current = null;
    setVisibleHistoryCount(historyBatchSize);
    setValidations(null);
    setValidationPages({});
    validationReturnToEnd.current = false;
    validationFocusIndex.current = null;
    setVisibleValidationCount(validationBatchSize);
    setDraft(null);
    setPending(null);
    setProfileActionsOpen(false);
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
        if (historyOffset === 0) setRecentHistory(audit.results[0] ?? null);
        if (validationOffset === 0)
          setRecentValidation(revisions.results[0] ?? null);
        const returnHistoryToEnd = historyReturnToEnd.current;
        historyReturnToEnd.current = false;
        setVisibleHistoryCount((count) =>
          returnHistoryToEnd
            ? Math.max(
                historyBatchSize,
                Math.ceil(audit.results.length / historyBatchSize) *
                  historyBatchSize,
              )
            : Object.hasOwn(historyPages, historyOffset)
              ? Math.min(
                  count,
                  Math.max(
                    historyBatchSize,
                    Math.ceil(audit.results.length / historyBatchSize) *
                      historyBatchSize,
                  ),
                )
              : historyBatchSize,
        );
        setHistoryPages({ [historyOffset]: audit.results });
        setValidations(revisions);
        const returnValidationToEnd = validationReturnToEnd.current;
        validationReturnToEnd.current = false;
        setVisibleValidationCount((count) =>
          returnValidationToEnd
            ? Math.max(
                validationBatchSize,
                Math.ceil(revisions.results.length / validationBatchSize) *
                  validationBatchSize,
              )
            : Object.hasOwn(validationPages, validationOffset)
              ? Math.min(
                  count,
                  Math.max(
                    validationBatchSize,
                    Math.ceil(revisions.results.length / validationBatchSize) *
                      validationBatchSize,
                  ),
                )
              : validationBatchSize,
        );
        setValidationPages({ [validationOffset]: revisions.results });
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
    historyReturnToEnd.current = false;
    historyFocusIndex.current = null;
    setVisibleHistoryCount(historyBatchSize);
    setValidationOffset(0);
    setValidationPages({});
    validationReturnToEnd.current = false;
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
  const driverActions = driver && (
    <div
      className="admin-driver-actions"
      role="group"
      aria-label="Acciones administrativas"
    >
      <button
        className={`button ${driver.publication.validation_state !== "approved" ? "button-primary" : "button-outline"}`}
        disabled={busy}
        onClick={() => navigate("validations")}
      >
        Revisar antecedentes
      </button>
      <button
        className="button button-outline"
        disabled={busy}
        onClick={() => navigate("plan")}
      >
        Gestionar plan
      </button>
      <details
        ref={profileDisclosure}
        className="admin-more-actions"
        open={profileActionsOpen}
        hidden={!!draft || !!pending}
        onKeyDown={(event) => {
          if (event.key === "Escape" && profileDisclosure.current?.open) {
            event.preventDefault();
            setProfileActionsOpen(false);
            moreActionsTrigger.current?.focus();
          }
        }}
      >
        <summary
          ref={moreActionsTrigger}
          className="button button-outline"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            event.preventDefault();
            if (!busy) setProfileActionsOpen((open) => !open);
          }}
        >
          Más acciones <span aria-hidden="true">▾</span>
        </summary>
        <div
          className="admin-profile-actions"
          hidden={!profileActionsOpen}
          role="group"
          aria-label="Cambiar estado del perfil"
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
      </details>
    </div>
  );
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
        {driver && <p className="helper-text">{driver.email}</p>}
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
          <nav
            className="admin-detail-navigation"
            aria-label="Secciones del detalle del conductor"
          >
            <div
              role="tablist"
              aria-label="Secciones del detalle del conductor"
              onKeyDown={(event) => {
                if (busy) return;
                const index = detailSections.findIndex(
                  ([value]) => value === section,
                );
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % detailSections.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + detailSections.length) %
                        detailSections.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? detailSections.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                navigate(detailSections[next]![0], false);
                event.currentTarget
                  .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }}
            >
              {detailSections.map(([value, label]) => (
                <button
                  key={value}
                  id={`driver-tab-${value}`}
                  type="button"
                  role="tab"
                  className="admin-detail-tab"
                  aria-selected={section === value}
                  tabIndex={section === value ? 0 : -1}
                  aria-controls={`driver-section-${value}`}
                  disabled={busy}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    navigate(value, false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>
          {(section === "summary" || section === "status") && (
            <DriverExecutiveSummary publication={driver.publication} />
          )}
          {(section === "summary" || section === "status") && driverActions}
          {draft && !pending && (
            <AdminFocusPanel
              title={`${profileActions[draft.status]}: ${draft.name}`}
              busy={busy}
              onClose={closeProfile}
              restoreFocus={() => {
                if (
                  profileTrigger.current?.isConnected &&
                  !profileTrigger.current.closest("[hidden]") &&
                  profileDisclosure.current?.open
                )
                  profileTrigger.current.focus();
                else if (moreActionsTrigger.current?.isConnected)
                  moreActionsTrigger.current.focus();
                else if (heading.current?.isConnected) heading.current.focus();
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
                  !profileTrigger.current.closest("[hidden]") &&
                  profileDisclosure.current?.open
                )
                  profileTrigger.current.focus();
                else if (moreActionsTrigger.current?.isConnected)
                  moreActionsTrigger.current.focus();
                else if (heading.current?.isConnected) heading.current.focus();
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
          <h2 ref={sectionHeading} tabIndex={-1} className="admin-detail-title">
            {detailSections.find(([value]) => value === section)?.[1]}
          </h2>
          <div
            id="driver-section-summary"
            role="tabpanel"
            aria-labelledby="driver-tab-summary"
            tabIndex={0}
            hidden={section !== "summary"}
          >
            <section
              aria-label="Actividad reciente"
              className="panel admin-recent-activity"
            >
              <p className="helper-text">
                Últimos registros recibidos. Consulta cada sección para ver más.
              </p>
              <div className="admin-task-row">
                <div>
                  <h3>Última validación enviada</h3>
                  {recentValidation ? (
                    <p>
                      Revisión {recentValidation.revision} ·{" "}
                      {adminLabels[recentValidation.state]} ·{" "}
                      {humanChileanDate(
                        recentValidation.reviewed_at ||
                          recentValidation.submitted_at,
                      )}
                    </p>
                  ) : (
                    <p>Sin información enviada para revisión.</p>
                  )}
                </div>
                <button
                  className="button button-outline"
                  onClick={() => navigate("validations")}
                >
                  Ver validaciones
                </button>
              </div>
              <div className="admin-task-row">
                <div>
                  <h3>Última acción administrativa</h3>
                  {recentHistory ? (
                    <p>
                      {historyTitle(recentHistory)} ·{" "}
                      {humanChileanDate(recentHistory.occurred_at)}
                    </p>
                  ) : (
                    <p>Sin acciones administrativas.</p>
                  )}
                </div>
                <button
                  className="button button-outline"
                  onClick={() => navigate("history")}
                >
                  Ver historial
                </button>
              </div>
            </section>
          </div>
          <div
            id="driver-section-status"
            role="tabpanel"
            aria-labelledby="driver-tab-status"
            tabIndex={0}
            hidden={section !== "status"}
          >
            <section aria-label="Datos del estado" className="panel">
              <p>{profileExplanation[driver.publication.profile_status]}</p>
              <dl className="admin-detail-facts">
                <div>
                  <dt>Publicación solicitada</dt>
                  <dd>
                    {driver.publication.publication_requested ? "Sí" : "No"}
                  </dd>
                </div>
                <div>
                  <dt>Cobertura</dt>
                  <dd>
                    {driver.publication.coverage
                      .map((item) => item.display_name)
                      .join(", ") || "Sin cobertura"}
                  </dd>
                </div>
                <div>
                  <dt>Revisión actual</dt>
                  <dd>
                    {driver.publication.current_validation_revision ??
                      "Sin revisión"}
                  </dd>
                </div>
                <div>
                  <dt>Revisión aprobada</dt>
                  <dd>
                    {driver.publication.approved_revision ??
                      "Sin revisión aprobada"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <div
            id="driver-section-plan"
            role="tabpanel"
            aria-labelledby="driver-tab-plan"
            tabIndex={0}
            hidden={section !== "plan"}
          >
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
          </div>
          <div
            id="driver-section-validations"
            role="tabpanel"
            aria-labelledby="driver-tab-validations"
            tabIndex={0}
            hidden={section !== "validations"}
          >
            <section className="panel" aria-label="Validación y observaciones">
              <p>
                La revisión de documentos y las decisiones se realizan en
                Validaciones.
              </p>
              {onValidations && (
                <button
                  className="button button-outline"
                  onClick={() => onValidations?.()}
                >
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
                    onReview={onValidations}
                  />
                ))}
              </ol>
              <p role="status" aria-live="polite" aria-atomic="true">
                {validations
                  ? `Mostrando ${lastLoadedValidationOffset + visibleValidationCount - validationBatchSize + (visibleValidations.length ? 1 : 0)}–${lastLoadedValidationOffset + visibleValidationCount - validationBatchSize + visibleValidations.length} de ${validations.count} validaciones. Más recientes primero.`
                  : "Cargando validaciones…"}
              </p>
              {(lastLoadedValidationOffset > 0 ||
                visibleValidationCount > validationBatchSize) && (
                <button
                  className="button button-outline"
                  disabled={busy || loading || !!readError}
                  onClick={() => {
                    validationFocusIndex.current = 0;
                    if (visibleValidationCount > validationBatchSize)
                      setVisibleValidationCount(
                        (count) => count - validationBatchSize,
                      );
                    else {
                      validationReturnToEnd.current = true;
                      setValidationOffset(
                        Math.max(
                          0,
                          lastLoadedValidationOffset - validationPageSize,
                        ),
                      );
                    }
                  }}
                >
                  Revisiones más recientes
                </button>
              )}
              <p className="helper-text">
                Tres revisiones por vista. Cada lectura recibe hasta 25; las
                páginas siguientes se consultan al avanzar.
              </p>
              {hasOlderValidations && (
                <div className="admin-pagination">
                  <button
                    className="button button-outline"
                    aria-controls="admin-validation-entries"
                    disabled={busy || loading || !!readError}
                    onClick={() => {
                      validationFocusIndex.current = 0;
                      if (validationEntries.length > visibleValidationCount) {
                        setVisibleValidationCount(
                          visibleValidationCount + validationBatchSize,
                        );
                      } else {
                        validationFocusIndex.current = 0;
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
            </section>
          </div>
          <div
            id="driver-section-history"
            role="tabpanel"
            aria-labelledby="driver-tab-history"
            tabIndex={0}
            hidden={section !== "history"}
          >
            <section className="panel" aria-label="Historial administrativo">
              <p>{history?.count ?? "…"} acciones</p>
              <p>Acciones más recientes primero.</p>
              {history && !history.count && (
                <p>Sin acciones administrativas.</p>
              )}
              <ol
                className="admin-timeline"
                id="admin-history-events"
                ref={timeline}
              >
                {visibleHistory.map((entry) => (
                  <HistoryEvent
                    key={`${refreshKey}:${entry.id}`}
                    entry={entry}
                  />
                ))}
              </ol>
              <p role="status" aria-live="polite" aria-atomic="true">
                {history
                  ? `Mostrando ${lastLoadedHistoryOffset + visibleHistoryCount - historyBatchSize + (visibleHistory.length ? 1 : 0)}–${lastLoadedHistoryOffset + visibleHistoryCount - historyBatchSize + visibleHistory.length} de ${history.count} acciones.`
                  : "Cargando historial…"}
              </p>
              {(lastLoadedHistoryOffset > 0 ||
                visibleHistoryCount > historyBatchSize) && (
                <button
                  className="button button-outline"
                  disabled={busy || loading || !!readError}
                  onClick={() => {
                    historyFocusIndex.current = 0;
                    if (visibleHistoryCount > historyBatchSize)
                      setVisibleHistoryCount(
                        (count) => count - historyBatchSize,
                      );
                    else {
                      historyReturnToEnd.current = true;
                      setHistoryOffset(
                        Math.max(0, lastLoadedHistoryOffset - historyPageSize),
                      );
                    }
                  }}
                >
                  Acciones más recientes
                </button>
              )}
              <p className="helper-text">
                Tres acciones por vista. Cada lectura recibe hasta 25; las
                páginas siguientes se consultan al avanzar.
              </p>
              {hasOlderHistory && (
                <div className="admin-pagination">
                  <button
                    className="button button-outline"
                    aria-controls="admin-history-events"
                    disabled={busy || loading || !!readError}
                    onClick={() => {
                      historyFocusIndex.current = 0;
                      if (historyEvents.length > visibleHistoryCount) {
                        setVisibleHistoryCount(
                          visibleHistoryCount + historyBatchSize,
                        );
                      } else {
                        historyFocusIndex.current = 0;
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
            </section>
          </div>
          {section !== "summary" && section !== "status" && (
            <>
              {driverActions}
              <DriverExecutiveSummary publication={driver.publication} />
            </>
          )}
        </>
      )}
    </section>
  );
}
function DriverExecutiveSummary({
  publication: p,
}: {
  publication: AdminDriver["publication"];
}) {
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const blockersId = useId();
  const blockerSet = JSON.stringify(p.blockers);
  const expanded = expandedFor === blockerSet;
  const visibleBlockers = expanded ? p.blockers : p.blockers.slice(0, 3);
  const validity = planValidity(
    p.subscription,
    p.blockers.map((item) => item.code),
  );
  return (
    <section
      className="panel admin-driver-snapshot"
      aria-label="Estado del servicio"
    >
      <div className="admin-section-heading">
        <h2>Estado del servicio</h2>
        <AdminBadge positive={p.eligible}>
          {p.eligible
            ? "Visible para apoderados"
            : "No visible para apoderados"}
        </AdminBadge>
      </div>
      <dl className="admin-detail-facts">
        <div>
          <dt>Perfil</dt>
          <dd>
            <AdminBadge
              positive={p.profile_status === "active"}
              danger={p.profile_status === "deactivated"}
            >
              {adminLabels[p.profile_status]}
            </AdminBadge>
          </dd>
        </div>
        <div>
          <dt>Validación</dt>
          <dd>
            <AdminBadge
              positive={p.validation_state === "approved"}
              neutral={p.validation_state === "pending"}
            >
              {adminLabels[p.validation_state]}
            </AdminBadge>
          </dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>
            {p.subscription
              ? `${p.subscription.plan_label} · ${validity}`
              : "Sin plan asignado"}
          </dd>
        </div>
        <div>
          <dt>Rutas activas completas</dt>
          <dd>{p.active_route_count}</dd>
        </div>
      </dl>
      {!p.eligible && (
        <div className="admin-driver-alerts">
          {p.blockers.length > 0 && (
            <p>
              Faltan {p.blockers.length}{" "}
              {p.blockers.length === 1 ? "requisito" : "requisitos"}.
            </p>
          )}
          <p>
            <strong>
              {p.blockers[0]
                ? adminBlocker(p.blockers[0])
                : "Revisa los requisitos pendientes del servicio."}
            </strong>
          </p>
          {p.blockers.length > 1 && (
            <ul id={blockersId}>
              {visibleBlockers.slice(1).map((item) => (
                <li key={item.code}>{adminBlocker(item)}</li>
              ))}
            </ul>
          )}
          {p.blockers.length > 3 && (
            <button
              type="button"
              className="button button-quiet"
              aria-expanded={expanded}
              aria-controls={blockersId}
              onClick={() => setExpandedFor(expanded ? null : blockerSet)}
            >
              {expanded
                ? "Ocultar requisitos"
                : p.blockers.length === 4
                  ? "Ver el requisito restante"
                  : `Ver los ${p.blockers.length - 3} requisitos restantes`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
function historyTitle(entry: AdminDriverHistory["results"][number]) {
  const profileStatus =
    entry.action === "profile_status_changed" ? entry.after.status : undefined;
  return profileStatus === "active" ||
    profileStatus === "suspended" ||
    profileStatus === "deactivated"
    ? profileResults[profileStatus]
    : actionLabels[entry.action];
}
function ValidationContext({
  revision,
  onReview,
}: {
  revision: AdminDriverValidations["results"][number];
  onReview?: (id?: number) => void;
}) {
  const [observationOpen, setObservationOpen] = useState(false);
  const date = revision.reviewed_at || revision.submitted_at;
  const observationId = `admin-validation-observation-${revision.id}`;
  return (
    <li>
      <article className="admin-validation-context">
        <h3 tabIndex={-1}>{adminLabels[revision.state]}</h3>
        <p>
          Revisión {revision.revision} · {revision.display_name_snapshot}
        </p>
        {onReview && (
          <button
            className="button button-outline"
            onClick={() => onReview(revision.id)}
          >
            Abrir expediente de revisión {revision.revision}
          </button>
        )}
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
  return (
    <li>
      <article>
        <time dateTime={entry.occurred_at}>
          {humanChileanDate(entry.occurred_at)}
        </time>
        <h3 tabIndex={-1}>{historyTitle(entry)}</h3>
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
