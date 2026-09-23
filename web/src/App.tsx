import { useEffect, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type { Identity } from "./api-types";
import "./style.css";

const api = new AuthApi();
const marker = "furgoplus-signed-out";
type State =
  | { kind: "loading" | "signed-out" | "expired" | "error"; message?: string }
  | { kind: "authenticated"; user: Identity };

export default function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");

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
        if (live) setState({ kind: "authenticated", user });
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && error.code === "not_authenticated") {
          api.clear();
          setState({ kind: "signed-out" });
        } else
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
    const verify = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const user = await api.me();
        setState({ kind: "authenticated", user });
      } catch (error) {
        if (error instanceof ApiError && error.code === "not_authenticated") {
          api.clear();
          setState({ kind: "expired" });
        }
      }
    };
    document.addEventListener("visibilitychange", verify);
    return () => document.removeEventListener("visibilitychange", verify);
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
        setState({ kind: "authenticated", user });
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "csrf_failed")
        setMessage("La verificación caducó. Repite la acción.");
      else
        setMessage(
          error instanceof ApiError
            ? error.message
            : "No se pudo completar la solicitud.",
        );
    }
  }

  async function signOut() {
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
        <span>FurgoPlus</span>
        <small>Cuenta</small>
      </header>
      <main className="card" aria-live="polite">
        {state.kind === "loading" && <p>Restaurando sesión…</p>}
        {state.kind === "error" && (
          <>
            <p className="error">{state.message}</p>
            <button onClick={() => window.location.reload()}>Reintentar</button>
          </>
        )}
        {state.kind === "expired" && <p>La sesión caducó.</p>}
        {state.kind === "authenticated" && (
          <>
            <h1>
              {state.user.role === "driver"
                ? "Área del conductor"
                : state.user.role === "admin"
                  ? "Área de administración"
                  : "Usa la aplicación móvil"}
            </h1>
            <p>{state.user.display_name || state.user.email}</p>
            <button onClick={() => void signOut()}>Cerrar sesión</button>
          </>
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
