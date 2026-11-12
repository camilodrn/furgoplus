import { useEffect, useState } from "react";
import type { AuthApi } from "./api";
import type { AdminRegistrations as Report } from "./api-types";
import { adminError } from "./AdminExperience";
import { humanChileanDate } from "./dates";
import { CollectionPages } from "./OperationsNavigation";
import { OperationalTable, OperationalCell } from "./OperationalPanel";

const roles = {
  parent: "Apoderados",
  driver: "Conductores",
  admin: "Administradores",
};
const roleLabels = {
  parent: "Apoderado",
  driver: "Conductor",
  admin: "Administrador",
};
const size = 25;

export function AdminRegistrations({ api }: { api: AuthApi }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState({ q: "", role: "", page: 1, refresh: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setBusy(true);
    setError("");
    setReport(null);
    const filters = new URLSearchParams({
      offset: String((query.page - 1) * size),
      limit: String(size),
    });
    if (query.q) filters.set("q", query.q);
    if (query.role) filters.set("role", query.role);
    api
      .adminRegistrations(filters)
      .then((value) => {
        if (!current) return;
        // A refresh can shrink the collection while a later page is open.
        const pages = Math.max(1, Math.ceil(value.count / size));
        if (query.page > pages) {
          setQuery((previous) => ({ ...previous, page: pages }));
          return;
        }
        setReport(value);
      })
      .catch((cause: unknown) => {
        if (current) setError(adminError(cause));
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [api, query]);

  return (
    <section className="screen" aria-labelledby="registered-title">
      <header className="admin-section-heading">
        <div>
          <p className="eyebrow">Feria · 4 de noviembre de 2026</p>
          <h1 id="registered-title">Usuarios registrados</h1>
          <p>
            Cuentas existentes en la base de datos. Actualiza después de
            registrar una cuenta desde Flutter o la web.
          </p>
        </div>
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() =>
            setQuery((previous) => ({
              ...previous,
              refresh: previous.refresh + 1,
            }))
          }
        >
          Actualizar usuarios
        </button>
      </header>
      <section
        className="panel"
        aria-label="Informe de usuarios"
        aria-busy={busy}
      >
        <h2>Total de cuentas por rol</h2>
        <dl className="admin-facts">
          {Object.entries(roles).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{report ? report.totals[key as keyof typeof roles] : "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="helper-text">
          Totales globales, incluidas cuentas inactivas. Los filtros afectan
          solo la lista. Solo se muestran correos ficticios @example.test.
        </p>
        <form
          className="admin-search admin-search-row"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((previous) => ({
              q: q.trim(),
              role,
              page: 1,
              refresh: previous.refresh + 1,
            }));
          }}
        >
          <label>
            Buscar por nombre o correo ficticio
            <input
              type="search"
              maxLength={100}
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <label>
            Rol
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">Todos los roles</option>
              {Object.entries(roles).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" disabled={busy}>
            Aplicar filtros
          </button>
        </form>
        <div id="registered-results" tabIndex={-1}>
          <h2>Cuentas recientes</h2>
          <p className="helper-text">
            Más recientes primero. Fecha y hora de Chile continental
            (America/Santiago).
          </p>
          {busy && <p role="status">Cargando usuarios…</p>}
          {error && (
            <p role="alert">
              {error} Usa «Actualizar usuarios» para volver a consultar.
            </p>
          )}
          {report && report.count === 0 && (
            <p role="status">
              {query.q || query.role
                ? "No hay cuentas que coincidan con los filtros."
                : "Todavía no hay cuentas registradas."}
            </p>
          )}
          {report && report.results.length > 0 && (
            <OperationalTable
              title="Usuarios registrados, del más reciente al más antiguo"
              headings={[
                "Nombre",
                "Correo ficticio",
                "Rol",
                "Creación en Chile",
              ]}
            >
              {report.results.map((user) => (
                <tr key={user.id} role="row">
                  <OperationalCell label="Nombre">
                    {user.display_name || "Sin nombre registrado"}
                  </OperationalCell>
                  <OperationalCell label="Correo ficticio">
                    {user.email ?? "Correo reservado"}
                  </OperationalCell>
                  <OperationalCell label="Rol">
                    {roleLabels[user.role]}
                  </OperationalCell>
                  <OperationalCell label="Creación en Chile">
                    <time dateTime={user.created_at}>
                      {humanChileanDate(user.created_at)}
                    </time>
                  </OperationalCell>
                </tr>
              ))}
            </OperationalTable>
          )}
        </div>
        {report && (
          <CollectionPages
            page={query.page}
            pages={Math.max(1, Math.ceil(report.count / size))}
            count={report.count}
            size={size}
            receivedCount={report.results.length}
            setPage={(page) => setQuery((previous) => ({ ...previous, page }))}
            label="Páginas de usuarios registrados"
            resultsId="registered-results"
            busy={busy}
          />
        )}
      </section>
    </section>
  );
}
