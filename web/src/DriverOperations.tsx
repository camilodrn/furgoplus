import { useEffect, useState } from "react";
import { AuthApi } from "./api";
import type {
  Assignment,
  AssignmentInput,
  Payment,
  PaymentInput,
  DriverSummary,
} from "./api-types";
import { ChileanDateField } from "./ChileanDateField";
import { validateForm } from "./formValidation";
import {
  chileDateTimeParts,
  formatChileanDate,
  parseChileanDate,
} from "./dates";

import {
  CapacityText,
  DriverReadNotice,
  DriverActionError,
  FieldError,
  ProductIcon,
  useDriverResource,
  type DriverDestination,
  ServiceAvailabilityNotice,
} from "./DriverExperience";
import { ServicePreparation, homeStatus } from "./DriverHomeStatus";
import {
  OperationalPanel,
  OperationalRow,
  OperationalTable,
  OperationalCell,
  DriverDialog,
} from "./OperationalPanel";

import { LocalPages, searchText, useLocalPage } from "./OperationsNavigation";

function todayChile(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const emptyAssignment: AssignmentInput = {
  route_id: 0,
  student_display_name: "",
  pickup_instruction: "",
  guardian_display_name: "",
  guardian_contact: "",
  starts_on: "",
  ends_on: null,
};

export function DriverRoster({
  api,
  onAssignmentChange,
  active = true,
}: {
  api: AuthApi;
  onAssignmentChange?: () => void;
  active?: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [assignmentState, setAssignmentState] = useState("all");
  const [form, setForm] = useState<AssignmentInput>(emptyAssignment);
  const [editing, setEditing] = useState<number | null>(null);
  const [dateAttempted, setDateAttempted] = useState(false);
  const [ending, setEnding] = useState<Assignment | null>(null);
  const [endDate, setEndDate] = useState("");
  const [detail, setDetail] = useState<Assignment | null>(null);
  const task = useDriverResource(
    api,
    async () => {
      const [routeList, assignments] = await Promise.all([
        api.routes(),
        api.assignments(),
      ]);
      return { routes: routeList.routes, assignments: assignments.assignments };
    },
    () => {
      setFormOpen(false);
      setForm(emptyAssignment);
      setEditing(null);
      setEnding(null);
      setEndDate("");
      setDetail(null);
      setFilter(0);
      setQuery("");
      setAssignmentState("all");
      setDateAttempted(false);
    },
    "assignment",
  );
  const { busy, fields } = task;
  const routes = task.data?.routes ?? [];
  const capacityPage = useLocalPage(routes, "roster-route-capacity", 5);
  const rows = task.data?.assignments ?? [];
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validateForm(event.currentTarget, task.setError)) return;
    setDateAttempted(true);
    const startsOn = parseChileanDate(form.starts_on);
    const endsOn = form.ends_on ? parseChileanDate(form.ends_on) : null;
    if (!startsOn || (form.ends_on && !endsOn)) {
      task.setError("Revisa las fechas en formato DD/MM/AAAA.");
      return;
    }
    if (!/^[0-9]{9}$/.test(form.guardian_contact)) {
      task.setError(
        "El teléfono del apoderado debe tener exactamente 9 dígitos.",
      );
      return;
    }
    const payload = { ...form, starts_on: startsOn, ends_on: endsOn };
    await task.mutate(
      async () => {
        if (editing) {
          const { route_id: _routeId, ...changes } = payload;
          void _routeId;
          return api.updateAssignment(editing, changes);
        }
        return api.createAssignment(payload);
      },
      () => {
        onAssignmentChange?.();
        setFormOpen(false);
        setEditing(null);
        setForm(emptyAssignment);
        setDateAttempted(false);
      },
      editing
        ? "Pasajero actualizado correctamente"
        : "Pasajero agregado correctamente",
      editing
        ? "No pudimos actualizar al pasajero"
        : "No pudimos agregar al pasajero",
    );
  }
  async function end(event: React.FormEvent) {
    event.preventDefault();
    if (!ending || busy) return;
    const endsOn = parseChileanDate(endDate);
    if (!endsOn) {
      task.setError("Ingresa una fecha válida en formato DD/MM/AAAA.");
      return;
    }
    await task.mutate(
      () => api.endAssignment(ending.id, endsOn),
      () => {
        onAssignmentChange?.();
        setEnding(null);
        setEndDate("");
      },
      "Asignación finalizada en la fecha indicada.",
      "No pudimos finalizar la asignación",
    );
  }
  const today = todayChile();
  const stateOf = (row: Assignment) =>
    row.ends_on && row.ends_on < today
      ? "ended"
      : row.starts_on > today
        ? "future"
        : "active";
  const matches = rows.filter(
    (row) =>
      (!filter || row.route_id === filter) &&
      (assignmentState === "all" || stateOf(row) === assignmentState) &&
      searchText(
        `${row.student_display_name} ${row.guardian_display_name} ${row.guardian_contact} ${routes.find((route) => route.id === row.route_id)?.label ?? ""}`,
      ).includes(searchText(query)),
  );
  const rosterPage = useLocalPage(
    matches,
    JSON.stringify([filter, query, assignmentState]),
  );
  return (
    <section
      className="publication-area driver-operations operations-workspace"
      aria-label="Pasajeros asignados"
    >
      <div className="publication-heading">
        <h1>Pasajeros</h1>
        <button
          className="button button-primary"
          hidden={formOpen}
          disabled={busy || !task.data || formOpen}
          onClick={() => {
            setEditing(null);
            setForm(emptyAssignment);
            setEnding(null);
            setDateAttempted(false);
            task.setError("");
            setFormOpen(true);
          }}
        >
          <span aria-hidden="true">＋ </span>Agregar pasajero
        </button>
      </div>
      <p className="helper-text">
        Esta información es privada y solo debe usarse para coordinar el
        traslado.
      </p>
      <DriverReadNotice {...task} />
      {!formOpen && !ending && <DriverActionError {...task} />}
      <button
        className="button button-quiet driver-refresh"
        disabled={busy || task.loading}
        onClick={() => void task.refresh()}
      >
        Actualizar pasajeros
      </button>
      <div className="roster-layout">
        {task.data && (
          <section
            className="driver-surface capacity-rail"
            aria-label="Cupos por ruta"
          >
            <div className="surface-heading">
              <h2>Cupos por ruta</h2>
              <p className="helper-text">
                Ocupación para la fecha indicada en cada ruta.
              </p>
            </div>
            <div
              className="capacity-options"
              id="roster-capacity-results"
              tabIndex={-1}
              role="group"
              aria-label="Seleccionar ruta"
            >
              <button
                className="capacity-option"
                aria-pressed={!filter}
                onClick={() => {
                  setFilter(0);
                  setQuery("");
                  setAssignmentState("all");
                }}
              >
                <strong>Todas mis rutas</strong>
                <span>{rows.length} asignaciones</span>
              </button>
              {capacityPage.rows.map((route) => (
                <div
                  className="capacity-option"
                  key={route.id}
                  data-selected={route.id === filter}
                >
                  <button
                    className="capacity-select"
                    aria-pressed={route.id === filter}
                    onClick={() => {
                      setFilter(route.id);
                      setQuery("");
                      setAssignmentState("all");
                      document.getElementById("roster-results")?.focus();
                    }}
                  >
                    <span className="sr-only">Ver pasajeros de</span>{" "}
                    <strong>{route.label}</strong>{" "}
                    <span>
                      {route.start_time.slice(0, 5)}–
                      {route.end_time.slice(0, 5)} ·{" "}
                      {route.status === "active" ? "Activa" : "Inactiva"}
                    </span>
                  </button>
                  <CapacityText route={route} />
                </div>
              ))}
              {!routes.length && <p>Sin rutas configuradas.</p>}
            </div>
            {routes.length > 5 && (
              <>
                <p className="helper-text">
                  Paginación local de las rutas recibidas. El filtro por ruta
                  permite seleccionar cualquiera de ellas.
                </p>
                <LocalPages
                  {...capacityPage}
                  busy={busy || task.loading}
                  label="Páginas de cupos por ruta de pasajeros"
                  resultsId="roster-capacity-results"
                />
              </>
            )}
          </section>
        )}
        <section
          className="driver-surface roster-results"
          aria-labelledby="roster-results"
        >
          <div className="operations-filters">
            <label>
              Buscar pasajero o apoderado
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Estado de asignación
              <select
                value={assignmentState}
                onChange={(event) => setAssignmentState(event.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Vigentes</option>
                <option value="future">Próximas</option>
                <option value="ended">Finalizadas</option>
              </select>
            </label>
            <label>
              Filtrar por ruta
              <select
                value={filter}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  setFilter(id);
                  const index = routes.findIndex((route) => route.id === id);
                  if (index >= 0)
                    capacityPage.setPage(
                      Math.floor(index / capacityPage.size) + 1,
                    );
                }}
              >
                <option value={0}>Todas mis rutas</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="surface-heading result-heading">
            <h2 id="roster-results" tabIndex={-1}>
              Pasajeros asociados
            </h2>
            {task.data && (
              <span role="status">{matches.length} asignaciones</span>
            )}
          </div>
          {task.data && (
            <details className="roster-scope helper-text">
              <summary>Alcance de búsqueda y filtros</summary>
              <p>
                Búsqueda, filtros y paginación locales sobre las asignaciones
                recibidas del servicio.
              </p>
            </details>
          )}
          {task.data && matches.length > 0 && (
            <OperationalTable
              title="Pasajeros asociados"
              headings={[
                "Pasajero / apoderado",
                "Ruta",
                "Vigencia",
                "Acciones",
              ]}
            >
              {rosterPage.rows.map((row) => (
                <tr key={row.id} role="row">
                  <OperationalCell label="Pasajero / apoderado">
                    <div className="passenger-identity">
                      <span className="passenger-symbol" aria-hidden="true">
                        <ProductIcon name="people" />
                      </span>
                      <div>
                        <strong>{row.student_display_name}</strong>
                        <small>{row.guardian_display_name}</small>
                      </div>
                    </div>
                  </OperationalCell>
                  <OperationalCell label="Ruta">
                    {routes.find((route) => route.id === row.route_id)?.label}
                    <small>Asignación #{row.id}</small>
                  </OperationalCell>
                  <OperationalCell label="Vigencia">
                    <span className={`status-pill status-${stateOf(row)}`}>
                      {stateOf(row) === "ended"
                        ? "Finalizada"
                        : stateOf(row) === "future"
                          ? "Comienza próximamente"
                          : "Vigente"}
                    </span>
                    <small>
                      {formatChileanDate(row.starts_on)}–
                      {row.ends_on
                        ? formatChileanDate(row.ends_on)
                        : "sin término"}
                    </small>
                  </OperationalCell>
                  <OperationalCell label="Acciones">
                    <button
                      className="button button-link"
                      aria-label={`Detalle de ${row.student_display_name}`}
                      onClick={() => setDetail(row)}
                    >
                      Detalle
                      <span className="sr-only">
                        {" "}
                        de {row.student_display_name}
                      </span>
                    </button>
                  </OperationalCell>
                </tr>
              ))}
            </OperationalTable>
          )}
          {task.data && (
            <LocalPages
              {...rosterPage}
              label="Páginas de pasajeros"
              resultsId="roster-results"
            />
          )}
          {task.data && rows.length > 0 && matches.length === 0 && (
            <div className="empty-state">
              <h3>No hay pasajeros que coincidan con los filtros.</h3>
              <button
                className="button button-outline"
                onClick={() => {
                  setFilter(0);
                  setQuery("");
                  setAssignmentState("all");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
          {task.data && rows.length === 0 && (
            <div className="empty-state">
              <ProductIcon name="people" />
              <h3>Aún no tienes pasajeros asignados.</h3>
              <p>
                Cuando acuerdes un servicio con una familia, puedes registrarlo
                aquí.
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  setForm(emptyAssignment);
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Agregar primer pasajero
              </button>
            </div>
          )}
        </section>
      </div>
      {detail && (
        <DriverDialog
          visible={active}
          title={detail.student_display_name}
          busy={busy}
          onClose={() => setDetail(null)}
        >
          <p>
            {routes.find((route) => route.id === detail.route_id)?.label} ·
            Asignación #{detail.id}
          </p>
          {detail.starts_on > today && (
            <p>
              Esta asignación comienza el {formatChileanDate(detail.starts_on)}.
              Aún no está vigente.
            </p>
          )}
          <p>
            {formatChileanDate(detail.starts_on)}–
            {detail.ends_on ? formatChileanDate(detail.ends_on) : "sin término"}
          </p>
          <details className="payment-details">
            <summary>Recogida y contacto</summary>
            <div className="passenger-contact-details">
              <div className="passenger-detail-row">
                <ProductIcon name="route" size={24} />
                <dl>
                  <dt>Recogida</dt>
                  <dd>{detail.pickup_instruction}</dd>
                </dl>
              </div>
              <div className="passenger-detail-row">
                <ProductIcon name="people" size={24} />
                <dl>
                  <dt>Apoderado</dt>
                  <dd>
                    <strong>{detail.guardian_display_name}</strong>
                  </dd>
                  <dt>Teléfono</dt>
                  <dd>
                    <a href={`tel:${detail.guardian_contact}`}>
                      {detail.guardian_contact}
                    </a>
                  </dd>
                </dl>
              </div>
            </div>
          </details>
          <div className="form-actions">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => {
                setEnding(null);
                setDetail(null);
                setFormOpen(true);
                setEditing(detail.id);
                setForm({
                  route_id: detail.route_id,
                  student_display_name: detail.student_display_name,
                  pickup_instruction: detail.pickup_instruction,
                  guardian_display_name: detail.guardian_display_name,
                  guardian_contact: detail.guardian_contact,
                  starts_on: formatChileanDate(detail.starts_on) ?? "",
                  ends_on: detail.ends_on
                    ? formatChileanDate(detail.ends_on)
                    : null,
                });
                setDateAttempted(false);
              }}
            >
              Editar
            </button>
            {stateOf(detail) !== "ended" && (
              <button
                className="button button-text-danger"
                disabled={busy}
                onClick={() => {
                  setEnding(detail);
                  setDetail(null);
                  setEndDate(formatChileanDate(todayChile()) ?? "");
                  task.setError("");
                }}
              >
                Finalizar asignación
              </button>
            )}
          </div>
        </DriverDialog>
      )}
      {ending && (
        <DriverDialog
          visible={active}
          title={`Finalizar asignación de ${ending.student_display_name}`}
          busy={busy}
          onClose={() => setEnding(null)}
        >
          <form
            className="validation-confirmation route-form"
            onSubmit={(event) => void end(event)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEnding(null);
            }}
          >
            <p>
              Indica el último día de traslado, incluido. La asignación se
              conserva como registro; no se elimina.
            </p>
            <ChileanDateField
              id="assignment-final-date"
              label="Último día de traslado"
              value={endDate}
              error={!!endDate && !parseChileanDate(endDate)}
              onChange={setEndDate}
            />
            <DriverActionError {...task} />
            <div className="form-actions">
              <button className="button button-primary" disabled={busy}>
                Confirmar finalización
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => setEnding(null)}
              >
                Cancelar finalización
              </button>
            </div>
          </form>
        </DriverDialog>
      )}
      {formOpen && (
        <DriverDialog
          visible={active}
          title={editing ? "Editar asignación" : "Agregar pasajero"}
          busy={busy}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setForm(emptyAssignment);
            setDateAttempted(false);
            task.setError("");
          }}
        >
          {task.data && !routes.length && (
            <p>Primero configura una ruta en Mi servicio → Rutas.</p>
          )}
          <form
            noValidate
            className="route-form"
            onSubmit={(event) => void save(event)}
          >
            <fieldset className="form-body" disabled={busy || !task.data}>
              <legend>Datos de la asignación</legend>
              <label>
                Ruta
                <select
                  required
                  disabled={editing !== null}
                  value={form.route_id || ""}
                  aria-invalid={!!fields.route_id}
                  aria-describedby={
                    fields.route_id ? "driver-route_id-error" : undefined
                  }
                  onChange={(event) =>
                    setForm({ ...form, route_id: Number(event.target.value) })
                  }
                >
                  <option value="">Selecciona una ruta</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.label}
                    </option>
                  ))}
                </select>
              </label>
              <FieldError errors={fields} name="route_id" />
              {routes.find((route) => route.id === form.route_id) && (
                <div>
                  <CapacityText
                    route={routes.find((route) => route.id === form.route_id)!}
                  />
                  <p className="helper-text">
                    Estos cupos corresponden a la fecha indicada. Al guardar, se
                    revisan las fechas de esta asignación.
                  </p>
                </div>
              )}
              <label>
                Nombre del estudiante
                <input
                  required
                  maxLength={100}
                  aria-describedby={
                    fields.student_display_name
                      ? "student-name-help driver-student_display_name-error"
                      : "student-name-help"
                  }
                  value={form.student_display_name}
                  aria-invalid={!!fields.student_display_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      student_display_name: event.target.value,
                    })
                  }
                />
              </label>
              <FieldError errors={fields} name="student_display_name" />
              <p id="student-name-help" className="helper-text">
                Usa el nombre habitual y el apellido necesario para
                distinguirlo.
              </p>
              <label>
                Instrucciones de recogida
                <input
                  required
                  maxLength={255}
                  value={form.pickup_instruction}
                  aria-invalid={!!fields.pickup_instruction}
                  aria-describedby={
                    fields.pickup_instruction
                      ? "driver-pickup_instruction-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setForm({ ...form, pickup_instruction: event.target.value })
                  }
                />
              </label>
              <FieldError errors={fields} name="pickup_instruction" />
              <label>
                Nombre del apoderado
                <input
                  required
                  maxLength={100}
                  value={form.guardian_display_name}
                  aria-invalid={!!fields.guardian_display_name}
                  aria-describedby={
                    fields.guardian_display_name
                      ? "driver-guardian_display_name-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      guardian_display_name: event.target.value,
                    })
                  }
                />
              </label>
              <FieldError errors={fields} name="guardian_display_name" />
              <label>
                Teléfono del apoderado
                <input
                  required
                  inputMode="numeric"
                  maxLength={9}
                  value={form.guardian_contact}
                  aria-invalid={!!fields.guardian_contact}
                  aria-describedby={
                    fields.guardian_contact
                      ? "driver-guardian_contact-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      guardian_contact: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 9),
                    })
                  }
                />
              </label>
              <FieldError errors={fields} name="guardian_contact" />
              <ChileanDateField
                id="assignment-starts-on"
                label="Fecha de inicio"
                value={form.starts_on}
                error={dateAttempted && !parseChileanDate(form.starts_on)}
                onChange={(value) => setForm({ ...form, starts_on: value })}
              />
              <FieldError errors={fields} name="starts_on" />
              <ChileanDateField
                id="assignment-ends-on"
                label="Fecha de término (opcional)"
                value={form.ends_on ?? ""}
                error={
                  dateAttempted &&
                  !!form.ends_on &&
                  !parseChileanDate(form.ends_on)
                }
                onChange={(value) =>
                  setForm({ ...form, ends_on: value || null })
                }
              />
              <FieldError errors={fields} name="ends_on" />
              <p className="helper-text">
                La fecha de inicio puede ser futura. La fecha de término incluye
                ese último día de traslado.
              </p>
              <DriverActionError {...task} />
              <div className="form-actions">
                <button
                  className="button button-primary"
                  disabled={busy || !routes.length}
                >
                  {editing ? "Guardar cambios" : "Crear asignación"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => {
                      setFormOpen(false);
                      setEditing(null);
                      setForm(emptyAssignment);
                      setDateAttempted(false);
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        </DriverDialog>
      )}
    </section>
  );
}

type PaymentForm = Omit<PaymentInput, "amount_clp"> & { amount_clp: string };

const emptyPayment: PaymentForm = {
  assignment_id: 0,
  service_period_start: "",
  service_period_end: "",
  amount_clp: "",
  due_on: "",
};
export function DriverPayments({
  api,
  active = true,
}: {
  api: AuthApi;
  active?: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyPayment);
  const [dateAttempted, setDateAttempted] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [detail, setDetail] = useState<Payment | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [passenger, setPassenger] = useState(0);
  const [period, setPeriod] = useState("");
  const task = useDriverResource(
    api,
    async () => {
      const [records, roster] = await Promise.all([
        api.payments(),
        api.assignments(),
      ]);
      return { payments: records.payments, assignments: roster.assignments };
    },
    () => {
      setFormOpen(false);
      setForm(emptyPayment);
      setVoiding(null);
      setPaying(null);
      setDetail(null);
      setQuery("");
      setStatus("all");
      setPassenger(0);
      setPeriod("");
      setDateAttempted(false);
    },
  );
  const { busy, fields } = task;
  const payments = task.data?.payments ?? [];
  const assignments = task.data?.assignments ?? [];
  const passengerName = (id: number) =>
    assignments.find((item) => item.id === id)?.student_display_name ??
    "Estudiante de una asignación anterior";
  const matchingPayments = payments.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      (!passenger || row.assignment_id === passenger) &&
      (!period ||
        (row.service_period_start <= `${period}-31` &&
          row.service_period_end >= `${period}-01`)) &&
      searchText(
        `${row.id} ${passengerName(row.assignment_id)} ${assignments.find((item) => item.id === row.assignment_id)?.guardian_display_name ?? ""} ${row.amount_clp} ${row.service_period_start} ${row.service_period_end}`,
      ).includes(searchText(query)),
  );
  const paymentPage = useLocalPage(
    matchingPayments,
    JSON.stringify([status, passenger, period, query]),
  );
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validateForm(event.currentTarget, task.setError)) return;
    setDateAttempted(true);
    const start = parseChileanDate(form.service_period_start);
    const end = parseChileanDate(form.service_period_end);
    const due = parseChileanDate(form.due_on);
    if (!start || !end || !due) {
      task.setError("Revisa las fechas en formato DD/MM/AAAA.");
      return;
    }
    const amount = Number(form.amount_clp);
    if (
      !/^[0-9]+$/.test(form.amount_clp) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      task.setError("El monto debe ser un entero positivo mayor que cero.");
      return;
    }
    await task.mutate(
      () =>
        api.createPayment({
          ...form,
          service_period_start: start,
          service_period_end: end,
          due_on: due,
          amount_clp: amount,
        }),
      () => {
        setFormOpen(false);
        setForm(emptyPayment);
        setDateAttempted(false);
      },
      "Pago pendiente registrado.",
      "No pudimos registrar el pago",
    );
  }
  async function transition(row: Payment, action: "paid" | "void") {
    await task.mutate(
      () =>
        action === "paid"
          ? api.markPaymentPaid(row.id)
          : api.voidPayment(row.id),
      () => {
        setVoiding(null);
        setPaying(null);
      },
      action === "paid" ? "Pago marcado como pagado." : "Registro anulado.",
      action === "paid"
        ? "No pudimos marcar el pago como pagado"
        : "No pudimos anular el registro",
    );
  }
  const clp = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
  return (
    <section
      className="publication-area driver-operations operations-workspace"
      aria-label="Registro de pagos"
    >
      <div className="publication-heading">
        <h1>Pagos</h1>
        <button
          className="button button-primary"
          hidden={formOpen}
          disabled={busy || !task.data || formOpen}
          onClick={() => {
            setForm(emptyPayment);
            setDateAttempted(false);
            task.setError("");
            setFormOpen(true);
          }}
        >
          <span aria-hidden="true">＋ </span>Registrar pago
        </button>
      </div>
      <p className="helper-text">
        Registro manual de pagos acordados con las familias. Marcar como pagado
        registra tu declaración; no verifica transferencias bancarias ni cobra
        dinero.
      </p>
      <DriverReadNotice {...task} />
      {!formOpen && !voiding && !paying && <DriverActionError {...task} />}
      <button
        className="button button-quiet driver-refresh"
        disabled={busy || task.loading}
        onClick={() => void task.refresh()}
      >
        Actualizar pagos
      </button>
      {task.data && (
        <dl className="payment-summary" aria-label="Resumen de pagos">
          {(
            [
              ["pending", "Pendientes"],
              ["paid", "Registrados como pagados"],
              ["void", "Anulados"],
            ] as const
          ).map(([code, label]) => (
            <div key={code}>
              <dt>{label}</dt>
              <dd className="summary-count">
                {payments.filter((row) => row.status === code).length} registros
                {code === "paid" ? " manuales" : ""}
              </dd>
              <dd className="operations-summary-amount">
                {clp.format(
                  payments
                    .filter((row) => row.status === code)
                    .reduce((sum, row) => sum + row.amount_clp, 0),
                )}{" "}
                CLP
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="driver-surface" hidden={formOpen}>
        <div className="operations-filters">
          <label>
            Buscar pago
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pasajero, apoderado, registro o monto"
            />
          </label>
          <label>
            Estado del pago
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="paid">Registrados como pagados</option>
              <option value="void">Anulados</option>
            </select>
          </label>
          <label>
            Pasajero del pago
            <select
              value={passenger}
              onChange={(event) => setPassenger(Number(event.target.value))}
            >
              <option value={0}>Todos los pasajeros</option>
              {[...new Set(payments.map((row) => row.assignment_id))].map(
                (id) => (
                  <option key={id} value={id}>
                    {passengerName(id)} · Asignación #{id}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Mes del servicio
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>
          <button
            className="button button-outline"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setPassenger(0);
              setPeriod("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
        <p className="helper-text">
          El mes incluye los períodos de servicio que coinciden total o
          parcialmente. Búsqueda y páginas sobre los registros recibidos del
          servicio. El resumen corresponde al total recibido.
        </p>
        <h3 id="payment-results" tabIndex={-1}>
          Registros de pagos
        </h3>
        {task.data && matchingPayments.length > 0 && (
          <OperationalTable
            title="Registros de pagos"
            headings={["Pasajero / período", "Monto CLP", "Estado", "Acciones"]}
          >
            {paymentPage.rows.map((row) => (
              <tr key={row.id} role="row">
                <OperationalCell label="Pasajero / período">
                  <strong>{passengerName(row.assignment_id)}</strong>
                  <small>
                    {formatChileanDate(row.service_period_start)}–
                    {formatChileanDate(row.service_period_end)} · #{row.id}
                  </small>
                </OperationalCell>
                <OperationalCell label="Monto CLP">
                  <strong className="payment-amount">
                    {clp.format(row.amount_clp)} CLP
                  </strong>
                  <small>Vence {formatChileanDate(row.due_on)}</small>
                </OperationalCell>
                <OperationalCell label="Estado">
                  <span className={`status-pill status-${row.status}`}>
                    {row.status === "pending"
                      ? "Pendiente"
                      : row.status === "paid"
                        ? "Registrado como pagado"
                        : "Anulado"}
                  </span>
                </OperationalCell>
                <OperationalCell label="Acciones">
                  <button
                    className="button button-link"
                    aria-label={`Ver registro #${row.id}`}
                    onClick={() => setDetail(row)}
                  >
                    Ver registro<span className="sr-only"> #{row.id}</span>
                  </button>
                </OperationalCell>
              </tr>
            ))}
          </OperationalTable>
        )}
        {task.data && (
          <LocalPages
            {...paymentPage}
            label="Páginas de pagos"
            resultsId="payment-results"
          />
        )}
        {task.data && payments.length > 0 && matchingPayments.length === 0 && (
          <p role="status">No hay pagos que coincidan con los filtros.</p>
        )}
        {task.data && payments.length === 0 && (
          <div className="empty-state">
            <ProductIcon name="payment" />
            <h3>Aún no has registrado pagos.</h3>
            <p>
              Registra los pagos acordados fuera de FurgoPlus para consultarlos
              aquí.
            </p>
          </div>
        )}
      </div>
      {detail && (
        <DriverDialog
          visible={active}
          title={`Registro #${detail.id}`}
          busy={busy}
          onClose={() => setDetail(null)}
        >
          <h4>
            {passengerName(detail.assignment_id)} ·{" "}
            {clp.format(detail.amount_clp)} CLP
          </h4>
          <p>
            Período: {formatChileanDate(detail.service_period_start)}–
            {formatChileanDate(detail.service_period_end)} · Vence:{" "}
            {formatChileanDate(detail.due_on)}
          </p>
          {detail.paid_at && (
            <p>
              Registrado como pagado: {chileDateTimeParts(detail.paid_at).date}{" "}
              · {chileDateTimeParts(detail.paid_at).time}
            </p>
          )}
          <p className="helper-text">
            Registro manual. FurgoPlus no verifica movimientos bancarios.
          </p>
          <div className="form-actions">
            {detail.status === "pending" && (
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => {
                  setPaying(detail);
                  setDetail(null);
                  setVoiding(null);
                }}
              >
                Marcar pagado
              </button>
            )}
            {detail.status !== "void" && (
              <button
                className="button button-text-danger"
                disabled={busy}
                onClick={() => {
                  setVoiding(detail);
                  setDetail(null);
                  setPaying(null);
                }}
              >
                Anular
              </button>
            )}
          </div>
        </DriverDialog>
      )}
      {paying && (
        <DriverDialog
          visible={active}
          title={`Marcar pagado: ${passengerName(paying.assignment_id)}`}
          busy={busy}
          onClose={() => setPaying(null)}
        >
          <p>
            Registro #{paying.id} · {clp.format(paying.amount_clp)} CLP ·{" "}
            {formatChileanDate(paying.service_period_start)}–
            {formatChileanDate(paying.service_period_end)}
          </p>
          <p>
            Confirma que deseas registrar manualmente este pago como pagado.
            FurgoPlus no verifica movimientos bancarios. Si te equivocas, puedes
            anular el registro.
          </p>
          <DriverActionError {...task} />
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void transition(paying, "paid")}
          >
            Confirmar registro como pagado
          </button>
        </DriverDialog>
      )}
      {voiding && (
        <DriverDialog
          visible={active}
          title={`Anular registro de ${clp.format(voiding.amount_clp)}`}
          busy={busy}
          onClose={() => setVoiding(null)}
        >
          <p>
            {passengerName(voiding.assignment_id)} · Registro #{voiding.id} ·{" "}
            {formatChileanDate(voiding.service_period_start)}–
            {formatChileanDate(voiding.service_period_end)}
          </p>
          <p>
            El registro se conserva como anulado y no podrás volver a marcarlo
            como pagado. Esta acción no devuelve dinero.
          </p>
          <DriverActionError {...task} />
          <div className="form-actions">
            <button
              disabled={busy}
              className="button button-danger"
              onClick={() => void transition(voiding, "void")}
            >
              Confirmar anulación
            </button>
            <button
              disabled={busy}
              className="button button-outline"
              onClick={() => setVoiding(null)}
            >
              Cancelar anulación
            </button>
          </div>
        </DriverDialog>
      )}
      {formOpen && (
        <DriverDialog
          visible={active}
          title="Registrar pago pendiente"
          busy={busy}
          onClose={() => {
            setFormOpen(false);
            setForm(emptyPayment);
            setDateAttempted(false);
            task.setError("");
          }}
        >
          <p className="helper-text">
            FurgoPlus solo registra este pago. No procesa ni cobra dinero.
          </p>
          {task.data && !assignments.length && (
            <p>Primero agrega un estudiante en Pasajeros.</p>
          )}
          <form
            noValidate
            className="route-form"
            onSubmit={(event) => void create(event)}
          >
            <fieldset className="form-body" disabled={busy || !task.data}>
              <legend>Datos del registro</legend>
              <label>
                Asignación
                <select
                  required
                  value={form.assignment_id || ""}
                  aria-invalid={!!fields.assignment_id}
                  aria-describedby={
                    fields.assignment_id
                      ? "driver-assignment_id-error"
                      : undefined
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      assignment_id: Number(event.target.value),
                    })
                  }
                >
                  <option value="">Selecciona una asignación</option>
                  {assignments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.student_display_name} · #{row.id} ·{" "}
                      {formatChileanDate(row.starts_on)}
                    </option>
                  ))}
                </select>
              </label>
              <FieldError errors={fields} name="assignment_id" />
              <ChileanDateField
                id="payment-period-start"
                label="Inicio del período"
                value={form.service_period_start}
                error={
                  dateAttempted && !parseChileanDate(form.service_period_start)
                }
                onChange={(value) =>
                  setForm({ ...form, service_period_start: value })
                }
              />
              <FieldError errors={fields} name="service_period_start" />
              <ChileanDateField
                id="payment-period-end"
                label="Fin del período"
                value={form.service_period_end}
                error={
                  dateAttempted && !parseChileanDate(form.service_period_end)
                }
                onChange={(value) =>
                  setForm({ ...form, service_period_end: value })
                }
              />
              <FieldError errors={fields} name="service_period_end" />
              <label>
                Monto CLP
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount_clp}
                  aria-invalid={!!fields.amount_clp}
                  aria-describedby={
                    fields.amount_clp ? "driver-amount_clp-error" : undefined
                  }
                  onChange={(event) =>
                    setForm({ ...form, amount_clp: event.target.value })
                  }
                />
              </label>
              <FieldError errors={fields} name="amount_clp" />
              <ChileanDateField
                id="payment-due-on"
                label="Vencimiento"
                value={form.due_on}
                error={dateAttempted && !parseChileanDate(form.due_on)}
                onChange={(value) => setForm({ ...form, due_on: value })}
              />
              <FieldError errors={fields} name="due_on" />
              <DriverActionError {...task} />
              <button
                className="button button-primary"
                disabled={busy || !assignments.length}
              >
                Registrar pendiente
              </button>
            </fieldset>
          </form>
        </DriverDialog>
      )}
    </section>
  );
}

export function DriverSummaryScreen({
  api,
  name = "",
  onNavigate,
}: {
  api: AuthApi;
  name?: string;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const task = useDriverResource(api, () => api.summary());
  useEffect(() => {
    const focus = () => {
      void task.refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [task.refresh]);
  const greetingName = name.replace(/\s*—\s*$/, "").trim();
  const summary = task.data;
  const publication = summary?.publication;
  const status = publication ? homeStatus(publication) : null;
  return (
    <section
      className="driver-home driver-operations"
      aria-label="Resumen operativo"
    >
      <div className="publication-heading">
        <h2>Hola{greetingName ? `, ${greetingName}` : ""}</h2>
        {!task.error && (
          <button
            className="button button-quiet driver-refresh"
            onClick={() => void task.refresh()}
          >
            Actualizar
          </button>
        )}
      </div>
      <DriverReadNotice {...task} />
      {!summary && !task.readError && (
        <div className="home-loading" aria-hidden="true" />
      )}
      {summary && publication && status && (
        <>
          <section
            className={`home-visibility ${publication.eligible ? "is-visible" : "needs-attention"}`}
            aria-label="Visibilidad del servicio"
          >
            <div>
              <h3>{status.title}</h3>
              {!publication.eligible && <p>{status.explanation}</p>}
            </div>
            {onNavigate && (
              <button
                className={`button ${publication.eligible ? "button-outline" : "button-primary"}`}
                onClick={() => onNavigate(status.destination)}
              >
                {status.action}
              </button>
            )}
          </section>
          <ServiceAvailabilityNotice
            publication={publication}
            onNavigate={onNavigate}
          />
          <HomeActivity api={api} summary={summary} onNavigate={onNavigate} />
          <ServicePreparation
            publication={publication}
            onNavigate={onNavigate}
          />
          <OperationalPanel title="Rutas y cupos">
            <div className="home-route-list">
              {summary.routes.slice(0, 3).map((route) => (
                <article key={route.id} className="home-route-row route-line">
                  <ProductIcon name="route" />
                  <div>
                    <h3>{route.label}</h3>
                    <small>
                      {route.status === "active" ? "Activa" : "Inactiva"}
                    </small>
                  </div>
                  <CapacityText route={route} />
                  {onNavigate && (
                    <button
                      className="button button-outline"
                      onClick={() => onNavigate("roster")}
                    >
                      Ver pasajeros
                    </button>
                  )}
                </article>
              ))}
              {!summary.routes.length && (
                <p>
                  Sin rutas configuradas. Define un horario, destino y
                  capacidad.
                </p>
              )}
            </div>
            {onNavigate && (
              <button
                className="button button-link"
                onClick={() => onNavigate("routes")}
              >
                Ver todas las rutas
              </button>
            )}
          </OperationalPanel>
        </>
      )}
    </section>
  );
}
function ActivityRow({
  icon,
  title,
  count,
  label,
  action,
  onClick,
  children,
  primary = false,
}: {
  icon: "route" | "people" | "message" | "payment";
  title: string;
  count?: number;
  label: string;
  action: string;
  onClick?: () => void;
  children?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <OperationalRow
      icon={icon}
      title={title}
      action={action}
      onClick={onClick}
      primary={primary}
    >
      {children}
      {count !== undefined && (
        <p className="snapshot-count">
          <strong>{count}</strong> {label}
        </p>
      )}
      {count === 0 && (
        <p className="helper-text">
          Sin {title.toLowerCase()} {label}.
        </p>
      )}
    </OperationalRow>
  );
}
function HomeActivity({
  api,
  summary,
  onNavigate,
}: {
  api: AuthApi;
  summary: DriverSummary;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const task = useDriverResource(api, () => api.driverContactRequests());
  const count = task.data?.results.filter(
    (row) => row.status === "pending",
  ).length;
  // Visual priority only. Every destination keeps its server-side permissions.
  const primary: DriverDestination | undefined = !summary.publication.eligible
    ? undefined
    : task.loading
      ? undefined
      : count && count > 0
        ? "requests"
        : summary.payment_counts.pending > 0
          ? "payments"
          : summary.active_assignments > 0
            ? "roster"
            : "routes";
  const nextDestination = homeStatus(summary.publication).destination;
  const navigate = (destination: DriverDestination) =>
    onNavigate ? () => onNavigate(destination) : undefined;
  return (
    <div className="home-activity">
      <OperationalPanel title="Pendientes">
        <ActivityRow
          icon="message"
          title="Solicitudes"
          count={count}
          label="por responder"
          action="Ver solicitudes"
          onClick={navigate("requests")}
          primary={primary === "requests"}
        >
          <DriverReadNotice {...task} />
        </ActivityRow>
        <ActivityRow
          icon="payment"
          title="Pagos"
          count={summary.payment_counts.pending}
          label="pendientes"
          action="Ver registro de pagos"
          onClick={navigate("payments")}
          primary={primary === "payments"}
        />
      </OperationalPanel>
      <OperationalPanel title="Tu operación">
        <ActivityRow
          icon="route"
          title="Rutas"
          count={
            summary.routes.filter((route) => route.status === "active").length
          }
          label="activas"
          action="Gestionar rutas"
          onClick={
            nextDestination === "routes" && !summary.publication.eligible
              ? undefined
              : navigate("routes")
          }
          primary={primary === "routes"}
        />
        <ActivityRow
          icon="people"
          title="Pasajeros"
          count={summary.active_assignments}
          label="asignados hoy"
          action="Ver pasajeros"
          onClick={navigate("roster")}
          primary={primary === "roster"}
        />
      </OperationalPanel>
    </div>
  );
}
