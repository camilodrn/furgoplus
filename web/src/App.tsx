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
import { DriverRequests } from "./DriverRequests";
import {
  DriverPayments,
  DriverRoster,
  DriverSummaryScreen,
} from "./DriverOperations";

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
    | "profile"
    | "documents"
    | "validation"
    | "publication"
    | "routes"
    | "requests"
    | "summary"
    | "roster"
    | "payments"
  >("profile");
  const [adminSection, setAdminSection] = useState<"control" | "validation">(
    "control",
  );
  const [adminRootNavigationKey, setAdminRootNavigationKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const serviceSections = [
    "profile",
    "documents",
    "validation",
    "publication",
    "routes",
  ];
  const inService = serviceSections.includes(driverSection);
  const driverDestinations = [
    { id: "summary", label: "Inicio", icon: "home" },
    { id: "profile", label: "Mi servicio", icon: "route" },
    { id: "roster", label: "Pasajeros", icon: "people" },
    { id: "requests", label: "Solicitudes", icon: "message" },
    { id: "payments", label: "Pagos", icon: "payment" },
  ] as const;
  function navigate(action: () => void) {
    action();
    setMenuOpen(false);
    main.current?.focus();
  }
  const [publication, setPublication] = useState<Publication | null>(null);
  const [publicationRefreshKey, setPublicationRefreshKey] = useState(0);

  return (
    <div
      className={`workspace-shell ${user.role === "admin" ? "admin-shell" : ""}`}
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
        id="workspace-sidebar"
        className={`workspace-sidebar ${menuOpen ? "menu-open" : ""}`}
      >
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
                      (id === "profile" ? inService : driverSection === id)
                        ? "page"
                        : undefined
                    }
                    onClick={() => navigate(() => setDriverSection(id))}
                  >
                    <NavIcon name={icon} />
                    {label}
                  </button>
                  {id === "profile" && (
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
                              driverSection === section ? "page" : undefined
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
                    adminSection === "validation" ? "page" : undefined
                  }
                  onClick={() => navigate(() => setAdminSection("validation"))}
                >
                  <NavIcon name="check" />
                  Validaciones
                </button>
              </li>
              <li>
                <button
                  className="sidebar-link"
                  aria-current={adminSection === "control" ? "page" : undefined}
                  onClick={() => {
                    navigate(() => {
                      setAdminSection("control");
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
                  <NavIcon name="people" />
                  Conductores
                </button>
              </li>
            </ul>
          </nav>
        )}
        <div className="sidebar-account">
          <span className="auth-support">Tu cuenta</span>
          <strong>{user.display_name || user.email}</strong>
          <LegalAccess />
          <button className="button-outline" onClick={onSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main id="main-content" ref={main} tabIndex={-1} className="workspace">
        {user.role === "driver" && (
          <>
            {!inService && (
              <h1>
                {
                  driverDestinations.find((item) => item.id === driverSection)
                    ?.label
                }
              </h1>
            )}
            <div hidden={!inService}>
              <DriverOnboarding
                showNavigation={false}
                api={api}
                activeSection={
                  driverSection === "summary" ? "profile" : driverSection
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
              refreshKey={publicationRefreshKey}
              onPublicationChange={setPublication}
              onNavigate={(destination) =>
                navigate(() => setDriverSection(destination))
              }
              activeSection={
                driverSection === "publication" ? "publication" : "routes"
              }
              visible={
                driverSection === "publication" || driverSection === "routes"
              }
            />
            {driverSection === "requests" && <DriverRequests api={api} />}
            {driverSection === "summary" && (
              <DriverSummaryScreen
                api={api}
                name={user.display_name ?? ""}
                onNavigate={(destination) =>
                  navigate(() => setDriverSection(destination))
                }
              />
            )}
            {driverSection === "roster" && (
              <DriverRoster
                api={api}
                onAssignmentChange={() =>
                  setPublicationRefreshKey((key) => key + 1)
                }
              />
            )}
            {driverSection === "payments" && <DriverPayments api={api} />}
          </>
        )}
        {user.role === "admin" && (
          <>
            {adminSection === "control" ? (
              <AdminControlScreen
                api={api}
                rootNavigationKey={adminRootNavigationKey}
                onValidations={() =>
                  navigate(() => setAdminSection("validation"))
                }
              />
            ) : (
              <AdminValidationScreen api={api} />
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
      </main>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
    route: "M4 6h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8M4 3v6m-3-3h6M16 19l3 3-3 1",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
    message:
      "M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h7",
    payment: "M3 5h18v14H3ZM3 9h18M7 15h4",
    check: "m5 12 4 4L19 6M3 3h18v18H3Z",
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
