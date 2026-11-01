import { useState } from "react";

export function searchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

// Local pagination only limits rendering of the supplied rows. It neither
// requests server pages nor claims to reduce transferred records.
export function useLocalPage<T>(rows: T[], filterKey: string, size = 10) {
  const [pageSize, setPageSize] = useState(size);
  size = pageSize;
  filterKey = `${filterKey}:${size}`;
  const [position, setPosition] = useState({ key: filterKey, page: 1 });
  // Commit the new filter identity too: returning to an earlier query must
  // start at page one rather than resurrecting that query's previous page.
  if (position.key !== filterKey) setPosition({ key: filterKey, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = position.key === filterKey ? Math.min(position.page, pages) : 1;
  // Commit a smaller page after a refreshed collection shrinks. Growing it
  // again must not unexpectedly take the reader back to a discarded page.
  if (position.key === filterKey && position.page > pages)
    setPosition({ key: filterKey, page: pages });
  return {
    rows: rows.slice((page - 1) * size, page * size),
    page,
    pages,
    count: rows.length,
    size,
    setSize: setPageSize,
    setPage: (next: number) => setPosition({ key: filterKey, page: next }),
  };
}

// Counts belong to the supplied collection (or to the server's page metadata).
// Callers must explain when that collection is only part of a larger history.
export function CollectionPages({
  page,
  pages,
  count,
  size,
  setPage,
  setSize,
  label,
  resultsId,
  busy = false,
  arrows = false,
  receivedCount,
}: {
  page: number;
  pages: number;
  count: number;
  size: number;
  setPage: (page: number) => void;
  setSize?: (size: number) => void;
  label: string;
  resultsId: string;
  busy?: boolean;
  arrows?: boolean;
  receivedCount?: number;
}) {
  function go(next: number) {
    setPage(next);
    document.getElementById(resultsId)?.focus();
  }
  return (
    <nav className="operations-pages" aria-label={label}>
      <p role="status" aria-live="polite" aria-current="page">
        {count && receivedCount !== 0
          ? `${(page - 1) * size + 1}–${Math.min((page - 1) * size + (receivedCount ?? size), count)} de ${count}`
          : "0 resultados"}{" "}
        ·{" "}
        <span aria-current="page">
          Página {page} de {pages}
        </span>
      </p>
      {setSize && (
        <label>
          Filas por página
          <select
            disabled={busy}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          >
            {[5, 10, 20].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="button button-outline"
        disabled={busy || page === 1}
        onClick={() => go(page - 1)}
      >
        {arrows ? "← Anterior" : "Anterior"}
      </button>
      <button
        className="button button-outline"
        disabled={busy || page === pages}
        onClick={() => go(page + 1)}
      >
        {arrows ? "Siguiente →" : "Siguiente"}
      </button>
    </nav>
  );
}

// Preserve the existing Pagos, Pasajeros and Solicitudes integration.
export const LocalPages = CollectionPages;
