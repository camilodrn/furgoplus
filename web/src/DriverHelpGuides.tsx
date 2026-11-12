import type { RefObject } from "react";
import type { HelpCenter } from "./api-types";
import {
  CollectionPages,
  searchText,
  useLocalPage,
} from "./OperationsNavigation";

type Guide = HelpCenter["articles"][number];

/** One task at a time: choose a topic/search, choose a result, read that guide. */
export function DriverHelpGuides({
  help,
  loading,
  heading,
  category,
  query,
  selectedId,
  page,
  onCategory,
  onQuery,
  onSelect,
  onBack,
}: {
  help: HelpCenter | null;
  loading: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  category: string;
  query: string;
  selectedId: string | null;
  page: ReturnType<typeof useLocalPage<Guide>>;
  onCategory: (category: string) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const categories = [...new Set(help?.articles.map((row) => row.category))];
  const article = help?.articles.find((row) => row.id === selectedId);
  const hasCriteria = Boolean(category || searchText(query));

  return (
    <section className="driver-surface help-guides" aria-label="Guías">
      {article ? (
        <article
          className="help-guide-article"
          id={`help-${article.id}`}
          aria-labelledby="help-selected-guide-title"
        >
          <button className="button button-link" onClick={onBack}>
            <span aria-hidden="true">← </span>Volver a las guías
          </button>
          <p className="task12-muted">{article.category}</p>
          <h2 id="help-selected-guide-title" ref={heading} tabIndex={-1}>
            {article.title}
          </h2>
          <p className="help-guide-body">{article.body}</p>
        </article>
      ) : (
        <>
          <h2 id="help-guides-title" ref={heading} tabIndex={-1}>
            Encuentra una respuesta
          </h2>
          {!help ? (
            loading ? (
              <p role="status">Cargando las guías de ayuda…</p>
            ) : (
              <p>
                Las guías no están disponibles. Vuelve a intentar o consulta tus
                consultas de soporte.
              </p>
            )
          ) : !help.articles.length ? (
            <p role="status">
              Aún no hay guías disponibles. Puedes enviar una consulta al equipo
              de soporte.
            </p>
          ) : (
            <>
              <p className="task12-muted">Elige un tema o busca una guía.</p>
              <div className="help-guide-tools">
                <label>
                  Tema de ayuda
                  <select
                    value={category}
                    onChange={(event) => onCategory(event.target.value)}
                  >
                    <option value="">Selecciona un tema</option>
                    {categories.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Buscar una guía
                  <input
                    type="search"
                    value={query}
                    placeholder="Escribe tu consulta"
                    onChange={(event) => onQuery(event.target.value)}
                  />
                </label>
              </div>
              {selectedId && (
                <p role="status">
                  La guía seleccionada ya no está disponible. Elige otra.
                </p>
              )}
              {hasCriteria && (
                <div
                  id="help-guide-results"
                  role="group"
                  aria-label="Resultados de guías"
                  tabIndex={-1}
                >
                  <p className="task12-muted" role="status">
                    {page.count}{" "}
                    {page.count === 1 ? "guía encontrada" : "guías encontradas"}
                    {category ? ` en ${category}` : " en todos los temas"}.
                  </p>
                  {page.count ? (
                    <ul
                      className="help-guide-choices"
                      aria-label="Elegir una guía"
                    >
                      {page.rows.map((row) => (
                        <li key={row.id}>
                          <button
                            id={`help-guide-choice-${row.id}`}
                            onClick={() => onSelect(row.id)}
                          >
                            <span>
                              <strong>{row.title}</strong>
                              {!category && <small>{row.category}</small>}
                            </span>
                            <span aria-hidden="true">›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No encontramos una guía. Prueba con otro tema o limpia la
                      búsqueda.
                    </p>
                  )}
                  {/* Page result collections only. The selected article is always whole. */}
                  {(page.count > 5 || page.size !== 5) && (
                    <>
                      <p className="task12-muted help-page-scope">
                        Páginas locales de los resultados recibidos para tu
                        acceso.
                      </p>
                      <CollectionPages
                        {...page}
                        label="Páginas de guías"
                        resultsId="help-guide-results"
                      />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {help && (
        <p className="help-version task12-muted">
          Contenido revisado · Versión {help.version}
        </p>
      )}
    </section>
  );
}
