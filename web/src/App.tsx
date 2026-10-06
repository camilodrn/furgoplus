import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type { Identity, Publication } from "./api-types";
import "./style.css";
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
  const [state, setState] = useState<State>({ kind: "loading" });
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [logoAvailable, setLogoAvailable] = useState(true);
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
  }, []);

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
    const form = event.currentTarget;
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement).value;
    setMessage("");
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
        setMessage("Cuenta creada. Inicia sesión.");
      } else {
        const user = await api.login({
          email: value("email"),
          password: value("password"),
        });
        form.reset();
        sessionStorage.removeItem(marker);
        authenticate(user);
      }
    } catch (error) {
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
      else
        setMessage(
          error instanceof ApiError
            ? error.message
            : "No se pudo completar la solicitud.",
        );
    }
  }

  async function signOut() {
    api.invalidateRequests();
    identityKey.current = null;
    sessionStorage.setItem(marker, "1");
    setState({ kind: "signed-out" });
    try {
      await api.logout();
      sessionStorage.removeItem(marker);
    } catch {
      api.clear();
      setMessage(
        "Sesión local cerrada. El cierre en el servidor no está confirmado.",
      );
    }
  }

  return (
    <div className="shell">
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-group">
            {logoAvailable ? (
              <img
                className="brand-logo"
                src="/brand/furgoplus-logo.png"
                alt="FurgoPlus Transporte Escolar"
                onError={() => setLogoAvailable(false)}
              />
            ) : (
              <span className="brand-wordmark">FurgoPlus</span>
            )}
            <span className="header-context">
              {state.kind === "authenticated"
                ? state.user.role === "admin"
                  ? "Validaciones de conductores"
                  : "Validación del conductor"
                : "Acceso a tu cuenta"}
            </span>
          </div>
          {state.kind === "authenticated" && (
            <div className="account-actions">
              <span className="account-name">
                {state.user.display_name || state.user.email}
              </span>
              <button
                className="button button-quiet"
                onClick={() => void signOut()}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>
      <main
        className={state.kind === "authenticated" ? "workspace" : "auth-card"}
      >
        {state.kind === "loading" && <p>Restaurando sesión…</p>}
        {state.kind === "error" && (
          <>
            <p className="error">{state.message}</p>
            <button onClick={() => window.location.reload()}>Reintentar</button>
          </>
        )}
        {state.kind === "expired" && <p>La sesión caducó.</p>}
        {state.kind === "authenticated" && (
          <AuthenticatedWorkspace
            key={`${state.user.id}:${state.user.role}`}
            api={api}
            user={state.user}
          />
        )}
        {(state.kind === "signed-out" || state.kind === "expired") && (
          <>
            <h1>
              {mode === "login" ? "Iniciar sesión" : "Registro de conductor"}
            </h1>
            <form onSubmit={(event) => void submit(event)}>
              {mode === "register" && (
                <label>
                  Nombre visible
                  <input name="display_name" required maxLength={100} />
                </label>
              )}
              <label>
                Correo
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </label>
              <button type="submit">
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Registrar conductor" : "Volver al inicio"}
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </main>
    </div>
  );
}

function AuthenticatedWorkspace({
  api,
  user,
}: {
  api: AuthApi;
  user: Identity;
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
  const [publication, setPublication] = useState<Publication | null>(null);
  const [publicationRefreshKey, setPublicationRefreshKey] = useState(0);

  return (
    <>
      {user.role === "driver" && (
        <>
          <DriverOnboarding
            api={api}
            activeSection={driverSection}
            onSectionChange={setDriverSection}
            publication={publication}
            onRelevantChange={() => setPublicationRefreshKey((key) => key + 1)}
          />
          <DriverPublicationScreen
            api={api}
            refreshKey={publicationRefreshKey}
            onPublicationChange={setPublication}
            activeSection={
              driverSection === "publication" ? "publication" : "routes"
            }
            visible={
              driverSection === "publication" || driverSection === "routes"
            }
          />
          {driverSection === "requests" && <DriverRequests api={api} />}
          {driverSection === "summary" && <DriverSummaryScreen api={api} />}
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
          <nav className="section-nav" aria-label="Administración">
            <button onClick={() => setAdminSection("control")}>
              Control de conductores
            </button>
            <button onClick={() => setAdminSection("validation")}>
              Revisión de documentos
            </button>
          </nav>
          {adminSection === "control" ? (
            <AdminControlScreen api={api} />
          ) : (
            <AdminValidationScreen api={api} />
          )}
        </>
      )}
      {user.role === "parent" && <h1>Usa la aplicación móvil</h1>}
    </>
  );
}
