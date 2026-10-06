import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type {
  AdminDriver,
  AdminDrivers,
  AdminDriverHistory,
  AdminDriverValidations,
  ProfileStatusInput,
} from "./api-types";
import { AdminPublicationScreen } from "./PublicationScreens";
import { humanChileanDate } from "./dates";

const labels = {
  active: "Activo",
  suspended: "Suspendido",
  deactivated: "Desactivado",
  draft: "Borrador",
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  inactive: "Inactivo",
  missing: "Sin asignar",
  eligible: "Visible",
  blocked: "No visible",
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
};
function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "not_authenticated")
      return "La sesión caducó. Vuelve a iniciar sesión.";
    if (error.status === 403) return "Tu sesión no permite esta acción.";
    if (error.status === 409)
      return "La información cambió. Revisa el estado actualizado antes de repetir la acción.";
    return Object.values(error.fields).flat().join(" ") || error.message;
  }
  return "No se pudo cargar o guardar la información. Reintenta.";
}
const actionLabels = {
  profile_status_changed: "Estado del perfil cambiado",
  subscription_changed: "Suscripción cambiada",
  validation_approved: "Validación aprobada",
  validation_rejected: "Validación rechazada",
  document_read: "Documento consultado",
};

function auditState(state: AdminDriverHistory["results"][number]["before"]) {
  const parts = [];
  if (state.plan_code) parts.push(labels[state.plan_code]);
  if (state.status)
    parts.push(labels[state.status as keyof typeof labels] || state.status);
  if (state.starts_at || state.ends_at)
    parts.push(
      `${humanChileanDate(state.starts_at ?? null)} hasta ${humanChileanDate(state.ends_at ?? null)}`,
    );
  return parts.join(" · ") || "Sin estado registrado";
}
const targetLabels = {
  driver_profile: "Perfil",
  subscription: "Suscripción",
  validation: "Validación",
  document: "Documento",
};

export function AdminControlScreen({ api }: { api: AuthApi }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [queue, setQueue] = useState<AdminDrivers | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setQueue(null);
    setError("");
    const params = new URLSearchParams({ ...applied, offset: String(offset) });
    void api
      .adminDrivers(params)
      .then((data) => {
        if (live) setQueue(data);
      })
      .catch((cause: unknown) => {
        if (live) {
          setError(errorText(cause));
          if (cause instanceof ApiError && cause.code === "not_authenticated")
            setSelected(null);
        }
      });
    return () => {
      live = false;
    };
  }, [api, applied, offset, refreshKey]);
  const select = (name: string, title: string, values: string[]) => (
    <label>
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
            {labels[value as keyof typeof labels]}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="screen admin-screen">
      <h1>Control de conductores</h1>
      <form
        className="panel"
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
        <label>
          Buscar nombre o correo
          <input
            maxLength={100}
            value={filters.q || ""}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
          />
        </label>
        {select("validation_state", "Validación actual", [
          "draft",
          "pending",
          "approved",
          "rejected",
        ])}
        {select("profile_status", "Estado del perfil", [
          "active",
          "suspended",
          "deactivated",
        ])}
        {select("subscription_status", "Suscripción", [
          "missing",
          "inactive",
          "active",
          "suspended",
        ])}
        {select("plan_code", "Plan asignado", ["basic", "pro", "elite"])}
        {select("publication", "Publicación", ["eligible", "blocked"])}
        <button>Aplicar filtros</button>
      </form>
      <button onClick={() => setRefreshKey((key) => key + 1)}>
        Actualizar cola
      </button>
      {error && <p role="alert">{error}</p>}
      {!queue && !error && <p>Cargando conductores…</p>}
      {queue && (
        <section className="panel" aria-label="Cola de control">
          <p>{queue.count} conductores</p>
          {!queue.results.length && (
            <p>No hay conductores con estos filtros.</p>
          )}
          {queue.results.map((driver) => (
            <article className="queue-item" key={driver.id}>
              <div>
                <h2>{driver.display_name}</h2>
                <p>{driver.email}</p>
                <p>
                  {labels[driver.publication.profile_status]} ·{" "}
                  {labels[driver.publication.validation_state]} ·{" "}
                  {driver.publication.eligible ? "Visible" : "No visible"}
                </p>
              </div>
              <button onClick={() => setSelected(driver.id)}>
                Abrir control
              </button>
            </article>
          ))}
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Conductores anteriores
          </button>
          <button
            disabled={offset + 25 >= queue.count}
            onClick={() => setOffset(offset + 25)}
          >
            Conductores siguientes
          </button>
        </section>
      )}
      {selected !== null && (
        <DriverControl
          key={selected}
          api={api}
          driverId={selected}
          onChanged={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </section>
  );
}

function DriverControl({
  api,
  driverId,
  onChanged,
}: {
  api: AuthApi;
  driverId: number;
  onChanged: () => void;
}) {
  const [driver, setDriver] = useState<AdminDriver | null>(null);
  const [history, setHistory] = useState<AdminDriverHistory | null>(null);
  const [validations, setValidations] = useState<AdminDriverValidations | null>(
    null,
  );
  const [historyOffset, setHistoryOffset] = useState(0);
  const [validationOffset, setValidationOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reason, setReason] = useState("");
  const [status, setStatus] =
    useState<ProfileStatusInput["status"]>("suspended");
  const [pending, setPending] = useState<ProfileStatusInput | null>(null);
  const pendingRef = useRef<ProfileStatusInput | null>(null);
  function setConfirmation(input: ProfileStatusInput | null) {
    pendingRef.current = input;
    setPending(input);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loadedKey, setLoadedKey] = useState(-1);
  useEffect(() => {
    let live = true;
    setError("");
    void Promise.all([
      api.adminDriver(driverId),
      api.adminDriverHistory(driverId, historyOffset),
      api.adminDriverValidations(driverId, validationOffset),
    ])
      .then(([current, audit, revisions]) => {
        if (!live) return;
        setDriver(current);
        setHistory(audit);
        setValidations(revisions);
        setLoadedKey(refreshKey);
        if (!pendingRef.current)
          setStatus(
            current.publication.profile_status === "active"
              ? "suspended"
              : "active",
          );
      })
      .catch((cause: unknown) => {
        if (live) {
          setError(errorText(cause));
          if (cause instanceof ApiError && cause.code === "not_authenticated") {
            setDriver(null);
            setHistory(null);
            setValidations(null);
          }
        }
      });
    return () => {
      live = false;
    };
  }, [api, driverId, historyOffset, validationOffset, refreshKey]);
  function changed() {
    setRefreshKey((key) => key + 1);
    onChanged();
  }
  async function mutate() {
    if (!pending || busy) return;
    const input = pending;
    setConfirmation(null);
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const current = await api.changeProfileStatus(driverId, input);
      setDriver(current);
      setReason("");
      setFeedback("Estado del perfil guardado.");
      changed();
    } catch (cause) {
      setError(errorText(cause));
      if (cause instanceof ApiError && cause.code === "not_authenticated") {
        setDriver(null);
        setHistory(null);
        setValidations(null);
      }
      if (cause instanceof ApiError && cause.status === 409) {
        // Refresh without erasing the conflict explanation.
        try {
          const current = await api.adminDriver(driverId);
          setDriver(current);
          setStatus(
            current.publication.profile_status === "active"
              ? "suspended"
              : "active",
          );
        } catch (refreshError) {
          setError(errorText(refreshError));
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Detalle de control">
      <h2>{driver?.display_name || "Detalle del conductor"}</h2>
      {loadedKey !== refreshKey && !error && <p>Cargando control…</p>}
      <button
        disabled={busy}
        onClick={() => {
          setConfirmation(null);
          changed();
        }}
      >
        Actualizar control / Reintentar
      </button>
      {error && <p role="alert">{error}</p>}
      {feedback && <p role="status">{feedback}</p>}
      {driver && (
        <>
          <p>
            {driver.email} · Estado del perfil:{" "}
            {labels[driver.publication.profile_status]}
          </p>
          <p>
            Validación actual: {labels[driver.publication.validation_state]} ·
            Revisión {driver.publication.current_validation_revision} · Revisión
            aprobada: {driver.publication.approved_revision ?? "Ninguna"}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && loadedKey === refreshKey && reason.trim())
                setConfirmation({
                  status,
                  reason,
                  expected_status: driver.publication.profile_status,
                  expected_version: driver.profile_version,
                });
            }}
          >
            <label>
              Nuevo estado del perfil
              <select
                disabled={busy || Boolean(pending)}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
              >
                {(["active", "suspended", "deactivated"] as const)
                  .filter(
                    (value) =>
                      value !== driver.publication.profile_status &&
                      !(
                        driver.publication.profile_status === "deactivated" &&
                        value === "suspended"
                      ),
                  )
                  .map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Motivo del cambio de perfil
              <textarea
                disabled={busy || Boolean(pending)}
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              disabled={
                busy ||
                Boolean(pending) ||
                loadedKey !== refreshKey ||
                !reason.trim()
              }
            >
              Cambiar estado del perfil
            </button>
          </form>
          {pending && (
            <div role="alertdialog" aria-label="Confirmar cambio de perfil">
              <p>
                Confirmar estado {labels[pending.status]} para{" "}
                {driver.display_name}. La restauración vuelve a comprobar todos
                los requisitos de publicación.
              </p>
              <button onClick={() => void mutate()}>Confirmar cambio</button>
              <button onClick={() => setConfirmation(null)}>
                Cancelar cambio
              </button>
            </div>
          )}
          <AdminPublicationScreen
            key={driver.profile_version ?? "initial"}
            api={api}
            driverId={driverId}
            refreshKey={refreshKey}
            onChanged={changed}
          />
          <h3>Historial de validaciones</h3>
          {validations && !validations.count && <p>Sin revisiones enviadas.</p>}
          {validations?.results.map((revision) => (
            <article key={revision.id}>
              <p>
                Revisión {revision.revision} · {revision.state} ·{" "}
                {humanChileanDate(
                  revision.reviewed_at || revision.submitted_at,
                )}
              </p>
              <p>{revision.observations || "Sin observaciones."}</p>
            </article>
          ))}
          <button
            disabled={!validationOffset}
            onClick={() =>
              setValidationOffset(Math.max(0, validationOffset - 25))
            }
          >
            Validaciones anteriores
          </button>
          <button
            disabled={
              !validations || validationOffset + 25 >= validations.count
            }
            onClick={() => setValidationOffset(validationOffset + 25)}
          >
            Más validaciones
          </button>
          <p>
            Consulta los documentos y decide revisiones en «Revisión de
            documentos».
          </p>
          <h3>Historial de acciones administrativas</h3>
          {history && !history.count && <p>Sin acciones administrativas.</p>}
          {history?.results.map((entry) => (
            <article key={entry.id}>
              <p>
                {actionLabels[entry.action]} · {entry.actor.display_name} ·{" "}
                {humanChileanDate(entry.occurred_at)}
              </p>
              <p>
                {targetLabels[entry.target_type]} #{entry.target_id} ·
                Referencia: {entry.correlation_id}
              </p>
              {entry.reason && <p>Motivo: {entry.reason}</p>}
              <p>
                Antes: {auditState(entry.before)} · Después:{" "}
                {auditState(entry.after)}
              </p>
            </article>
          ))}
          <button
            disabled={!historyOffset}
            onClick={() => setHistoryOffset(Math.max(0, historyOffset - 25))}
          >
            Acciones anteriores
          </button>
          <button
            disabled={!history || historyOffset + 25 >= history.count}
            onClick={() => setHistoryOffset(historyOffset + 25)}
          >
            Más acciones
          </button>
        </>
      )}
    </section>
  );
}
