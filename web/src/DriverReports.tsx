import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ApiError, type AuthApi } from "./api";
import type {
  AdvancedReport,
  DriverCapabilities,
  MonthlyReport,
} from "./api-types";
import "./task12.css";
import { OperationalTable, OperationalCell } from "./OperationalPanel";
import { CollectionPages, useLocalPage } from "./OperationsNavigation";
import { planValidity } from "./PlanValidity";
import { ProductIcon, driverError } from "./DriverExperience";
import { formatChileanDate, humanChileanDate } from "./dates";

const states: Record<string, string> = {
  pending: "Pendientes",
  paid: "Pagados (manuales)",
  void: "Anulados",
  planned: "Planificados",
  in_progress: "En curso",
  completed: "Finalizados",
  accepted: "Aceptadas",
  declined: "Rechazadas",
  cancelled: "Canceladas",
};
const integer = (n: number) => n.toLocaleString("es-CL");

const periodLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });

export function DriverReports({
  api,
  onHome,
  onHelp,
  active = true,
}: {
  api: AuthApi;
  active?: boolean;
  onHome?: () => void;
  onHelp?: () => void;
}) {
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
    }).format(new Date()),
  );
  const [selected, setSelected] = useState(month);
  const [caps, setCaps] = useState<DriverCapabilities | null>(null);
  const [report, setReport] = useState<MonthlyReport | AdvancedReport | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const planBenefits = useRef<HTMLDetailsElement>(null);
  const sequence = useRef(0);
  const downloadSequence = useRef(0);
  const refresh = useCallback(
    async (background = false) => {
      const id = ++sequence.current;
      downloadSequence.current++;
      setDownloading(false);
      if (!background) {
        setDownloadNotice("");
        setLoading(true);
        setReport(null);
        setCaps(null);
      }
      setError("");
      try {
        const permissions = await api.driverCapabilities();
        if (id !== sequence.current) return;
        setCaps(permissions);
        // Keep unchanged summaries in place during automatic rechecks. Remove
        // revoked report data as soon as the server returns the new access state.
        setReport((current) => {
          if (!permissions.capabilities["reports.monthly.read"].enabled)
            return null;
          if (
            current &&
            "previous" in current &&
            (!permissions.capabilities["reports.detail.read"].enabled ||
              !permissions.capabilities["analytics.period_comparison"].enabled)
          )
            return null;
          return current;
        });
        if (permissions.capabilities["reports.monthly.read"].enabled) {
          const result =
            permissions.capabilities["reports.detail.read"].enabled &&
            permissions.capabilities["analytics.period_comparison"].enabled
              ? await api.advancedReport(selected)
              : await api.monthlyReport(selected);
          if (id === sequence.current) setReport(result);
        }
      } catch (cause) {
        if (
          id !== sequence.current ||
          (cause instanceof ApiError && cause.code === "stale_request")
        )
          return;
        setReport(null);
        if (cause instanceof ApiError && cause.code === "not_authenticated")
          setCaps(null);
        if (
          cause instanceof ApiError &&
          cause.status === 403 &&
          cause.code !== "not_authenticated"
        ) {
          setCaps(null);
          try {
            const updated = await api.driverCapabilities();
            if (id !== sequence.current) return;
            setCaps(updated);
          } catch {
            /* Keep the original error; no recursive retries. */
          }
        }
        if (id !== sequence.current) return;
        setError(driverError(cause));
      } finally {
        if (id === sequence.current) setLoading(false);
      }
    },
    [api, selected],
  );
  useEffect(() => {
    if (!active) return;
    void refresh();
    const focus = () => {
      void refresh(true);
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 30000);
    return () => {
      sequence.current++;
      downloadSequence.current++;
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, active]);
  // The timestamp only schedules a server recheck; the client never grants access.
  useEffect(() => {
    if (!caps?.subscription?.effective || !caps.subscription.ends_at) return;
    const remaining = Date.parse(caps.subscription.ends_at) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => void refresh(true),
      Math.min(remaining + 50, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [caps, refresh]);

  async function download(kind: "payments" | "runs" | "contacts") {
    const id = ++downloadSequence.current;
    setDownloading(true);
    setDownloadNotice("");
    setError("");
    try {
      const blob = await api.downloadReport(kind, selected);
      if (id !== downloadSequence.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `furgoplus-${kind}-${selected}.xlsx`;
      link.click();
      setDownloadNotice(
        "Archivo Excel listo. Revisa las descargas de tu navegador.",
      );
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (
        id !== downloadSequence.current ||
        (cause instanceof ApiError && cause.code === "stale_request")
      )
        return;
      if (cause instanceof ApiError && cause.status === 403) {
        const expected = sequence.current + 1;
        await refresh();
        if (sequence.current !== expected) return;
        setError(
          cause.code === "not_authenticated"
            ? driverError(cause)
            : "El acceso cambió. Se actualizó la información; revisa el plan y vuelve a consultar.",
        );
      } else setError(driverError(cause));
    } finally {
      if (id === downloadSequence.current) setDownloading(false);
    }
  }

  const canRead = caps?.capabilities["reports.monthly.read"].enabled;
  const withoutSubscription = !caps?.plan || !caps.subscription;
  const operationsAvailable = caps?.capabilities["operations.core"].enabled;

  return (
    <section
      className="task12-screen operations-workspace reports-screen"
      aria-labelledby="reports-title"
    >
      <header className="task12-heading">
        <div>
          <h1 id="reports-title">Plan y reportes</h1>
          <p className="task12-muted">
            Consulta el período y los registros de tu servicio.
          </p>
        </div>
        <button
          className="button button-outline"
          disabled={loading}
          onClick={() => void refresh()}
        >
          Actualizar información
        </button>
      </header>
      {error && (
        <div className="task12-feedback task12-error" role="alert">
          <strong>No pudimos completar la consulta</strong>
          <p>{error}</p>
          <button
            className="button button-outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            Volver a intentar
          </button>
        </div>
      )}
      {loading && (
        <div className="task12-loading" role="status">
          Cargando plan y reportes…
        </div>
      )}
      {caps && (
        <>
          {!canRead && (
            <article
              className="panel service-continuity"
              aria-labelledby="operations-title"
            >
              <h2 id="operations-title">
                {operationsAvailable
                  ? "Continúa con tu servicio"
                  : "Revisa el estado de tu servicio"}
              </h2>
              <p>
                {operationsAvailable
                  ? "Tu gestión diaria sigue disponible en Inicio. Revisa allí los requisitos de publicación."
                  : "En Inicio puedes revisar los requisitos pendientes de tu servicio."}
              </p>
              {caps.plan?.code === "basic" && caps.subscription?.effective && (
                <p className="task12-muted">
                  Básico incluye la gestión diaria. Para consultar resúmenes
                  mensuales, puedes informarte sobre Pro o Elite.
                </p>
              )}
              {onHelp && caps.subscription?.effective && (
                <button className="button button-outline" onClick={onHelp}>
                  Informarme sobre los planes
                </button>
              )}
            </article>
          )}

          {canRead && (
            <section
              aria-labelledby="monthly-title"
              className="task12-section monthly-report driver-surface"
            >
              <div className="task12-row">
                <div>
                  <h2 id="monthly-title">Resumen mensual</h2>
                  <p className="task12-muted">
                    Elige el mes que quieres revisar.
                  </p>
                </div>
                <form
                  className="report-filter"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selected === month) void refresh();
                    else setSelected(month);
                  }}
                >
                  <label htmlFor="report-month">
                    Mes del reporte
                    <input
                      id="report-month"
                      type="month"
                      required
                      min="2000-01"
                      max="2099-12"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </label>
                  <button className="button button-primary" disabled={loading}>
                    Consultar mes
                  </button>
                </form>
              </div>
              {report && (
                <>
                  <p className="report-period">
                    {periodLabel(report.period.month)}
                  </p>
                  {!report.summary.payment_count &&
                    !report.summary.run_count &&
                    !report.summary.contact_count && (
                      <div className="task12-empty" role="status">
                        <strong>
                          Sin datos registrados para este período.
                        </strong>
                        <p>
                          Cuando registres pagos, recorridos o solicitudes,
                          podrás revisarlos aquí. También puedes consultar otro
                          mes.
                        </p>
                      </div>
                    )}
                  <Summary report={report} />
                  <div className="report-analysis-grid">
                    {"previous" in report && <Advanced report={report} />}
                    {caps.capabilities["reports.xlsx.export"].enabled && (
                      <article
                        className="panel"
                        aria-labelledby="downloads-title"
                      >
                        <h3 id="downloads-title">Descarga tus reportes</h3>
                        <p className="task12-muted">
                          Tres archivos Excel del mes de{" "}
                          {periodLabel(report.period.month)}.
                        </p>
                        <div className="report-downloads">
                          {(
                            [
                              ["payments", "pagos"],
                              ["runs", "recorridos y cupos"],
                              ["contacts", "solicitudes de contacto"],
                            ] as const
                          ).map(([kind, label]) => (
                            <button
                              key={kind}
                              className="button button-outline"
                              disabled={loading || downloading}
                              onClick={() => void download(kind)}
                            >
                              Descargar Excel de {label}
                            </button>
                          ))}
                        </div>
                        {downloading && (
                          <p role="status">Preparando tu Excel…</p>
                        )}
                        {downloadNotice && (
                          <p
                            className="task12-feedback is-positive"
                            role="status"
                          >
                            {downloadNotice}
                          </p>
                        )}
                      </article>
                    )}
                  </div>
                  {"previous" in report && <ReportDetails report={report} />}
                  <CapacityDetails report={report} />
                  <details className="task12-disclosure">
                    <summary>Cómo leer estos reportes</summary>
                    <div className="task12-disclosure-body">
                      <p>
                        Los pagos se agrupan por vencimiento; los recorridos,
                        por fecha del servicio; las solicitudes, por fecha de
                        recepción. Se muestran sus estados actuales.
                      </p>
                      <p>
                        Los pagos son registros manuales, no cobros bancarios.
                        Los cupos no indican pasajeros transportados.
                      </p>
                      <ul>
                        {report.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                      <p className="task12-muted">
                        Información actualizada el{" "}
                        {humanChileanDate(report.generated_at)}. Fechas y meses
                        según la hora de Chile continental.
                      </p>
                    </div>
                  </details>
                </>
              )}
            </section>
          )}
          <article
            className="panel plan-card"
            aria-labelledby="current-plan-title"
          >
            <div className="task12-row">
              <div>
                <p className="task12-eyebrow">Tu plan actual</p>
                <h2 id="current-plan-title">
                  {caps.plan?.label ?? "Sin plan asignado"}
                </h2>
              </div>
              {!withoutSubscription && (
                <span
                  className={`task12-badge ${caps.subscription?.effective ? "is-positive" : "is-warning"}`}
                >
                  {planValidity(
                    caps.plan ? caps.subscription : null,
                    caps.blockers,
                  )}
                </span>
              )}
            </div>
            {caps.plan && typeof caps.plan.monthly_price_clp === "number" && (
              <p className="plan-price">
                <strong>${integer(caps.plan.monthly_price_clp)}</strong> CLP /
                mes
                <span>Valor de referencia del plan. Sin cobro automático.</span>
              </p>
            )}
            {caps.subscription && (
              <dl className="plan-dates">
                <div>
                  <dt>Inicio</dt>
                  <dd>
                    {caps.subscription.starts_at
                      ? humanChileanDate(caps.subscription.starts_at)
                      : "Sin fecha registrada"}
                  </dd>
                </div>
                <div>
                  <dt>Término</dt>
                  <dd>
                    {caps.subscription.ends_at
                      ? humanChileanDate(caps.subscription.ends_at)
                      : "Sin fecha registrada"}
                  </dd>
                </div>
              </dl>
            )}
            {!caps.subscription?.effective && (
              <p>
                {caps.plan
                  ? "Los beneficios de suscripción estarán disponibles cuando tu plan esté vigente."
                  : "Aún no tienes un plan asignado. Los reportes requieren una suscripción Pro o Elite vigente."}{" "}
                Puedes consultar las guías y enviar solicitudes de soporte.
              </p>
            )}
            {caps.blockers.includes("driver_unavailable") && (
              <p>
                Tu perfil necesita revisión para acceder a los reportes.
                Consulta el estado de tu servicio en Inicio.
              </p>
            )}
            <div className="task12-actions">
              {!withoutSubscription && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    if (planBenefits.current) {
                      planBenefits.current.open = true;
                      planBenefits.current.querySelector("summary")?.focus();
                    }
                  }}
                >
                  Ver beneficios
                </button>
              )}
              {withoutSubscription && (
                <button
                  className="button button-primary"
                  aria-controls="plan-benefits"
                  onClick={() => {
                    if (planBenefits.current) {
                      planBenefits.current.open = true;
                      planBenefits.current.querySelector("summary")?.focus();
                    }
                  }}
                >
                  Conocer los planes
                </button>
              )}
              {!canRead && onHome && (
                <button
                  className={`button ${withoutSubscription ? "button-outline" : "button-primary"}`}
                  onClick={onHome}
                >
                  Ir a Inicio
                </button>
              )}
              {!caps.subscription?.effective && onHelp && (
                <button className="button button-outline" onClick={onHelp}>
                  Consultar por mi plan
                </button>
              )}
            </div>
          </article>
          <PlanBenefits caps={caps} onHelp={onHelp} detailsRef={planBenefits} />
        </>
      )}
    </section>
  );
}

function PlanBenefits({
  caps,
  onHelp,
  detailsRef,
}: {
  caps: DriverCapabilities;
  onHelp?: () => void;
  detailsRef: RefObject<HTMLDetailsElement | null>;
}) {
  const benefits = [
    ["operations.core", "Gestión diaria de tu servicio"],
    [
      "reports.monthly.read",
      "Resúmenes mensuales de pagos, recorridos y solicitudes",
    ],
    ["analytics.period_comparison", "Comparación con el mes anterior"],
    ["reports.detail.read", "Detalle de los registros del mes"],
    ["reports.xlsx.export", "Tres reportes descargables en Excel"],
    ["assistant.faq", "Asistente para preguntas frecuentes"],
    [
      "assistant.contextual",
      "Orientación del asistente con los estados de tu cuenta",
    ],
  ] as const;
  const available = benefits.filter(
    ([key]) =>
      caps.capabilities[key].included_in_plan &&
      caps.capabilities[key].implemented,
  );
  return (
    <details id="plan-benefits" ref={detailsRef} className="task12-disclosure">
      <summary>
        {caps.plan
          ? "Conocer los beneficios de mi plan"
          : "Qué ofrece cada plan"}
      </summary>
      <div className="task12-disclosure-body">
        {caps.plan ? (
          <>
            <h3>Qué incluye {caps.plan.label}</h3>
            <ul>
              {available.map(([key, label]) => (
                <li key={key}>{label}</li>
              ))}
              <li>Centro de ayuda y solicitudes de soporte</li>
            </ul>
            {caps.plan.support_priority && (
              <p>
                Atención{" "}
                {
                  {
                    standard: "estándar",
                    preferred: "preferente",
                    priority: "prioritaria",
                  }[caps.plan.support_priority]
                }{" "}
                con suscripción vigente. Los incidentes críticos de seguridad se
                atienden primero, sin importar el plan.
              </p>
            )}
            <p>
              Los beneficios de suscripción requieren plan vigente y perfil
              habilitado. La ayuda y las solicitudes de soporte siguen
              disponibles sin un plan vigente.
            </p>
          </>
        ) : (
          <p>
            Básico permite gestionar tu servicio. Pro agrega resúmenes mensuales
            y asistente de preguntas frecuentes. Elite suma comparaciones,
            detalle, tres Excel y orientación con los estados de tu cuenta.
          </p>
        )}
        <p className="task12-muted">
          Información comercial del catálogo vigente. Para conocer las
          condiciones o consultar un cambio, entra a Ayuda y soporte. La
          contratación, los cambios y la renovación no se realizan
          automáticamente aquí.
        </p>
        {onHelp && (
          <button className="button button-outline" onClick={onHelp}>
            Ir a Ayuda y soporte
          </button>
        )}
      </div>
    </details>
  );
}

function Summary({ report }: { report: MonthlyReport }) {
  const { summary } = report;
  return (
    <div className="report-summary-grid">
      <article
        className="report-summary-card"
        aria-labelledby="payments-summary-title"
      >
        <ProductIcon name="payment" />
        <h3 id="payments-summary-title">Pagos manuales</h3>
        <p className="report-value">
          ${integer(summary.non_void_amount_clp)} <span>CLP</span>
        </p>
        <p className="task12-muted">Pendientes y pagados, sin anulados</p>
        <details>
          <summary>
            Ver {integer(summary.payment_count)} registros de pago
          </summary>
          <dl className="report-breakdown">
            {Object.entries(summary.payments).map(([state, row]) => (
              <div key={state}>
                <dt>{states[state]}</dt>
                <dd>
                  {integer(row.count)} · ${integer(row.amount_clp)}
                </dd>
              </div>
            ))}
          </dl>
          {!summary.payment_count && (
            <p>No hay pagos con vencimiento en este mes.</p>
          )}
        </details>
      </article>
      <article
        className="report-summary-card"
        aria-labelledby="runs-summary-title"
      >
        <ProductIcon name="route" />
        <h3 id="runs-summary-title">Recorridos</h3>
        <p className="report-value">{integer(summary.run_count)}</p>
        <p className="task12-muted">Servicios registrados en el mes</p>
        <details>
          <summary>Ver estados de los recorridos</summary>
          <dl className="report-breakdown">
            {Object.entries(summary.runs).map(([state, count]) => (
              <div key={state}>
                <dt>{states[state]}</dt>
                <dd>{integer(count)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Capacidades registradas: {integer(summary.recorded_capacity_total)}{" "}
            cupos entre servicios. No indica pasajeros transportados.
          </p>
          {!summary.run_count && (
            <p>No hay recorridos registrados en este mes.</p>
          )}
        </details>
      </article>
      <article
        className="report-summary-card"
        aria-labelledby="contacts-summary-title"
      >
        <ProductIcon name="message" />
        <h3 id="contacts-summary-title">Solicitudes de contacto</h3>
        <p className="report-value">{integer(summary.contact_count)}</p>
        <p className="task12-muted">Recibidas en el mes</p>
        <details>
          <summary>Ver estados de las solicitudes</summary>
          <dl className="report-breakdown">
            {Object.entries(summary.contacts).map(([state, count]) => (
              <div key={state}>
                <dt>{states[state]}</dt>
                <dd>{integer(count)}</dd>
              </div>
            ))}
          </dl>
          {!summary.contact_count && (
            <p>No hay solicitudes recibidas en este mes.</p>
          )}
        </details>
      </article>
    </div>
  );
}

function Advanced({ report }: { report: AdvancedReport }) {
  const metrics = [
    ["Registros de pago", "payment_count"],
    ["Monto sin anulados", "non_void_amount_clp"],
    ["Recorridos", "run_count"],
    ["Solicitudes recibidas", "contact_count"],
  ] as const;
  return (
    <>
      <article className="panel" aria-labelledby="comparison-title">
        <h3 id="comparison-title">Comparación mensual</h3>
        <p className="task12-muted">
          {periodLabel(report.period.month)} frente a{" "}
          {periodLabel(report.previous.period.month)}. Un mes en curso puede
          estar incompleto.
        </p>
        {!report.previous.summary.payment_count &&
          !report.previous.summary.run_count &&
          !report.previous.summary.contact_count && (
            <p>
              Sin datos en el mes anterior; aún no hay una base para identificar
              una tendencia.
            </p>
          )}
        <dl className="report-comparison">
          {metrics.map(([label, key]) => {
            const value = report.summary[key];
            const previous = report.previous.summary[key];
            const difference = value - previous;
            const money = key === "non_void_amount_clp";
            const format = (n: number) =>
              money ? `$${integer(n)} CLP` : integer(n);
            return (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <strong>{format(value)}</strong>
                  <span>Mes anterior: {format(previous)}</span>
                  <span className="comparison-difference">
                    {difference === 0
                      ? "Sin cambio"
                      : `${format(Math.abs(difference))} ${difference > 0 ? "más" : "menos"} que el mes anterior`}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </article>
    </>
  );
}

function CapacityDetails({ report }: { report: MonthlyReport }) {
  const page = useLocalPage(
    report.current_capacity.routes,
    report.current_capacity.as_of,
  );
  return (
    <details className="task12-disclosure">
      <summary>Ver cupos actuales</summary>
      <div
        className="task12-disclosure-body"
        id="report-capacity-results"
        tabIndex={-1}
      >
        <p>
          Al {formatChileanDate(report.current_capacity.as_of)}. Se calculan con
          las asignaciones actuales, sin importar el mes consultado. No indican
          asistencia ni ocupación histórica.
        </p>
        {report.current_capacity.routes.length ? (
          <OperationalTable
            title="Cupos de las rutas registradas"
            headings={[
              "Estado",
              "Próximo servicio",
              "Capacidad",
              "Asignados",
              "Disponibles",
            ]}
          >
            {page.rows.map((r) => (
              <tr key={r.route_id} role="row">
                <OperationalCell label="Estado">
                  {r.status === "active" ? "Activa" : "Inactiva"}
                </OperationalCell>
                <OperationalCell label="Próximo servicio">
                  {formatChileanDate(r.next_service_date)}
                </OperationalCell>
                <OperationalCell label="Capacidad">
                  {integer(r.seat_capacity)}
                </OperationalCell>
                <OperationalCell label="Asignados">
                  {integer(r.used_seats)}
                </OperationalCell>
                <OperationalCell label="Disponibles">
                  {integer(r.available_seats)}
                </OperationalCell>
              </tr>
            ))}
          </OperationalTable>
        ) : (
          <p>Sin rutas registradas.</p>
        )}
      </div>
      {page.count > 10 && (
        <>
          <p className="task12-muted">
            Paginación local de los cupos por ruta recibidos para la fecha
            indicada.
          </p>
          <CollectionPages
            {...page}
            label="Páginas de cupos por ruta"
            resultsId="report-capacity-results"
          />
        </>
      )}
    </details>
  );
}

function ReportDetails({ report }: { report: AdvancedReport }) {
  const payments = useLocalPage(report.details.payments, report.period.month);
  const runs = useLocalPage(report.details.runs, report.period.month);
  const contacts = useLocalPage(report.details.contacts, report.period.month);
  return (
    <details className="task12-disclosure">
      <summary>Ver registros del mes</summary>
      <div className="task12-disclosure-body">
        <p className="task12-muted">
          Paginación local independiente de los registros recibidos para el mes
          consultado. Los conteos corresponden a estas colecciones.
        </p>
        <h4 id="report-payments-results" tabIndex={-1}>
          Pagos manuales
        </h4>
        {report.details.payments.length ? (
          <ul>
            {payments.rows.map((p) => (
              <li key={p.id}>
                {states[p.status]}, ${integer(p.amount_clp)} CLP · Vence el{" "}
                {formatChileanDate(p.due_on)}. Servicio del{" "}
                {formatChileanDate(p.service_period_start)} al{" "}
                {formatChileanDate(p.service_period_end)}.
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin pagos.</p>
        )}
        {payments.count > 10 && (
          <CollectionPages
            {...payments}
            label="Páginas de pagos del reporte"
            resultsId="report-payments-results"
          />
        )}
        <h4 id="report-runs-results" tabIndex={-1}>
          Recorridos registrados
        </h4>
        {report.details.runs.length ? (
          <ul>
            {runs.rows.map((r) => (
              <li key={r.id}>
                {formatChileanDate(r.service_date)} · {states[r.state]} ·
                Capacidad registrada: {integer(r.seat_capacity_snapshot)} cupos.
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin recorridos registrados.</p>
        )}
        {runs.count > 10 && (
          <CollectionPages
            {...runs}
            label="Páginas de recorridos del reporte"
            resultsId="report-runs-results"
          />
        )}
        <h4 id="report-contacts-results" tabIndex={-1}>
          Solicitudes de contacto
        </h4>
        {report.details.contacts.length ? (
          <ul>
            {contacts.rows.map((c) => (
              <li key={c.id}>
                Recibida el {humanChileanDate(c.created_at)} ·{" "}
                {states[c.status]}.
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin solicitudes.</p>
        )}
        {contacts.count > 10 && (
          <CollectionPages
            {...contacts}
            label="Páginas de contactos del reporte"
            resultsId="report-contacts-results"
          />
        )}
      </div>
    </details>
  );
}
