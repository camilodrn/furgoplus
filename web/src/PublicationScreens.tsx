import { useEffect, useRef, useState } from "react";
import { AuthApi } from "./api";
import type { Publication, Route, RouteInput } from "./api-types";
import { humanChileanDate } from "./dates";
import {
  CapacityText,
  DriverReadNotice,
  DriverActionError,
  FieldError,
  ActivationPath,
  FocusPanel,
  ProductIcon,
  type DriverDestination,
  useDriverResource,
} from "./DriverExperience";

const days = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miércoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;
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
export function DriverPublicationScreen({
  api,
  activeSection = "all",
  visible = true,
  refreshKey = 0,
  onPublicationChange,
  onNavigate,
}: {
  api: AuthApi;
  activeSection?: "all" | "publication" | "routes";
  visible?: boolean;
  refreshKey?: number;
  onPublicationChange?: (publication: Publication) => void;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RouteInput>(emptyRoute);
  const [editing, setEditing] = useState<Route | null>(null);
  const task = useDriverResource(
    api,
    async () => {
      const [publication, routeList, catalog] = await Promise.all([
        api.publication(),
        api.routes(),
        api.communes(),
      ]);
      return {
        publication,
        routes: routeList.routes,
        communes: catalog.communes,
      };
    },
    () => {
      setFormOpen(false);
      setStep(0);
      setForm(emptyRoute);
      setEditing(null);
    },
    "route",
  );
  const { busy, fields } = task;
  useEffect(() => {
    const names = Object.keys(fields);
    if (!names.length) return;
    setStep(
      names.some((name) =>
        ["label", "status", "weekdays", "start_time", "end_time"].includes(
          name,
        ),
      )
        ? 0
        : 1,
    );
  }, [fields]);
  const publication = task.data?.publication;
  const routes = task.data?.routes ?? [];
  const communes = task.data?.communes ?? [];
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (lastRefreshKey.current !== refreshKey) {
      lastRefreshKey.current = refreshKey;
      void task.refresh();
    }
  }, [refreshKey, task.refresh]);
  const lastView = useRef({ visible, activeSection });
  useEffect(() => {
    const previous = lastView.current;
    lastView.current = { visible, activeSection };
    if (
      visible &&
      (!previous.visible || previous.activeSection !== activeSection)
    )
      void task.refresh();
  }, [visible, activeSection, task.refresh]);
  useEffect(() => {
    if (publication) onPublicationChange?.(publication);
  }, [publication]);
  useEffect(() => {
    const focus = () => {
      void task.refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [task.refresh]);
  async function intent() {
    if (!publication) return;
    const requested = !publication.publication_requested;
    await task.mutate(
      () => api.setPublication({ publication_requested: requested }),
      () => {},
      requested
        ? "Solicitud guardada. Revisa el estado actualizado y los requisitos pendientes."
        : "Dejaste de solicitar que tu servicio sea visible.",
      requested
        ? "No pudimos solicitar la publicación"
        : "No pudimos detener la publicación",
    );
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      setStep(step + 1);
      requestAnimationFrame(() =>
        document.getElementById("route-stage-title")?.focus(),
      );
      return;
    }
    await task.mutate(
      () =>
        editing
          ? api.updateRoute(editing.id, {
              ...form,
              expected_revision: editing.revision,
            })
          : api.createRoute(form),
      () => {
        setFormOpen(false);
        setStep(0);
        setEditing(null);
        setForm(emptyRoute);
      },
      "Ruta guardada.",
      "No pudimos guardar la ruta",
    );
  }
  function edit(route: Route) {
    setFormOpen(true);
    setStep(0);
    task.setError("");
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
    await task.mutate(
      () =>
        api.updateRoute(route.id, {
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
        }),
      () => {},
      route.status === "active" ? "Ruta desactivada." : "Ruta activada.",
      route.status === "active"
        ? "No pudimos desactivar la ruta"
        : "No pudimos activar la ruta",
    );
  }
  return (
    <section
      className="panel publication-area driver-operations"
      aria-label="Publicación y rutas"
      hidden={!visible}
    >
      <DriverReadNotice {...task} />
      {!formOpen && <DriverActionError {...task} />}
      <div hidden={activeSection === "routes"}>
        <div className="publication-heading">
          <h2>Visibilidad de tu servicio</h2>
          <button
            type="button"
            className="button button-link publication-refresh"
            disabled={busy}
            onClick={() => void task.refresh()}
          >
            Actualizar estado
          </button>
        </div>
        {publication ? (
          <div className="publication-summary">
            <span
              className={`hero-icon ${publication.eligible ? "is-success" : ""}`}
            >
              <ProductIcon
                name={publication.eligible ? "visible" : "waiting"}
              />
            </span>
            <p
              className={`publication-state ${publication.eligible ? "publication-visible" : ""}`}
            >
              {publication.eligible
                ? "Visible para apoderados"
                : "Aún no visible"}
            </p>
            <p>
              {publication.publication_requested
                ? publication.eligible
                  ? "Pediste que tu servicio sea visible y los apoderados pueden encontrarte."
                  : "Pediste que tu servicio sea visible, pero aún falta resolver los requisitos indicados abajo."
                : "Aún no has pedido que tu servicio sea visible."}
            </p>
            <ActivationPath publication={publication} onNavigate={onNavigate} />
            <div className="plan-block" aria-label="Plan actual">
              <h3>Plan actual</h3>
              {publication.subscription ? (
                <>
                  <strong className="plan-name">
                    {publication.subscription.plan_label}
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
            <p className="helper-text">
              {publication.publication_requested
                ? "Si dejas de mostrar tu servicio, los apoderados no podrán encontrarte. Tus rutas y registros privados se conservan."
                : "Al solicitarlo, tu servicio será visible solo cuando cumpla todos los requisitos. La solicitud por sí sola no lo hace visible."}
            </p>
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
                ? "Dejar de mostrar mi servicio"
                : "Solicitar que mi servicio sea visible"}
            </button>
          </div>
        ) : null}
      </div>
      <div hidden={activeSection === "publication"}>
        <div className="publication-heading">
          <h2>Mis rutas</h2>
          <button
            className="button button-primary"
            hidden={formOpen}
            disabled={busy || !task.data || formOpen}
            onClick={() => {
              setEditing(null);
              setForm(emptyRoute);
              setStep(0);
              task.setError("");
              setFormOpen(true);
            }}
          >
            <span aria-hidden="true">＋ </span>Crear ruta
          </button>
        </div>
        <button
          className="button button-link driver-refresh"
          disabled={busy || task.loading}
          onClick={() => void task.refresh()}
        >
          Actualizar rutas
        </button>
        <div hidden={formOpen}>
          <p>
            Una ruta define dónde y cuándo prestas el traslado de forma
            recurrente. El servicio de cada día se gestiona en la aplicación
            móvil.
          </p>

          {task.data && routes.length === 0 && (
            <div className="empty-state">
              <ProductIcon name="route" />
              <h3>Aún no tienes rutas</h3>
              <p>
                Agrega tu primera ruta para definir dónde y cuándo prestas el
                servicio.
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyRoute);
                  setStep(0);
                  setFormOpen(true);
                }}
              >
                Crear primera ruta
              </button>
            </div>
          )}
          <div className="operational-list">
            {routes.map((route) => (
              <article className="operational-card" key={route.id}>
                <div className="operational-card-heading">
                  <h3>{route.label}</h3>
                  <span className="status-pill">
                    {route.status === "active" ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <p>
                  {days
                    .filter(([code]) => route.weekdays.includes(code))
                    .map(([, label]) => label.slice(0, 3))
                    .join(" · ")}
                </p>
                <p className="route-time">
                  {route.start_time.slice(0, 5)} → {route.end_time.slice(0, 5)}
                </p>
                <CapacityText route={route} />
                <p>
                  Destino: {route.destination_label}
                  <br />
                  Cobertura:{" "}
                  {route.coverage_codes
                    .map(
                      (code) =>
                        communes.find((item) => item.code === code)
                          ?.display_name ?? "Comuna fuera del catálogo vigente",
                    )
                    .join(", ")}
                </p>
                <div className="form-actions">
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => edit(route)}
                  >
                    Editar
                  </button>
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => void toggle(route)}
                  >
                    {route.status === "active" ? "Desactivar" : "Activar"}
                  </button>
                </div>
                {route.status === "active" && (
                  <p className="helper-text">
                    Al desactivarla, deja de aparecer como ruta activa para los
                    apoderados. Las asignaciones se conservan.
                  </p>
                )}
              </article>
            ))}
          </div>
          {task.data && communes.length === 0 && (
            <p>
              No hay comunas disponibles para configurar la cobertura. Intenta
              actualizar las rutas más tarde.
            </p>
          )}
        </div>
        {formOpen && (
          <FocusPanel
            title={editing ? `Editar ruta: ${editing.label}` : "Crear ruta"}
            busy={busy}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
              setForm(emptyRoute);
              setStep(0);
              task.setError("");
            }}
          >
            <ol className="form-stepper" aria-label="Etapas de la ruta">
              {["Días y horario", "Cupos y cobertura", "Revisar"].map(
                (label, index) => (
                  <li
                    key={label}
                    aria-current={index === step ? "step" : undefined}
                  >
                    <span aria-hidden="true">
                      {index < step ? "✓" : index + 1}
                    </span>
                    {label}
                  </li>
                ),
              )}
            </ol>
            <h4 id="route-stage-title" tabIndex={-1}>
              {["Días y horario", "Cupos y cobertura", "Revisar"][step]}
            </h4>
            <p>
              El regreso requiere otra ruta. Los horarios son locales de Chile.
              No puedes cambiar los datos del servicio de hoy después de
              iniciarlo.
            </p>
            <form className="route-form" onSubmit={(event) => void save(event)}>
              <fieldset className="form-body" disabled={busy || !task.data}>
                {step === 0 && (
                  <>
                    <fieldset className="route-group">
                      <legend>Datos de la ruta</legend>
                      <label>
                        Nombre de la ruta
                        <input
                          value={form.label}
                          aria-invalid={!!fields.label}
                          aria-describedby={
                            fields.label ? "driver-label-error" : undefined
                          }
                          maxLength={100}
                          required
                          onChange={(event) =>
                            setForm({ ...form, label: event.target.value })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="label" />
                      <label>
                        Estado
                        <select
                          value={form.status}
                          aria-invalid={!!fields.status}
                          aria-describedby={
                            fields.status ? "driver-status-error" : undefined
                          }
                          onChange={(event) =>
                            setForm({
                              ...form,
                              status: event.target
                                .value as RouteInput["status"],
                            })
                          }
                        >
                          <option value="active">Activa</option>
                          <option value="inactive">Inactiva</option>
                        </select>
                      </label>
                      <FieldError errors={fields} name="status" />
                    </fieldset>
                    <fieldset className="route-group">
                      <legend>Horario</legend>
                      <fieldset>
                        <legend>Días de servicio</legend>
                        <FieldError errors={fields} name="weekdays" />
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
                                    : form.weekdays.filter(
                                        (day) => day !== code,
                                      ),
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
                          aria-invalid={!!fields.start_time}
                          aria-describedby={
                            fields.start_time
                              ? "driver-start_time-error"
                              : undefined
                          }
                          required
                          onChange={(event) =>
                            setForm({ ...form, start_time: event.target.value })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="start_time" />
                      <label>
                        Hora de término
                        <input
                          type="time"
                          lang="es-CL"
                          step="60"
                          value={form.end_time}
                          aria-invalid={!!fields.end_time}
                          aria-describedby={
                            fields.end_time
                              ? "driver-end_time-error"
                              : undefined
                          }
                          required
                          onChange={(event) =>
                            setForm({ ...form, end_time: event.target.value })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="end_time" />
                    </fieldset>
                  </>
                )}
                {step === 1 && (
                  <>
                    <fieldset className="route-group">
                      <legend>Capacidad</legend>
                      <label>
                        Capacidad de la ruta
                        <input
                          type="number"
                          min="1"
                          value={form.seat_capacity}
                          aria-invalid={!!fields.seat_capacity}
                          aria-describedby={
                            fields.seat_capacity
                              ? "driver-seat_capacity-error"
                              : "route-capacity-help"
                          }
                          required
                          onChange={(event) =>
                            setForm({
                              ...form,
                              seat_capacity: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="seat_capacity" />
                    </fieldset>
                    <p className="helper-text" id="route-capacity-help">
                      La capacidad es el total de asientos para pasajeros en
                      esta ruta. Los cupos utilizados y disponibles se calculan
                      según las fechas de las asignaciones.
                    </p>
                    <fieldset className="route-group">
                      <legend>Destino y cobertura</legend>
                      <label>
                        Nombre del destino
                        <input
                          value={form.destination_label}
                          aria-invalid={!!fields.destination_label}
                          aria-describedby={
                            fields.destination_label
                              ? "driver-destination_label-error"
                              : undefined
                          }
                          required
                          onChange={(event) =>
                            setForm({
                              ...form,
                              destination_label: event.target.value,
                            })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="destination_label" />
                      <label>
                        Dirección del destino (privada)
                        <input
                          value={form.destination_address}
                          aria-invalid={!!fields.destination_address}
                          aria-describedby={
                            fields.destination_address
                              ? "driver-destination_address-error"
                              : undefined
                          }
                          required
                          onChange={(event) =>
                            setForm({
                              ...form,
                              destination_address: event.target.value,
                            })
                          }
                        />
                      </label>
                      <FieldError errors={fields} name="destination_address" />
                      <fieldset>
                        <legend>Comunas de cobertura</legend>
                        <FieldError errors={fields} name="coverage_codes" />
                        {communes.map((commune) => (
                          <label key={commune.code}>
                            <input
                              type="checkbox"
                              checked={form.coverage_codes.includes(
                                commune.code,
                              )}
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
                  </>
                )}
                {step === 2 && (
                  <section
                    className="route-review"
                    aria-label="Revisión de la ruta"
                  >
                    <h4>{form.label}</h4>
                    <p>{form.status === "active" ? "Activa" : "Inactiva"}</p>
                    <p>
                      {days
                        .filter(([code]) => form.weekdays.includes(code))
                        .map(([, label]) => label)
                        .join(" · ")}
                    </p>
                    <p className="route-time">
                      {form.start_time} → {form.end_time}
                    </p>
                    <p>
                      {form.seat_capacity} cupos · {form.destination_label}
                    </p>
                    <p>Dirección privada: {form.destination_address}</p>
                    <p>
                      {form.coverage_codes
                        .map(
                          (code) =>
                            communes.find((commune) => commune.code === code)
                              ?.display_name ??
                            "Comuna fuera del catálogo vigente",
                        )
                        .join(" · ")}
                    </p>
                    <p className="helper-text">
                      Revisa los datos antes de guardar. Los cupos se verifican
                      en el servidor.
                    </p>
                  </section>
                )}
                <DriverActionError {...task} />
                <div className="form-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => {
                        setStep(step - 1);
                        requestAnimationFrame(() =>
                          document.getElementById("route-stage-title")?.focus(),
                        );
                      }}
                    >
                      Atrás
                    </button>
                  )}
                  <button
                    className="button button-primary"
                    disabled={
                      busy ||
                      communes.length === 0 ||
                      (step === 0 && form.weekdays.length === 0) ||
                      (step === 1 && form.coverage_codes.length === 0)
                    }
                  >
                    {step === 0
                      ? "Continuar: cupos y cobertura"
                      : step === 1
                        ? "Revisar ruta"
                        : editing
                          ? "Guardar cambios"
                          : "Crear ruta"}
                  </button>
                </div>
              </fieldset>
            </form>
            {editing && (
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => void toggle(editing)}
              >
                {editing.status === "active" ? "Desactivar" : "Activar"}
              </button>
            )}
          </FocusPanel>
        )}
      </div>
    </section>
  );
}

export { AdminPublicationScreen } from "./AdminPlanControls";
