import { useEffect, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type {
  Publication,
  Route,
  RouteInput,
  Plans,
  AdminSubscription,
} from "./api-types";
import {
  chileDateTimeParts,
  chileInstant,
  formatChileanDate,
  humanChileanDate,
  parseChileanDate,
} from "./dates";
import { ChileanDateField } from "./ChileanDateField";

const days = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miércoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;
const validationLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};
const subscriptionLabels = {
  inactive: "Inactivo",
  active: "Activo",
  suspended: "Suspendido",
};
const emptyRoute: RouteInput = {
  label: "",
  status: "active",
  weekdays: [],
  start_time: "07:00",
  end_time: "08:00",
  seat_capacity: 1,
  destination_label: "",
  destination_address: "",
  coverage_codes: [],
};
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "La información cambió. Actualiza antes de guardar.";
    if (error.status === 401 || error.status === 403)
      return "Tu sesión no permite esta acción.";
    return Object.values(error.fields).flat().join(" ") || error.message;
  }
  return "No se pudo completar la acción.";
}

export function DriverPublicationScreen({
  api,
  activeSection = "all",
  visible = true,
  refreshKey = 0,
  onPublicationChange,
}: {
  api: AuthApi;
  activeSection?: "all" | "publication" | "routes";
  visible?: boolean;
  refreshKey?: number;
  onPublicationChange?: (publication: Publication) => void;
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [communes, setCommunes] = useState<
    { code: string; display_name: string }[]
  >([]);
  const [form, setForm] = useState<RouteInput>(emptyRoute);
  const [editing, setEditing] = useState<Route | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [state, routeList, catalog] = await Promise.all([
      api.publication(),
      api.routes(),
      api.communes(),
    ]);
    setPublication(state);
    onPublicationChange?.(state);
    setRoutes(routeList.routes);
    setCommunes(catalog.communes);
  }
  useEffect(() => {
    void refresh().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [refreshKey]);
  async function intent() {
    if (!publication) return;
    setBusy(true);
    setError("");
    try {
      await api.setPublication({
        publication_requested: !publication.publication_requested,
      });
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing)
        await api.updateRoute(editing.id, {
          ...form,
          expected_revision: editing.revision,
        });
      else await api.createRoute(form);
      setEditing(null);
      setForm(emptyRoute);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function edit(route: Route) {
    setEditing(route);
    setForm({
      label: route.label,
      status: route.status,
      weekdays: route.weekdays,
      start_time: route.start_time,
      end_time: route.end_time,
      seat_capacity: route.seat_capacity,
      destination_label: route.destination_label,
      destination_address: route.destination_address,
      coverage_codes: route.coverage_codes,
    });
  }
  async function toggle(route: Route) {
    setBusy(true);
    setError("");
    try {
      await api.updateRoute(route.id, {
        label: route.label,
        status: route.status === "active" ? "inactive" : "active",
        weekdays: route.weekdays,
        start_time: route.start_time,
        end_time: route.end_time,
        seat_capacity: route.seat_capacity,
        destination_label: route.destination_label,
        destination_address: route.destination_address,
        coverage_codes: route.coverage_codes,
        expected_revision: route.revision,
      });
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel publication-area"
      aria-label="Publicación y rutas"
      hidden={!visible}
    >
      <div hidden={activeSection === "routes"}>
        <div className="publication-heading">
          <h2>Estado de publicación</h2>
          <button
            type="button"
            className="button button-link publication-refresh"
            disabled={busy}
            onClick={() =>
              void refresh().catch((cause: unknown) =>
                setError(errorMessage(cause)),
              )
            }
          >
            Actualizar estado
          </button>
        </div>
        {publication ? (
          <div className="publication-summary">
            <p
              className={`publication-state ${publication.eligible ? "publication-visible" : ""}`}
            >
              {publication.eligible
                ? "Tu servicio está visible para apoderados"
                : "Tu servicio no está visible para apoderados"}
            </p>
            <ul
              className="publication-facts"
              aria-label="Requisitos del servicio"
            >
              <li
                className={
                  publication.validation_state === "approved"
                    ? "is-success"
                    : ""
                }
              >
                <span aria-hidden="true">
                  {publication.validation_state === "approved" ? "✓" : "•"}
                </span>
                Validación{" "}
                {validationLabels[publication.validation_state].toLowerCase()}
              </li>
              <li
                className={
                  publication.active_route_count > 0 ? "is-success" : ""
                }
              >
                <span aria-hidden="true">
                  {publication.active_route_count > 0 ? "✓" : "•"}
                </span>
                {publication.active_route_count}{" "}
                {publication.active_route_count === 1
                  ? "ruta activa completa"
                  : "rutas activas completas"}
              </li>
            </ul>
            <div className="plan-block" aria-label="Plan actual">
              <h3>Plan actual</h3>
              {publication.subscription ? (
                <>
                  <strong className="plan-name">
                    {publication.subscription.plan_code.toUpperCase()}
                  </strong>
                  <span
                    className={`plan-status ${publication.subscription.status === "active" && !publication.blockers.some((item) => item.code.startsWith("subscription_")) ? "is-success" : ""}`}
                  >
                    {subscriptionLabels[publication.subscription.status]}
                  </span>
                  <p className="plan-validity">
                    {publication.blockers.some(
                      (item) => item.code === "subscription_expired",
                    )
                      ? `Venció el ${humanChileanDate(publication.subscription.ends_at)}`
                      : publication.blockers.some(
                            (item) => item.code === "subscription_not_started",
                          )
                        ? `Comienza el ${humanChileanDate(publication.subscription.starts_at)}`
                        : publication.subscription.ends_at
                          ? `${publication.subscription.status === "active" ? "Vigente" : "Período definido"} hasta ${humanChileanDate(publication.subscription.ends_at)}`
                          : "Sin fecha de vigencia definida"}
                  </p>
                </>
              ) : (
                <>
                  <strong className="plan-empty">Sin plan activo</strong>
                  <p className="plan-validity">
                    Necesitas un plan vigente para aparecer ante los apoderados.
                  </p>
                </>
              )}
            </div>
            {publication.blockers.length > 0 && (
              <div className="publication-blockers">
                <h3>Faltan o requieren atención</h3>
                <ul>
                  {publication.blockers.map((item) => (
                    <li key={item.code}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              className={
                publication.publication_requested
                  ? "button button-outline"
                  : "button button-primary"
              }
              disabled={busy}
              onClick={() => void intent()}
            >
              {publication.publication_requested
                ? "Retirar solicitud de publicación"
                : "Solicitar publicación"}
            </button>
          </div>
        ) : (
          <p>Cargando estado…</p>
        )}
      </div>
      <div hidden={activeSection === "publication"}>
        <h2>Mis rutas</h2>
        {routes.map((route) => (
          <div className="route-row" key={route.id}>
            <strong>{route.label}</strong> ·{" "}
            {route.status === "active" ? "Activa" : "Inactiva"} ·{" "}
            {route.start_time}–{route.end_time} · {route.seat_capacity} cupos
            <p>
              Próximo servicio: {formatChileanDate(route.next_service_date)} ·{" "}
              {route.used_seats} usados · {route.available_seats} disponibles
            </p>
            <p>
              {route.weekdays
                .map((day) => days.find(([code]) => code === day)?.[1] ?? day)
                .join(", ")}{" "}
              · Cobertura: {route.coverage_codes.join(", ")} · Destino:{" "}
              {route.destination_label}
            </p>
            <div>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => edit(route)}
              >
                Editar
              </button>{" "}
              <button
                className={
                  route.status === "active"
                    ? "button button-text-danger"
                    : "button button-primary"
                }
                disabled={busy}
                onClick={() => void toggle(route)}
              >
                {route.status === "active" ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
        {communes.length === 0 && (
          <p>
            Aún no hay comunas en el catálogo. Para una demostración local usa
            el catálogo sintético.
          </p>
        )}
        <h3>{editing ? "Editar ruta" : "Crear ruta"}</h3>
        <p>
          Un servicio de regreso requiere otra ruta. Los horarios son locales de
          Chile.
        </p>
        <form className="route-form" onSubmit={(event) => void save(event)}>
          <fieldset className="route-group">
            <legend>Datos de la ruta</legend>
            <label>
              Nombre de la ruta
              <input
                value={form.label}
                maxLength={100}
                required
                onChange={(event) =>
                  setForm({ ...form, label: event.target.value })
                }
              />
            </label>
            <label>
              Estado
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as RouteInput["status"],
                  })
                }
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </label>
          </fieldset>
          <fieldset className="route-group">
            <legend>Horario</legend>
            <fieldset>
              <legend>Días de servicio</legend>
              {days.map(([code, label]) => (
                <label key={code}>
                  <input
                    type="checkbox"
                    checked={form.weekdays.includes(code)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        weekdays: event.target.checked
                          ? [...form.weekdays, code]
                          : form.weekdays.filter((day) => day !== code),
                      })
                    }
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Hora de inicio
              <input
                type="time"
                lang="es-CL"
                step="60"
                value={form.start_time}
                required
                onChange={(event) =>
                  setForm({ ...form, start_time: event.target.value })
                }
              />
            </label>
            <label>
              Hora de término
              <input
                type="time"
                lang="es-CL"
                step="60"
                value={form.end_time}
                required
                onChange={(event) =>
                  setForm({ ...form, end_time: event.target.value })
                }
              />
            </label>
          </fieldset>
          <fieldset className="route-group">
            <legend>Cobertura y cupos</legend>
            <label>
              Cupos disponibles
              <input
                type="number"
                min="1"
                value={form.seat_capacity}
                required
                onChange={(event) =>
                  setForm({
                    ...form,
                    seat_capacity: Number(event.target.value),
                  })
                }
              />
            </label>
            <fieldset>
              <legend>Comunas de cobertura</legend>
              {communes.map((commune) => (
                <label key={commune.code}>
                  <input
                    type="checkbox"
                    checked={form.coverage_codes.includes(commune.code)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        coverage_codes: event.target.checked
                          ? [...form.coverage_codes, commune.code]
                          : form.coverage_codes.filter(
                              (code) => code !== commune.code,
                            ),
                      })
                    }
                  />{" "}
                  {commune.display_name}
                </label>
              ))}
            </fieldset>
          </fieldset>
          <fieldset className="route-group">
            <legend>Destino</legend>
            <label>
              Nombre del destino
              <input
                value={form.destination_label}
                required
                onChange={(event) =>
                  setForm({ ...form, destination_label: event.target.value })
                }
              />
            </label>
            <label>
              Dirección del destino (privada)
              <input
                value={form.destination_address}
                required
                onChange={(event) =>
                  setForm({ ...form, destination_address: event.target.value })
                }
              />
            </label>
          </fieldset>
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={
                busy ||
                communes.length === 0 ||
                form.weekdays.length === 0 ||
                form.coverage_codes.length === 0
              }
            >
              {editing ? "Guardar cambios" : "Crear ruta"}
            </button>
            {editing && (
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyRoute);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}

export function AdminPublicationScreen({
  api,
  driverId,
}: {
  api: AuthApi;
  driverId: number;
}) {
  const [data, setData] = useState<AdminSubscription | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [plan, setPlan] = useState<"basic" | "pro" | "elite">("basic");
  const [status, setStatus] = useState<"inactive" | "active" | "suspended">(
    "active",
  );
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("00:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [current, catalog] = await Promise.all([
      api.adminSubscription(driverId),
      api.plans(),
    ]);
    setData(current);
    setPlans(catalog);
    if (current.publication.subscription) {
      const sub = current.publication.subscription;
      setPlan(sub.plan_code);
      setStatus(sub.status);
      if (sub.starts_at) {
        const value = chileDateTimeParts(sub.starts_at);
        setStartDate(value.date);
        setStartTime(value.time);
      }
      if (sub.ends_at) {
        const value = chileDateTimeParts(sub.ends_at);
        setEndDate(value.date);
        setEndTime(value.time);
      }
    } else {
      setPlan("basic");
      setStatus("active");
      setStartDate("");
      setStartTime("00:00");
      setEndDate("");
      setEndTime("00:00");
    }
  }
  useEffect(() => {
    void refresh().catch((cause: unknown) => setError(errorMessage(cause)));
  }, [driverId]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const starts_at = chileInstant(startDate, startTime),
      ends_at = chileInstant(endDate, endTime);
    if (!starts_at || !ends_at) {
      setError(
        "Ingresa fechas DD/MM/AAAA y horas HH:mm válidas. Los cambios de hora ambiguos no se aceptan.",
      );
      return;
    }
    if (ends_at <= starts_at) {
      setError("La fecha y hora de término deben ser posteriores al inicio.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.changeSubscription(driverId, {
        plan_code: plan,
        status,
        starts_at,
        ends_at,
        reason,
        expected_version: data.version,
      });
      await refresh();
      setReason("");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel publication-area"
      aria-label="Plan y publicación del conductor"
    >
      <h2>Plan y publicación</h2>
      <button
        className="button button-quiet"
        disabled={busy}
        onClick={() =>
          void refresh().catch((cause: unknown) =>
            setError(errorMessage(cause)),
          )
        }
      >
        Actualizar estado
      </button>
      {data && (
        <>
          <p
            className={`publication-state ${data.publication.eligible ? "publication-visible" : ""}`}
          >
            {data.publication.eligible
              ? "Visible para apoderados"
              : "No visible para apoderados"}
          </p>
          <p>
            Validación: {validationLabels[data.publication.validation_state]} ·
            Publicación solicitada:{" "}
            {data.publication.publication_requested ? "Sí" : "No"}
          </p>
          <p>
            {data.publication.active_route_count} rutas activas completas ·
            Cobertura:{" "}
            {data.publication.coverage
              .map((item) => item.display_name)
              .join(", ") || "Sin cobertura"}
          </p>
          <p>
            Plan actual:{" "}
            {data.publication.subscription
              ? `${data.publication.subscription.plan_label} · ${subscriptionLabels[data.publication.subscription.status]} · ${humanChileanDate(data.publication.subscription.starts_at)} hasta ${humanChileanDate(data.publication.subscription.ends_at)}`
              : "Sin asignar"}
          </p>
          {data.publication.blockers.length > 0 && (
            <ul>
              {data.publication.blockers.map((item) => (
                <li key={item.code}>{item.message}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <form
        className="subscription-form"
        onSubmit={(event) => void save(event)}
      >
        <label>
          Plan
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value as typeof plan)}
          >
            {plans?.plans.map((item) => (
              <option key={item.code} value={item.code}>
                {item.display_label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="inactive">Inactivo</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </label>
        <p className="form-explanation">
          El plan estará vigente desde esta fecha y hora hasta la fecha y hora
          de término.
        </p>
        <ChileanDateField
          id="subscription-start-date"
          label="Fecha de inicio"
          value={startDate}
          error={!!startDate && !parseChileanDate(startDate)}
          onChange={setStartDate}
        />
        <label>
          Hora de inicio
          <input
            type="time"
            lang="es-CL"
            step="60"
            value={startTime}
            required
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <ChileanDateField
          id="subscription-end-date"
          label="Fecha de término"
          value={endDate}
          error={!!endDate && !parseChileanDate(endDate)}
          onChange={setEndDate}
        />
        <label>
          Hora de término
          <input
            type="time"
            lang="es-CL"
            step="60"
            value={endTime}
            required
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
        <p className="helper-text">
          El plan deja de estar vigente al llegar la fecha y hora de término.
        </p>
        <label>
          Motivo
          <textarea
            value={reason}
            required
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button
          className="button button-primary"
          disabled={busy || !data || !reason.trim()}
        >
          {busy ? "Guardando…" : "Guardar plan"}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
