import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type {
  Assignment,
  AssignmentInput,
  DriverSummary,
  Payment,
  PaymentInput,
  Route,
} from "./api-types";
import { ChileanDateField } from "./ChileanDateField";
import {
  chileDateTimeParts,
  formatChileanDate,
  parseChileanDate,
  humanChileanDate,
} from "./dates";

function message(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === "not_authenticated")
    return "La sesión caducó. Vuelve a iniciar sesión.";
  if (cause instanceof ApiError)
    return Object.values(cause.fields).flat().join(" ") || cause.message;
  return "No se pudo completar la acción.";
}

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
  const [routes, setRoutes] = useState<Route[]>([]);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState(0);
  const [form, setForm] = useState<AssignmentInput>(emptyAssignment);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dateAttempted, setDateAttempted] = useState(false);
  async function refresh() {
    const [routeList, assignments] = await Promise.all([
      api.routes(),
      api.assignments(),
    ]);
    setRoutes(routeList.routes);
    setRows(assignments.assignments);
  }
  useEffect(() => {
    void refresh().catch((cause: unknown) => setError(message(cause)));
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setDateAttempted(true);
    const startsOn = parseChileanDate(form.starts_on);
    const endsOn = form.ends_on ? parseChileanDate(form.ends_on) : null;
    if (!startsOn || (form.ends_on && !endsOn)) {
      setError("Revisa las fechas en formato DD/MM/AAAA.");
      return;
    }
    if (!/^[0-9]{9}$/.test(form.guardian_contact)) {
      setError("El teléfono del apoderado debe tener exactamente 9 dígitos.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, starts_on: startsOn, ends_on: endsOn };
      if (editing) {
        const { route_id: _routeId, ...changes } = payload;
        void _routeId;
        await api.updateAssignment(editing, changes);
      } else await api.createAssignment(payload);
      onAssignmentChange?.();
      setEditing(null);
      setForm(emptyAssignment);
      setDateAttempted(false);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function end(row: Assignment) {
    const entered = window.prompt(
      "Último día de servicio (DD/MM/AAAA)",
      formatChileanDate(todayChile()) ?? "",
    );
    if (entered === null) return;
    const endsOn = parseChileanDate(entered);
    if (!endsOn) {
      setError("Ingresa una fecha válida en formato DD/MM/AAAA.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.endAssignment(row.id, endsOn);
      onAssignmentChange?.();
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  const today = todayChile();
  return (
    <section
      className="panel publication-area"
      aria-label="Pasajeros asignados"
    >
      <h2>Pasajeros asignados</h2>
      <p className="helper-text">
        Registro privado del servicio acordado fuera de FurgoPlus. Para pruebas
        usa solo datos ficticios.
      </p>
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
      {rows
        .filter((row) => !filter || row.route_id === filter)
        .map((row) => {
          const ended = row.ends_on !== null && row.ends_on < today;
          return (
            <div className="route-row" key={row.id}>
              <strong>{row.student_display_name}</strong> ·{" "}
              {routes.find((route) => route.id === row.route_id)?.label} ·{" "}
              {ended
                ? "Finalizada"
                : row.starts_on > today
                  ? "Programada"
                  : "Vigente"}
              <p>
                {formatChileanDate(row.starts_on)}–
                {row.ends_on ? formatChileanDate(row.ends_on) : "sin término"}
              </p>
              <p>
                Recogida: {row.pickup_instruction} · Apoderado:{" "}
                {row.guardian_display_name} · {row.guardian_contact}
              </p>
              <button
                className="button button-quiet"
                disabled={busy}
                onClick={() => {
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
                  onClick={() => void end(row)}
                >
                  Terminar
                </button>
              )}
            </div>
          );
        })}
      {rows.length === 0 && <p>Aún no hay pasajeros asignados.</p>}
      <h3>{editing ? "Editar asignación" : "Crear asignación"}</h3>
      <form className="route-form" onSubmit={(event) => void save(event)}>
        <label>
          Ruta
          <select
            required
            disabled={editing !== null}
            value={form.route_id || ""}
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
        <label>
          Nombre visible del estudiante
          <input
            required
            maxLength={100}
            value={form.student_display_name}
            onChange={(event) =>
              setForm({ ...form, student_display_name: event.target.value })
            }
          />
        </label>
        <label>
          Recogida / instrucciones
          <input
            required
            maxLength={255}
            value={form.pickup_instruction}
            onChange={(event) =>
              setForm({ ...form, pickup_instruction: event.target.value })
            }
          />
        </label>
        <label>
          Nombre del apoderado
          <input
            required
            maxLength={100}
            value={form.guardian_display_name}
            onChange={(event) =>
              setForm({ ...form, guardian_display_name: event.target.value })
            }
          />
        </label>
        <label>
          Teléfono del apoderado
          <input
            required
            inputMode="numeric"
            maxLength={9}
            value={form.guardian_contact}
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
        <ChileanDateField
          id="assignment-starts-on"
          label="Desde"
          value={form.starts_on}
          error={dateAttempted && !parseChileanDate(form.starts_on)}
          onChange={(value) => setForm({ ...form, starts_on: value })}
        />
        <ChileanDateField
          id="assignment-ends-on"
          label="Hasta (opcional)"
          value={form.ends_on ?? ""}
          error={
            dateAttempted && !!form.ends_on && !parseChileanDate(form.ends_on)
          }
          onChange={(value) => setForm({ ...form, ends_on: value || null })}
        />
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
                setEditing(null);
                setForm(emptyAssignment);
                setDateAttempted(false);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyPayment);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dateAttempted, setDateAttempted] = useState(false);
  async function refresh() {
    const [records, roster] = await Promise.all([
      api.payments(),
      api.assignments(),
    ]);
    setPayments(records.payments);
    setAssignments(roster.assignments);
  }
  useEffect(() => {
    void refresh().catch((cause: unknown) => setError(message(cause)));
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setDateAttempted(true);
    const start = parseChileanDate(form.service_period_start);
    const end = parseChileanDate(form.service_period_end);
    const due = parseChileanDate(form.due_on);
    if (!start || !end || !due) {
      setError("Revisa las fechas en formato DD/MM/AAAA.");
      return;
    }
    const amount = Number(form.amount_clp);
    if (
      !/^[0-9]+$/.test(form.amount_clp) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      setError("El monto debe ser un entero positivo mayor que cero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createPayment({
        ...form,
        service_period_start: start,
        service_period_end: end,
        due_on: due,
        amount_clp: amount,
      });
      setForm(emptyPayment);
      setDateAttempted(false);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transition(row: Payment, action: "paid" | "void") {
    setBusy(true);
    setError("");
    try {
      if (action === "paid") await api.markPaymentPaid(row.id);
      else await api.voidPayment(row.id);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  const clp = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
  return (
    <section
      className="panel publication-area"
      aria-label="Pagos de transporte"
    >
      <h2>Pagos de transporte</h2>
      <p className="helper-text">
        Registro manual en pesos chilenos. No procesa pagos ni cambia tu plan.
      </p>
      {payments.map((row) => (
        <div className="route-row" key={row.id}>
          <strong>{clp.format(row.amount_clp)}</strong> ·{" "}
          {row.status === "pending"
            ? "Pendiente"
            : row.status === "paid"
              ? "Pagado"
              : "Anulado"}{" "}
          ·{" "}
          {assignments.find((item) => item.id === row.assignment_id)
            ?.student_display_name ?? `Asignación ${row.assignment_id}`}
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
              onClick={() => void transition(row, "void")}
            >
              Anular
            </button>
          )}
        </div>
      ))}
      {payments.length === 0 && <p>Aún no hay pagos registrados.</p>}
      <h3>Registrar pago pendiente</h3>
      <form className="route-form" onSubmit={(event) => void create(event)}>
        <label>
          Asignación
          <select
            required
            value={form.assignment_id || ""}
            onChange={(event) =>
              setForm({ ...form, assignment_id: Number(event.target.value) })
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
        <ChileanDateField
          id="payment-period-start"
          label="Inicio del período"
          value={form.service_period_start}
          error={dateAttempted && !parseChileanDate(form.service_period_start)}
          onChange={(value) =>
            setForm({ ...form, service_period_start: value })
          }
        />
        <ChileanDateField
          id="payment-period-end"
          label="Fin del período"
          value={form.service_period_end}
          error={dateAttempted && !parseChileanDate(form.service_period_end)}
          onChange={(value) => setForm({ ...form, service_period_end: value })}
        />
        <label>
          Monto CLP
          <input
            type="text"
            inputMode="numeric"
            value={form.amount_clp}
            onChange={(event) =>
              setForm({ ...form, amount_clp: event.target.value })
            }
          />
        </label>
        <ChileanDateField
          id="payment-due-on"
          label="Vencimiento"
          value={form.due_on}
          error={dateAttempted && !parseChileanDate(form.due_on)}
          onChange={(value) => setForm({ ...form, due_on: value })}
        />
        <button
          className="button button-primary"
          disabled={busy || !assignments.length}
        >
          Registrar pendiente
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

export function DriverSummaryScreen({ api }: { api: AuthApi }) {
  const [summary, setSummary] = useState<DriverSummary | null>(null);
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  async function refresh() {
    const generation = ++requestGeneration.current;
    setError("");
    try {
      const current = await api.summary();
      if (generation === requestGeneration.current) setSummary(current);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(message(cause));
      if (cause instanceof ApiError && cause.code === "not_authenticated") {
        requestGeneration.current += 1;
        setSummary(null);
      }
    }
  }
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      requestGeneration.current += 1;
      window.removeEventListener("focus", focus);
    };
  }, [api]);
  return (
    <section className="panel publication-area" aria-label="Resumen operativo">
      <h2>Resumen operativo</h2>
      <button onClick={() => void refresh()}>
        Actualizar resumen / Reintentar
      </button>
      {!summary && !error && <p>Cargando resumen…</p>}
      {summary && (
        <>
          <p>
            Perfil: {summary.publication.profile_status} · Validación:{" "}
            {summary.publication.validation_state} · Publicación:{" "}
            {summary.publication.eligible ? "Visible" : "No visible"}
          </p>
          <p>
            Plan:{" "}
            {summary.publication.subscription
              ? `${summary.publication.subscription.plan_label} · ${summary.publication.subscription.status}`
              : "Sin asignar"}
          </p>
          <p>
            Publicación solicitada:{" "}
            {summary.publication.publication_requested ? "Sí" : "No"} · Revisión{" "}
            {summary.publication.current_validation_revision}
          </p>
          {summary.publication.subscription && (
            <p>
              Vigencia:{" "}
              {humanChileanDate(summary.publication.subscription.starts_at)}{" "}
              hasta {humanChileanDate(summary.publication.subscription.ends_at)}
            </p>
          )}
          <ul>
            {summary.publication.blockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
          <p>
            Rutas: {summary.routes.length} · Asignaciones vigentes hoy:{" "}
            {summary.active_assignments}
          </p>
          {summary.routes.map((route) => (
            <p key={route.id}>
              {route.label} ({route.status}) · Próximo servicio:{" "}
              {formatChileanDate(route.next_service_date)} · {route.used_seats}{" "}
              usados / {route.available_seats} disponibles de{" "}
              {route.seat_capacity}
            </p>
          ))}
          <p>
            Pagos: {summary.payment_counts.pending} pendientes ·{" "}
            {summary.payment_counts.paid} pagados ·{" "}
            {summary.payment_counts.void} anulados
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
