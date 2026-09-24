import { useCallback, useEffect, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type { DriverContactRequest } from "./api-types";

const status: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  declined: "Rechazada",
  cancelled: "Cancelada",
};

export function DriverRequests({ api }: { api: AuthApi }) {
  const [rows, setRows] = useState<DriverContactRequest[]>([]);
  const [current, setCurrent] = useState<DriverContactRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await api.driverContactRequests();
      setRows(result.results);
      if (current) {
        const fresh = result.results.find((row) => row.id === current.id);
        if (fresh) setCurrent(fresh);
      }
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "No se pudieron cargar las solicitudes.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, current]);
  useEffect(() => {
    void refresh();
  }, [api]);

  async function open(id: number) {
    try {
      setCurrent(await api.driverContactRequest(id));
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "No se pudo abrir la solicitud.",
      );
    }
  }
  async function decide(decision: "accept" | "decline") {
    if (!current) return;
    try {
      const result = await api.decideContactRequest(current.id, decision);
      setCurrent(result);
      setRows((existing) =>
        existing.map((row) => (row.id === result.id ? result : row)),
      );
      setMessage(
        decision === "accept" ? "Solicitud aceptada." : "Solicitud rechazada.",
      );
      void refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "driver_ineligible") {
        setMessage(
          "No puedes aceptar mientras tu publicación no esté vigente. Revisa validación, plan y rutas. Puedes rechazarla.",
        );
      } else if (error instanceof ApiError && error.status === 409) {
        setMessage("La solicitud cambió. Actualiza antes de decidir.");
      } else {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "No se pudo decidir la solicitud.",
        );
      }
    }
  }
  return (
    <section aria-labelledby="requests-title">
      <h2 id="requests-title">Solicitudes de contacto</h2>
      <p>
        El correo mostrado fue compartido con tu cuenta por el apoderado al
        solicitar contacto.
      </p>
      <button type="button" className="button" onClick={() => void refresh()}>
        Actualizar
      </button>
      {loading && <p>Cargando solicitudes…</p>}
      {message && <p role="status">{message}</p>}
      {!loading && rows.length === 0 && <p>Aún no tienes solicitudes.</p>}
      <div className="request-layout">
        <ul className="request-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => void open(row.id)}>
                <strong>{row.parent_display_name}</strong> ·{" "}
                {status[row.status]} ·{" "}
                {new Date(row.created_at).toLocaleDateString("es-CL")}
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <article className="request-detail">
            <h3>{current.parent_display_name}</h3>
            <p>
              Estado:{" "}
              <strong className={`request-${current.status}`}>
                {status[current.status]}
              </strong>
            </p>
            <p>
              Recibida: {new Date(current.created_at).toLocaleString("es-CL")}
            </p>
            <p>
              Correo compartido:{" "}
              <a href={`mailto:${current.parent_email}`}>
                {current.parent_email}
              </a>
            </p>
            <p className="request-message">{current.message}</p>
            {current.status === "pending" && (
              <div className="request-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => void decide("accept")}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => void decide("decline")}
                >
                  Rechazar
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
