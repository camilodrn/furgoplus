import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type AuthApi } from "./api";
import type {
  AssistantAnswer,
  HelpCenter,
  SupportTicket,
  SupportTickets,
} from "./api-types";
import { humanChileanDate } from "./dates";
import { ProductIcon } from "./DriverExperience";
import { DriverHelpGuides } from "./DriverHelpGuides";
import {
  CollectionPages,
  searchText,
  useLocalPage,
} from "./OperationsNavigation";
import "./task12.css";
import "./help-support.css";

const states: Record<SupportTicket["state"], string> = {
  open: "Abierta",
  in_progress: "En revisión",
  waiting_user: "Esperando tu respuesta",
  resolved: "Resuelta",
  closed: "Cerrada",
};
const priorities = {
  standard: "Estándar",
  preferred: "Preferente",
  priority: "Prioritaria",
};
const severities = ["", "Crítica / seguridad", "Alta", "Normal", "Baja"];
const requesterRoles = {
  driver: "Conductor",
  parent: "Apoderado",
  admin: "Soporte",
};
function stateLabel(state: SupportTicket["state"], admin: boolean) {
  return admin && state === "waiting_user"
    ? "Esperando al solicitante"
    : states[state];
}
function ticketRequester(ticket: SupportTicket) {
  return ticket.events.find(
    (event) =>
      !event.from_state &&
      event.to_state === "open" &&
      event.author_role !== "admin",
  );
}
function requesterLabel(requester: ReturnType<typeof ticketRequester>) {
  return requester
    ? `${requesterRoles[requester.author_role]} · Usuario #${requester.author_id}`
    : "Sin identificación disponible";
}
function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "No tienes permiso o la función ya no está disponible. Actualiza la ayuda y revisa tu sesión y plan.";
    if (error.status === 409)
      return "La consulta cambió. Vuelve a abrirla para consultar su versión actual antes de responder.";
    if (error.status === 429)
      return "Alcanzaste el límite de uso. Intenta más tarde o continúa en una consulta existente.";
    return Object.values(error.fields).flat().join(" ") || error.message;
  }
  return "No se pudo completar la consulta. Intenta nuevamente.";
}

export function HelpSupport({
  api,
  admin = false,
  driver = false,
  active = true,
}: {
  api: AuthApi;
  admin?: boolean;
  driver?: boolean;
  active?: boolean;
}) {
  const [helpLoading, setHelpLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [guideSearch, setGuideSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [caseSearch, setCaseSearch] = useState("");
  const guideTarget = useRef<string | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const caseHeading = useRef<HTMLHeadingElement>(null);
  const [help, setHelp] = useState<HelpCenter | null>(null);
  const [section, setSection] = useState<"help" | "tickets" | "assistant">(
    admin ? "tickets" : "help",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const live = useRef(true);
  const helpSequence = useRef(0);
  const readSequence = useRef(0);
  const answerSequence = useRef(0);
  const [list, setList] = useState<SupportTickets | null>(null);
  const [offset, setOffset] = useState(0);
  const [queueState, setQueueState] = useState("active");
  const listPosition = useRef({ offset, queueState });
  listPosition.current = { offset, queueState };
  const activeView = useRef(active);
  activeView.current = active;
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4>(3);
  const [confirmed, setConfirmed] = useState(false);
  const [reply, setReply] = useState("");
  const [state, setState] = useState<SupportTicket["state"]>("open");
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"faq" | "contextual">("faq");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);

  const refreshHelp = useCallback(async () => {
    const id = ++helpSequence.current;
    setHelpLoading(true);
    answerSequence.current++;
    setAnswer(null);
    try {
      const result = await api.helpCenter();
      if (!live.current || id !== helpSequence.current) return;
      setHelp({
        ...result,
        articles: result.articles.map((article) => ({
          ...article,
          body: article.body.replaceAll(
            "tickets de soporte",
            "consultas de soporte",
          ),
        })),
      });
      setMode((current) =>
        result.assistant_modes.includes(current) ? current : "faq",
      );
    } catch (cause) {
      if (!live.current || id !== helpSequence.current) return;
      setHelp(null);
      setError(errorMessage(cause));
    } finally {
      if (live.current && id === helpSequence.current) setHelpLoading(false);
    }
  }, [api]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      helpSequence.current++;
      readSequence.current++;
      answerSequence.current++;
    };
  }, [api]);

  useEffect(() => {
    if (!active) return;
    void refreshHelp();
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshHelp();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      helpSequence.current++;
      answerSequence.current++;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [refreshHelp, active]);

  const loadList = useCallback(
    async (start = 0, filter = "active", restoreFocus = false) => {
      const id = ++readSequence.current;
      setListLoading(true);
      setTicketLoading(false);
      setList(null);
      setTicket(null);
      setCreating(false);
      setError("");
      try {
        const read = (at: number) =>
          admin
            ? api.supportTickets(true, at, filter)
            : api.supportTickets(false, at);
        let result = await read(start);
        if (!live.current || id !== readSequence.current) return;
        // A removed/closed record can invalidate the current server page.
        if (start > 0 && start >= result.count) {
          start = Math.max(0, Math.floor((result.count - 1) / 25) * 25);
          result = await read(start);
        }
        if (live.current && id === readSequence.current) {
          setOffset(start);
          setList(result);
          if (restoreFocus)
            requestAnimationFrame(() => {
              if (
                live.current &&
                activeView.current &&
                id === readSequence.current
              )
                (driver ? caseHeading : sectionHeading).current?.focus({
                  preventScroll: true,
                });
            });
        }
      } catch (cause) {
        if (live.current && id === readSequence.current)
          setError(errorMessage(cause));
      } finally {
        if (live.current && id === readSequence.current) setListLoading(false);
      }
    },
    [api, admin, driver],
  );

  useEffect(() => {
    if (admin)
      void loadList(
        listPosition.current.offset,
        listPosition.current.queueState,
      );
  }, [admin, driver, loadList]);

  async function openTicket(id: number) {
    if (driver) setSection("tickets");
    const sequence = ++readSequence.current;
    setTicketLoading(true);
    setError("");
    setNotice("");
    setTicket(null);
    setReply("");
    setReason("");
    setCreating(false);
    try {
      const result = await api.supportTicket(id, admin);
      if (!live.current || sequence !== readSequence.current) return;
      setTicket(result);
      setState(result.state);
      requestAnimationFrame(
        () =>
          activeView.current &&
          document.getElementById("support-thread-title")?.focus(),
      );
    } catch (cause) {
      if (live.current && sequence === readSequence.current)
        setError(errorMessage(cause));
    } finally {
      if (live.current && sequence === readSequence.current)
        setTicketLoading(false);
    }
  }

  function draft() {
    readSequence.current++;
    setListLoading(false);
    setTicketLoading(false);
    setSection("tickets");
    setTicket(null);
    setCreating(true);
    setSubject("");
    setBody("");
    setSeverity(3);
    setConfirmed(false);
    setError("");
    setNotice("");
    requestAnimationFrame(() => formHeading.current?.focus());
  }

  async function submit(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (cause) {
      if (!live.current) return;
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 403) {
        setAnswer(null);
        void refreshHelp();
      }
    } finally {
      busyRef.current = false;
      if (live.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (active) sectionHeading.current?.focus({ preventScroll: true });
  }, [section, active]);

  function showArticle(id: string) {
    setGuideSearch("");
    setSelectedCategory(
      help?.articles.find((article) => article.id === id)?.category ?? "",
    );
    setExpandedArticle(id);
    guideTarget.current = id;
    showGuides();
  }
  const categories = [
    ...new Set(help?.articles.map((article) => article.category) ?? []),
  ];
  const currentCategory =
    selectedCategory !== null &&
    (selectedCategory === "" || categories.includes(selectedCategory))
      ? selectedCategory
      : driver
        ? ""
        : (categories[0] ?? "");
  const matchingArticles = (help?.articles ?? []).filter(
    (article) =>
      (!currentCategory || article.category === currentCategory) &&
      searchText(
        `${article.title} ${article.category} ${article.body}`,
      ).includes(searchText(guideSearch)),
  );
  const guidePage = useLocalPage(
    matchingArticles,
    `${currentCategory}:${searchText(guideSearch)}`,
    5,
  );
  useEffect(() => {
    const id = guideTarget.current;
    if (!id || section !== "help") return;
    const index = matchingArticles.findIndex((row) => row.id === id);
    if (index < 0) return;
    guideTarget.current = null;
    guidePage.setPage(Math.floor(index / guidePage.size) + 1);
    requestAnimationFrame(() => {
      if (!activeView.current) return;
      if (driver) document.getElementById("help-selected-guide-title")?.focus();
      else
        document
          .getElementById(`help-${id}`)
          ?.querySelector("summary")
          ?.focus();
    });
  }, [section, currentCategory, guideSearch]);
  const visibleCategories = [
    ...new Set(guidePage.rows.map((article) => article.category)),
  ];
  const visibleTickets = (list?.results ?? []).filter(
    (row) =>
      (caseFilter === "all" || row.state === caseFilter) &&
      searchText(`#${row.id} ${row.subject} ${states[row.state]}`).includes(
        searchText(caseSearch),
      ),
  );
  const showCases = section === "tickets";
  const showInbox = !creating && !ticket && !ticketLoading;

  function showGuides() {
    readSequence.current++;
    setListLoading(false);
    setTicketLoading(false);
    setSection("help");
    setError("");
    setNotice("");
  }
  function showAssistant() {
    readSequence.current++;
    setListLoading(false);
    setTicketLoading(false);
    setSection("assistant");
    setError("");
    setNotice("");
  }
  function readGuide(id: string) {
    setExpandedArticle(id);
    requestAnimationFrame(() => {
      if (activeView.current)
        document.getElementById("help-selected-guide-title")?.focus();
    });
  }
  function backToGuides() {
    const id = expandedArticle;
    setExpandedArticle(null);
    requestAnimationFrame(() => {
      if (activeView.current)
        (
          document.getElementById(`help-guide-choice-${id}`) ??
          document.getElementById("help-guides-title")
        )?.focus();
    });
  }
  const canUseAssistant = Boolean(help?.assistant_modes.length);
  // The creation event identifies the requester; the list contract has no owner field.
  const requester = ticket ? ticketRequester(ticket) : undefined;
  const DetailHeading = admin || driver ? "h2" : "h3";
  const ConversationHeading = admin || driver ? "h3" : "h4";

  return (
    <section
      className={`task12-screen help-support${admin ? " support-admin" : driver ? " driver-help operations-workspace" : ""}`}
      aria-label="Ayuda y soporte"
    >
      <header className="task12-heading">
        <div>
          <h1>Ayuda y soporte</h1>
          <p className="task12-muted">
            {admin
              ? "Atiende consultas y da seguimiento a cada caso."
              : "Encuentra una orientación o pide ayuda con tu servicio."}
          </p>
        </div>
        {driver && section === "tickets" && showInbox && (
          <button
            className="button button-primary"
            disabled={busy || !help}
            onClick={draft}
          >
            Crear consulta de soporte
          </button>
        )}
      </header>
      <nav className="help-navigation" aria-label="Centro de ayuda">
        <button
          className="help-destination"
          aria-label="Guías de ayuda"
          aria-current={section === "help" ? "page" : undefined}
          disabled={busy}
          onClick={showGuides}
        >
          <ProductIcon name="book" />
          <strong>{driver ? "Guías" : "Guías de ayuda"}</strong>
          <span>Respuestas por tema, para revisar a tu ritmo.</span>
        </button>

        <button
          className="help-destination"
          aria-label={admin ? "Panel de soporte" : "Consultas de soporte"}
          aria-current={section === "tickets" ? "page" : undefined}
          disabled={busy}
          onClick={() => {
            setSection("tickets");
            setNotice("");
            void loadList(offset, queueState, driver);
          }}
        >
          <ProductIcon name="support" />
          <strong>
            {admin
              ? "Panel de soporte"
              : driver
                ? "Consultas de soporte"
                : "Consultas de soporte"}
          </strong>
          <span>
            {admin
              ? "Revisa y responde las consultas del equipo."
              : "Escribe al equipo y consulta sus respuestas."}
          </span>
        </button>
        {!admin && (
          <button
            className="help-destination"
            aria-label="Asistente automatizado"
            aria-describedby="assistant-availability"
            aria-current={section === "assistant" ? "page" : undefined}
            disabled={busy}
            onClick={showAssistant}
          >
            <ProductIcon name="message" />
            <strong>{driver ? "Asistente" : "Asistente automatizado"}</strong>
            <span id="assistant-availability">
              {canUseAssistant
                ? "Haz una pregunta y recibe orientación automática."
                : !help
                  ? helpLoading
                    ? "Comprobando disponibilidad…"
                    : "Disponibilidad sin confirmar."
                  : "No disponible con tu acceso actual."}
            </span>
          </button>
        )}
      </nav>
      {error && (
        <div className="task12-feedback task12-error" role="alert">
          <strong>No pudimos completar la acción</strong>
          <p>{error}</p>
          {section === "help" && (
            <button
              className="button button-outline"
              onClick={() => {
                setError("");
                void refreshHelp();
              }}
            >
              Volver a intentar
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="task12-feedback is-positive" role="status">
          {notice}
        </p>
      )}
      {busy && (
        <p className="task12-loading" role="status">
          {section === "assistant"
            ? "Buscando una orientación…"
            : "Enviando información…"}
        </p>
      )}
      <div className="help-content">
        {section === "help" &&
          (driver ? (
            <DriverHelpGuides
              help={help}
              loading={helpLoading}
              heading={sectionHeading}
              category={currentCategory}
              query={guideSearch}
              selectedId={expandedArticle}
              page={guidePage}
              onCategory={(value) => {
                setSelectedCategory(value);
                setExpandedArticle(null);
              }}
              onQuery={(value) => {
                setGuideSearch(value);
                setExpandedArticle(null);
              }}
              onSelect={readGuide}
              onBack={backToGuides}
            />
          ) : (
            <section
              className={`task12-section${driver ? " driver-surface help-guides" : ""}`}
              aria-labelledby="help-guides-title"
            >
              <div className="task12-row">
                <div>
                  <h2 id="help-guides-title" ref={sectionHeading} tabIndex={-1}>
                    ¿En qué necesitas ayuda?
                  </h2>
                  <p className="task12-muted">
                    Elige un tema y abre la guía que necesitas.
                  </p>
                </div>
              </div>
              {!help ? (
                helpLoading ? (
                  <p role="status">Cargando las guías de ayuda…</p>
                ) : (
                  <p>
                    Las guías no están disponibles en este momento. Puedes
                    volver a intentar o consultar tus consultas de soporte.
                  </p>
                )
              ) : (
                <>
                  {!help.articles.length && (
                    <div className="task12-empty">
                      <strong>Aún no hay guías disponibles.</strong>
                      <p>Puedes enviar una consulta al equipo de soporte.</p>
                    </div>
                  )}
                  <label className="help-guide-search">
                    Buscar una guía
                    <input
                      type="search"
                      value={guideSearch}
                      onChange={(event) => {
                        setGuideSearch(event.target.value);
                        setExpandedArticle(null);
                      }}
                      placeholder="Escribe un tema"
                    />
                  </label>
                  {categories.length > 0 && (
                    <label
                      className="help-topic-filter"
                      htmlFor="help-category"
                    >
                      Tema de ayuda
                      <select
                        id="help-category"
                        value={currentCategory}
                        onChange={(event) => {
                          setSelectedCategory(event.target.value);
                          setExpandedArticle(null);
                        }}
                      >
                        <option value="">Todos los temas</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {help.articles.length > 0 && !matchingArticles.length && (
                    <p role="status">
                      No encontramos una guía. Prueba con otro tema o limpia la
                      búsqueda.
                    </p>
                  )}
                  <div
                    id="help-guide-results"
                    tabIndex={-1}
                    role="group"
                    aria-label="Resultados de guías"
                  >
                    {visibleCategories.map((category) => (
                      <section
                        className="help-topic"
                        key={category}
                        aria-label={category}
                      >
                        {!currentCategory && <h3>{category}</h3>}
                        {guidePage.rows
                          .filter((article) => article.category === category)
                          .map((article) => (
                            <details
                              className="task12-disclosure"
                              key={article.id}
                              id={`help-${article.id}`}
                              open={expandedArticle === article.id}
                            >
                              <summary
                                onClick={(event) => {
                                  event.preventDefault();
                                  setExpandedArticle(
                                    expandedArticle === article.id
                                      ? null
                                      : article.id,
                                  );
                                }}
                              >
                                {article.title}
                              </summary>
                              <div className="task12-disclosure-body">
                                <p>{article.body}</p>
                              </div>
                            </details>
                          ))}
                      </section>
                    ))}
                  </div>
                  <p className="task12-muted help-page-scope">
                    Paginación local de las guías recibidas.{" "}
                    {matchingArticles.length}{" "}
                    {matchingArticles.length === 1
                      ? "coincidencia"
                      : "coincidencias"}{" "}
                    de {help.articles.length} guías disponibles para tu acceso.
                  </p>
                  {help.articles.length > 0 && (
                    <CollectionPages
                      {...guidePage}
                      label="Páginas de guías"
                      resultsId="help-guide-results"
                    />
                  )}
                  <p className="help-version task12-muted">
                    Contenido revisado · Versión {help.version}
                  </p>
                </>
              )}
            </section>
          ))}
        {showCases && (
          <section
            className={driver ? "driver-surface help-cases" : "help-cases"}
            aria-label="Consultas de soporte"
          >
            {(driver ? showInbox : !admin || (!ticket && !ticketLoading)) && (
              <div className="task12-row">
                <div>
                  <h2
                    id="support-case-results"
                    ref={driver ? caseHeading : sectionHeading}
                    tabIndex={-1}
                  >
                    {admin ? "Cola de soporte" : "Tus consultas de soporte"}
                  </h2>
                  {!admin && (
                    <p className="task12-muted">
                      Las respuestas del equipo aparecen en el historial de cada
                      consulta.
                    </p>
                  )}
                </div>
                {!admin && !driver && !creating && (
                  <button
                    className="button button-primary"
                    disabled={busy || !help}
                    onClick={draft}
                  >
                    Crear consulta de soporte
                  </button>
                )}
              </div>
            )}

            {admin && !ticket && !ticketLoading && (
              <div className="support-queue-tools">
                <label>
                  Filtrar consultas
                  <select
                    value={queueState}
                    disabled={busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      setQueueState(value);
                      void loadList(0, value);
                    }}
                  >
                    <option value="active">Activas</option>
                    <option value="open">Abiertas · por revisar</option>
                    <option value="in_progress">En revisión</option>
                    <option value="waiting_user">
                      Esperando al solicitante
                    </option>
                    <option value="all">Todo el historial</option>
                    <option value="resolved">Resueltas</option>
                    <option value="closed">Cerradas</option>
                  </select>
                </label>
                <button
                  className="button button-outline"
                  disabled={busy || listLoading}
                  onClick={() => {
                    setNotice("");
                    void loadList(offset, queueState);
                  }}
                >
                  Actualizar consultas
                </button>
              </div>
            )}
            {driver && showInbox && (
              <div className="support-local-filters">
                <label>
                  Buscar en esta página de consultas
                  <input
                    type="search"
                    value={caseSearch}
                    placeholder="Asunto, número o estado"
                    disabled={busy || listLoading || ticketLoading}
                    onChange={(event) => setCaseSearch(event.target.value)}
                  />
                </label>
                <label className="support-case-filter">
                  Estado en esta página
                  <select
                    value={caseFilter}
                    disabled={busy || listLoading || ticketLoading}
                    onChange={(event) => setCaseFilter(event.target.value)}
                  >
                    <option value="all">
                      Todos los estados ({list?.results.length ?? 0})
                    </option>
                    {Object.entries(states).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label} (
                        {list?.results.filter((row) => row.state === value)
                          .length ?? 0}
                        )
                      </option>
                    ))}
                  </select>
                </label>
                {(caseSearch || caseFilter !== "all") && (
                  <button
                    className="button button-outline"
                    disabled={busy || listLoading || ticketLoading}
                    onClick={() => {
                      setCaseSearch("");
                      setCaseFilter("all");
                    }}
                  >
                    Limpiar criterios de consultas
                  </button>
                )}
              </div>
            )}
            {!admin && !creating && !ticket && !ticketLoading && (
              <button
                className="button button-outline"
                disabled={busy || listLoading || ticketLoading}
                onClick={() => {
                  setNotice("");
                  void loadList(offset);
                }}
              >
                Actualizar consultas
              </button>
            )}
            {listLoading && (
              <p className="task12-loading" role="status">
                {admin
                  ? "Cargando la cola de soporte…"
                  : "Cargando tus consultas…"}
              </p>
            )}
            {ticketLoading && (
              <p className="task12-loading" role="status">
                Abriendo el historial…
              </p>
            )}
            {list && showInbox && (
              <>
                {!list.count ? (
                  <div className="task12-empty" role="status">
                    <strong>
                      {admin
                        ? "No hay consultas en esta vista."
                        : "No tienes consultas en esta vista."}
                    </strong>
                    <p>
                      {admin
                        ? "Prueba con otro filtro para consultar el historial."
                        : "Si necesitas ayuda del equipo, crea una consulta. Podrás seguir la conversación aquí."}
                    </p>
                  </div>
                ) : !admin ? (
                  <p className="task12-muted">
                    {list.count} {list.count === 1 ? "consulta" : "consultas"}
                  </p>
                ) : null}
                {admin ? (
                  <>
                    <AdminQueue
                      api={api}
                      list={list}
                      busy={busy}
                      onReview={(id) => void openTicket(id)}
                    />
                    <QueueSummary list={list} offset={offset} />
                  </>
                ) : (
                  <ul className="support-list">
                    {(driver ? visibleTickets : list.results).map((row) => (
                      <li key={row.id}>
                        <button
                          disabled={busy}
                          onClick={() => void openTicket(row.id)}
                        >
                          <span className={`task12-badge ticket-${row.state}`}>
                            {states[row.state]}
                          </span>
                          <strong>
                            #{row.id} · {row.subject}
                          </strong>
                          <span className="task12-muted">
                            Actualizada el {humanChileanDate(row.updated_at)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {driver && (
                  <p className="task12-muted support-page-scope" role="status">
                    {visibleTickets.length}{" "}
                    {visibleTickets.length === 1
                      ? "coincidencia"
                      : "coincidencias"}{" "}
                    de {list.results.length}{" "}
                    {list.results.length === 1
                      ? "consulta recibida"
                      : "consultas recibidas"}{" "}
                    en esta página. Total informado por la API: {list.count}{" "}
                    consultas (sin filtrar). El filtro se aplica a esta página,
                    al igual que la búsqueda; consulta las demás para revisar
                    todo el historial.
                    {list.count > 0 &&
                      !visibleTickets.length &&
                      " No hay consultas con los criterios elegidos en esta página. Cambia la búsqueda o el estado, o consulta otra página."}
                  </p>
                )}
                {admin && (
                  <details className="support-queue-policy">
                    <summary>Cómo se ordena la cola</summary>
                    <p>
                      Primero la gravedad; luego la prioridad del plan vigente y
                      la antigüedad. Los casos críticos preceden a los de menor
                      gravedad, cualquiera sea el plan. El filtro de estado
                      recorre toda la bandeja.
                    </p>
                  </details>
                )}
                {(list.count > 25 ||
                  offset > 0 ||
                  (driver && list.count > 0)) && (
                  <CollectionPages
                    page={Math.floor(offset / 25) + 1}
                    pages={Math.max(1, Math.ceil(list.count / 25))}
                    count={list.count}
                    size={25}
                    receivedCount={list.results.length}
                    busy={busy || listLoading || ticketLoading}
                    setPage={(page) =>
                      void loadList(
                        (page - 1) * 25,
                        queueState,
                        admin || driver,
                      )
                    }
                    label="Páginas de consultas de soporte"
                    resultsId="support-case-results"
                  />
                )}
              </>
            )}
            {creating && help && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!confirmed) return;
                  void submit(async () => {
                    const created = await api.createSupportTicket({
                      subject,
                      body,
                      severity,
                      privacy_confirmed: true,
                    });
                    if (!live.current) return;
                    setTicket(created);
                    setState(created.state);
                    setCreating(false);
                    setList(null);
                    setBody("");
                    setSubject("");
                    setConfirmed(false);
                    setNotice(
                      "Consulta enviada. Puedes consultar las respuestas en su historial.",
                    );
                    requestAnimationFrame(
                      () =>
                        activeView.current &&
                        document
                          .getElementById("support-thread-title")
                          ?.focus(),
                    );
                  });
                }}
              >
                <DetailHeading ref={formHeading} tabIndex={-1}>
                  Nueva consulta de soporte
                </DetailHeading>
                <label>
                  Asunto
                  <input
                    required
                    maxLength={120}
                    value={subject}
                    onChange={(event) => {
                      setSubject(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <label>
                  Gravedad
                  <select
                    value={severity}
                    onChange={(event) =>
                      setSeverity(Number(event.target.value) as 1 | 2 | 3 | 4)
                    }
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {severities[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Si hay peligro inmediato, utiliza los canales de emergencia.
                  Las consultas sobre seguridad se revisan primero.
                </p>
                <p id="support-privacy" className="task12-muted">
                  {help.privacy_notice}
                </p>
                <label>
                  Describe el problema
                  <textarea
                    required
                    maxLength={2000}
                    value={body}
                    onChange={(event) => {
                      setBody(event.target.value);
                      setConfirmed(false);
                    }}
                    aria-describedby="support-privacy"
                  />
                </label>
                <label className="support-consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    required
                  />
                  Revisé el texto, no incluí datos privados y confirmo enviar
                  esta consulta.
                </label>
                <button disabled={busy || !confirmed}>
                  Confirmar y enviar consulta
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => {
                    setCreating(false);
                    setConfirmed(false);
                    setBody("");
                    setSubject("");
                    setNotice("");
                    void loadList(offset, queueState, driver);
                  }}
                >
                  Cancelar
                </button>
              </form>
            )}
            {ticket && (
              <article
                className="support-thread"
                aria-label="Historial de soporte"
              >
                <button
                  className={
                    admin ? "button button-link" : "button button-outline"
                  }
                  disabled={busy}
                  onClick={() => {
                    setNotice("");
                    void loadList(offset, queueState, admin || driver);
                  }}
                >
                  {admin
                    ? "Volver a la cola de soporte"
                    : "Volver a mis consultas"}
                </button>
                <header className="support-ticket-heading">
                  <div className="task12-row">
                    <div>
                      {admin && (
                        <p className="support-ticket-number">
                          Consulta #{ticket.id}
                        </p>
                      )}
                      <DetailHeading id="support-thread-title" tabIndex={-1}>
                        {admin
                          ? ticket.subject
                          : `#${ticket.id} · ${ticket.subject}`}
                      </DetailHeading>
                    </div>
                    <span className={`task12-badge ticket-${ticket.state}`}>
                      {stateLabel(ticket.state, admin)}
                    </span>
                  </div>
                  {admin && (
                    <p className="support-requester">
                      <strong>Solicitante: </strong>
                      {requesterLabel(requester)}
                      <span className="task12-muted">
                        {" "}
                        El contrato de soporte no entrega nombres. Se muestra el
                        rol y el identificador autorizado de la cuenta.
                      </span>
                      <span
                        className={`support-severity severity-${ticket.severity}`}
                      >
                        Gravedad: {severities[ticket.severity]}
                      </span>
                    </p>
                  )}
                  <p className="task12-muted">
                    Creada {humanChileanDate(ticket.created_at)} · Actualizada{" "}
                    {humanChileanDate(ticket.updated_at)}
                  </p>
                </header>
                <details className="task12-disclosure">
                  <summary>
                    {admin
                      ? "Prioridad y datos del caso"
                      : "Ver prioridad de atención"}
                  </summary>
                  <div className="task12-disclosure-body">
                    <p>
                      Atención {priorities[ticket.priority].toLowerCase()} ·
                      Gravedad: {severities[ticket.severity]}.
                    </p>
                    <p>
                      Los incidentes críticos de seguridad se revisan primero.
                      Luego se considera la prioridad del plan vigente y la
                      antigüedad. La prioridad no garantiza una respuesta
                      inmediata.
                    </p>
                    {admin && (
                      <p>
                        Atención al crear:{" "}
                        {priorities[ticket.priority_at_creation]}. Versión del
                        caso: {ticket.version}.
                      </p>
                    )}
                  </div>
                </details>
                <div
                  className={admin || driver ? "support-workspace" : undefined}
                >
                  <section
                    className="support-conversation"
                    aria-label="Conversación"
                  >
                    <ConversationHeading>
                      {admin
                        ? "Historial del caso"
                        : "Conversación con el equipo"}
                    </ConversationHeading>
                    {admin && ticket.events.length > 3 && (
                      <details className="task12-disclosure">
                        <summary>
                          Ver {ticket.events.length - 3} eventos anteriores
                        </summary>
                        <div className="task12-disclosure-body">
                          <EarlierMessages
                            key={ticket.id}
                            ticket={ticket}
                            admin
                          />
                        </div>
                      </details>
                    )}
                    <ol className="support-events">
                      {ticket.events.slice(-3).map((event) => (
                        <TicketEvent
                          key={event.id}
                          event={event}
                          admin={admin}
                        />
                      ))}
                    </ol>
                    {!admin && ticket.events.length > 3 && (
                      <details className="task12-disclosure">
                        <summary>
                          Ver {ticket.events.length - 3} mensajes anteriores
                        </summary>
                        <div className="task12-disclosure-body">
                          <EarlierMessages key={ticket.id} ticket={ticket} />
                        </div>
                      </details>
                    )}
                  </section>
                  {ticket.state === "closed" ? (
                    <p>Consulta cerrada. Su historial permanece disponible.</p>
                  ) : (
                    <form
                      className={admin || driver ? "support-reply" : undefined}
                      aria-label={
                        admin
                          ? "Responder al solicitante"
                          : "Responder al equipo"
                      }
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submit(async () => {
                          const result = admin
                            ? await api.updateSupportTicket(ticket.id, {
                                body: reply,
                                state,
                                reason,
                                expected_version: ticket.version,
                              })
                            : await api.replySupportTicket(ticket.id, {
                                body: reply,
                                expected_version: ticket.version,
                              });
                          if (!live.current) return;
                          setTicket(result);
                          setList(null);
                          setState(result.state);
                          setReply("");
                          setReason("");
                          setNotice(
                            admin
                              ? reply.trim()
                                ? "Respuesta enviada. Historial actualizado."
                                : "Estado actualizado. Motivo registrado en el historial."
                              : "Historial actualizado.",
                          );
                        });
                      }}
                    >
                      {admin ? (
                        <ConversationHeading>
                          Responder al solicitante
                        </ConversationHeading>
                      ) : (
                        <p>{help?.privacy_notice}</p>
                      )}
                      <label>
                        Respuesta
                        <textarea
                          maxLength={2000}
                          required={!admin}
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                        />
                      </label>
                      {admin && (
                        <>
                          <details className="support-state-controls">
                            <summary>Cambiar estado (opcional)</summary>
                            <label>
                              Estado
                              <select
                                value={state}
                                onChange={(event) =>
                                  setState(
                                    event.target
                                      .value as SupportTicket["state"],
                                  )
                                }
                              >
                                {[
                                  ...new Set([
                                    ticket.state,
                                    ...ticket.allowed_transitions,
                                  ]),
                                ].map((value) => (
                                  <option key={value} value={value}>
                                    {stateLabel(value, admin)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {state === ticket.state && (
                              <label>
                                Motivo (opcional)
                                <input
                                  maxLength={300}
                                  value={reason}
                                  onChange={(event) =>
                                    setReason(event.target.value)
                                  }
                                />
                              </label>
                            )}
                          </details>
                          {state !== ticket.state && (
                            <p className="support-state-preview" role="status">
                              Se cambiará a «{stateLabel(state, admin)}» al
                              guardar.
                            </p>
                          )}
                          {state !== ticket.state && (
                            <label>
                              Motivo del cambio
                              <input
                                maxLength={300}
                                required={state !== ticket.state}
                                value={reason}
                                onChange={(event) =>
                                  setReason(event.target.value)
                                }
                              />
                            </label>
                          )}
                          <details className="support-privacy">
                            <summary>Privacidad al responder</summary>
                            <p>
                              {help?.privacy_notice ??
                                "No incluyas datos privados en la respuesta."}
                            </p>
                          </details>
                        </>
                      )}
                      {!admin && ticket.state === "resolved" && (
                        <p>Responder reabre la consulta para revisión.</p>
                      )}
                      <button
                        className={
                          admin && state !== ticket.state && !reply.trim()
                            ? "button button-outline"
                            : "button button-primary"
                        }
                        disabled={
                          busy ||
                          (admin &&
                            ((state === ticket.state && !reply.trim()) ||
                              (state !== ticket.state && !reason.trim())))
                        }
                      >
                        {admin && state !== ticket.state
                          ? reply.trim()
                            ? "Enviar respuesta y cambiar estado"
                            : "Guardar cambio de estado"
                          : "Enviar respuesta"}
                      </button>
                    </form>
                  )}
                </div>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void openTicket(ticket.id)}
                >
                  Actualizar esta consulta
                </button>
              </article>
            )}
          </section>
        )}
      </div>
      {section === "assistant" && (
        <>
          <h2 ref={sectionHeading} tabIndex={-1}>
            {canUseAssistant
              ? "Conversa con el asistente"
              : "Sobre el asistente"}
          </h2>
          {canUseAssistant && (
            <p className="task12-muted">
              Haz una pregunta sobre cómo usar FurgoPlus. Recibirás una
              orientación automática basada en nuestras guías.
            </p>
          )}
          <details className="task12-disclosure">
            <summary>Qué puede hacer el asistente</summary>
            <div className="task12-disclosure-body">
              <p>
                Pro permite consultar preguntas frecuentes. Elite también
                permite orientar con los estados de tu propia cuenta. El
                asistente usa reglas y contenidos revisados; no usa IA
                generativa ni realiza cambios.
              </p>
              <p>
                Si no encuentra una respuesta, puedes preparar una consulta para
                el equipo de soporte.
              </p>
            </div>
          </details>
          {error && !help && (
            <button
              className="button button-outline"
              disabled={helpLoading}
              onClick={() => {
                setError("");
                void refreshHelp();
              }}
            >
              Volver a cargar la ayuda
            </button>
          )}
          {error && help && (
            <button
              className="button button-outline"
              disabled={busy}
              onClick={draft}
            >
              Continuar con el equipo de soporte
            </button>
          )}
          {!help?.assistant_modes.length ? (
            <div className="task12-empty">
              <strong>Revisa las guías o consulta al equipo</strong>
              <p>
                {help
                  ? "El asistente requiere Pro o Elite vigentes y un perfil habilitado. Las guías y el soporte siguen disponibles."
                  : helpLoading
                    ? "Estamos comprobando la disponibilidad del asistente."
                    : "No pudimos comprobar la disponibilidad del asistente. Vuelve a cargar la ayuda o consulta tus consultas."}
              </p>
              <div className="task12-actions">
                <button
                  className="button button-primary"
                  onClick={() => setSection("help")}
                >
                  Ver guías de ayuda
                </button>
                <button
                  className="button button-outline"
                  disabled={!help || busy}
                  onClick={draft}
                >
                  Crear consulta de soporte
                </button>
              </div>
            </div>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setAnswer(null);
                  const sequence = ++answerSequence.current;
                  void submit(async () => {
                    const result = await api.askAssistant({ question, mode });
                    if (live.current && sequence === answerSequence.current)
                      setAnswer(result);
                  });
                }}
              >
                <label>
                  Tipo de ayuda
                  <select
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as "faq" | "contextual");
                      setAnswer(null);
                      answerSequence.current++;
                    }}
                  >
                    {help.assistant_modes.map((value) => (
                      <option key={value} value={value}>
                        {value === "faq"
                          ? "Preguntas frecuentes"
                          : "Contexto propio (Elite)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pregunta
                  <input
                    required
                    maxLength={300}
                    value={question}
                    onChange={(event) => {
                      setQuestion(event.target.value);
                      setAnswer(null);
                      answerSequence.current++;
                    }}
                    aria-describedby="assistant-privacy"
                    placeholder="Por ejemplo: ¿dónde veo cuándo vence mi plan?"
                  />
                </label>
                <p className="task12-muted">
                  Puedes preguntar por planes, reportes, rutas, pagos o primeros
                  pasos.
                </p>
                <p id="assistant-privacy">{help.privacy_notice}</p>
                <button disabled={busy}>Consultar asistente</button>
              </form>
              {answer && (
                <article
                  aria-label="Respuesta del asistente"
                  aria-live="polite"
                >
                  <p>{answer.answer}</p>
                  {answer.article_id && (
                    <p>
                      <a
                        href={`#help-${answer.article_id}`}
                        onClick={() => showArticle(answer.article_id!)}
                      >
                        Consultar guía de origen
                      </a>{" "}
                      · Versión {answer.content_version}
                    </p>
                  )}
                  {answer.context.length > 0 && (
                    <dl>
                      {answer.context.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {answer.can_offer_ticket && (
                    <div className="assistant-recovery">
                      <h3>¿Necesitas más ayuda?</h3>
                      <p>
                        Envía una consulta al equipo. Podrás revisar el texto
                        antes de enviarlo y seguir las respuestas en Mis
                        consultas.
                      </p>
                      <button
                        className="button button-primary"
                        disabled={busy}
                        onClick={draft}
                      >
                        Preparar consulta de soporte
                      </button>
                    </div>
                  )}
                </article>
              )}
            </>
          )}
        </>
      )}
      <footer className="help-service-notice">
        {admin || driver ? (
          <details>
            <summary>Sobre la atención y sus límites</summary>
            <p>
              {help?.service_notice ??
                "La atención humana no es inmediata ni está disponible 24/7."}
            </p>
            <p>
              No es un canal de emergencias. Si hay peligro inmediato, utiliza
              los canales de emergencia correspondientes.
            </p>
            {driver && help && <p>{help.privacy_notice}</p>}
          </details>
        ) : (
          <>
            <strong>Sobre la atención</strong>
            <p>
              {help?.service_notice ??
                "Puedes consultar la ayuda y enviar consultas sin horario, mientras el servicio esté disponible. La atención humana no es inmediata ni está disponible 24/7."}
            </p>
            <p>
              No es un canal de emergencias. Si hay peligro inmediato, utiliza
              los canales de emergencia correspondientes.
            </p>
          </>
        )}
      </footer>
    </section>
  );
}

function EarlierMessages({
  ticket,
  admin = false,
}: {
  ticket: SupportTicket;
  admin?: boolean;
}) {
  const page = useLocalPage(ticket.events.slice(0, -3), String(ticket.id));
  return (
    <>
      <p className="task12-muted">
        Paginación local de los mensajes anteriores recibidos. Los tres más
        recientes se muestran junto a la respuesta.
      </p>
      <ol className="support-events" id="support-earlier-results" tabIndex={-1}>
        {page.rows.map((event) => (
          <TicketEvent key={event.id} event={event} admin={admin} />
        ))}
      </ol>
      {page.count > 10 && (
        <CollectionPages
          {...page}
          label="Páginas de mensajes anteriores"
          resultsId="support-earlier-results"
        />
      )}
    </>
  );
}

function QueueSummary({
  list,
  offset,
}: {
  list: SupportTickets;
  offset: number;
}) {
  const active = list.results.filter(
    (row) => row.state !== "closed" && row.state !== "resolved",
  );
  const metrics = [
    {
      label: "Críticas activas",
      value: active.filter((row) => row.severity === 1).length,
      tone: "critical",
    },
    {
      label: "Abiertas · por revisar",
      value: active.filter((row) => row.state === "open").length,
      tone: "pending",
    },
    {
      label: "En revisión",
      value: active.filter((row) => row.state === "in_progress").length,
      tone: "review",
    },
  ];
  return (
    <section className="support-summary" aria-label="Resumen de la cola">
      <div className="support-summary-heading">
        <strong>
          {list.count}{" "}
          {list.count === 1
            ? "consulta en esta vista"
            : "consultas en esta vista"}
        </strong>
        <span>
          {list.results.length
            ? `Mostrando ${offset + 1}–${offset + list.results.length}`
            : "Sin resultados"}{" "}
          · Indicadores de esta página
        </span>
      </div>
      <dl className="support-metrics">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={metric.value ? `has-${metric.tone}` : undefined}
          >
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AdminQueue({
  api,
  list,
  busy,
  onReview,
}: {
  api: AuthApi;
  list: SupportTickets;
  busy: boolean;
  onReview: (id: number) => void;
}) {
  const [requesters, setRequesters] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const visible = list.results.filter(
    (row) =>
      (!severityFilter || String(row.severity) === severityFilter) &&
      searchText(
        `${row.id} ${row.subject} ${stateLabel(row.state, true)} ${requesters[row.id] ?? ""}`,
      ).includes(searchText(query)),
  );
  useEffect(() => {
    // List responses omit the owner. Read only the visible page, with at most
    // three detail requests in flight; retain identity labels, never histories.
    let cancelled = false;
    let next = 0;
    setRequesters({});
    async function readRequester() {
      while (!cancelled && next < list.results.length) {
        const row = list.results[next++];
        if (!row) return;
        let label: string;
        try {
          const detail = await api.supportTicket(row.id, true);
          label =
            detail.id === row.id
              ? requesterLabel(ticketRequester(detail))
              : "Identificación no disponible";
        } catch {
          label = "Identificación no disponible · revisa el caso";
        }
        if (!cancelled)
          setRequesters((current) => ({ ...current, [row.id]: label }));
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(3, list.results.length) }, readRequester),
    );
    return () => {
      cancelled = true;
    };
  }, [api, list.results]);
  return (
    <>
      <details className="support-page-filters">
        <summary>
          Buscar y filtrar esta página
          {query || severityFilter ? " · Criterios activos" : ""}
        </summary>
        <div className="support-local-filters">
          <label>
            Buscar en esta página de soporte
            <input
              type="search"
              placeholder="Asunto, número o identificación disponible"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            Gravedad en esta página
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              <option value="">Todas</option>
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {severities[value]}
                </option>
              ))}
            </select>
          </label>
          {(query || severityFilter) && (
            <button
              className="button button-quiet"
              onClick={() => {
                setQuery("");
                setSeverityFilter("");
              }}
            >
              Limpiar búsqueda de página
            </button>
          )}
        </div>
        <p className="task12-muted">
          {visible.length} de {list.results.length} casos de esta página. Estos
          criterios no buscan en otras páginas. La identificación disponible
          incluye rol e ID; soporte no entrega nombres.
        </p>
      </details>
      {!visible.length && (
        <p role="status">
          No hay coincidencias en esta página. Limpia los criterios o cambia de
          página.
        </p>
      )}
      <ol
        className="support-admin-queue"
        aria-label="Consultas en orden de atención"
      >
        {visible.map((row) => (
          <li
            key={row.id}
            className={`support-queue-card severity-${row.severity}`}
          >
            <div className="support-queue-subject">
              <span className={`support-severity severity-${row.severity}`}>
                {severities[row.severity]}
              </span>
              <h3>
                #{row.id} · {row.subject}
              </h3>
              <p>
                Solicitante:{" "}
                <span className="task12-muted">
                  {requesters[row.id] ?? "Cargando identificación…"}
                </span>
              </p>
            </div>
            <div className={`support-queue-status state-${row.state}`}>
              <strong>{stateLabel(row.state, true)}</strong>
              <span>Atención: {priorities[row.priority]}</span>
              <span>
                Creada{" "}
                <time dateTime={row.created_at}>
                  {humanChileanDate(row.created_at)}
                </time>
              </span>
            </div>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => onReview(row.id)}
              aria-label={`Revisar consulta #${row.id}: ${row.subject}`}
            >
              Revisar
              <span className="support-review-arrow" aria-hidden="true">
                {" "}
                →
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function TicketEvent({
  event,
  admin,
}: {
  event: SupportTicket["events"][number];
  admin: boolean;
}) {
  return (
    <li
      className={
        admin
          ? `support-event event-${event.author_role === "admin" ? "team" : "requester"}`
          : undefined
      }
    >
      <p className="support-event-meta">
        <strong>
          {event.author_role === "admin" ? "Soporte" : "Solicitante"}
          {admin ? ` · Usuario #${event.author_id}` : ""}
        </strong>{" "}
        ·{" "}
        <time dateTime={event.occurred_at}>
          {humanChileanDate(event.occurred_at)}
        </time>
      </p>
      {event.body && <p className="support-body">{event.body}</p>}
      {event.from_state !== event.to_state && (
        <p className="task12-muted">
          {event.from_state
            ? `Estado anterior: ${stateLabel(event.from_state as SupportTicket["state"], admin)}. `
            : ""}
          Estado: {stateLabel(event.to_state, admin)}.
        </p>
      )}
      {event.reason && <p>Motivo: {event.reason}</p>}
    </li>
  );
}
