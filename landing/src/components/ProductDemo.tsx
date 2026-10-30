import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Brand, Icon } from "./Icons";

export type Audience = "conductor" | "apoderado";
const routes = [
  {
    name: "Ida al colegio",
    time: "07:15",
    end: "08:00",
    seats: "6 de 8",
    status: "Programado",
  },
  {
    name: "Regreso a casa",
    time: "15:30",
    end: "16:15",
    seats: "5 de 8",
    status: "Programado",
  },
];

export function ProductDemo({
  audience,
  setAudience,
}: {
  audience: Audience;
  setAudience: (value: Audience) => void;
}) {
  const [route, setRoute] = useState(0);
  const [profile, setProfile] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : audience === "conductor"
            ? 1
            : 0;
    setAudience(next === 0 ? "conductor" : "apoderado");
    tabRefs.current[next]?.focus();
  }
  return (
    <div className="demo-experience">
      <div className="demo-controls">
        <div
          role="tablist"
          aria-label="Elige la experiencia"
          className="audience-tabs"
        >
          {(["conductor", "apoderado"] as const).map((value, i) => (
            <button
              key={value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${value}`}
              aria-controls="experience-panel"
              aria-selected={audience === value}
              tabIndex={audience === value ? 0 : -1}
              onKeyDown={onTabKey}
              onClick={() => setAudience(value)}
            >
              <Icon name={value === "conductor" ? "bus" : "people"} size={18} />
              Soy {value}
            </button>
          ))}
        </div>
        <span className="demo-label">
          <span /> Demo ilustrativa · Datos ficticios
        </span>
      </div>
      <p className="demo-instruction" aria-live="polite">
        {audience === "conductor"
          ? "Selecciona un recorrido para verlo en el celular."
          : "Alterna entre los perfiles A y B de ejemplo."}
      </p>
      <div
        role="tabpanel"
        id="experience-panel"
        aria-labelledby={`tab-${audience}`}
        tabIndex={0}
        className="demo-panel"
      >
        <div className={`product-layout experience-${audience}`} key={audience}>
          <div className="web-product">
            <div className="window-bar">
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
              <span>Conductor / Web ilustrativa</span>
              <Icon name="shield" size={12} />
            </div>
            <div className="product-window">
              <aside
                className="product-sidebar"
                aria-label="Secciones ilustrativas del producto"
              >
                <Brand linked={false} />
                <div className="sidebar-label">MI ESPACIO</div>
                {[
                  ["grid", "Resumen"],
                  ["route", "Recorridos"],
                  ["people", "Solicitudes"],
                  ["wallet", "Registro de pagos"],
                ].map(([icon, label], i) => (
                  <div
                    key={label}
                    className={`sidebar-item ${i === 0 ? "selected" : ""}`}
                  >
                    <Icon name={icon as "grid"} size={16} />
                    {label}
                  </div>
                ))}
                <div className="sidebar-bottom">
                  <span className="avatar">D</span>
                  <span>
                    Conductor demo<small>Cuenta ilustrativa</small>
                  </span>
                </div>
              </aside>
              <div className="dashboard">
                <div className="dashboard-top">
                  <span>Tu jornada, en orden.</span>
                  <span className="demo-pill">DEMO</span>
                </div>
                <h3>
                  {audience === "conductor"
                    ? "Un buen día para avanzar."
                    : "Así se organiza tu transportista."}
                </h3>
                <p className="dashboard-sub">
                  {audience === "conductor"
                    ? "Tus recorridos y solicitudes, en un solo lugar."
                    : "Así se organiza el servicio desde la vista del conductor."}
                </p>
                <div className="dashboard-metrics">
                  <div>
                    <Icon name="route" size={17} />
                    <strong>02</strong>
                    <span>Recorridos de ejemplo</span>
                  </div>
                  <div>
                    <Icon name="people" size={17} />
                    <strong>03</strong>
                    <span>Solicitudes ficticias</span>
                  </div>
                  <div>
                    <Icon name="bus" size={17} />
                    <strong>08</strong>
                    <span>Cupos por recorrido</span>
                  </div>
                </div>
                <div className="dashboard-section-label">
                  Tus recorridos <span>Selecciona para explorar ↓</span>
                </div>
                <div className="route-table">
                  {routes.map((item, i) => (
                    <button
                      key={item.name}
                      className={`route-row ${route === i ? "active" : ""}`}
                      onClick={() => setRoute(i)}
                      aria-pressed={route === i}
                    >
                      <span className="route-row-icon">
                        <Icon name={i === 0 ? "school" : "home"} size={19} />
                      </span>
                      <span className="route-row-name">
                        {item.name}
                        <small>Lunes a viernes</small>
                      </span>
                      <span className="route-time">
                        {item.time}
                        <small>{item.seats} cupos</small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
                </div>
                <div className="route-detail" aria-live="polite">
                  <span className="small-dot" />
                  <span>
                    {routes[route].name} · {routes[route].time} a{" "}
                    {routes[route].end}
                  </span>
                  <span>{routes[route].status}</span>
                </div>
                <p className="dashboard-foot">
                  <Icon name="shield" size={13} /> Cada conductor administra sus
                  propios registros.
                </p>
              </div>
            </div>
          </div>
          <div className="phone-product">
            <div className="phone-speaker" />
            <div className="phone-status">
              <span>9:41</span>
              <span aria-hidden="true">▮▮▮ ▰</span>
            </div>
            <div className="phone-brand">
              <Brand linked={false} />
              <span className="phone-demo">DEMO</span>
            </div>
            {audience === "conductor" ? (
              <>
                <span className="phone-eyebrow">TU JORNADA</span>
                <h3>
                  Vamos por un
                  <br />
                  buen camino.
                </h3>
                <p className="phone-sub">Recorridos del día</p>
                <div className="phone-route">
                  <div className="phone-route-head">
                    <span className="phone-icon">
                      <Icon name={route === 0 ? "school" : "home"} size={23} />
                    </span>
                    <span className="status-pill">Programado</span>
                  </div>
                  <h4>{routes[route].name}</h4>
                  <div className="phone-time">
                    {routes[route].time} <span>→ {routes[route].end}</span>
                  </div>
                  <div className="mini-route">
                    <span />
                    <i />
                    <span />
                  </div>
                  <div className="phone-locations">
                    <span>
                      {route === 0 ? "Punto de salida" : "Colegio de ejemplo"}
                    </span>
                    <span>
                      {route === 0 ? "Colegio de ejemplo" : "Punto de regreso"}
                    </span>
                  </div>
                  <div className="phone-capacity">
                    <Icon name="people" size={16} />
                    {routes[route].seats} cupos asignados
                  </div>
                </div>
                <div className="phone-note">
                  <Icon name="clock" size={19} />
                  <span>
                    Todo a mano antes
                    <br />
                    de comenzar.
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="phone-eyebrow">PARA TU FAMILIA</span>
                <h3>
                  Encuentra tu
                  <br />
                  próximo trayecto.
                </h3>
                <div className="phone-search">
                  <Icon name="search" size={15} />
                  <span>Comuna de ejemplo</span>
                </div>
                <div className="phone-profile" aria-live="polite" aria-atomic="true">
                  <span className="profile-monogram">
                    {profile === 0 ? "A" : "B"}
                  </span>
                  <span className="status-pill">Perfil demo</span>
                  <h4>Transportista {profile === 0 ? "A" : "B"}</h4>
                  <p>
                    {profile === 0
                      ? "Recorrido de mañana"
                      : "Recorrido de tarde"}
                  </p>
                  <div className="profile-data">
                    <span>
                      Horario
                      <strong>
                        {profile === 0 ? "07:15–08:00" : "15:30–16:15"}
                      </strong>
                    </span>
                    <span>
                      Disponibles
                      <strong>{profile === 0 ? "2 cupos" : "3 cupos"}</strong>
                    </span>
                  </div>
                </div>
                <div
                  className="profile-switch"
                  role="group"
                  aria-label="Explorar perfiles ficticios"
                >
                  {[0, 1].map((i) => (
                    <button
                      key={i}
                      onClick={() => setProfile(i)}
                      aria-pressed={profile === i}
                    >
                      Perfil {i === 0 ? "A" : "B"}
                      <Icon name="arrow" size={13} />
                    </button>
                  ))}
                </div>
                <p className="phone-disclaimer">
                  Datos ficticios · Compara antes de solicitar contacto.
                </p>
              </>
            )}
            <div className="phone-home-bar" />
          </div>
        </div>
      </div>
      <div className="demo-explainer">
        <p aria-live="polite">
          {audience === "conductor"
            ? "Planifica en la web y consulta tu jornada en el celular."
            : "Busca, compara y solicita contacto por comuna."}
        </p>
        <a
          className="text-link demo-link"
          href="https://demo.furgoplus.cl"
          target="_blank"
          rel="noopener noreferrer"
        >
          Probar la aplicación
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (abre en una nueva pestaña)</span>
        </a>
      </div>
    </div>
  );
}
