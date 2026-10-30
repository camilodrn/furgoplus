import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Brand, Icon } from "./components/Icons";
import { RouteIllustration } from "./components/RouteIllustration";
import { ProductDemo } from "./components/ProductDemo";
import type { Audience } from "./components/ProductDemo";
import { Pricing, PricingView } from "./components/Pricing";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    el.classList.add("reveal-pending");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveal = () => {
      el.classList.remove("reveal-pending");
      observer.disconnect();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
        }
      },
      { threshold: 0.08 },
    );
    const onPreference = () => {
      if (preference.matches) reveal();
    };
    observer.observe(el);
    // Revealed content never becomes pending again, including after a
    // preference round trip or keyboard navigation into an offscreen section.
    preference.addEventListener("change", onPreference);
    el.addEventListener("focusin", reveal);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", onPreference);
      el.removeEventListener("focusin", reveal);
      el.classList.remove("reveal-pending");
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
const faqs = [
  [
    "¿Qué es FurgoPlus y en qué etapa está?",
    "FurgoPlus es un proyecto académico chileno de transporte escolar. Explora una demo ilustrativa, sin inscripciones ni contratación.",
  ],
  [
    "¿Puedo ver la ubicación del furgón en tiempo real?",
    "No hay GPS ni seguimiento en vivo: la ruta animada es conceptual. El MVP permite registrar inicio y término del recorrido y abrir mapas externos, sin acreditar ubicación ni llegada.",
  ],
  [
    "¿Cómo se establece el contacto con un transportista?",
    "El apoderado elige un perfil elegible y autoriza compartir su correo al solicitar contacto. Si el conductor acepta, se habilita su correo de servicio. La coordinación y el acuerdo ocurren fuera de FurgoPlus; la solicitud no reserva cupos.",
  ],
  [
    "¿Qué significa que un perfil tenga validación?",
    "Es una revisión interna de los documentos presentados en la demo, sin certificación oficial ni garantía de permisos, seguros o seguridad. La aparición en búsquedas exige además cumplir los requisitos de publicación.",
  ],
  [
    "¿Cuánto cuestan los planes? ¿Se puede pagar en la plataforma?",
    "Los precios son académicos, sin contratación ni disponibilidad comercial habilitadas. En la versión académica, Básico no incluye informes mensuales; Pro y Elite sí, y Elite añade informes avanzados y archivos XLSX para hojas de cálculo. Los asistentes son experimentales: aún falta completar su integración y experiencia de uso. Los planes se activan manualmente y el registro de pagos no procesa dinero.",
  ],
  [
    "¿La simulación de esta landing guarda mis datos o se conecta a una cuenta?",
    "No pide datos personales ni conecta cuentas: las selecciones ficticias se pierden al recargar. Los recursos son del mismo sitio, sin analítica ni almacenamiento persistente añadido por la landing. El servidor podría guardar datos técnicos, como IP e información del navegador.",
  ],
];
const modalCopy = {
  project: {
    title: "Un proyecto que empieza por conectar.",
    body: "FurgoPlus es un proyecto académico chileno para explorar una mejor organización del transporte escolar. Esta presentación permite explorar una demo ilustrativa con datos ficticios. No ofrece contratación, inscripciones ni descargas de aplicaciones.",
  },
  terms: {
    title: "Términos y condiciones",
    body: "Esta landing presenta una propuesta académica demostrativa de FurgoPlus, orientada a explorar una mejor organización del transporte escolar. La simulación utiliza datos ficticios y se ofrece únicamente con fines ilustrativos. Actualmente no existe contratación comercial habilitada. Este sitio no permite contratar transporte escolar, reservar cupos ni procesar pagos. Los precios y planes publicados tienen fines académicos y no constituyen una oferta de contratación.",
  },
  privacy: {
    title: "Sobre esta visita y tus datos.",
    body: "La simulación de esta landing no pide datos personales ni conecta cuentas o servicios privados. Las selecciones usan datos ficticios, se mantienen en memoria y se pierden al recargar. El código de esta landing no instala cookies, analítica ni almacenamiento persistente. Sus fuentes, imágenes y demás recursos se sirven desde el mismo sitio, sin recursos de terceros configurados por la landing. Al solicitar la página y sus archivos, el servidor recibe datos técnicos como tu dirección IP y la información del navegador, y podría guardarlos en registros de acceso.",
  },
  accessibility: {
    title: "Un camino más accesible.",
    body: "Puedes recorrer la página con Tab y activar enlaces y botones con el teclado. En el selector de experiencias, usa las flechas izquierda y derecha, Inicio o Fin. Las preguntas se abren con Enter o Espacio. La página respeta la preferencia de reducir movimiento y ofrece un enlace para saltar al contenido. Esta implementación inicial requiere también revisión humana con lectores de pantalla.",
  },
};
type Modal = keyof typeof modalCopy;

export function App() {
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [audience, setAudience] = useState<Audience>("conductor");
  const [modal, setModal] = useState<Modal>("project");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogOpener = useRef<HTMLButtonElement>(null);
  const dialogClose = useRef<HTMLButtonElement>(null);
  const dialogConfirm = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 961px)");
    // Chromium can blur a display:none navigation item to body before it
    // dispatches the media change. Remember only the current header control;
    // an actual focus move outside the header clears it.
    let navigationFocus: HTMLElement | null = null;
    const rememberFocus = (event: FocusEvent) => {
      navigationFocus = event.target instanceof HTMLElement &&
        headerRef.current?.contains(event.target) ? event.target : null;
    };
    const forgetVisibleBlur = (event: FocusEvent) => {
      if (event.target === navigationFocus && navigationFocus?.getClientRects().length)
        navigationFocus = null;
    };
    const onBreakpoint = () => {
      if (desktop.matches) setMenuOpen(false);
      const active = document.activeElement;
      const previous = active === document.body ? navigationFocus : active;
      if (!(previous instanceof HTMLElement)) return;
      const disappearing = desktop.matches
        ? previous.closest("#mobile-menu, .menu-button")
        : previous.closest(".desktop-nav, .nav-cta");
      if (!disappearing) return;
      if (desktop.matches) {
        const href = previous.getAttribute("href");
        const equivalent = [...(headerRef.current?.querySelectorAll<HTMLAnchorElement>(".desktop-nav a") ?? [])]
          .find((link) => link.getAttribute("href") === href);
        (equivalent ?? headerRef.current?.querySelector<HTMLAnchorElement>(".nav-cta"))?.focus();
      } else menuButton.current?.focus();
    };
    document.addEventListener("focusin", rememberFocus);
    document.addEventListener("focusout", forgetVisibleBlur);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("focusin", rememberFocus);
      document.removeEventListener("focusout", forgetVisibleBlur);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  function openModal(value: Modal, opener: HTMLButtonElement) {
    dialogOpener.current = opener;
    setModal(value);
    dialogRef.current?.showModal();
    dialogClose.current?.focus();
  }
  const links = [
    ["La propuesta", "#propuesta"],
    ["El producto", "#producto"],
    ["Cómo funciona", "#como-funciona"],
    ["Planes", "#planes"],
  ];
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="site-header" ref={headerRef}>
        <div className="nav-shell">
          <Brand />
          <nav className="desktop-nav" aria-label="Navegación principal">
            {links.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <a
            href="https://demo.furgoplus.cl"
            className="button button-small nav-cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir demo
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> (abre en una nueva pestaña)</span>
          </a>
          <button
            className="menu-button"
            ref={menuButton}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
        <nav
          id="mobile-menu"
          className="mobile-nav"
          aria-label="Navegación móvil"
          hidden={!menuOpen}
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
              <Icon name="arrow" size={17} />
            </a>
          ))}
          <a
            href="https://demo.furgoplus.cl"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            Abrir demo
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> (abre en una nueva pestaña)</span>
          </a>
        </nav>
      </header>
      {/* Editorial: una idea por sección, hasta tres beneficios por bloque.
          Subtítulos breves; condiciones y alcance completo bajo demanda.
          Criterio permanente: landing/EDITORIAL_GUIDELINES.md. */}
      <main id="contenido" tabIndex={-1}>
        <section
          className="hero section-shell"
          id="inicio"
          tabIndex={-1}
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="small-dot" /> TRANSPORTE ESCOLAR, MEJOR CONECTADO
            </div>
            <h1 id="hero-title">
              Un buen día
              <br />
              empieza con un
              <br />
              <em>buen trayecto.</em>
            </h1>
            <p className="hero-description">
              Entre la casa y el colegio, conectamos a familias y transportistas
              para que organizar cada trayecto sea más simple.
            </p>
            <div className="hero-actions">
              <a className="button" href="#producto">
                Ver cómo funciona
                <Icon name="arrow" size={18} />
              </a>
            </div>
            <p className="stage-note">
              <span /> Proyecto académico chileno · Etapa demostrativa
            </p>
          </div>
          <div className="hero-art">
            <RouteIllustration />
          </div>
          <div className="hero-bottom">
            <span>MENOS VUELTAS. MÁS CONEXIÓN.</span>
            <a href="#propuesta" aria-label="Descubrir la propuesta">
              <span>EL CAMINO EMPIEZA AQUÍ</span>
              <span className="scroll-arrow">↓</span>
            </a>
            <span>
              DISEÑADO EN CHILE <span aria-hidden="true">↗</span>
            </span>
          </div>
        </section>

        <section
          id="propuesta"
          tabIndex={-1}
          className="proposition section-shell section-space"
          aria-labelledby="proposition-title"
        >
          <Reveal className="section-intro">
            <span className="eyebrow section-index">
              01 / UNA MEJOR FORMA DE CONECTAR
            </span>
            <h2 id="proposition-title">
              El recorrido es de todos.
              <br />
              La organización, <em>más simple.</em>
            </h2>
          </Reveal>
          <div className="proposition-grid">
            <Reveal className="problem-copy">
              <p>
                Mensajes por aquí.
                <br />
                Horarios por allá.
                <br />
                <span>La información, repartida.</span>
              </p>
              <div className="problem-line" />
            </Reveal>
            <Reveal className="solution-copy" delay={0.12}>
              <span className="solution-mark" aria-hidden="true">
                <Icon name="route" size={31} />
              </span>
              <h3>
                Un punto de encuentro.
                <br />
                Un camino más claro.
              </h3>
              <p>
                Búsqueda, contacto y gestión de recorridos en un mismo lugar.
              </p>
              <div className="connection-strip">
                <span>
                  <Icon name="home" size={17} />
                  Familia
                </span>
                <i />
                <span className="connection-brand">FurgoPlus</span>
                <i />
                <span>
                  <Icon name="bus" size={18} />
                  Transportista
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="producto"
          tabIndex={-1}
          className="product-section section-space"
          aria-labelledby="product-title"
        >
          <div className="section-shell product-shell">
            <Reveal className="product-heading">
              <span className="eyebrow section-index">
                02 / ASÍ SE VE UN CAMINO MÁS SIMPLE
              </span>
              <h2 id="product-title">
                Tu servicio en orden.
                <br />
                <em>Donde lo necesitas.</em>
              </h2>
              <p>Gestión web para conductores y una app móvil para cada experiencia.</p>
            </Reveal>
            <Reveal>
              <ProductDemo audience={audience} setAudience={setAudience} />
            </Reveal>
          </div>
        </section>

        <section className="benefits" aria-labelledby="benefits-title">
          <div className="section-shell section-space">
            <Reveal className="benefits-heading">
              <span className="eyebrow">
                03 / DOS MIRADAS. UN MISMO CAMINO.
              </span>
              <h2 id="benefits-title">
                Más orden para ti.
                <br />
                <em>Más información para tu familia.</em>
              </h2>
            </Reveal>
            <div className="benefits-grid">
              <Reveal className="benefit-column">
                <div className="benefit-number">
                  <span>01 — PARA TRANSPORTISTAS</span>
                  <Icon name="bus" size={26} />
                </div>
                <h3>
                  Más orden.
                  <br />
                  Mejor jornada.
                </h3>
                <ul className="feature-list">
                  <li>
                    <Icon name="check" />
                    Organiza rutas, horarios y cupos.
                  </li>
                  <li>
                    <Icon name="check" />
                    Gestiona solicitudes de contacto.
                  </li>
                  <li>
                    <Icon name="check" />
                    Mantén un registro manual de pagos.
                  </li>
                </ul>
                <a
                  className="light-link"
                  href="#producto"
                  onClick={() => setAudience("conductor")}
                >
                  Ver demo del conductor
                  <Icon name="arrow" size={18} />
                </a>
              </Reveal>
              <Reveal className="benefit-column family" delay={0.12}>
                <div className="benefit-number">
                  <span>02 — PARA FAMILIAS</span>
                  <Icon name="home" size={26} />
                </div>
                <h3>
                  Más información.
                  <br />
                  Mejores decisiones.
                </h3>
                <ul className="feature-list">
                  <li>
                    <Icon name="check" />
                    Busca y compara por comuna.
                  </li>
                  <li>
                    <Icon name="check" />
                    Revisa horarios, cupos y validación interna.
                  </li>
                  <li>
                    <Icon name="check" />
                    Solicita contacto y autoriza compartir tu correo.
                  </li>
                </ul>
                <a
                  className="light-link"
                  href="#producto"
                  onClick={() => setAudience("apoderado")}
                >
                  Ver demo del apoderado
                  <Icon name="arrow" size={18} />
                </a>
              </Reveal>
            </div>
            <div className="benefits-footnote">
              <Icon name="shield" size={16} />
              <p>
                Validación interna demostrativa: no certifica seguridad ni
                autoriza transporte.
              </p>
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          tabIndex={-1}
          className="how-it-works section-shell section-space"
          aria-labelledby="how-title"
        >
          <Reveal className="how-heading">
            <div>
              <span className="eyebrow section-index">
                04 / DEL PRIMER CONTACTO AL RECORRIDO
              </span>
              <h2 id="how-title">
                Conectar es el
                <br />
                <em>primer paso.</em>
              </h2>
            </div>
          </Reveal>
          <div className="steps">
            {[
              {
                icon: "search" as const,
                title: "Encuentra y compara",
                body: "Busca por comuna y compara perfiles, horarios y cupos.",
              },
              {
                icon: "people" as const,
                title: "Solicita contacto",
                body: "Autoriza compartir tu correo; el conductor decide si acepta.",
              },
              {
                icon: "route" as const,
                title: "Organiza el trayecto",
                body: "Coordina el servicio fuera de FurgoPlus; solicitar contacto no reserva cupos.",
              },
            ].map((step, i) => (
              <Reveal className="step" key={step.title} delay={i * 0.09}>
                <div className="step-top">
                  <span className="step-icon">
                    <Icon name={step.icon} size={26} />
                  </span>
                  <span className="step-number">0{i + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section
          id="planes"
          tabIndex={-1}
          className="plans section-shell section-space"
          aria-labelledby="plans-title"
        >
          <Reveal className="plans-heading">
            <div>
              <span className="eyebrow section-index">05 / PLANES PARA CONDUCTORES</span>
              <h2 id="plans-title">Un plan para cada etapa.</h2>
            </div>
            <div className="plans-heading-aside">
              <PricingView
                showBreakdown={showPriceBreakdown}
                onChange={setShowPriceBreakdown}
              />
            </div>
          </Reveal>
          <Reveal>
            <Pricing showBreakdown={showPriceBreakdown} />
          </Reveal>
        </section>

        <section
          id="preguntas"
          tabIndex={-1}
          className="faq-section section-shell section-space"
          aria-labelledby="faq-title"
        >
          <Reveal className="faq-heading">
            <span className="eyebrow section-index">
              06 / CONVERSEMOS CON CLARIDAD
            </span>
            <h2 id="faq-title">
              Lo que quizás
              <br />
              te estás <em>preguntando.</em>
            </h2>
          </Reveal>
          <div className="faq-list">
            {faqs.map(([question, answer], i) => (
              <details
                key={question}
                id={i === 4 ? "pregunta-planes" : `pregunta-${i}`}
              >
                <summary>
                  {question}
                  <span className="faq-plus">
                    <Icon name="plus" size={18} />
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div className="cta-route" aria-hidden="true">
            <svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice">
              <path
                d="M-50 340H210q60 0 60-60v-50q0-60 60-60h540q60 0 60-60V90q0-60 60-60h250"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="7 9"
              />
              <circle cx="210" cy="340" r="8" fill="currentColor" />
              <circle cx="990" cy="30" r="8" fill="currentColor" />
            </svg>
          </div>
          <Reveal className="section-shell cta-inner">
            <h2 id="cta-title">
              Menos vueltas.
              <br />
              <em>Más FurgoPlus.</em>
            </h2>
            <p>Explora FurgoPlus con datos de ejemplo.</p>
            <a className="button button-white" href="#producto">
              Ver cómo funciona
              <Icon name="arrow" size={18} />
            </a>
            <span className="cta-stage">
              Proyecto académico · Sin inscripciones abiertas
            </span>
          </Reveal>
        </section>
      </main>
      <footer className="site-footer">
        <div className="section-shell">
          <div className="footer-main">
            <div className="footer-about">
              <Brand light />
              <p>
                Acercamos a quienes comparten
                <br />
                el mismo camino.
              </p>
            </div>
            <div className="footer-column">
              <h3>Conoce FurgoPlus</h3>
              <a href="#propuesta">La propuesta</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#producto">Demo interactiva</a>
              <a href="#planes">Propuesta de planes</a>
            </div>
            <div className="footer-column">
              <h3>Con toda claridad</h3>
              <a href="#preguntas">Preguntas frecuentes</a>
              <button onClick={(event) => openModal("project", event.currentTarget)}>
                Sobre el proyecto
              </button>
              <button onClick={(event) => openModal("terms", event.currentTarget)}>
                Términos y condiciones
              </button>
              <button onClick={(event) => openModal("privacy", event.currentTarget)}>
                Privacidad
              </button>
              <button onClick={(event) => openModal("accessibility", event.currentTarget)}>
                Accesibilidad
              </button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} FurgoPlus · Proyecto académico
              demostrativo
            </span>
            <a href="#inicio">
              Volver arriba <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        className="info-dialog"
        aria-labelledby="dialog-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
          // Wrap only the boundaries of this dialog's two-button sequence.
          const destination = event.shiftKey
            ? document.activeElement === dialogClose.current && dialogConfirm.current
            : document.activeElement === dialogConfirm.current && dialogClose.current;
          if (destination) {
            event.preventDefault();
            destination.focus();
          }
        }}
        onClose={() => {
          // A queued close event must not steal focus from a reopened dialog.
          if (dialogRef.current?.open) return;
          const opener = dialogOpener.current;
          dialogOpener.current = null;
          if (opener?.isConnected) opener.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="dialog-content">
          <button
            ref={dialogClose}
            className="dialog-close"
            aria-label="Cerrar información"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="close" />
          </button>
          <span className="eyebrow section-index">
            FURGOPLUS / CON TRANSPARENCIA
          </span>
          <h2 id="dialog-title">{modalCopy[modal].title}</h2>
          <p>{modalCopy[modal].body}</p>
          {modal === "project" && (
            <div className="project-milestones" id="project-milestones">
              <h3>El camino del proyecto</h3>
              <dl>
                <div>
                  <dt>Noviembre de 2026</dt>
                  <dd>
                    Evaluación académica de la demostración, con sus capacidades
                    y pendientes.
                  </dd>
                </div>
                <div>
                  <dt>Feria de Software 2027</dt>
                  <dd>
                    Aspiramos a mostrar una versión más madura, probada con
                    usuarios y comercialmente validada. Es un objetivo del
                    proyecto, sujeto a su desarrollo y aprendizaje.
                  </dd>
                </div>
              </dl>
            </div>
          )}
          <button ref={dialogConfirm} className="button" onClick={() => dialogRef.current?.close()}>
            Entendido
            <Icon name="check" size={17} />
          </button>
        </div>
      </dialog>
    </>
  );
}
