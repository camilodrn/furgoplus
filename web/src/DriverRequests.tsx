import { useEffect, useState } from "react";
import type { AuthApi } from "./api";
import type { DriverContactRequest } from "./api-types";
import { chileDateTimeParts } from "./dates";
import {
  DriverReadNotice,
  DriverActionError,
  FocusPanel,
  ProductIcon,
  useDriverResource,
} from "./DriverExperience";

const status: Record<DriverContactRequest["status"], string> = {
  pending: "Pendiente de respuesta",
  accepted: "Aceptada",
  declined: "Rechazada",
  cancelled: "Cancelada por el apoderado",
};
export function DriverRequests({ api }: { api: AuthApi }) {
  const [filter, setFilter] = useState("all");
  const [current, setCurrent] = useState<DriverContactRequest | null>(null);
  const task = useDriverResource(
    api,
    () => api.driverContactRequests(),
    () => {
      setCurrent(null);
      setFilter("all");
    },
  );
  const rows = task.data?.results ?? [];
  const filtered = rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "closed"
        ? row.status === "declined" || row.status === "cancelled"
        : row.status === filter),
  );
  useEffect(() => {
    setCurrent((selected) =>
      selected
        ? (task.data?.results.find((row) => row.id === selected.id) ?? null)
        : null,
    );
  }, [task.data]);
  async function open(id: number) {
    await task.mutate(
      () => api.driverContactRequest(id),
      (result) => setCurrent(result),
      "",
      "No pudimos cargar la solicitud",
    );
  }
  async function decide(decision: "accept" | "decline") {
    if (!current) return;
    await task.mutate(
      () => api.decideContactRequest(current.id, decision),
      (result) => setCurrent(result),
      decision === "accept"
        ? "Solicitud aceptada. El apoderado puede ver el correo de tu servicio."
        : "Solicitud rechazada.",
      decision === "accept"
        ? "No pudimos aceptar la solicitud"
        : "No pudimos rechazar la solicitud",
    );
  }
  return (
    <section
      className="panel driver-operations"
      aria-labelledby="requests-title"
    >
      <div className="publication-heading">
        <h2 id="requests-title">Solicitudes</h2>
        <button
          type="button"
          className="button button-link driver-refresh"
          disabled={task.busy || task.loading}
          onClick={() => void task.refresh()}
        >
          Actualizar solicitudes
        </button>
      </div>
      <p>
        Los apoderados te escriben para coordinar un traslado fuera de
        FurgoPlus. Aceptar una solicitud no reserva un cupo ni agrega un
        pasajero.
      </p>
      <DriverReadNotice {...task} />
      {!current && <DriverActionError {...task} />}
      {task.data && (
        <div
          className="inbox-filters"
          role="group"
          aria-label="Filtrar solicitudes"
        >
          {[
            ["all", "Todas"],
            ["pending", "Por responder"],
            ["accepted", "Aceptadas"],
            ["closed", "Cerradas"],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              className="button filter-chip"
              aria-pressed={filter === code}
              onClick={() => {
                setFilter(code!);
                setCurrent(null);
              }}
            >
              {label}{" "}
              <span>
                {
                  rows.filter(
                    (row) =>
                      code === "all" ||
                      (code === "closed"
                        ? row.status === "declined" ||
                          row.status === "cancelled"
                        : row.status === code),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
      )}
      {task.data && rows.length === 0 && (
        <div className="empty-state">
          <ProductIcon name="message" />
          <h3>No tienes solicitudes pendientes.</h3>
          <p>Cuando un apoderado solicite contacto, podrás responder aquí.</p>
        </div>
      )}
      {task.data &&
        rows.length > 0 &&
        !rows.some((row) => row.status === "pending") && (
          <p>
            No tienes solicitudes pendientes. Puedes consultar las anteriores.
          </p>
        )}
      <div className="request-layout">
        <ul className="request-list" aria-label="Solicitudes recibidas">
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={task.busy}
                aria-pressed={current?.id === row.id}
                onClick={() => void open(row.id)}
              >
                <strong>{row.parent_display_name}</strong>
                <span className="status-pill">
                  {row.status === "pending"
                    ? "Nueva · Por responder"
                    : status[row.status]}
                </span>
                <span>
                  Recibida el {chileDateTimeParts(row.created_at).date}
                </span>
                <span className="request-context">
                  Consulta por tu servicio
                </span>
                <span className="request-open">Ver solicitud →</span>
              </button>
            </li>
          ))}
        </ul>
        {task.data && rows.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <ProductIcon name="message" />
            <h3>No hay solicitudes en esta vista.</h3>
            <p>Elige otra categoría para consultar tu bandeja.</p>
          </div>
        )}
        {current && (
          <FocusPanel
            title="Solicitud de contacto"
            busy={task.busy}
            onClose={() => setCurrent(null)}
          >
            <article className="request-detail">
              <h3>{current.parent_display_name}</h3>
              <p>
                Estado:{" "}
                <strong className={`request-${current.status}`}>
                  {status[current.status]}
                </strong>
              </p>
              <p>
                Recibida: {chileDateTimeParts(current.created_at).date} ·{" "}
                {chileDateTimeParts(current.created_at).time} h
              </p>
              <p className="helper-text">
                El apoderado autorizó compartir este correo contigo al enviar la
                solicitud. Úsalo solo para coordinar el traslado.
              </p>
              <p>
                Correo compartido:{" "}
                <a href={`mailto:${current.parent_email}`}>
                  {current.parent_email}
                </a>
              </p>
              <h4>Mensaje del apoderado</h4>
              <p className="request-message">{current.message}</p>
              {current.status === "pending" && (
                <>
                  <p>
                    Al aceptar, el apoderado podrá ver el correo de contacto de
                    tu servicio. Al rechazar, la solicitud se cierra sin
                    compartir ese correo.
                  </p>
                  <DriverActionError {...task} />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={task.busy}
                      onClick={() => void decide("accept")}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={task.busy}
                      onClick={() => void decide("decline")}
                    >
                      Rechazar
                    </button>
                  </div>
                </>
              )}
              {current.status === "accepted" && (
                <p>
                  El apoderado puede consultar el correo de tu servicio que
                  compartiste al aceptar. Acuerden el traslado por ese medio.
                </p>
              )}
            </article>
          </FocusPanel>
        )}
      </div>
    </section>
  );
}
