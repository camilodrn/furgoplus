import { useEffect, useRef, useState } from "react";
import { AuthApi } from "./api";
import type {
  Assignment,
  AssignmentInput,
  Payment,
  PaymentInput,
} from "./api-types";
import { ChileanDateField } from "./ChileanDateField";
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
  VisibilityStatus,
  ActivationPath,
  activationSteps,
  FocusPanel,
  ProductIcon,
  useDriverResource,
  type DriverDestination,
} from "./DriverExperience";

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
}: {
  api: AuthApi;
  onAssignmentChange?: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [form, setForm] = useState<AssignmentInput>(emptyAssignment);
  const [editing, setEditing] = useState<number | null>(null);
  const [dateAttempted, setDateAttempted] = useState(false);
  const [ending, setEnding] = useState<Assignment | null>(null);
  const [endDate, setEndDate] = useState("");
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
      setFilter(0);
      setDateAttempted(false);
    },
    "assignment",
  );
  const { busy, fields } = task;
  const routes = task.data?.routes ?? [];
  const rows = task.data?.assignments ?? [];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
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
  return (
    <section
      className="panel publication-area driver-operations"
      aria-label="Pasajeros asignados"
    >
      <div className="publication-heading">
        <h2>Pasajeros</h2>
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
        className="button button-link driver-refresh"
        disabled={busy || task.loading}
        onClick={() => void task.refresh()}
      >
        Actualizar pasajeros
      </button>
      <div hidden={formOpen}>
        <label>
          Filtrar por ruta
          <select
            value={filter}
            onChange={(event) => setFilter(Number(event.target.value))}
          >
            <option value={0}>Todas mis rutas</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.label}
              </option>
            ))}
          </select>
        </label>
        <div className="operational-list">
          {rows
            .filter((row) => !filter || row.route_id === filter)
            .map((row) => {
              const ended = row.ends_on !== null && row.ends_on < today;
              return (
                <article className="operational-card" key={row.id}>
                  <h3>{row.student_display_name}</h3>{" "}
                  <p>
                    {routes.find((route) => route.id === row.route_id)?.label}
                  </p>
                  <span className="status-pill">
                    {ended
                      ? "Finalizada"
                      : row.starts_on > today
                        ? "Comienza próximamente"
                        : "Vigente"}
                  </span>
                  {row.starts_on > today && (
                    <p className="helper-text">
                      Esta asignación comienza el{" "}
                      {formatChileanDate(row.starts_on)}. Aún no está vigente.
                    </p>
                  )}
                  <p>
                    {formatChileanDate(row.starts_on)}–
                    {row.ends_on
                      ? formatChileanDate(row.ends_on)
                      : "sin término"}
                  </p>
                  <p>
                    Recogida: {row.pickup_instruction}
                    <br />
                    Apoderado: {row.guardian_display_name}
                    <br />
                    Teléfono:{" "}
                    <a href={`tel:${row.guardian_contact}`}>
                      {row.guardian_contact}
                    </a>
                  </p>
                  <div className="form-actions">
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => {
                        setEnding(null);
                        setFormOpen(true);
                        setEditing(row.id);
                        setForm({
                          route_id: row.route_id,
                          student_display_name: row.student_display_name,
                          pickup_instruction: row.pickup_instruction,
                          guardian_display_name: row.guardian_display_name,
                          guardian_contact: row.guardian_contact,
                          starts_on: formatChileanDate(row.starts_on) ?? "",
                          ends_on: row.ends_on
                            ? formatChileanDate(row.ends_on)
                            : null,
                        });
                        setDateAttempted(false);
                      }}
                    >
                      Editar
                    </button>{" "}
                    {!ended && (
                      <button
                        className="button button-text-danger"
                        disabled={busy}
                        onClick={() => {
                          setEnding(row);
                          setEndDate(formatChileanDate(todayChile()) ?? "");
                          task.setError("");
                          requestAnimationFrame(() =>
                            document
                              .getElementById("assignment-end-title")
                              ?.focus(),
                          );
                        }}
                      >
                        Finalizar asignación
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
        {task.data &&
          rows.filter((row) => !filter || row.route_id === filter).length ===
            0 && (
            <div className="empty-state">
              <ProductIcon name="people" />
              <h3>
                Aún no tienes pasajeros asignados{filter ? " en esta ruta" : ""}
                .
              </h3>
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
      </div>
      {ending && (
        <form
          className="validation-confirmation route-form"
          onSubmit={(event) => void end(event)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEnding(null);
          }}
        >
          <h3 id="assignment-end-title" tabIndex={-1}>
            Finalizar asignación de {ending.student_display_name}
          </h3>
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
      )}
      {formOpen && (
        <FocusPanel
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
          <form className="route-form" onSubmit={(event) => void save(event)}>
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
        </FocusPanel>
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
export function DriverPayments({ api }: { api: AuthApi }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyPayment);
  const [dateAttempted, setDateAttempted] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
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
      setDateAttempted(false);
    },
  );
  const { busy, fields } = task;
  const payments = task.data?.payments ?? [];
  const assignments = task.data?.assignments ?? [];
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
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
      () => setVoiding(null),
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
      className="panel publication-area driver-operations"
      aria-label="Registro de pagos"
    >
      <div className="publication-heading">
        <h2>Pagos</h2>
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
        Registra los pagos acordados con las familias para consultarlos aquí.
      </p>
      <DriverReadNotice {...task} />
      {!formOpen && !voiding && <DriverActionError {...task} />}
      <button
        className="button button-link driver-refresh"
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
              ["paid", "Pagados"],
              ["void", "Anulados"],
            ] as const
          ).map(([code, label]) => (
            <div key={code}>
              <dt>{label}</dt>
              <dd>{payments.filter((row) => row.status === code).length}</dd>
            </div>
          ))}
        </dl>
      )}
      <div hidden={formOpen}>
        <div className="operational-list">
          {payments.map((row) => (
            <article className="operational-card" key={row.id}>
              <div className="payment-card-heading">
                <h3>
                  {assignments.find((item) => item.id === row.assignment_id)
                    ?.student_display_name ??
                    "Estudiante de una asignación anterior"}
                </h3>
                <strong className="payment-amount">
                  {clp.format(row.amount_clp)} CLP
                </strong>
              </div>
              <span className="status-pill">
                {row.status === "pending"
                  ? "Pendiente"
                  : row.status === "paid"
                    ? "Pagado"
                    : "Anulado"}
              </span>
              <p>Vence {formatChileanDate(row.due_on)}</p>
              <details className="payment-details">
                <summary>Ver registro</summary>
                <p>
                  Período: {formatChileanDate(row.service_period_start)}–
                  {formatChileanDate(row.service_period_end)} · Vence:{" "}
                  {formatChileanDate(row.due_on)}
                </p>
                {row.paid_at && (
                  <p>
                    Pagado: {chileDateTimeParts(row.paid_at).date} ·{" "}
                    {chileDateTimeParts(row.paid_at).time}
                  </p>
                )}
                <div className="form-actions">
                  {row.status === "pending" && (
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => void transition(row, "paid")}
                    >
                      Marcar pagado
                    </button>
                  )}{" "}
                  {row.status !== "void" && (
                    <button
                      className="button button-text-danger"
                      disabled={busy}
                      onClick={() => setVoiding(row)}
                    >
                      Anular
                    </button>
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>
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
      {voiding && (
        <div
          className="validation-confirmation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setVoiding(null);
          }}
        >
          <h3>Anular registro de {clp.format(voiding.amount_clp)}</h3>
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
        </div>
      )}
      {formOpen && (
        <FocusPanel
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
          <form className="route-form" onSubmit={(event) => void create(event)}>
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
                      {row.student_display_name}
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
        </FocusPanel>
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
  const path = useRef<HTMLDivElement>(null);
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
  const pending = publication
    ? activationSteps(publication).filter((step) => !step.complete).length
    : 0;
  return (
    <section
      className="driver-home driver-operations"
      aria-label="Resumen operativo"
    >
      <div className="publication-heading">
        <h2>Hola{greetingName ? `, ${greetingName}` : ""}</h2>
        {!task.error && (
          <button
            className="button button-link driver-refresh"
            onClick={() => void task.refresh()}
          >
            Actualizar
          </button>
        )}
      </div>
      <DriverReadNotice {...task} />
      {summary && publication && (
        <>
          <section
            className={`panel visibility-hero ${publication.eligible ? "hero-visible" : "hero-waiting"}`}
            aria-label="Visibilidad del servicio"
          >
            <span className="hero-icon">
              <ProductIcon
                name={publication.eligible ? "visible" : "waiting"}
              />
            </span>
            <div>
              <p className="eyebrow">¿Está visible mi servicio?</p>
              <VisibilityStatus publication={publication} />
              {!publication.eligible && (
                <>
                  <p>
                    {pending
                      ? `Te ${pending === 1 ? "falta 1 paso" : `faltan ${pending} pasos`} para aparecer en FurgoPlus.`
                      : "Actualiza el estado de tu servicio para revisar qué falta."}
                  </p>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      path.current?.focus();
                      path.current?.scrollIntoView?.({ block: "nearest" });
                    }}
                  >
                    Ver qué me falta
                  </button>
                </>
              )}
              {publication.eligible && onNavigate && (
                <button
                  className="button button-primary"
                  onClick={() => onNavigate("requests")}
                >
                  Revisar solicitudes
                </button>
              )}
            </div>
          </section>
          <div
            ref={path}
            tabIndex={-1}
            className="panel activation-section"
            role="region"
            aria-label="Progreso de activación"
          >
            <h2>Tu camino para aparecer en FurgoPlus</h2>
            <ActivationPath publication={publication} onNavigate={onNavigate} />
          </div>
          <h2>Tu actividad</h2>
          <div className="snapshot-grid">
            <SnapshotCard
              icon="route"
              title="Rutas"
              count={
                summary.routes.filter((route) => route.status === "active")
                  .length
              }
              label="activas"
              action={
                summary.routes.length
                  ? "Gestionar rutas"
                  : "Crear mi primera ruta"
              }
              onClick={onNavigate ? () => onNavigate("routes") : undefined}
            />
            <SnapshotCard
              icon="people"
              title="Pasajeros"
              count={summary.active_assignments}
              label="asignados hoy"
              action="Ver pasajeros"
              onClick={onNavigate ? () => onNavigate("roster") : undefined}
            />
            <HomeRequests api={api} onNavigate={onNavigate} />
            <SnapshotCard
              icon="payment"
              title="Pagos"
              count={summary.payment_counts.pending}
              label="pendientes"
              action="Ver registro de pagos"
              onClick={onNavigate ? () => onNavigate("payments") : undefined}
            />
          </div>
          {summary.routes.length > 0 && (
            <section className="route-snapshot" aria-label="Cupos por ruta">
              <div className="publication-heading">
                <h2>Cupos por ruta</h2>
                {onNavigate && (
                  <button
                    className="button button-link"
                    onClick={() => onNavigate("routes")}
                  >
                    Ver mis rutas
                  </button>
                )}
              </div>
              <div className="operational-list">
                {summary.routes.map((route) => (
                  <article key={route.id} className="operational-card">
                    <div className="operational-card-heading">
                      <h3>
                        <ProductIcon name="route" /> {route.label}
                      </h3>
                      <span className="status-pill">
                        {route.status === "active" ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <CapacityText route={route} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
function SnapshotCard({
  icon,
  title,
  count,
  label,
  action,
  onClick,
  children,
}: {
  icon: "route" | "people" | "message" | "payment";
  title: string;
  count?: number;
  label: string;
  action: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="snapshot-card"
      aria-label={`Resumen de ${title.toLowerCase()}`}
    >
      <ProductIcon name={icon} />
      <h3>{title}</h3>
      {children}
      {count !== undefined && (
        <p className="snapshot-count">
          <strong>{count}</strong> {label}
        </p>
      )}
      {onClick && (
        <button className="button button-link" onClick={onClick}>
          {action}
        </button>
      )}
    </section>
  );
}
function HomeRequests({
  api,
  onNavigate,
}: {
  api: AuthApi;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const task = useDriverResource(api, () => api.driverContactRequests());
  const count = task.data?.results.filter(
    (row) => row.status === "pending",
  ).length;
  return (
    <SnapshotCard
      icon="message"
      title="Solicitudes"
      count={count}
      label="por responder"
      action="Ver solicitudes"
      onClick={onNavigate ? () => onNavigate("requests") : undefined}
    >
      <DriverReadNotice {...task} />
    </SnapshotCard>
  );
}
