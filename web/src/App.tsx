import { useEffect, useState } from "react";
import { getHealth } from "./api";
import "./style.css";

type HealthState = "loading" | "ok" | "error";

function HealthScreen() {
  const [state, setState] = useState<HealthState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setState("ok"))
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="card" aria-live="polite">
      <p className="eyebrow">Fundación técnica</p>
      <h1>Estado de la API</h1>
      {state === "loading" && <p>Comprobando conexión…</p>}
      {state === "ok" && (
        <p className="success">La API responde correctamente.</p>
      )}
      {state === "error" && (
        <p className="error">No se pudo conectar con la API.</p>
      )}
    </section>
  );
}

export default function App() {
  const route = window.location.pathname;
  return (
    <div className="shell">
      <header className="site-header">
        <span>FurgoPlus</span>
        <small>Desarrollo</small>
      </header>
      <main>
        {route === "/" ? (
          <HealthScreen />
        ) : (
          <p>Esta ruta aún no está disponible.</p>
        )}
      </main>
    </div>
  );
}
