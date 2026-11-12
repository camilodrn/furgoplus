import { useEffect, useId, useMemo, useState } from "react";
import type { AuthApi } from "./api";
import type { DriverContactRequest } from "./api-types";
import { chileDateTimeParts } from "./dates";
import { DriverDialog } from "./OperationalPanel";
import { LocalPages } from "./OperationsNavigation";
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

function matchesFilter(row: DriverContactRequest, filter: string) {
  return (
    filter === "all" ||
    (filter === "closed"
      ? row.status === "declined" || row.status === "cancelled"
      : row.status === filter)
  );
}
export function DriverRequests({
  api,
  active = true,
}: {
  api: AuthApi;
  active?: boolean;
}) {
  const detailId = useId();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null);
  const [detail, setCurrent] = useState<DriverContactRequest | null>(null);
  const task = useDriverResource(
    api,
    () => api.driverContactRequests(),
    () => {
      setCurrent(null);
      setDecision(null);
      setFilter("all");
      setPage(1);
    },
  );
  const rows = task.data?.results ?? [];
  // This endpoint returns the complete inbox, with no server pagination fields
  // or parameters. Local pages use only that existing authoritative response;
  // never prefetch or infer additional records. This exception is user-approved.
  // Stable pending-first partition of the complete response, before local pages.
  const filtered = useMemo(
    () =>
      [
        ...(task.data?.results ?? []).filter((row) => row.status === "pending"),
        ...(task.data?.results ?? []).filter((row) => row.status !== "pending"),
      ].filter((row) => matchesFilter(row, filter)),
    [task.data, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  // Commit only a real shrink. An effect that always writes its captured page
  // can undo a newer Next action while the initial response is settling.
  if (task.data && page > totalPages) setPage(totalPages);
  const visibleRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );
  const current =
    detail && visibleRows.some((row) => row.id === detail.id) ? detail : null;
  useEffect(() => {
    setCurrent((selected) =>
      selected
        ? (visibleRows.find((row) => row.id === selected.id) ?? null)
        : null,
    );
  }, [visibleRows, currentPage]);
  function changePage(next: number) {
    setCurrent(null);
    setPage(next);
  }
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
    setDecision(null);
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
      className="driver-operations operations-workspace requests-workspace"
      aria-labelledby="requests-title"
    >
      <div className="publication-heading">
        <h1 id="requests-title">Solicitudes de contacto</h1>
        <button
          type="button"
          className="button button-quiet driver-refresh"
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
      {task.data && (
        <p className="helper-text">
          Filtros y paginación locales de las solicitudes recibidas del
          servicio.
        </p>
      )}
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
              disabled={task.busy}
              onClick={() => {
                setDecision(null);
                setFilter(code!);
                setCurrent(null);
                setPage(1);
              }}
            >
              {label}{" "}
              <span>
                {rows.filter((row) => matchesFilter(row, code!)).length}
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
      {task.data && rows.length > 0 && (
        <div className="request-layout">
          <section
            className="driver-surface"
            aria-label="Bandeja de solicitudes"
          >
            <div className="surface-heading">
              <h2 id="request-results" tabIndex={-1}>
                Solicitudes recibidas
              </h2>
              <p>
                {filtered.length}{" "}
                {filtered.length === 1
                  ? "solicitud en esta vista"
                  : "solicitudes en esta vista"}
                . Abre una para leer y responder.
              </p>
            </div>
            <ul className="request-list" aria-label="Solicitudes recibidas">
              {visibleRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="request-row"
                    disabled={task.busy}
                    aria-pressed={current?.id === row.id}
                    aria-expanded={current?.id === row.id}
                    aria-controls={
                      current?.id === row.id
                        ? `${detailId}-${row.id}`
                        : undefined
                    }
                    onClick={() => {
                      if (current?.id === row.id) setCurrent(null);
                      else void open(row.id);
                    }}
                  >
                    <strong className="request-identity">
                      {row.parent_display_name}
                    </strong>
                    <span className="status-pill">
                      {row.status === "pending"
                        ? "Nueva · Por responder"
                        : status[row.status]}
                    </span>
                    <span className="request-context">
                      Recibida el {chileDateTimeParts(row.created_at).date} ·
                      Consulta por tu servicio
                    </span>
                    <span className="request-open">
                      {current?.id === row.id
                        ? "Ocultar detalle ↑"
                        : "Ver solicitud →"}
                    </span>
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
            {task.data && totalPages > 1 && (
              <LocalPages
                busy={task.busy}
                arrows
                page={currentPage}
                pages={totalPages}
                count={filtered.length}
                size={pageSize}
                setSize={(size) => {
                  setPageSize(size);
                  changePage(1);
                }}
                setPage={changePage}
                label="Páginas de solicitudes"
                resultsId="request-results"
              />
            )}
          </section>
          <section
            className={`driver-surface request-reading${current ? " has-selection" : ""}`}
            aria-label="Lectura de solicitud"
          >
            {current && (
              <div
                id={`${detailId}-${current.id}`}
                className="request-expansion"
              >
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
                      El apoderado autorizó compartir este correo contigo al
                      enviar la solicitud. Úsalo solo para coordinar el
                      traslado.
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
                          Al aceptar, el apoderado podrá ver el correo de
                          contacto de tu servicio. Al rechazar, la solicitud se
                          cierra sin compartir ese correo.
                        </p>
                        <DriverActionError {...task} />
                        <div className="form-actions">
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={task.busy}
                            onClick={() => setDecision("accept")}
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={task.busy}
                            onClick={() => setDecision("decline")}
                          >
                            Rechazar
                          </button>
                        </div>
                      </>
                    )}
                    {current.status === "accepted" && (
                      <p>
                        El apoderado puede consultar el correo de tu servicio
                        que compartiste al aceptar. Acuerden el traslado por ese
                        medio.
                      </p>
                    )}
                  </article>
                </FocusPanel>
              </div>
            )}

            {!current && (
              <div className="empty-state">
                <ProductIcon name="message" />
                <h3>Selecciona una solicitud</h3>
                <p>Revisa el mensaje antes de responder.</p>
              </div>
            )}
          </section>
        </div>
      )}
      {decision && current && (
        <DriverDialog
          visible={active}
          title={
            decision === "accept" ? "Confirmar contacto" : "Confirmar rechazo"
          }
          busy={task.busy}
          onClose={() => setDecision(null)}
        >
          <p>{current.parent_display_name}</p>
          <p>
            {decision === "accept"
              ? "Al aceptar, la familia podrá ver el correo de contacto de tu servicio. Aceptar no reserva un cupo ni agrega un pasajero."
              : "La solicitud se cerrará sin compartir el correo de tu servicio."}
          </p>
          <DriverActionError {...task} />
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={task.busy}
              onClick={() => void decide(decision)}
            >
              {decision === "accept"
                ? "Confirmar aceptación"
                : "Confirmar rechazo"}
            </button>
            <button
              className="button button-outline"
              disabled={task.busy}
              onClick={() => setDecision(null)}
            >
              Cancelar
            </button>
          </div>
        </DriverDialog>
      )}
    </section>
  );
}
