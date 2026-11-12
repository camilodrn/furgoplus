import { TaskVisibility } from "./useModal";
import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import { demoRegistrationNotice, isDemoMode } from "./demo";
import type { Identity, Publication } from "./api-types";
import "./style.css";
import { LegalAccess } from "./LegalAccess";
import { ActionFeedbackProvider } from "./ActionFeedback";
import { AdminValidationScreen, DriverOnboarding } from "./ValidationScreens";
import { DriverPublicationScreen } from "./PublicationScreens";
import { AdminControlScreen } from "./AdminControls";
import { AdminOverview } from "./AdminOverview";
import "./admin-coherence.css";
import { DriverRequests } from "./DriverRequests";
import { DriverReports } from "./DriverReports";
import { ProductIcon } from "./DriverExperience";
import { HelpSupport } from "./HelpSupport";
import {
  DriverPayments,
  DriverRoster,
  DriverSummaryScreen,
} from "./DriverOperations";
import "./driver-coherence.css";

const marker = "furgoplus-signed-out";
type State =
  | { kind: "loading" | "signed-out" | "expired" | "error"; message?: string }
  | { kind: "authenticated"; user: Identity };

export default function App() {
  const demoMode = isDemoMode();
  const authForm = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [messageKind, setMessageKind] = useState<
    "error" | "success" | "warning"
  >("error");
  const identityKey = useRef<string | null>(null);
  const [api] = useState(
    () =>
      new AuthApi(() => {
        const wasAuthenticated = identityKey.current !== null;
        identityKey.current = null;
        setState({ kind: wasAuthenticated ? "expired" : "signed-out" });
      }),
  );

  function authenticate(user: Identity) {
    const key = `${user.id}:${user.role}`;
    if (identityKey.current !== key) api.invalidateRequests();
    identityKey.current = key;
    setMessage("");
    setFieldErrors({});
    setState({ kind: "authenticated", user });
  }

  useEffect(() => {
    let live = true;
    const restore = async () => {
      try {
        await api.csrf();
        if (sessionStorage.getItem(marker)) {
          if (live) setState({ kind: "signed-out" });
          try {
            await api.logout();
            sessionStorage.removeItem(marker);
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === "not_authenticated"
            ) {
              sessionStorage.removeItem(marker);
            }
          }
          return;
        }
        const user = await api.me();
        if (live) authenticate(user);
      } catch (error) {
        if (!live) return;
        // AuthApi handles confirmed absence/expiration centrally. Superseded
        // restores must leave the newer authentication state untouched.
        if (
          error instanceof ApiError &&
          (error.code === "not_authenticated" || error.code === "stale_request")
        )
          return;
        setState({
          kind: "error",
          message: "No se pudo restaurar la sesión.",
        });
      }
    };
    void restore();
    return () => {
      live = false;
    };
  }, [restoreAttempt]);

  useEffect(() => {
    if (state.kind !== "authenticated") return;
    let live = true;
    let verification = 0;
    const verify = async () => {
      const current = ++verification;
      if (document.visibilityState !== "visible") return;
      try {
        const user = await api.me();
        if (live && current === verification) authenticate(user);
      } catch {
        // AuthApi centrally invalidates confirmed expiration. Other failures
        // preserve the last confirmed identity until verification succeeds.
      }
    };
    document.addEventListener("visibilitychange", verify);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", verify);
    };
  }, [state.kind]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setMessageKind("error");
    const form = event.currentTarget;
    if (mode === "register" && demoMode) {
      form.reset();
      setShowPassword(false);
      setFieldErrors({});
      setMessageKind("warning");
      setMessage(demoRegistrationNotice);
      return;
    }
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement).value;
    setMessage("");
    const errors: Record<string, string> = {};
    if (mode === "register" && !value("display_name").trim())
      errors.display_name = "Ingresa tu nombre.";
    if (!value("email").trim()) errors.email = "Ingresa tu correo electrónico.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email").trim()))
      errors.email = "Ingresa un correo electrónico válido.";
    if (!value("password")) errors.password = "Ingresa tu contraseña.";
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      setMessage("Revisa los campos indicados.");
      (form.elements.namedItem(firstInvalid) as HTMLInputElement).focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      if (mode === "register") {
        await api.register({
          email: value("email"),
          password: value("password"),
          role: "driver",
          display_name: value("display_name"),
        });
        form.reset();
        setMode("login");
        setShowPassword(false);
        setMessageKind("success");
        setMessage("Cuenta creada. Inicia sesión.");
      } else {
        const user = await api.login({
          email: value("email"),
          password: value("password"),
        });
        form.reset();
        sessionStorage.removeItem(marker);
        setShowPassword(false);
        authenticate(user);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "stale_request") return;
      if (error instanceof ApiError && error.code === "registration_disabled") {
        form.reset();
        setShowPassword(false);
        setMessageKind("warning");
        setMessage(demoRegistrationNotice);
        return;
      }
      if (error instanceof ApiError && error.code === "csrf_failed")
        setMessage("La verificación caducó. Repite la acción.");
      else if (
        mode === "login" &&
        error instanceof ApiError &&
        error.status === 400 &&
        error.code === "validation_error" &&
        "credentials" in error.fields
      )
        setMessage("Correo o contraseña incorrectos.");
      else if (error instanceof ApiError && error.code === "throttled")
        setMessage(
          "Hay demasiados intentos. Espera un momento y vuelve a intentarlo.",
        );
      else if (error instanceof ApiError && error.code === "validation_error") {
        const errors: Record<string, string> = {};
        if ("display_name" in error.fields)
          errors.display_name =
            "Escribe cómo te llamas (hasta 100 caracteres).";
        if ("email" in error.fields)
          errors.email = "Revisa el correo electrónico.";
        if ("password" in error.fields)
          errors.password = "Revisa los requisitos de la contraseña.";
        setFieldErrors(errors);
        setMessage(
          mode === "register"
            ? "No pudimos crear la cuenta. Revisa tu correo, nombre y los requisitos de la contraseña e inténtalo de nuevo."
            : "Revisa tu correo y contraseña e inténtalo de nuevo.",
        );
      } else
        setMessage("No se pudo completar la solicitud. Inténtalo de nuevo.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function signOut() {
    api.invalidateRequests();
    identityKey.current = null;
    sessionStorage.setItem(marker, "1");
    setState({ kind: "signed-out" });
    setMode("login");
    setMessage("");
    setShowPassword(false);
    try {
      await api.logout();
      sessionStorage.removeItem(marker);
    } catch (error) {
      if (error instanceof ApiError && error.code === "stale_request") return;
      api.clear();
      setMessageKind("warning");
      setMessage(
        "Sesión local cerrada. El cierre en el servidor no está confirmado.",
      );
    }
  }

  if (state.kind === "authenticated")
    return (
      <ActionFeedbackProvider key={`${state.user.id}:${state.user.role}`}>
        <AuthenticatedWorkspace
          api={api}
          user={state.user}
          onSignOut={() => void signOut()}
        />
      </ActionFeedbackProvider>
    );

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <header className="auth-brand">
        <Brand />
      </header>
      <main id="main-content" tabIndex={-1} className="auth-card">
        {state.kind === "loading" && (
          <>
            <h1>Abriendo FurgoPlus</h1>
            <p role="status">Estamos comprobando tu sesión…</p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1>No pudimos abrir tu cuenta</h1>
            <p className="auth-notice notice-error" role="alert">
              {state.message}
            </p>
            <p>Comprueba tu conexión y vuelve a intentarlo.</p>
            <button
              className="button-primary"
              onClick={() => {
                api.invalidateRequests();
                setState({ kind: "loading" });
                setRestoreAttempt((attempt) => attempt + 1);
              }}
            >
              Reintentar
            </button>
          </>
        )}
        {(state.kind === "signed-out" || state.kind === "expired") && (
          <>
            {state.kind === "expired" && (
              <p className="auth-notice notice-warning" role="alert">
                Tu sesión caducó. Inicia sesión de nuevo para continuar.
              </p>
            )}
            <h1>
              {mode === "login"
                ? "Inicia sesión"
                : demoMode
                  ? "Registro ilustrativo de conductor"
                  : "Crea tu cuenta de conductor"}
            </h1>
            <p className="auth-intro">
              {mode === "login"
                ? "Coordina tu transporte escolar con FurgoPlus."
                : demoMode
                  ? "Puedes explorar el formulario. El registro público está cerrado en esta demostración."
                  : "Primero crea tu cuenta. Después podrás completar tus datos y enviar tus documentos para aprobación."}
            </p>
            {mode === "register" && (
              <p className="auth-notice auth-demo-notice notice-warning">
                {demoMode
                  ? "No ingreses datos reales. Las cuentas ficticias las prepara el equipo."
                  : "Entorno de demostración: usa únicamente información sintética de prueba."}
              </p>
            )}
            <form
              ref={authForm}
              noValidate
              aria-label={
                mode === "login" ? "Inicio de sesión" : "Registro de conductor"
              }
              aria-busy={pending}
              onSubmit={(event) => void submit(event)}
            >
              {mode === "register" && (
                <div className="field">
                  <label htmlFor="auth-name">Cómo te llamas</label>
                  <input
                    id="auth-name"
                    name="display_name"
                    required
                    maxLength={100}
                    autoComplete={demoMode ? "off" : "name"}
                    disabled={pending}
                    aria-invalid={!!fieldErrors.display_name}
                    aria-describedby={
                      fieldErrors.display_name ? "name-error" : undefined
                    }
                  />
                  {fieldErrors.display_name && (
                    <span className="field-error" id="name-error">
                      {fieldErrors.display_name}
                    </span>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor="auth-email">Correo electrónico</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete={
                    demoMode && mode === "register" ? "off" : "email"
                  }
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={pending}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                />
                {fieldErrors.email && (
                  <span className="field-error" id="email-error">
                    {fieldErrors.email}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="auth-password">Contraseña</label>
                <div className="password-control">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={
                      demoMode && mode === "register"
                        ? "off"
                        : mode === "login"
                          ? "current-password"
                          : "new-password"
                    }
                    disabled={pending}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={
                      [
                        mode === "register" ? "password-help" : "",
                        fieldErrors.password ? "password-error" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                  <button
                    type="button"
                    className="button-outline"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-controls="auth-password"
                    aria-pressed={showPassword}
                    disabled={pending}
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {mode === "register" && (
                  <p className="helper-text" id="password-help">
                    Usa al menos 8 caracteres. Evita contraseñas comunes, solo
                    números o muy parecidas a tu correo.
                  </p>
                )}
                {fieldErrors.password && (
                  <span className="field-error" id="password-error">
                    {fieldErrors.password}
                  </span>
                )}
              </div>
              {message && (
                <p
                  className={`auth-notice notice-${messageKind}`}
                  role={messageKind === "success" ? "status" : "alert"}
                >
                  {message}
                </p>
              )}
              <button
                className="button-primary"
                type="submit"
                disabled={pending}
              >
                {pending
                  ? mode === "login"
                    ? "Iniciando sesión…"
                    : "Creando cuenta…"
                  : mode === "login"
                    ? "Iniciar sesión"
                    : "Crear cuenta"}
              </button>
              {pending && (
                <span className="sr-only" role="status">
                  Espera mientras completamos tu solicitud.
                </span>
              )}
            </form>
            <div className="auth-switch">
              {mode === "login" && <p>¿Aún no tienes cuenta?</p>}
              <button
                type="button"
                className="button-outline"
                disabled={pending}
                onClick={() => {
                  if (demoMode) authForm.current?.reset();
                  setMode(mode === "login" ? "register" : "login");
                  setShowPassword(false);
                  setMessage("");
                  setFieldErrors({});
                }}
              >
                {mode === "login"
                  ? "Crear cuenta de conductor"
                  : "Volver a iniciar sesión"}
              </button>
              <p className="auth-support">
                Si eres apoderado, usa la aplicación móvil.
              </p>
            </div>
          </>
        )}
        <LegalFooter />
      </main>
    </div>
  );
}

function Brand() {
  const [available, setAvailable] = useState(true);
  return available ? (
    <img
      className="brand-logo"
      src="/brand/furgoplus-logo.png"
      alt="FurgoPlus Transporte Escolar"
      onError={() => setAvailable(false)}
    />
  ) : (
    <span className="brand-wordmark">FurgoPlus</span>
  );
}

function LegalFooter() {
  return (
    <footer className="auth-legal">
      <LegalAccess />
    </footer>
  );
}

function AuthenticatedWorkspace({
  api,
  user,
  onSignOut,
}: {
  api: AuthApi;
  user: Identity;
  onSignOut: () => void;
}) {
  const [driverSection, setDriverSection] = useState<
    | "service"
    | "profile"
    | "documents"
    | "validation"
    | "publication"
    | "routes"
    | "requests"
    | "summary"
    | "roster"
    | "payments"
    | "reports"
  >("summary");
  const [adminSection, setAdminSection] = useState<
    "summary" | "control" | "validation"
  >("summary");
  const [adminPendingDrivers, setAdminPendingDrivers] = useState(false);
  const [adminValidationTarget, setAdminValidationTarget] = useState<
    number | undefined
  >();
  const [adminRootNavigationKey, setAdminRootNavigationKey] = useState(0);
  const [visitedDriver, setVisitedDriver] = useState<string[]>([]);
  const [visitedAdmin, setVisitedAdmin] = useState<string[]>([]);
  useEffect(() => {
    if (user.role === "driver")
      setVisitedDriver((current) =>
        current.includes(driverSection) ? current : [...current, driverSection],
      );
    if (user.role === "admin")
      setVisitedAdmin((current) =>
        current.includes(adminSection) ? current : [...current, adminSection],
      );
  }, [driverSection, adminSection, user.role]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpVisited, setHelpVisited] = useState(false);
  useEffect(() => {
    if (helpOpen) setHelpVisited(true);
  }, [helpOpen]);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const serviceSections = [
    "service",
    "profile",
    "documents",
    "validation",
    "publication",
    "routes",
  ];
  const historyReady = useRef(false);
  const historyPop = useRef(false);
  useEffect(() => {
    if (user.role !== "driver" && user.role !== "admin") return;
    const restore = (event: PopStateEvent) => {
      if (user.role === "admin") {
        const section = event.state?.furgoAdminSection;
        if (!["summary", "control", "validation"].includes(section)) return;
        historyPop.current = true;
        setAdminSection(section);
        setHelpOpen(Boolean(event.state?.furgoHelp));
        setMenuOpen(false);
        main.current?.focus();
        return;
      }
      const section = event.state?.furgoDriverSection;
      if (
        ![
          "service",
          "profile",
          "documents",
          "validation",
          "publication",
          "routes",
          "requests",
          "summary",
          "roster",
          "payments",
          "reports",
        ].includes(section)
      )
        return;
      historyPop.current = true;
      setDriverSection(section);
      setHelpOpen(Boolean(event.state?.furgoHelp));
      setMenuOpen(false);
      main.current?.focus();
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [user.role]);
  useEffect(() => {
    if (user.role !== "driver" && user.role !== "admin") return;
    if (historyPop.current) {
      historyPop.current = false;
      return;
    }
    const state = {
      ...window.history.state,
      furgoDriverSection: user.role === "driver" ? driverSection : undefined,
      furgoAdminSection: user.role === "admin" ? adminSection : undefined,
      furgoHelp: helpOpen,
    };
    if (!historyReady.current) {
      window.history.replaceState(state, "");
      historyReady.current = true;
    } else window.history.pushState(state, "");
  }, [driverSection, adminSection, helpOpen, user.role]);
  const inService = serviceSections.includes(driverSection);
  const driverDestinations = [
    { id: "summary", label: "Inicio", icon: "home" },
    { id: "service", label: "Mi servicio", icon: "route" },
    { id: "roster", label: "Pasajeros", icon: "people" },
    { id: "requests", label: "Solicitudes", icon: "message" },
    { id: "payments", label: "Pagos", icon: "payment" },
    { id: "reports", label: "Plan y reportes", icon: "reports" },
  ] as const;
  function navigate(action: () => void) {
    setHelpOpen(false);
    action();
    setMenuOpen(false);
    main.current?.focus();
    requestAnimationFrame(() => main.current?.focus());
  }
  useEffect(() => {
    if (!menuOpen || (user.role !== "driver" && user.role !== "admin")) return;
    const compact = window.matchMedia?.("(max-width: 900px)");
    if (compact && !compact.matches) {
      setMenuOpen(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const content = main.current;
    if (content) content.inert = true;
    const controls = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select, summary",
        ) ?? [],
      ).filter((node) => !node.closest("[hidden]"));
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = controls(),
        first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (compact && !compact.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", trap);
    compact?.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (content) content.inert = false;
      document.removeEventListener("keydown", trap);
      compact?.removeEventListener("change", resize);
    };
  }, [menuOpen, user.role]);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [publicationRefreshKey, setPublicationRefreshKey] = useState(0);

  return (
    <div
      className={`workspace-shell ${user.role === "admin" ? "admin-shell" : user.role === "driver" ? "driver-shell" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <header className="mobile-shell-header">
        <span className="brand-wordmark">FurgoPlus</span>
        <button
          ref={menuButton}
          className="button-outline"
          aria-expanded={menuOpen}
          aria-controls="workspace-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menú
        </button>
      </header>
      <aside
        ref={sidebar}
        id="workspace-sidebar"
        role={
          (user.role === "driver" || user.role === "admin") && menuOpen
            ? "dialog"
            : undefined
        }
        aria-modal={
          (user.role === "driver" || user.role === "admin") && menuOpen
            ? true
            : undefined
        }
        aria-label={
          menuOpen
            ? user.role === "driver"
              ? "Menú del conductor"
              : user.role === "admin"
                ? "Menú de administración"
                : undefined
            : undefined
        }
        className={`workspace-sidebar ${menuOpen ? "menu-open" : ""}`}
      >
        {(user.role === "driver" || user.role === "admin") && (
          <button
            className={`button button-outline ${user.role === "admin" ? "admin-menu-close" : "driver-menu-close"}`}
            onClick={() => {
              setMenuOpen(false);
              menuButton.current?.focus();
            }}
          >
            Cerrar menú
          </button>
        )}
        <div className="sidebar-brand">
          <Brand />
          <p>Transporte escolar</p>
        </div>
        {user.role === "driver" && (
          <nav aria-label="Secciones del conductor">
            <ul className="sidebar-links">
              {driverDestinations.map(({ id, label, icon }) => (
                <li key={id}>
                  <button
                    className="sidebar-link"
                    aria-current={
                      !helpOpen &&
                      (id === "service" ? inService : driverSection === id)
                        ? "page"
                        : undefined
                    }
                    onClick={() => navigate(() => setDriverSection(id))}
                  >
                    <ProductIcon size={24} name={icon} />
                    {label}
                  </button>
                  {id === "service" && (
                    <ul
                      className="sidebar-subnav"
                      aria-label="Configuración de mi servicio"
                    >
                      {(
                        [
                          ["publication", "Publicación"],
                          ["routes", "Rutas"],
                        ] as const
                      ).map(([section, text]) => (
                        <li key={section}>
                          <button
                            className="sidebar-link"
                            aria-current={
                              !helpOpen && driverSection === section
                                ? "page"
                                : undefined
                            }
                            onClick={() =>
                              navigate(() => setDriverSection(section))
                            }
                          >
                            {text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}
        {user.role === "admin" && (
          <nav aria-label="Administración">
            <ul className="sidebar-links">
              <li>
                <button
                  className="sidebar-link"
                  aria-current={
                    !helpOpen && adminSection === "summary" ? "page" : undefined
                  }
                  onClick={() => navigate(() => setAdminSection("summary"))}
                >
                  <ProductIcon size={24} name="home" />
                  Inicio
                </button>
              </li>
              <li>
                <button
                  className="sidebar-link"
                  aria-current={
                    !helpOpen && adminSection === "validation"
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    navigate(() => {
                      setAdminValidationTarget(undefined);
                      setAdminSection("validation");
                    })
                  }
                >
                  <ProductIcon size={24} name="check" />
                  Validaciones
                </button>
              </li>
              <li>
                <button
                  className="sidebar-link"
                  aria-current={
                    !helpOpen && adminSection === "control" ? "page" : undefined
                  }
                  onClick={() => {
                    navigate(() => {
                      setAdminSection("control");
                      setAdminPendingDrivers(false);
                      setAdminRootNavigationKey((key) => key + 1);
                    });
                    requestAnimationFrame(() => {
                      main.current?.focus({ preventScroll: true });
                      main.current?.scrollTo?.({ top: 0, behavior: "instant" });
                      document.scrollingElement?.scrollTo?.({
                        top: 0,
                        behavior: "instant",
                      });
                    });
                  }}
                >
                  <ProductIcon size={24} name="people" />
                  Conductores
                </button>
              </li>
            </ul>
          </nav>
        )}
        <nav aria-label="Ayuda">
          <button
            className="sidebar-link"
            aria-current={helpOpen ? "page" : undefined}
            onClick={() => navigate(() => setHelpOpen(true))}
          >
            <ProductIcon size={24} name="support" />
            Ayuda y soporte
          </button>
          {user.role === "parent" && helpOpen && (
            <button
              className="sidebar-link"
              onClick={() => navigate(() => setHelpOpen(false))}
            >
              Inicio
            </button>
          )}
        </nav>
        <div className="sidebar-account">
          <span className="auth-support">Tu cuenta</span>
          <strong>{user.display_name || user.email}</strong>
          <LegalAccess />
          <button className="button-outline" onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      {user.role === "driver" && (
        <header className="driver-context-bar" aria-label="Ubicación actual">
          <span>Conductor</span>
          <span aria-hidden="true">›</span>
          <strong>
            {helpOpen
              ? "Ayuda y soporte"
              : {
                  summary: "Inicio",
                  service: "Mi servicio",
                  profile: "Datos del servicio",
                  documents: "Documentos",
                  validation: "Revisión e historial",
                  publication: "Publicación",
                  routes: "Rutas",
                  roster: "Pasajeros",
                  requests: "Solicitudes",
                  payments: "Pagos",
                  reports: "Plan y reportes",
                }[driverSection]}
          </strong>
        </header>
      )}
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        className={`workspace${!helpOpen && user.role === "driver" && driverSection === "service" ? " service-workspace" : ""}${!helpOpen && user.role === "driver" && driverSection === "summary" ? " home-workspace" : ""}`}
      >
        {user.role === "admin" && (
          <p className="admin-academic-context">
            Administración académica · Usa únicamente datos sintéticos de
            demostración.
          </p>
        )}
        <div hidden={!helpOpen}>
          {(helpOpen || helpVisited) && (
            <HelpSupport
              api={api}
              admin={user.role === "admin"}
              driver={user.role === "driver"}
              active={helpOpen}
            />
          )}
        </div>
        <div hidden={helpOpen}>
          {user.role === "driver" && (
            <>
              {!inService && driverSection === "summary" && (
                <h1>
                  {
                    driverDestinations.find((item) => item.id === driverSection)
                      ?.label
                  }
                </h1>
              )}
              <div
                hidden={
                  !inService ||
                  driverSection === "publication" ||
                  driverSection === "routes"
                }
              >
                <DriverOnboarding
                  showNavigation={false}
                  api={api}
                  activeSection={
                    driverSection === "summary" || driverSection === "reports"
                      ? "profile"
                      : driverSection
                  }
                  onSectionChange={setDriverSection}
                  publication={publication}
                  onRelevantChange={() =>
                    setPublicationRefreshKey((key) => key + 1)
                  }
                />
              </div>
              <DriverPublicationScreen
                api={api}
                onBack={() => navigate(() => setDriverSection("service"))}
                refreshKey={publicationRefreshKey}
                onPublicationChange={setPublication}
                onNavigate={(destination) =>
                  navigate(() =>
                    destination === "help"
                      ? setHelpOpen(true)
                      : setDriverSection(destination),
                  )
                }
                activeSection={
                  driverSection === "publication" ? "publication" : "routes"
                }
                visible={
                  !helpOpen &&
                  (driverSection === "publication" ||
                    driverSection === "routes")
                }
              />
              {(driverSection === "requests" ||
                visitedDriver.includes("requests")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && driverSection === "requests"}
                >
                  <div hidden={driverSection !== "requests"}>
                    <DriverRequests
                      api={api}
                      active={!helpOpen && driverSection === "requests"}
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
              {driverSection === "summary" && (
                <DriverSummaryScreen
                  api={api}
                  name={user.display_name ?? ""}
                  onNavigate={(destination) =>
                    navigate(() =>
                      destination === "help"
                        ? setHelpOpen(true)
                        : setDriverSection(destination),
                    )
                  }
                />
              )}
              {(driverSection === "roster" ||
                visitedDriver.includes("roster")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && driverSection === "roster"}
                >
                  <div hidden={driverSection !== "roster"}>
                    <DriverRoster
                      api={api}
                      active={!helpOpen && driverSection === "roster"}
                      onAssignmentChange={() =>
                        setPublicationRefreshKey((key) => key + 1)
                      }
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
              {(driverSection === "payments" ||
                visitedDriver.includes("payments")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && driverSection === "payments"}
                >
                  <div hidden={driverSection !== "payments"}>
                    <DriverPayments
                      api={api}
                      active={!helpOpen && driverSection === "payments"}
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
              {(driverSection === "reports" ||
                visitedDriver.includes("reports")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && driverSection === "reports"}
                >
                  <div hidden={driverSection !== "reports"}>
                    <DriverReports
                      api={api}
                      active={!helpOpen && driverSection === "reports"}
                      onHome={() => navigate(() => setDriverSection("summary"))}
                      onHelp={() => navigate(() => setHelpOpen(true))}
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
            </>
          )}
          {user.role === "admin" && (
            <>
              {adminSection === "summary" && (
                <AdminOverview
                  api={api}
                  onDrivers={(pending = false) =>
                    navigate(() => {
                      setAdminPendingDrivers(pending);
                      setAdminSection("control");
                      setAdminRootNavigationKey((key) => key + 1);
                    })
                  }
                  onValidations={() =>
                    navigate(() => {
                      setAdminValidationTarget(undefined);
                      setAdminSection("validation");
                    })
                  }
                  onSupport={() => navigate(() => setHelpOpen(true))}
                />
              )}
              {(adminSection === "control" ||
                visitedAdmin.includes("control")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && adminSection === "control"}
                >
                  <div hidden={adminSection !== "control"}>
                    <AdminControlScreen
                      api={api}
                      rootNavigationKey={adminRootNavigationKey}
                      pendingOnly={adminPendingDrivers}
                      onValidations={(id) =>
                        navigate(() => {
                          setAdminValidationTarget(id);
                          setAdminSection("validation");
                        })
                      }
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
              {(adminSection === "validation" ||
                visitedAdmin.includes("validation")) && (
                <TaskVisibility.Provider
                  value={!helpOpen && adminSection === "validation"}
                >
                  <div hidden={adminSection !== "validation"}>
                    <AdminValidationScreen
                      key={adminValidationTarget ?? "queue"}
                      api={api}
                      initialValidationId={adminValidationTarget}
                      onAllPending={() =>
                        navigate(() => {
                          setAdminPendingDrivers(true);
                          setAdminSection("control");
                          setAdminRootNavigationKey((key) => key + 1);
                        })
                      }
                    />
                  </div>
                </TaskVisibility.Provider>
              )}
            </>
          )}
          {user.role === "parent" && (
            <>
              <h1>Usa la aplicación móvil</h1>
              <p>
                Desde allí puedes buscar transporte escolar y revisar tus
                solicitudes.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
