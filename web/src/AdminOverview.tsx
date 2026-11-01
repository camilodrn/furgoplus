import { useEffect, useState } from "react";
import type { AuthApi } from "./api";
import type { SupportTickets } from "./api-types";
import { adminError } from "./AdminExperience";

type Counts = { all: number; pending: number; blocked: number };
export function AdminOverview({
  api,
  onDrivers,
  onValidations,
  onSupport,
}: {
  api: AuthApi;
  onDrivers: (pending?: boolean) => void;
  onValidations: () => void;
  onSupport: () => void;
}) {
  const [counts, setCounts] = useState<Partial<Counts>>({});
  const [support, setSupport] = useState<SupportTickets | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setCounts({});
    setSupport(null);
    setErrors({});
    const filters = {
      all: {},
      pending: { validation_state: "pending" },
      blocked: { publication: "blocked" },
    };
    for (const key of ["all", "pending", "blocked"] as const) {
      void api
        .adminDrivers(
          new URLSearchParams({ ...filters[key], offset: "0", limit: "1" }),
        )
        .then((data) => {
          if (live) setCounts((current) => ({ ...current, [key]: data.count }));
        })
        .catch((cause: unknown) => {
          if (live)
            setErrors((current) => ({ ...current, [key]: adminError(cause) }));
        });
    }
    void api
      .supportTickets(true, 0, "active")
      .then((data) => {
        if (live) setSupport(data);
      })
      .catch((cause: unknown) => {
        if (live)
          setErrors((current) => ({ ...current, support: adminError(cause) }));
      });
    return () => {
      live = false;
    };
  }, [api, refresh]);
  const critical = support?.results.filter((row) => row.severity === 1).length;
  return (
    <section className="screen admin-overview">
      <header className="admin-section-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Inicio administrativo</h1>
          <p>Revisa los pendientes y elige la siguiente tarea.</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => setRefresh((key) => key + 1)}
        >
          Actualizar resumen
        </button>
      </header>
      <section className="panel admin-attention" aria-label="Requiere atención">
        <h2>Requiere atención</h2>
        <div
          className={`admin-task-row ${critical ? "admin-critical-task" : ""}`}
        >
          <div>
            <h3>Soporte activo</h3>
            <p>
              {support
                ? `${support.count} ${support.count === 1 ? "caso activo" : "casos activos"}.`
                : errors.support
                  ? "Resumen de soporte no disponible."
                  : "Cargando soporte…"}
            </p>
            {support && (
              <p>
                {critical
                  ? `${critical} ${critical === 1 ? "caso crítico" : "casos críticos"} en los primeros ${support.results.length} recibidos. Revisa estos casos primero.`
                  : "Sin casos críticos en la primera página recibida."}{" "}
                La gravedad determina el orden de atención.
              </p>
            )}
            {errors.support && <p role="alert">{errors.support}</p>}
          </div>
          <button
            className={`button ${critical ? "button-primary" : "button-outline"}`}
            onClick={onSupport}
          >
            Revisar soporte
          </button>
        </div>
        <div className="admin-task-row">
          <div>
            <h3>Antecedentes por revisar</h3>
            <p>
              {counts.pending !== undefined
                ? `${counts.pending} ${counts.pending === 1 ? "conductor con información pendiente" : "conductores con información pendiente"}.`
                : errors.pending
                  ? "Cantidad no disponible."
                  : "Cargando pendientes…"}{" "}
              Cada decisión requiere revisión y confirmación.
            </p>
            {errors.pending && <p role="alert">{errors.pending}</p>}
          </div>
          <button
            className={`button ${!critical && (support || errors.support) && counts.pending ? "button-primary" : "button-outline"}`}
            onClick={onValidations}
          >
            Revisar antecedentes
          </button>
        </div>
        <button className="button button-quiet" onClick={() => onDrivers(true)}>
          Buscar en todos los conductores pendientes
        </button>
      </section>
      <section className="panel" aria-label="Estado administrativo">
        <div className="admin-section-heading">
          <h2>Estado administrativo</h2>
          <button className="button button-outline" onClick={() => onDrivers()}>
            Gestionar conductores
          </button>
        </div>
        <dl className="admin-facts">
          {(
            [
              ["all", "Conductores registrados"],
              ["blocked", "Servicios no visibles"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {counts[key] ?? (errors[key] ? "No disponible" : "Cargando…")}
              </dd>
              {errors[key] && <p role="alert">{errors[key]}</p>}
            </div>
          ))}
        </dl>
        <p className="helper-text">
          Cantidades globales consultadas al servidor. Un servicio no visible
          puede estar en preparación; revisa sus requisitos antes de intervenir.
        </p>
      </section>
      <details className="panel admin-disclosure">
        <summary>Alcance de la administración académica</summary>
        <p>
          Gestiona perfiles, antecedentes, planes y soporte con los permisos de
          tu cuenta. Los planes habilitan capacidades académicas; no hay
          contratación ni cobro comercial. La revisión de archivos sintéticos no
          acredita una revisión jurídica definitiva ni una certificación de
          seguridad.
        </p>
        <p>
          Las solicitudes de contacto entre familias y conductores se gestionan
          en sus cuentas. No existe una bandeja administrativa de esos mensajes.
        </p>
      </details>
    </section>
  );
}
