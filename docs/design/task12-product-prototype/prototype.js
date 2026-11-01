"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "$" + Number(n).toLocaleString("es-CL");
const dateLabel = (s) =>
  s
    ? new Date(s + "T12:00:00Z").toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Sin fecha";
const paths = {
  home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
  service: "M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h7",
  route: "M6 5h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h8M6 2v6M3 5h6M16 18l3 3-3 2",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
  message:
    "M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h7",
  payment: "M3 5h18v14H3ZM3 9h18M7 15h4",
  chart: "M4 20V10M10 20V4M16 20v-8M22 21H2",
  help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  check: "m5 12 4 4L19 6",
  chevron: "m9 5 7 7-7 7",
  back: "m12 5-7 7 7 7M5 12h15",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  calendar: "M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  refresh:
    "M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-4l2 3M4 17l2 3a8 8 0 0 0 13-4",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6ZM8 12l3 3 5-6",
  account: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  warning: "M12 3 2 21h20ZM12 9v5M12 17h.01",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  phone: "M6 3h4l1 5-3 2a15 15 0 0 0 6 6l2-3 5 1v4c-8 5-22-9-15-15",
  signal: "M4 20v-4M9 20v-8M14 20V8M19 20V3",
  battery: "M3 7h16v10H3ZM21 10v4M6 10h10v4H6",
  bus: "M4 16V5c0-3 16-3 16 0v11ZM4 9h16M8 3v6M16 3v6M7 20v-4M17 20v-4M7 13h.01M17 13h.01",
  logout: "M9 3H3v18h6M9 12h12m-5-5 5 5-5 5",
  mail: "M3 5h18v14H3ZM3 5l9 8 9-8",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.service}"/></svg>`;
const badge = (text, tone = "") =>
  `<span class="badge ${tone}">${esc(text)}</span>`;
let current,
  model,
  scene = "",
  filters = {},
  pages = {},
  selectedRequest = 101,
  selectedRun = 1,
  selectedServices = new Set(),
  searched = false,
  dialogContext = null,
  routeDraft = {},
  toastTimer;
let tickets = [
  {
    id: 204,
    subject: "Consulta sobre mi plan",
    state: "En revisión",
    severity: "Normal",
    message: "¿Dónde puedo consultar la vigencia de mi plan?",
    events: [
      {
        by: "Tú",
        text: "¿Dónde puedo consultar la vigencia de mi plan?",
        date: "03 nov · 10:20",
      },
      {
        by: "Equipo FurgoPlus",
        text: "Puedes revisar las fechas en Mi plan. Cuéntanos si necesitas más ayuda.",
        date: "03 nov · 12:10",
      },
    ],
  },
];
const getF = (key, fallback = "") => filters[current.page]?.[key] ?? fallback;
const setF = (key, value) => {
  (filters[current.page] ??= {})[key] = value;
  pages[current.page] = 1;
};
function locationState() {
  const [path, query] = (
    location.hash.slice(1) || "web/conductor/inicio"
  ).split("?");
  const [platform = "web", role = "conductor", page = "inicio", id = ""] =
    path.split("/");
  return {
    platform,
    role,
    page,
    id,
    scene: new URLSearchParams(query).get("estado") || "normal",
  };
}
function href(page, role = current.role, platform = current.platform, id = "") {
  return `#${platform}/${role}/${page}${id ? "/" + id : ""}${scene !== "normal" ? "?estado=" + scene : ""}`;
}
function nav(
  page,
  text,
  cls = "",
  role = current.role,
  platform = current.platform,
  id = "",
) {
  return `<a class="${cls}" href="${href(page, role, platform, id)}" ${cls.includes("icon-button") ? `aria-label="${page === "cuenta" ? "Mi cuenta" : page === "ayuda" ? "Ayuda y soporte" : "Volver"}"` : ""}>${text}</a>`;
}
function button(action, text, cls = "", id = "", extra = "") {
  return `<button type="button" class="btn ${cls}" data-action="${action}" ${id !== "" ? `data-id="${esc(id)}"` : ""} ${extra}>${text}</button>`;
}
const heading = (title, description = "", actions = "") =>
  `<div class="page-heading"><div><h1 id="page-title" tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ""}</div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
const panel = (title, body, extra = "") =>
  `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
function notice(title, text = "", tone = "", actions = "") {
  return `<div class="notice ${tone}" ${tone === "bad" ? 'role="alert"' : 'role="status"'}>${icon(tone ? "warning" : "shield")}<div><strong>${title}</strong>${text ? `<span>${text}</span>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
const empty = (title, text, action = "", name = "people") =>
  `<div class="empty">${icon(name)}<h2>${title}</h2><p>${text}</p>${action}</div>`;
function metrics(items) {
  return `<div class="metrics">${items.map(([label, value, sub, tone = ""]) => `<div class="metric ${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join("")}</div>`;
}
function meter(r) {
  return `<div class="meter ${r.used >= r.capacity ? "full" : ""}" role="meter" aria-label="Ocupación de ${esc(r.name)}" aria-valuenow="${r.used}" aria-valuemin="0" aria-valuemax="${r.capacity}" aria-valuetext="${r.used} de ${r.capacity} cupos utilizados"><span style="width:${Math.min(100, (r.used / r.capacity) * 100)}%"></span></div>`;
}
// Only presentation widths are inline; all interactions use delegated listeners.
function capacity(r) {
  return `<div><span class="meter-value">${r.used} de ${r.capacity} ocupados</span>${meter(r)}</div>`;
}
function field(label, name, value = "", type = "text", help = "", extra = "") {
  return `<label class="field ${extra}">${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${type === "number" ? 'min="1" step="1"' : ""}>${help ? `<small>${help}</small>` : ""}</label>`;
}
function selectField(label, name, options, value = "", extra = "") {
  return `<label class="field ${extra}">${label}<select name="${name}" required>${options.map(([v, t]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
}
function dl(items) {
  return `<dl class="detail-list">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}
function filterField(label, key, options) {
  return `<label>${label}<select data-filter="${key}">${options.map(([v, t]) => `<option value="${esc(v)}" ${getF(key) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
}
function searchField(label = "Buscar", placeholder = "Nombre o apoderado") {
  return `<label class="search">${label}<input type="search" data-filter="q" value="${esc(getF("q"))}" placeholder="${placeholder}"></label>`;
}
function normalize(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function match(q, values) {
  return normalize(values.join(" ")).includes(normalize(q));
}
function paginate(rows, size = Number(getF("size", "5"))) {
  const max = Math.max(1, Math.ceil(rows.length / size));
  let p = Math.min(pages[current.page] || 1, max);
  pages[current.page] = p;
  return {
    rows: rows.slice((p - 1) * size, p * size),
    p,
    max,
    total: rows.length,
    start: rows.length ? (p - 1) * size + 1 : 0,
    end: Math.min(p * size, rows.length),
  };
}
function pager(p) {
  return `<nav class="pager" aria-label="Páginas de resultados"><span>${p.start}–${p.end} de ${p.total}</span><label class="page-size">Filas <select data-filter="size" aria-label="Filas por página">${[5, 10, 20].map((n) => `<option value="${n}" ${Number(getF("size", "5")) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><div class="actions"><button data-action="page" data-id="${p.p - 1}" aria-label="Página anterior" ${p.p === 1 ? "disabled" : ""}>${icon("back")}</button><span> ${p.p} / ${p.max} </span><button data-action="page" data-id="${p.p + 1}" aria-label="Página siguiente" ${p.p === p.max ? "disabled" : ""}>${icon("arrow")}</button></div></nav>`;
}
function table(headers, rows) {
  // Keep a single semantic table. CSS reflows each row using its column labels.
  const template = document.createElement("template");
  template.innerHTML = `<div class="table-wrap"><table role="table"><thead role="rowgroup"><tr role="row">${headers.map((x) => `<th role="columnheader" scope="col">${x}</th>`).join("")}</tr></thead><tbody role="rowgroup">${rows}</tbody></table></div>`;
  template.content.querySelectorAll("tbody tr").forEach((row) => {
    row.setAttribute("role", "row");
    Array.from(row.cells).forEach((cell, index) => {
      cell.dataset.label = headers[index] || "";
      cell.setAttribute("role", "cell");
    });
  });
  return template.innerHTML;
}
const findPassenger = (id) => model.passengers.find((p) => p.id === Number(id));
const findRoute = (id) => model.routes.find((r) => r.id === Number(id));
function resetModel(nextScene) {
  scene = nextScene;
  model = {
    ...FurgoDemo.makeData(scene),
    name: "Transportes Los Aromos",
    summary:
      "Traslados escolares de mañana y tarde en La Florida y Puente Alto.",
    email: "servicio.aromos@example.test",
    document: scene === "pendiente" ? "observed" : "ok",
    review: scene === "pendiente" ? "rejected" : "approved",
    published: scene !== "pendiente",
    plan: "Elite",
    planAdminStatus: scene === "pendiente" ? "Suspendido" : "Activo",
    planStart: "2026-10-01",
    planEnd: "2026-12-31",
    planStatus: scene === "pendiente" ? "Suspendido" : "Vigente",
    runStates: {},
    recovered: new Set(),
    accountStatus: "Activo",
    parentName: "María Vega",
    parentRequests:
      scene === "vacio"
        ? []
        : [
            {
              id: 105,
              serviceId: 2,
              name: "María Vega",
              status: "accepted",
              date: "02 nov · 11:00",
              message: "Hola, quisiera coordinar el horario de mañana.",
              email: "familia.vega@example.test",
            },
          ],
    audit: [],
    routeInactive: new Set(),
  };
  filters = {};
  pages = {};
  selectedRequest = model.requests[0]?.id;
  selectedRun = 1;
  selectedServices = new Set();
  searched = false;
  if (scene === "vacio") {
    model.routes = [];
    tickets = [];
  } else
    tickets = [
      {
        id: 204,
        subject: "Consulta sobre mi plan",
        state: "En revisión",
        severity: "Normal",
        message: "¿Dónde puedo consultar la vigencia de mi plan?",
        events: [
          {
            by: "Tú",
            text: "¿Dónde puedo consultar la vigencia de mi plan?",
            date: "03 nov · 10:20",
          },
          {
            by: "Equipo FurgoPlus",
            text: "Puedes revisar las fechas en Mi plan. Cuéntanos si necesitas más ayuda.",
            date: "03 nov · 12:10",
          },
        ],
      },
    ];
}
function seedManyTickets() {
  if (scene === "muchos" && tickets.length === 1)
    for (let i = 1; i <= 26; i++)
      tickets.push({
        id: 204 + i,
        subject:
          (i % 4 ? "Consulta de operación " : "Incidente de seguridad ") + i,
        state: i % 3 ? "Abierta" : "En revisión",
        severity: i % 4 ? "Normal" : "Crítica",
        message: "Mensaje sintético sin datos privados.",
        events: [
          {
            by: "Conductor",
            text: "Mensaje sintético sin datos privados.",
            date: "04 nov · 08:00",
          },
        ],
      });
}
function activeError() {
  return (
    ["error", "carga"].includes(scene) &&
    !model.recovered.has(
      current.platform + "/" + current.role + "/" + current.page,
    )
  );
}
function recovery() {
  if (scene === "carga")
    return `<div class="panel panel-body" role="status" aria-busy="true"><h2>Consultando información…</h2><div class="skeleton big"></div><div class="skeleton"></div><div class="skeleton"></div><p class="small muted">Estamos recuperando el estado de tu servicio.</p>${button("retry", "Ver resultado de la carga", "quiet")}</div>`;
  return `<section class="panel">${empty("No pudimos cargar esta información", "La consulta no terminó. Puedes volver a intentarlo sin perder tu sesión.", button("retry", icon("refresh") + " Volver a intentar", "primary"), "warning")}</section>`;
}
function statusStrip() {
  return `<div class="status-strip"><span class="status-pair">Publicación ${badge(model.published ? "Visible" : "No visible", model.published ? "good" : "warn")}</span><span class="status-pair">Revisión ${badge({ approved: "Aprobada", pending: "En revisión", rejected: "Con observaciones" }[model.review], model.review === "approved" ? "" : "warn")}</span><span class="push muted">${esc(model.name)}</span></div>`;
}
function routeRows(routes = model.routes) {
  return `<div class="route-list">${routes.map((r) => `<div class="route-line"><div class="route-time">${r.time}<small>${r.end}</small></div><div class="route-name">${esc(r.name)}<small>${esc(r.destination)} · ${esc(r.commune)}</small></div>${capacity(r)}${nav("pasajeros", "Ver pasajeros", "btn compact", current.role, "web", r.id)}</div>`).join("")}</div>`;
}
function taskRow(title, desc, action, num = "", symbol = "service") {
  return `<div class="task-row">${num !== "" ? `<span class="large-number">${num}</span>` : `<span class="row-icon">${icon(symbol)}</span>`}<div class="task-body"><h3>${title}</h3><p>${desc}</p></div>${action}</div>`;
}
function webHome() {
  const pending = model.requests.filter((r) => r.status === "pending").length,
    payments = model.payments.filter((p) => p.status === "pending");
  return (
    heading(
      "Tu servicio, al día",
      "Miércoles 4 de noviembre · Una vista de lo que necesita tu atención.",
      nav("servicio", "Ver mi servicio", "btn"),
    ) +
    statusStrip() +
    `<div class="stack">${!model.published ? notice("Tu servicio todavía no es visible", "Revisa los requisitos pendientes para aparecer en las búsquedas.", "warn", nav("publicacion", "Revisar publicación", "btn primary")) : ""}<div class="cols">${panel("Por resolver", taskRow("Solicitudes por responder", "Coordina el primer contacto con las familias.", nav("solicitudes", pending ? "Responder" : "Ver solicitudes", `btn ${pending ? "primary" : ""}`), pending) + taskRow("Pagos pendientes", `${money(payments.reduce((a, p) => a + p.amount, 0))} en registros manuales.`, nav("pagos", "Revisar pagos", "btn"), payments.length))}${panel("Tu operación", taskRow("Pasajeros asignados", "Asignaciones y cupos por ruta.", nav("pasajeros", icon("chevron"), "btn quiet"), model.passengers.filter((p) => p.status === "Vigente").length) + taskRow("Rutas configuradas", "Horarios, cobertura y capacidad.", nav("rutas", icon("chevron"), "btn quiet"), model.routes.length))}</div>${panel("Rutas y cupos", model.routes.length ? routeRows(model.routes.slice(0, 3)) : empty("Configura tu primera ruta", "Define un horario, destino y capacidad.", nav("rutas", "Crear ruta", "btn primary"), "route"), `<span class="small muted">Próximo servicio · 04 nov</span>`)}<details class="disclosure"><summary>Preparación del servicio</summary><p>Datos ${model.review === "approved" ? "aprobados" : "por revisar"} · ${model.document === "ok" ? "3 documentos cargados" : "credencial con observaciones"} · Plan ${model.plan} ${model.planStatus.toLowerCase()}.</p></details></div>`
  );
}
function serviceTabs(active) {
  return `<nav class="tabs" aria-label="Mi servicio">${[
    ["servicio", "Resumen"],
    ["datos", "Datos"],
    ["documentos", "Documentos"],
    ["revision", "Revisión e historial"],
  ]
    .map(
      ([p, t]) =>
        `<a href="${href(p)}" ${active === p ? 'aria-current="page"' : ""}>${t}</a>`,
    )
    .join("")}</nav>`;
}
function documentRows(admin = false, record = model) {
  return [
    ["Identidad", "Sin vencimiento requerido"],
    ["Vehículo", "Sin vencimiento requerido"],
    [
      "Credencial",
      "Vence el " + dateLabel(record.documentExpiry || "2026-12-31"),
    ],
  ]
    .map(
      ([name, sub], i) =>
        `<div class="document-row">${icon("service")}<div><strong>${name}</strong><small>${sub}</small></div>${badge(i === 2 && record.document === "observed" ? "Observado" : "Cargado", i === 2 && record.document === "observed" ? "warn" : "good")}${button(admin ? "document-preview" : "document-edit", admin ? "Ver" : i === 2 && record.document === "observed" ? "Actualizar" : "Ver", "quiet compact", i)}</div>`,
    )
    .join("");
}
function webService() {
  return (
    heading("Mi servicio", "La información que respalda tu servicio.") +
    serviceTabs("servicio") +
    statusStrip() +
    `<div class="stack">${model.review === "rejected" ? (model.document === "observed" ? notice("Actualiza tu credencial", "La imagen no permite leer la fecha de vencimiento.", "warn", nav("documentos", "Corregir documento", "btn primary")) : notice("Tus cambios requieren revisión", "Envía la información actualizada al equipo.", "warn", nav("revision", "Revisar y enviar", "btn primary"))) : ""}<div class="cols">${panel("Documentos", documentRows(), '<span class="small muted">3 requeridos</span>')}${panel(
      "Datos del servicio",
      `<div class="panel-body">${dl([
        ["Nombre", esc(model.name)],
        ["Descripción", esc(model.summary)],
        ["Correo de contacto", esc(model.email)],
      ])}${nav("datos", "Editar datos", "text-button")}</div>`,
    )}</div><div class="section-links"><div><h3>Revisión e historial</h3><p>Consulta observaciones y envíos anteriores.</p>${nav("revision", "Ver revisión", "text-button")}</div><div><h3>Rutas del servicio</h3><p>Organiza horarios, cobertura y cupos.</p>${nav("rutas", "Gestionar rutas", "text-button")}</div></div></div>`
  );
}
function webServiceData() {
  return (
    heading(
      "Datos del servicio",
      "Mantén clara la información pública de tu servicio.",
    ) +
    serviceTabs("datos") +
    `<form class="panel form-panel" data-form="service"><div class="form-section"><h2>Presentación del servicio</h2><p class="small muted">Los cambios deben pasar por una nueva revisión.</p></div><div class="form-section stack-sm">${field("Nombre del servicio", "name", model.name)}<label class="field">Descripción<textarea name="summary" required>${esc(model.summary)}</textarea></label>${field("Correo de contacto del servicio", "email", model.email, "email", "Se comparte con el apoderado cuando aceptas su solicitud.")}</div><div class="form-footer">${nav("servicio", "Cancelar", "btn")}<button class="btn primary">Guardar cambios</button></div></form>`
  );
}
function webDocuments() {
  return (
    heading(
      "Documentos",
      "Archivos privados para la revisión del equipo FurgoPlus.",
    ) +
    serviceTabs("documentos") +
    `<div class="stack form-panel">${model.document === "observed" ? notice("La credencial necesita una imagen legible", "Debe poder leerse la fecha de vencimiento.", "warn") : ""}${panel("Documentos requeridos", documentRows())}${nav("revision", "Continuar a revisión " + icon("arrow"), "btn primary")}</div>`
  );
}
function webReview() {
  return (
    heading(
      "Revisión de información",
      "Aprobación, observaciones e historial de envíos.",
    ) +
    serviceTabs("revision") +
    `<div class="stack form-panel">${notice(model.review === "approved" ? "Tu información está aprobada" : model.review === "pending" ? "Tu envío está en revisión" : "Tu información requiere revisión", model.review === "approved" ? "La visibilidad también depende del plan, las rutas y la publicación." : model.review === "pending" ? "El equipo revisará los datos y documentos enviados." : model.document === "observed" ? "Credencial: la fecha no se lee con claridad." : "Tus cambios están listos para enviar.", model.review === "rejected" ? "warn" : "", model.review === "rejected" && model.document === "ok" ? button("submit-review", "Enviar a revisión", "primary") : model.document === "observed" ? nav("documentos", "Corregir documento", "btn primary") : nav("publicacion", "Ver publicación", "btn"))}${panel("Historial de revisiones", `<div class="panel-body"><div class="timeline">${model.review === "pending" ? "<div><strong>Enviado para revisión</strong><small>04 nov 2026 · 09:00</small><p>Datos y documentos actualizados.</p></div>" : ""}<div><strong>${model.review === "approved" ? "Información aprobada" : "Observaciones del equipo"}</strong><small>02 nov 2026 · 11:20</small><p>${model.review === "approved" ? "Documentos revisados." : esc(model.observation || "La imagen de la credencial no permite leer la fecha.")}</p></div><div><strong>Primer envío</strong><small>01 nov 2026 · 16:40</small></div></div></div>`)}</div>`
  );
}
function publicationRequirements() {
  return [
    [
      "Cuenta habilitada",
      model.accountStatus === "Activo",
      "ayuda",
      "Consultar estado",
    ],
    [
      "Datos y documentos",
      model.document === "ok",
      "documentos",
      "Revisar documentos",
    ],
    [
      "Revisión aprobada",
      model.review === "approved",
      "revision",
      "Ver revisión",
    ],
    ["Plan vigente", model.planStatus === "Vigente", "plan", "Ver mi plan"],
    [
      "Ruta activa",
      model.routes.some((r) => !model.routeInactive.has(r.id)),
      "rutas",
      "Configurar ruta",
    ],
  ];
}
function webPublication() {
  let req = publicationRequirements(),
    ready = req.every((r) => r[1]);
  return (
    heading(
      "Publicación",
      "Controla cuándo tu servicio aparece en las búsquedas.",
    ) +
    `<div class="stack"><div class="plan-summary"><div><div class="eyebrow">Visibilidad del servicio</div><h2>${model.published ? "Visible para apoderados" : "Tu servicio no es visible"}</h2><p class="small muted">${model.published ? "Los apoderados pueden encontrar tu servicio y solicitar contacto." : ready ? "Cumples los requisitos para solicitar publicación." : "Completa los requisitos pendientes."}</p></div>${model.published ? button("publication-off", "Dejar de mostrar", "") : ready ? button("publication-on", "Solicitar publicación", "primary") : badge(req.filter((r) => !r[1]).length + " requisitos pendientes", "warn")}</div>${panel("Requisitos de publicación", req.map(([title, ok, page, action]) => taskRow(title, ok ? "Requisito completo" : "Requiere tu atención", ok ? badge("Completo", "good") : nav(page, action, "btn compact"), "", ok ? "check" : "warning")).join(""))}<details class="disclosure"><summary>Qué ocurre al dejar de mostrar el servicio</summary><p>Deja de aparecer en nuevas búsquedas. Tus registros de operación permanecen disponibles.</p></details></div>`
  );
}
function webRoutes() {
  return (
    heading(
      "Rutas",
      "Horarios, cobertura y capacidad de tu servicio.",
      button("route-new", icon("plus") + " Nueva ruta", "primary"),
    ) +
    `<div class="stack">${model.routes.length ? panel("Rutas configuradas", `<div class="route-list">${model.routes.map((r) => `<div class="route-line"><div class="route-time">${r.time}<small>${r.end}</small></div><div class="route-name">${esc(r.name)}<small>${esc(r.destination)} · ${esc(r.commune)} · ${model.routeInactive.has(r.id) ? "Inactiva" : "Activa"}</small></div>${capacity(r)}${button("route-edit", "Editar", "compact", r.id)}</div>`).join("")}</div>`) : `<div class="panel">${empty("Diseña tu primera ruta", "Define un destino, horario y capacidad para organizar el traslado.", button("route-new", "Crear ruta", "primary"), "route")}</div>`}<p class="small muted">La capacidad corresponde a cada ruta y fecha. Consulta sus asignaciones en Pasajeros.</p></div>`
  );
}
function passengerFilters() {
  return `<div class="filters">${searchField()}${filterField(
    "Vigencia",
    "status",
    [
      ["", "Todas"],
      ["Vigente", "Vigentes"],
      ["Futura", "Futuras"],
      ["Finalizada", "Finalizadas"],
    ],
  )}${button("clear-filters", "Limpiar", "quiet compact")}</div>`;
}
function webPassengers() {
  const routeId = Number(getF("route", current.id || "")),
    rows = model.passengers.filter(
      (p) =>
        (!routeId || p.route === routeId) &&
        (!getF("status") || p.status === getF("status")) &&
        match(getF("q"), [
          p.name,
          p.guardian,
          p.phone,
          findRoute(p.route)?.name,
        ]),
    );
  const p = paginate(rows),
    r = findRoute(routeId);
  return (
    heading(
      "Pasajeros",
      "Asignaciones y cupos para el próximo servicio.",
      button("passenger-new", icon("plus") + " Agregar pasajero", "primary"),
    ) +
    `<div class="capacity-layout"><aside class="panel capacity-rail" aria-label="Ocupación por ruta"><div class="capacity-title"><h2>Cupos por ruta</h2><p>${model.routes.length} rutas · Servicio del 04 nov 2026</p></div><div class="capacity-options"><button class="capacity-item" data-action="route-filter" data-id="" aria-pressed="${!routeId}"><strong>Todas las rutas</strong><small> · ${model.passengers.filter((p) => p.status === "Vigente").length} asignaciones vigentes</small></button>${model.routes.map((r) => `<button class="capacity-item" data-action="route-filter" data-id="${r.id}" aria-pressed="${r.id === routeId}"><div class="split"><strong>${esc(r.name)}</strong></div><small>${r.time} · ${r.commune}</small>${meter(r)}<div class="split"><small>${r.used} / ${r.capacity} ocupados</small>${badge(r.capacity === r.used ? "Sin cupos" : `${r.capacity - r.used} libres`, r.capacity === r.used ? "warn" : "blue")}</div></button>`).join("")}</div></aside><section class="panel">${passengerFilters()}<div class="result-heading"><span>${r ? esc(r.name) : "Todas las rutas"} · ${rows.length} asignaciones</span><span>Servicio · 04 nov</span></div>${rows.length ? table(["Pasajero / apoderado", "Ruta", "Vigencia", ""], p.rows.map((a) => `<tr><td><strong>${esc(a.name)}</strong><small>${esc(a.guardian)}</small></td><td>${esc(findRoute(a.route)?.name)}<small>Asignación #${a.id}</small></td><td>${badge(a.status, a.status === "Vigente" ? "good" : "")}<small>${a.status === "Futura" ? "Desde " + dateLabel(a.start) : "Hasta " + dateLabel(a.end)}</small></td><td>${button("passenger-detail", "Detalle", "quiet compact", a.id)}</td></tr>`).join("")) : empty(model.passengers.length ? "No encontramos coincidencias" : "Aún no tienes pasajeros", model.passengers.length ? "Prueba otro nombre o ajusta los filtros." : "Después de acordar el traslado con una familia, registra la asignación.", model.passengers.length ? button("clear-filters", "Limpiar filtros", "") : button("passenger-new", "Agregar pasajero", "primary"))}${pager(p)}</section></div>`
  );
}
function webPayments() {
  let all = model.payments,
    q = getF("q"),
    status = getF("status"),
    month = getF("month");
  const rows = all.filter(
    (p) =>
      (!status || p.status === status) &&
      (!month ||
        (p.start.slice(0, 7) <= month && p.end.slice(0, 7) >= month)) &&
      match(q, [
        findPassenger(p.assignment)?.name,
        findPassenger(p.assignment)?.guardian,
        p.id,
      ]),
  );
  const p = paginate(rows);
  const total = (status) =>
    all.filter((p) => p.status === status).reduce((a, p) => a + p.amount, 0);
  const count = (status) => all.filter((p) => p.status === status).length;
  return (
    heading(
      "Pagos",
      "Un registro claro de los acuerdos con las familias.",
      button("payment-new", icon("plus") + " Registrar pendiente", "primary"),
    ) +
    metrics([
      [
        "Por registrar como pagado",
        money(total("pending")),
        count("pending") + " registros pendientes",
        "warn",
      ],
      [
        "Registrados como pagados",
        money(total("paid")),
        count("paid") + " registros manuales",
        "good",
      ],
      [
        "Anulados",
        money(total("void")),
        count("void") + " registros conservados",
      ],
    ]) +
    `<div class="stack-sm"><p class="small muted">Registro manual. FurgoPlus no cobra ni verifica movimientos bancarios.</p><section class="panel"><div class="filters">${searchField("Buscar pago", "Pasajero, apoderado o registro")}${filterField(
      "Estado",
      "status",
      [
        ["", "Todos"],
        ["pending", "Pendiente"],
        ["paid", "Registrado como pagado"],
        ["void", "Anulado"],
      ],
    )}<label>Mes del servicio<input type="month" data-filter="month" value="${esc(month)}"></label>${button("clear-filters", "Limpiar", "quiet compact")}</div><div class="result-heading"><span>${rows.length} registros ${status || q || month ? "con los filtros aplicados" : ""}</span><span>Resumen superior: todos los registros</span></div>${rows.length ? table(["Pasajero / período", "Monto CLP", "Estado", ""], p.rows.map((x) => `<tr><td><strong>${esc(findPassenger(x.assignment)?.name || "Asignación anterior")}</strong><small>${dateLabel(x.start)}–${dateLabel(x.end)} · #${x.id}</small></td><td class="amount">${money(x.amount)}<small>Vence ${dateLabel(x.due)}</small></td><td>${badge({ pending: "Pendiente", paid: "Pagado · registro manual", void: "Anulado" }[x.status], { pending: "warn", paid: "good", void: "" }[x.status])}</td><td>${button("payment-detail", "Ver registro", "quiet compact", x.id)}</td></tr>`).join("")) : empty(all.length ? "No hay pagos con estos filtros" : "Todavía no hay pagos registrados", all.length ? "Prueba otro período, estado o nombre." : "Registra un pendiente cuando acuerdes un monto y período con la familia.", all.length ? button("clear-filters", "Limpiar filtros") : button("payment-new", "Registrar pendiente", "primary"), "payment")}${pager(p)}</section></div>`
  );
}
const requestStatus = {
  pending: "Por responder",
  accepted: "Aceptada",
  declined: "Rechazada",
  cancelled: "Cancelada",
};
function webRequests() {
  const status = getF("status"),
    rows = model.requests.filter(
      (r) =>
        !status ||
        (status === "closed"
          ? ["declined", "cancelled"].includes(r.status)
          : r.status === status),
    ),
    p = paginate(rows);
  const request = p.rows.find((r) => r.id === selectedRequest);
  return (
    heading(
      "Solicitudes",
      "Responde a las familias que quieren coordinar contigo.",
    ) +
    `<nav class="tabs" aria-label="Estado de solicitudes">${[
      ["", "Todas"],
      ["pending", "Por responder"],
      ["accepted", "Aceptadas"],
      ["closed", "Cerradas"],
    ]
      .map(
        ([v, t]) =>
          `<button data-action="request-filter" data-id="${v}" aria-pressed="${status === v}">${t} ${badge(v === "closed" ? model.requests.filter((r) => ["declined", "cancelled"].includes(r.status)).length : model.requests.filter((r) => !v || r.status === v).length)}</button>`,
      )
      .join(
        "",
      )}</nav><div class="request-layout"><section class="panel">${p.rows.length ? p.rows.map((r) => `<button class="inbox-row" data-action="request-select" data-id="${r.id}" aria-pressed="${selectedRequest === r.id}"><div class="split"><strong>${esc(r.name)}</strong>${badge(requestStatus[r.status], r.status === "pending" ? "warn" : r.status === "accepted" ? "good" : "")}</div><p>Consulta por tu servicio</p><small>${r.date}</small></button>`).join("") : empty("No tienes solicitudes aquí", "Cuando una familia te escriba, podrás responder desde esta bandeja.", "", "message")}${pager(p)}</section><section class="panel request-detail">${request ? `<div class="panel-head"><h2>${esc(request.name)}</h2>${badge(requestStatus[request.status], request.status === "pending" ? "warn" : "")}</div><div class="panel-body"><span class="small muted">Recibida el ${request.date}</span><div class="message">${esc(request.message)}</div>${dl([["Correo autorizado para esta solicitud", esc(request.email)]])}<div class="actions" style="margin-top:20px">${request.status === "pending" ? button("request-accept", "Aceptar contacto", "primary", request.id) + button("request-decline", "Rechazar", "", request.id) : request.status === "accepted" ? notice("Contacto aceptado", "La familia puede ver el correo de tu servicio.") : ""}</div><p class="small muted" style="margin-top:18px">Aceptar contacto no reserva cupo ni agrega un pasajero.</p></div>` : empty("Selecciona una solicitud", "Revisa el mensaje antes de responder.", "", "message")}</section></div>`
  );
}
function webPlan() {
  const good = model.planStatus === "Vigente",
    all = model.payments,
    pending = all.filter((p) => p.status === "pending"),
    paid = all.filter((p) => p.status === "paid");
  let reportEmpty = getF("month", "2026-11") !== "2026-11";
  return (
    heading(
      "Plan y reportes",
      "Vigencia, beneficios y resumen mensual de tu operación.",
    ) +
    `<div class="stack"><section class="plan-summary"><div><div class="eyebrow">Tu plan</div><h2>FurgoPlus ${model.plan} ${badge(model.planStatus, good ? "good" : "warn")}</h2><p class="small muted">${dateLabel(model.planStart)}–${dateLabel(model.planEnd)} · Los permisos dependen de su vigencia.</p></div>${button("plan-benefits", "Ver beneficios", "")}</section>${
      !good
        ? notice(
            "Tu plan está suspendido",
            "Los reportes no están disponibles mientras el plan permanezca suspendido.",
            "warn",
            nav("ayuda", "Consultar en Ayuda", "btn primary"),
          )
        : model.plan === "Básico"
          ? notice(
              "Tu plan incluye la operación esencial",
              "El reporte mensual requiere un plan con ese beneficio.",
              "",
              nav("ayuda", "Consultar beneficios", "btn"),
            )
          : `<section class="panel"><div class="panel-head"><h2>Resumen mensual</h2>${button("report-export", icon("download") + " Descargar Excel", "", "", model.plan !== "Elite" ? "disabled" : "")}</div><div class="filters">${filterField(
              "Período",
              "month",
              [
                ["2026-11", "Noviembre 2026"],
                ["2026-10", "Octubre 2026"],
                ["2026-09", "Septiembre 2026"],
              ],
            )}<span class="small muted">${model.plan === "Elite" ? "Detalle y comparación incluidos" : "Reporte mensual incluido"}</span></div>${
              reportEmpty
                ? empty(
                    "Sin actividad en este período",
                    "Selecciona noviembre para revisar el ejemplo con registros.",
                    "",
                    "chart",
                  )
                : `<div class="panel-body">${metrics([
                    [
                      "Pagados · manuales",
                      money(paid.reduce((s, p) => s + p.amount, 0)),
                      paid.length + " registros",
                    ],
                    [
                      "Pendientes",
                      money(pending.reduce((s, p) => s + p.amount, 0)),
                      pending.length + " registros",
                      "warn",
                    ],
                    [
                      "Asignaciones",
                      model.passengers.length,
                      model.routes.length + " rutas",
                    ],
                  ])}<h3>Pagos por estado</h3><div class="report-bars">${[
                    ["Registrados", paid.length, "good"],
                    ["Pendientes", pending.length, "warn"],
                    [
                      "Anulados",
                      all.filter((p) => p.status === "void").length,
                      "",
                    ],
                  ]
                    .map(
                      ([label, n]) =>
                        `<div class="report-bar"><span>${label}</span><div class="meter"><span style="width:${all.length ? (n / all.length) * 100 : 0}%"></span></div><strong>${n}</strong></div>`,
                    )
                    .join("")}</div>${
                    model.plan === "Elite"
                      ? `<details class="disclosure"><summary>Comparar con octubre</summary>${dl(
                          [
                            ["Octubre · registros manuales", money(0)],
                            [
                              "Noviembre · registros manuales",
                              money(paid.reduce((s, p) => s + p.amount, 0)),
                            ],
                          ],
                        )}<p>Son registros declarados por el conductor; no son ingresos bancarios verificados.</p></details>`
                      : ""
                  }<details class="disclosure"><summary>Alcance de este reporte</summary><p>Incluye registros de pago cuyo período de servicio se superpone con el mes seleccionado. Anulados se muestran aparte. Las asignaciones son registros, no personas únicas.</p></details></div>`
            }</section>`
    }<details class="disclosure"><summary>Revisar otro plan en el prototipo</summary><p>Control de revisión: cambia únicamente el ejemplo visual.</p><div class="actions">${["Básico", "Pro", "Elite"].map((p) => button("demo-plan", p, "", p)).join("")}</div></details></div>`
  );
}
const articles = [
  {
    id: 1,
    title: "Preparar y publicar mi servicio",
    category: "Mi servicio",
    body: "Completa los datos del servicio, carga los documentos y envía tu información a revisión. Cuando esté aprobada, revisa la vigencia del plan y configura al menos una ruta activa. En Publicación puedes solicitar que el servicio sea visible.",
  },
  {
    id: 2,
    title: "Registrar un pago de una familia",
    category: "Pagos",
    body: "En Pagos, registra un pendiente con la asignación, el monto y el período acordado. Cuando recibas el pago por fuera de FurgoPlus, abre el registro y confirma Marcar pagado. Es un registro manual: FurgoPlus no verifica el banco ni mueve dinero.",
  },
  {
    id: 3,
    title: "Buscar transporte y solicitar contacto",
    category: "Apoderados",
    body: "Busca por comuna, revisa el servicio y compara hasta tres opciones. Solicita contacto con un mensaje y autoriza compartir tu correo. La solicitud no reserva un cupo. Cuando el conductor acepte, podrás consultar el correo de su servicio.",
  },
  {
    id: 4,
    title: "Iniciar y finalizar el recorrido",
    category: "Hoy",
    body: "En Hoy, selecciona la ruta y consulta destino, cupos y pasajeros. Pulsa Iniciar servicio cuando corresponda. Al terminar, confirma Finalizar servicio. Si una respuesta queda incierta, consulta el estado antes de volver a actuar.",
  },
];
function helpHome(admin = false, mobile = false) {
  seedManyTickets();
  const q = getF("q");
  let list = articles.filter((a) => match(q, [a.title, a.category]));
  const tp = paginate(
    tickets.filter(
      (t) => !getF("ticket-state") || t.state === getF("ticket-state"),
    ),
  );
  const shown = tp.rows;
  return (
    heading(
      admin ? "Soporte" : "Ayuda y soporte",
      admin
        ? "Prioriza y responde las solicitudes del servicio."
        : "Encuentra una respuesta o conversa con el equipo.",
      admin
        ? ""
        : button("support-new", icon("plus") + " Nueva solicitud", "primary"),
    ) +
    `${
      admin
        ? metrics([
            [
              "Críticas activas",
              shown.filter(
                (t) => t.severity === "Crítica" && t.state !== "Resuelta",
              ).length,
              "En esta página",
              "warn",
            ],
            [
              "Por revisar",
              shown.filter((t) => t.state === "Abierta").length,
              "En esta página",
            ],
            [
              "En revisión",
              shown.filter((t) => t.state === "En revisión").length,
              "En esta página",
            ],
          ])
        : ""
    }<div class="${mobile || admin ? "stack" : "cols"}">${!admin ? panel("Guías rápidas", `<div class="filters">${searchField("Buscar una guía", "Escribe un tema")}</div>${list.length ? list.map((a) => `<a class="task-row" href="${href("articulo", current.role, current.platform, a.id)}"><div class="task-body"><h3>${a.title}</h3><p>${a.category}</p></div>${icon("chevron")}</a>`).join("") : empty("No encontramos una guía", "Prueba con “pago”, “contacto” o “servicio”.", "", "search")}`) : ""}${panel(
      admin ? "Cola de solicitudes" : "Mis solicitudes",
      `<div class="filters">${filterField("Estado", "ticket-state", [
        ["", "Todas"],
        ["Abierta", "Abiertas"],
        ["En revisión", "En revisión"],
        ["Resuelta", "Resueltas"],
      ])}</div>` +
        (shown.length
          ? shown
              .map(
                (t) =>
                  `<a class="task-row" href="${href("ticket", current.role, current.platform, t.id)}"><div class="task-body"><div class="split"><h3>${esc(t.subject)}</h3>${badge(t.state, t.severity === "Crítica" ? "bad" : "blue")}</div><p>#${t.id} · ${admin ? "Conductor · " : ""}${t.severity} · 03 nov</p></div>${icon("chevron")}</a>`,
              )
              .join("")
          : empty(
              "Sin solicitudes de soporte",
              admin
                ? "Las nuevas solicitudes aparecerán aquí."
                : "Puedes escribirnos si las guías no resuelven tu duda.",
              admin ? "" : button("support-new", "Escribir al equipo", ""),
              "message",
            )) +
        pager(tp),
    )}</div>${admin ? "" : `<details class="disclosure"><summary>Disponibilidad y privacidad</summary><p>No incluyas nombres de estudiantes, contactos privados ni contraseñas en tus mensajes. Las consultas se atienden según su prioridad.</p></details>`}`
  );
}
function articlePage() {
  const a = articles.find((a) => a.id === Number(current.id)) || articles[0];
  return (
    nav("ayuda", icon("back") + " Volver a Ayuda", "back-link") +
    heading(a.title, a.category) +
    `<article class="panel form-panel"><div class="panel-body stack-sm"><p>${a.body}</p><div class="actions">${button("support-new", "Necesito más ayuda", "primary")}${nav("ayuda", "Ver otras guías", "btn")}</div></div></article>`
  );
}
function ticketPage() {
  const t = tickets.find((t) => t.id === Number(current.id));
  if (!t)
    return (
      nav("ayuda", "Volver a Ayuda", "btn") +
      empty(
        "Solicitud no disponible",
        "Vuelve a la bandeja para consultar tus solicitudes.",
      )
    );
  const admin = current.role === "administrador";
  return (
    nav("ayuda", icon("back") + " Volver a solicitudes", "back-link") +
    heading(esc(t.subject), `Solicitud #${t.id} · ${t.severity}`) +
    `<div class="stack form-panel">${admin ? `<section class="panel"><div class="panel-head"><h2>Gestión de la solicitud</h2>${badge(t.state, "blue")}</div><div class="panel-body"><div class="actions">${button("ticket-review", "Pasar a revisión", "", t.id)}${button("ticket-resolve", "Resolver", "primary", t.id)}</div></div></section>` : notice("Estado: " + t.state, "Puedes responder para agregar contexto.")}<section class="panel"><div class="panel-body"><div class="timeline">${t.events.map((e) => `<div><strong>${esc(e.by)}</strong><small>${esc(e.date)}</small><p>${esc(e.text)}</p></div>`).join("")}</div><form data-form="ticket-reply"><input name="ticketId" type="hidden" value="${t.id}"><label class="field">${admin ? "Respuesta del equipo" : "Tu respuesta"}<textarea name="body" required placeholder="Escribe sin información privada"></textarea></label><label class="check"><input name="privacy" type="checkbox" required>Revisé el texto y no contiene información privada.</label><div class="actions"><button class="btn primary">Enviar respuesta</button></div></form></div></section></div>`
  );
}

function adminRecord(id = 1) {
  if (Number(id) === 1) return model;
  model.adminRecords ??= {};
  return (model.adminRecords[id] ??= {
    name:
      Number(id) === 2
        ? "Transporte de Ejemplo Sur"
        : Number(id) === 3
          ? "Ruta de Prueba Oriente"
          : "Servicio Sintético " + id,
    email: "servicio" + id + "@example.test",
    summary: "Traslados escolares de ejemplo.",
    accountStatus:
      Number(id) === 3
        ? "Desactivado"
        : Number(id) === 2
          ? "Suspendido"
          : "Activo",
    review: Number(id) === 3 ? "rejected" : "pending",
    published: false,
    plan: Number(id) === 3 ? "Básico" : "Pro",
    planStatus: "Suspendido",
    planAdminStatus: "Suspendido",
    document: "ok",
    audit: [],
  });
}

function adminValidation() {
  const driverRows = [
    {
      id: 1,
      name: model.name,
      review: model.review === "approved" ? "approved" : "pending",
      date: "04 nov · 08:30",
    },
    {
      id: 2,
      name: "Transporte de Ejemplo Sur",
      review: "pending",
      date: "03 nov · 16:40",
    },
    {
      id: 3,
      name: "Ruta de Prueba Oriente",
      review: "rejected",
      date: "02 nov · 12:00",
    },
  ];
  if (scene === "muchos")
    for (let i = 4; i <= 48; i++)
      driverRows.push({
        id: i,
        name: `Servicio Sintético ${i}`,
        review: i % 3 ? "pending" : "approved",
        date: "02 nov · 10:00",
      });
  const rows = (
      scene === "vacio"
        ? []
        : driverRows.map((r) => ({
            ...r,
            name: adminRecord(r.id).name,
            review: adminRecord(r.id).review,
          }))
    ).filter(
      (x) =>
        (!getF("status") || x.review === getF("status")) &&
        match(getF("q"), [x.name]),
    ),
    p = paginate(rows);
  return (
    heading(
      "Validaciones",
      "Revisa datos y documentos antes de emitir una decisión.",
    ) +
    `<section class="panel"><div class="filters">${searchField("Buscar servicio", "Nombre del servicio")}${filterField(
      "Estado",
      "status",
      [
        ["", "Todos"],
        ["pending", "Pendientes"],
        ["approved", "Aprobadas"],
        ["rejected", "Con observaciones"],
      ],
    )}</div><div class="result-heading"><span>${rows.length} revisiones</span><span>Más recientes primero</span></div>${rows.length ? table(["Servicio", "Enviado", "Revisión", ""], p.rows.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>Envío #${700 + r.id}</small></td><td>${r.date}</td><td>${badge({ pending: "Pendiente", approved: "Aprobada", rejected: "Con observaciones" }[r.review], r.review === "pending" ? "warn" : r.review === "approved" ? "good" : "")}</td><td>${nav("expediente", "Revisar expediente", "btn quiet compact", current.role, "web", r.id)}</td></tr>`).join("")) : empty("No hay revisiones en esta vista", "Las nuevas revisiones aparecerán aquí.", "", "shield")}${pager(p)}</section>`
  );
}
function adminDossier() {
  const rec = adminRecord(current.id || 1),
    canDecide = rec.review === "pending";
  const stateLabel = {
    approved: "Aprobada",
    pending: "Pendiente",
    rejected: "Con observaciones",
  }[rec.review];
  return (
    nav("validaciones", icon("back") + " Volver a validaciones", "back-link") +
    heading(
      esc(rec.name),
      `Envío #${700 + Number(current.id || 1)} · Información enviada el 04 nov 2026`,
    ) +
    `<div class="status-strip"><span>Revisión ${badge(stateLabel, rec.review === "approved" ? "good" : "warn")}</span><span>Cuenta ${badge(rec.accountStatus)}</span><span>Publicación ${badge(rec.published ? "Visible" : "No visible")}</span></div>
 <div class="cols admin-dossier">
 <div class="stack-sm">${panel("Documentos del envío", documentRows(true, rec))}
 <details class="disclosure"><summary>Historial del envío</summary><p>Enviado el 04 nov 2026. ${rec.review === "rejected" ? "La credencial requiere una imagen legible." : rec.review === "approved" ? "Información aprobada por el equipo." : "Pendiente de decisión del equipo."}</p></details></div>
 ${panel(
   "Revisión y decisión",
   `<div class="panel-body stack-sm">${dl([["Correo declarado", esc(rec.email)]])}<details class="disclosure"><summary>Descripción del servicio</summary><p>${esc(rec.summary)}</p></details>
 ${!canDecide ? notice(rec.review === "approved" ? "Información aprobada" : "Esperando un nuevo envío", rec.review === "approved" ? "Esta revisión ya tiene una decisión." : "El conductor debe corregir y reenviar su información.", rec.review === "approved" ? "" : "warn") : ""}
 <form data-form="validation"><input name="driverId" type="hidden" value="${esc(current.id || 1)}"><label class="field">Comentario al conductor<textarea name="comment" placeholder="Indica las correcciones necesarias" ${canDecide ? "" : "disabled"}></textarea><small>Obligatorio para solicitar correcciones.</small></label><div class="actions" style="margin-top:16px"><button name="decision" value="approve" class="btn primary full" ${canDecide ? "" : "disabled"}>Aprobar información</button><button name="decision" value="reject" class="btn full" ${canDecide ? "" : "disabled"}>Solicitar correcciones</button></div></form><p class="small muted">Aprobar no publica el servicio ni activa su plan.</p></div>`,
 )}
 </div>`
  );
}
function adminDrivers() {
  let rows = [
    {
      id: 1,
      name: model.name,
      email: model.email,
      status: model.accountStatus,
      plan: model.plan,
      review: model.review,
      visible: model.published,
    },
    {
      id: 2,
      name: "Transporte de Ejemplo Sur",
      email: "sur@example.test",
      status: "Suspendido",
      plan: "Pro",
      review: "pending",
      visible: false,
    },
    {
      id: 3,
      name: "Ruta de Prueba Oriente",
      email: "oriente@example.test",
      status: "Desactivado",
      plan: "Básico",
      review: "rejected",
      visible: false,
    },
  ];
  if (scene === "muchos")
    for (let i = 4; i <= 76; i++)
      rows.push({
        id: i,
        name: "Servicio Sintético " + i,
        email: `servicio${i}@example.test`,
        status: i % 5 ? "Activo" : "Suspendido",
        plan: i % 3 ? "Pro" : "Elite",
        review: "approved",
        visible: !!(i % 5),
      });
  rows = rows.map((r) => {
    const rec = adminRecord(r.id);
    return {
      ...r,
      name: rec.name,
      email: rec.email,
      status: rec.accountStatus,
      plan: rec.plan,
      review: rec.review,
      visible: rec.published,
    };
  });
  if (scene === "vacio") rows = [];
  rows = rows.filter(
    (r) =>
      match(getF("q"), [r.name, r.email]) &&
      (!getF("status") || r.status === getF("status")) &&
      (!getF("plan") || r.plan === getF("plan")),
  );
  const p = paginate(rows);
  return (
    heading(
      "Conductores",
      "Consulta y gestiona cada servicio con su contexto.",
    ) +
    `<section class="panel"><div class="filters">${searchField("Buscar conductor", "Servicio o correo")}${filterField(
      "Cuenta",
      "status",
      [
        ["", "Todas"],
        ["Activo", "Activa"],
        ["Suspendido", "Suspendida"],
        ["Desactivado", "Desactivada"],
      ],
    )}${filterField("Plan", "plan", [
      ["", "Todos"],
      ["Básico", "Básico"],
      ["Pro", "Pro"],
      ["Elite", "Elite"],
    ])}</div><div class="result-heading"><span>${rows.length} conductores</span></div>${rows.length ? table(["Conductor / servicio", "Cuenta", "Revisión", "Plan / publicación", ""], p.rows.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.email)}</small></td><td>${badge(r.status, r.status === "Activo" ? "" : "warn")}</td><td>${badge({ approved: "Aprobada", pending: "En revisión", rejected: "Observada" }[r.review])}</td><td>${r.plan}<small>${r.visible ? "Visible" : "No visible"}</small></td><td>${nav("conductor", "Gestionar", "btn quiet compact", current.role, "web", r.id)}</td></tr>`).join("")) : empty("No hay conductores en esta vista", "Ajusta los filtros para consultar otros servicios.", "", "people")}${pager(p)}</section>`
  );
}
function adminDriver() {
  const rec = adminRecord(current.id);
  return (
    nav("conductores", icon("back") + " Volver a conductores", "back-link") +
    heading(
      esc(rec.name),
      "Los estados de cuenta, revisión, publicación y plan son independientes.",
    ) +
    `<div class="stack"><div class="metrics"><div class="metric"><span>Cuenta del conductor</span><strong style="font-size:1.375rem">${rec.accountStatus}</strong><small>Estado administrativo</small></div><div class="metric"><span>Revisión</span><strong style="font-size:1.375rem">${{ approved: "Aprobada", pending: "Pendiente", rejected: "Con observaciones" }[rec.review]}</strong><small>Datos y documentos</small></div><div class="metric"><span>Publicación</span><strong style="font-size:1.375rem">${rec.published ? "Visible" : "No visible"}</strong><small>Resultado de requisitos</small></div></div><div class="cols equal">${panel("Cuenta y acceso", `<div class="panel-body stack-sm"><p class="small muted">Cada cambio requiere una razón y queda en el historial.</p><div class="actions">${button("account-suspend", "Suspender servicio", "danger", current.id)}${button("account-activate", "Activar servicio", "", current.id)}${button("account-deactivate", "Desactivar", "quiet", current.id)}</div>${nav("expediente", "Ver validaciones", "text-button", current.role, "web", current.id)}</div>`)}${panel(
      "Plan asignado",
      `<div class="panel-body">${dl([
        ["Plan", rec.plan],
        ["Estado administrativo", rec.planAdminStatus || "Suspendido"],
        ["Vigencia", rec.planStatus],
        [
          "Inicio y término",
          dateLabel(rec.planStart || "2026-10-01") +
            "–" +
            dateLabel(rec.planEnd || "2026-12-31"),
        ],
      ])}${button("admin-plan", "Editar plan", "", current.id)}</div>`,
    )}</div>${panel("Historial de gestión", `<div class="panel-body"><div class="timeline">${rec.audit.map((a) => `<div><strong>${esc(a.title)}</strong><small>04 nov · 09:00 · Administración</small><p>${esc(a.reason)}</p></div>`).join("")}<div><strong>Plan asignado</strong><small>01 oct 2026 · Equipo FurgoPlus</small><p>Vigencia y acceso según requisitos del servicio.</p></div></div></div>`)}</div>`
  );
}
function webParent() {
  return (
    heading(
      "Tu próximo traslado empieza en la app",
      "Busca transporte escolar y revisa tus solicitudes desde Android.",
    ) +
    `<section class="panel form-panel"><div class="panel-body stack-sm">${icon("bus")}<h2>Encuentra un servicio para tu familia</h2><p class="muted">En la app puedes buscar por comuna, comparar servicios y solicitar contacto con un conductor.</p><div class="actions">${nav("buscar", "Ver experiencia Android", "btn primary", "apoderado", "android")}${nav("ayuda", "Ayuda y soporte", "btn")}</div></div></section>`
  );
}
function authPage(mobile = false) {
  const register = current.page === "registro";
  return `<div class="${mobile ? "" : "auth-layout"}">${mobile ? "" : `<div class="auth-brand"><img src="assets/furgoplus-logo.png" alt="FurgoPlus"><h2>Tu servicio escolar.<br>Todo más claro.</h2><p>Organiza tus rutas y mantén el contacto con las familias.</p></div>`}<div class="auth-form"><div><h1>${register ? "Crea tu cuenta" : "Te damos la bienvenida"}</h1><p class="small muted" style="margin-top:8px">${register ? "Regístrate como apoderado para buscar transporte." : "Ingresa a FurgoPlus para continuar."}</p></div><form data-form="login">${register ? field("Nombre visible", "name", "María Vega") : ""}${field("Correo electrónico", "email", register ? "familia.vega@example.test" : "conductor@example.test", "email")}${field("Contraseña", "password", "demo-sintetica", "password")}<label class="check"><input type="checkbox" data-action="toggle-password">Mostrar contraseña</label>${register ? '<label class="check"><input type="checkbox" required>Acepto los términos y la política de privacidad.</label>' : ""}<button class="btn primary full">${register ? "Crear cuenta" : "Ingresar"}</button></form><p class="small muted">${register ? nav("ingresar", "Ya tengo cuenta", "", "acceso", current.platform) : nav("registro", "Crear cuenta de apoderado", "", "acceso", current.platform)}</p><p class="small muted">Acceso de muestra: utiliza cualquier correo válido y contraseña. No se envían credenciales.</p></div></div>`;
}
function mobileToday() {
  const r = findRoute(selectedRun) || model.routes[0];
  if (!r)
    return (
      heading("Hoy", "Miércoles 4 de noviembre") +
      `<section class="panel">${empty("Sin recorridos para hoy", "Cuando tengas una ruta programada, podrás consultar el recorrido y sus pasajeros.", "", "route")}</section>`
    );
  selectedRun = r.id;
  const state = model.runStates[r.id] || "planned",
    unknown = scene === "incierto" && !model.recovered.has("run" + r.id);
  const label = unknown
    ? "Estado por confirmar"
    : {
        planned: "Planificado",
        in_progress: "En curso",
        completed: "Finalizado",
      }[state];
  return (
    heading("Hoy", "Miércoles 4 de noviembre") +
    `<div class="stack-sm">${unknown ? notice("Consulta el estado antes de continuar", "La última respuesta no llegó. Evita repetir la acción.", "warn", button("run-recover", "Consultar estado", "primary full", r.id)) : ""}<section class="journey-hero"><div class="journey-top"><div class="split"><span class="eyebrow">Recorrido seleccionado</span>${badge(label, unknown ? "warn" : state === "in_progress" ? "blue" : state === "completed" ? "good" : "")}</div><div class="route-clock">${r.time}<span class="small muted"> → ${r.end}</span></div><h2>${esc(r.name)}</h2><p class="route-sub">${esc(r.commune)} · Lunes a viernes</p>${unknown ? button("run-recover", "Consultar estado", "primary full", r.id) : state === "completed" ? '<p class="small">El servicio de hoy está finalizado.</p>' : button(state === "planned" ? "run-start" : "run-end", state === "planned" ? "Iniciar servicio" : "Finalizar servicio", "primary full", r.id)}</div><div class="journey-body"><div class="split"><strong>${r.used} pasajeros</strong><span>${r.capacity - r.used} cupos libres</span></div>${meter(r)}<p class="small muted" style="margin-top:8px">${r.used} de ${r.capacity} cupos · 04 nov</p>${nav("recorrido", "Información del recorrido " + icon("chevron"), "text-button", "conductor", "android", r.id)}</div></section><section class="panel">${nav("pasajeros", `<div class="row-icon">${icon("people")}</div><div class="task-body"><h3>Pasajeros del recorrido</h3><p>Recogida y contacto bajo demanda</p></div>${icon("chevron")}`, "task-row", "conductor", "android", r.id)}</section><details class="disclosure"><summary>Otros recorridos de hoy · ${Math.max(0, model.routes.length - 1)}</summary><div class="stack-sm" style="margin-top:12px">${model.routes
      .filter((x) => x.id !== r.id)
      .map(
        (x) =>
          `<button class="capacity-item panel" data-action="run-select" data-id="${x.id}"><div class="split"><strong>${esc(x.name)}</strong><span>${x.time}</span></div><small>${x.used}/${x.capacity} cupos ocupados</small></button>`,
      )
      .join("")}</div></details></div>`
  );
}
function mobileRoute() {
  const r = findRoute(current.id) || findRoute(selectedRun);
  if (!r)
    return empty(
      "Recorrido no disponible",
      "Vuelve a Hoy para seleccionar otro.",
      nav("hoy", "Volver a Hoy", "btn"),
    );
  return (
    heading("Tu recorrido", esc(r.name)) +
    `<div class="stack-sm"><section class="panel panel-body"><div class="destination-block">${icon("pin")}<div><span class="small muted">Destino</span><strong>${esc(r.destination)}</strong><p>${esc(r.address)} · ${r.commune}</p></div></div>${button("maps", icon("pin") + " Abrir en mapas", "full", r.id)}<p class="small muted" style="margin-top:10px">Dirección privada del recorrido.</p></section><section class="panel panel-body">${dl(
      [
        ["Horario", `${r.time}–${r.end}`],
        ["Días de servicio", "Lunes a viernes"],
        ["Próximo servicio", "04 nov 2026"],
        [
          "Ocupación",
          `${r.used} de ${r.capacity} cupos · ${r.capacity - r.used} disponibles`,
        ],
      ],
    )}${nav("pasajeros", "Consultar pasajeros " + icon("arrow"), "text-button", "conductor", "android", r.id)}</section></div>`
  );
}
function mobilePassengers() {
  const r = findRoute(current.id) || findRoute(selectedRun);
  if (!r)
    return (
      heading("Pasajeros") +
      empty(
        "Sin recorrido seleccionado",
        "Vuelve a Hoy para consultar tus rutas.",
        nav("hoy", "Ir a Hoy", "btn"),
      )
    );
  const rows = model.passengers.filter(
      (p) =>
        p.route === r.id &&
        p.status === "Vigente" &&
        match(getF("q"), [p.name, p.guardian]),
    ),
    p = paginate(rows, 5);
  return (
    heading("Pasajeros", `${esc(r.name)} · ${r.time}`) +
    `<div class="split small"><strong>${r.used} de ${r.capacity} cupos</strong>${badge(`${r.capacity - r.used} libres`, "blue")}</div>${meter(r)}<label class="field"><span class="small muted" style="margin-top:18px">Buscar pasajero o apoderado</span><input type="search" data-filter="q" value="${esc(getF("q"))}" placeholder="Nombre o apoderado"></label><div>${p.rows.length ? p.rows.map((a) => `<article class="passenger-row"><strong>${esc(a.name)}</strong><p>${esc(a.pickup)}</p><details><summary>${icon("phone")} &nbsp; Ver contacto del apoderado</summary><p><strong>${esc(a.guardian)}</strong>${esc(a.phone)}<br><small>Contacto sintético de revisión</small></p></details></article>`).join("") : empty("No hay pasajeros en esta vista", getF("q") ? "Prueba otro nombre." : "Esta ruta aún no tiene pasajeros asignados.")}${pager(p)}</div>`
  );
}
function mobilePlan() {
  const good = model.planStatus === "Vigente";
  return (
    heading("Mi plan", "Tus beneficios y la vigencia del servicio.") +
    `<div class="stack-sm"><section class="plan-summary"><div class="eyebrow">FurgoPlus</div><h2>Plan ${model.plan}</h2>${badge(model.planStatus, good ? "good" : "warn")}<p class="small muted" style="margin-top:12px">${dateLabel(model.planStart)}–${dateLabel(model.planEnd)}</p></section>${!good ? notice("Tu plan requiere atención", "Consulta con el equipo para revisar su estado.", "warn", nav("ayuda", "Ir a Ayuda", "btn primary full")) : ""}<section class="panel"><div class="panel-head"><h2>Qué incluye</h2></div>${[["Operación diaria", "Recorridos y pasajeros en Android."], ["Ayuda y soporte", "Guías y solicitudes de atención."], ...(model.plan === "Básico" ? [] : [["Reporte mensual", "Disponible desde la web."]]), ...(model.plan === "Elite" ? [["Detalle y Excel", "Disponibles desde la web."]] : [])].map(([a, b]) => taskRow(a, b, icon("check"))).join("")}</section><details class="disclosure"><summary>Detalles de mi plan</summary>${dl(
      [
        ["Plan asignado", model.plan],
        ["Estado administrativo", model.planAdminStatus],
        ["Vigencia", model.planStatus],
        ["Inicio", dateLabel(model.planStart)],
        ["Término", dateLabel(model.planEnd)],
      ],
    )}<p>El plan asignado no garantiza acceso fuera de su vigencia. La publicación se revisa por separado.</p></details></div>`
  );
}
function mobileAccount(parent = false) {
  return (
    heading("Mi cuenta", "Información de tu cuenta FurgoPlus.") +
    `<div class="account-hero"><span class="avatar">${parent ? "MV" : "CL"}</span><div><h2>${parent ? esc(model.parentName) : "Cristóbal Lagos"}</h2><p>${parent ? "Apoderado/a" : "Conductor"}</p></div></div><section class="panel panel-body">${dl([["Correo de la cuenta", parent ? "familia.vega@example.test" : "conductor@example.test"]])}${parent ? button("parent-name", "Editar nombre", "quiet") : ""}</section><div class="actions" style="margin-top:24px">${button("logout", icon("logout") + " Cerrar sesión", "")}</div><div class="legal-links">${button("legal", "Términos de uso", "quiet", "terminos")}${button("legal", "Privacidad", "quiet", "privacidad")}</div>`
  );
}
function publicServices() {
  return [
    {
      id: 1,
      name: model.name,
      commune: "La Florida",
      route: "Mañana · Los Aromos",
      time: "07:15–08:00",
      used: findRoute(1)?.used ?? 8,
      capacity: 12,
      description: model.summary,
    },
    {
      id: 2,
      name: "Transporte de Ejemplo Sur",
      commune: "La Florida",
      route: "Mañana · Los Aromos",
      time: "07:00–07:50",
      used: 9,
      capacity: 12,
      description: "Traslado escolar de mañana en La Florida.",
    },
    {
      id: 3,
      name: "Ruta de Prueba Oriente",
      commune: "Puente Alto",
      route: "Mañana · El Arrayán",
      time: "07:20–08:10",
      used: 10,
      capacity: 14,
      description: "Servicio de mañana para familias de Puente Alto.",
    },
  ];
}
function parentSearch() {
  const commune = getF("commune", "La Florida");
  const rows =
    scene === "vacio"
      ? []
      : publicServices().filter((s) => !commune || s.commune === commune);
  return (
    heading("Busca tu transporte", "Encuentra servicios en tu comuna.") +
    `<form class="panel panel-body ${searched ? "search-result-form" : ""}" data-form="parent-search"><label class="field">Comuna<select name="commune"><option ${commune === "La Florida" ? "selected" : ""}>La Florida</option><option ${commune === "Puente Alto" ? "selected" : ""}>Puente Alto</option><option ${commune === "" ? "selected" : ""} value="">Todas las comunas</option></select></label><button class="btn primary full" style="margin-top:16px">${icon("search")} Buscar servicios</button></form>${searched ? `<div class="split" style="margin:24px 0 14px"><h2>${rows.length} servicios</h2><span class="small muted">${esc(commune || "Todas las comunas")}</span></div>${rows.length ? rows.map((s) => `<article class="service-result"><div class="result-top"><span class="eyebrow">Transporte escolar</span><h2>${esc(s.name)}</h2><div class="result-meta">${icon("pin")} ${s.commune} · ${s.time}</div>${badge(`${s.capacity - s.used} cupos disponibles`, "blue")}<p class="small muted" style="margin-top:8px">${esc(s.route)} · 04 nov</p></div><div class="result-bottom"><label class="check"><input type="checkbox" data-action="compare-toggle" data-id="${s.id}" ${selectedServices.has(s.id) ? "checked" : ""}>Comparar</label>${nav("servicio", "Ver servicio " + icon("chevron"), "text-button", "apoderado", "android", s.id)}</div></article>`).join("") : empty("Sin servicios en esta comuna", "Prueba otra comuna para ampliar tu búsqueda.", "", "search")}${selectedServices.size ? `<div class="compare-dock"><span>${selectedServices.size} de 3 seleccionados</span>${selectedServices.size >= 2 ? nav("comparar", "Comparar", "btn primary") : button("compare-hint", "Selecciona otro", "quiet")}</div>` : ""}` : `<div class="empty">${icon("bus")}<h2>Un traslado que se adapte a ti</h2><p>Selecciona una comuna para ver los servicios disponibles.</p></div>`}`
  );
}
function parentService() {
  const s =
    publicServices().find((s) => s.id === Number(current.id)) ||
    publicServices()[0];
  return (
    heading(esc(s.name), "Transporte escolar · " + s.commune) +
    `<div class="stack-sm"><section class="journey-hero"><div class="journey-top">${badge("Servicio disponible", "good")}<h2 style="margin-top:14px">${esc(s.route)}</h2><div class="route-clock" style="font-size:1.625rem">${s.time}</div><p class="route-sub">Lunes a viernes · ${s.commune}</p><div class="split small"><strong>${s.capacity - s.used} cupos disponibles</strong><span>04 nov 2026</span></div></div><div class="journey-body">${nav("contacto", "Solicitar contacto", "btn primary full", "apoderado", "android", s.id)}<p class="small muted" style="margin-top:12px">Solicitar contacto no reserva un cupo.</p></div></section><div class="actions">${button("compare-toggle", selectedServices.has(s.id) ? "Quitar de comparación" : "Agregar a comparación", "quiet", s.id)}</div><section class="panel panel-body"><h2>Sobre el servicio</h2><p class="small muted" style="margin-top:12px">${esc(s.description)}</p><details class="disclosure"><summary>Cobertura y horario</summary>${dl(
      [
        ["Comuna", s.commune],
        ["Destino", s.id === 3 ? "Escuela El Arrayán" : "Colegio Los Aromos"],
        ["Horario", s.time],
        ["Días", "Lunes a viernes"],
      ],
    )}</details><details class="disclosure"><summary>Reseñas del servicio</summary><p>“Comunicación clara para coordinar el traslado.”</p><p class="small">Reseña de ejemplo · 22 oct 2026</p></details></section></div>`
  );
}
function parentCompare() {
  const rows = publicServices().filter((s) => selectedServices.has(s.id));
  return (
    heading("Compara servicios", "Revisa cobertura, horarios y cupos.") +
    (rows.length < 2
      ? empty(
          "Selecciona al menos dos servicios",
          "Puedes comparar hasta tres opciones.",
          nav("buscar", "Volver a Buscar", "btn"),
        )
      : `<div class="comparison-scroll" role="region" aria-label="Comparación de servicios; desplazamiento horizontal" tabindex="0"><div class="comparison-grid" data-count="${rows.length}">${rows
          .map(
            (s) =>
              `<section class="panel panel-body"><h3>${esc(s.name)}</h3>${dl([
                ["Comuna", s.commune],
                ["Horario", s.time],
                ["Cupos", `${s.capacity - s.used} libres`],
                ["Fecha", "04 nov"],
              ])}${nav("servicio", "Ver servicio", "btn full", "apoderado", "android", s.id)}</section>`,
          )
          .join(
            "",
          )}</div></div><p class="small muted" style="margin-top:12px">Desliza dentro del comparador si las opciones exceden el ancho disponible.</p><p class="small muted" style="margin-top:20px">La disponibilidad puede cambiar. Coordina el traslado directamente con el conductor.</p>`)
  );
}
function parentContact() {
  const s =
      publicServices().find((s) => s.id === Number(current.id)) ||
      publicServices()[0],
    existing =
      model.requests.find(
        (r) =>
          r.name === model.parentName &&
          (r.serviceId || 1) === s.id &&
          r.status !== "cancelled",
      ) ||
      model.parentRequests.find(
        (r) => (r.serviceId || 1) === s.id && r.status !== "cancelled",
      );
  return (
    heading("Solicitar contacto", esc(s.name)) +
    (existing
      ? notice(
          "Ya tienes una solicitud para este servicio",
          "Revisa su estado antes de enviar otra.",
          "",
          nav(
            "solicitud",
            "Ver mi solicitud",
            "btn primary full",
            "apoderado",
            "android",
            existing.id,
          ),
        )
      : `<form class="stack-sm" data-form="contact"><input name="serviceId" type="hidden" value="${s.id}"><section class="panel panel-body"><label class="field">Tu mensaje<textarea name="message" required placeholder="Cuéntale qué traslado necesitas" maxlength="1000"></textarea><small>Evita direcciones, nombres de estudiantes y otros datos privados.</small></label></section><label class="check"><input name="consent" type="checkbox" required>Autorizo compartir mi correo familia.vega@example.test con este conductor para coordinar el traslado.</label><p class="small muted">Esta solicitud abre el contacto. No reserva un cupo ni confirma una contratación.</p><button class="btn primary full">Enviar solicitud</button></form>`)
  );
}
function parentRequestRows() {
  const shared = model.requests.filter((r) => r.name === model.parentName),
    extra = model.parentRequests.filter(
      (r) => !shared.some((x) => x.id === r.id),
    );
  return [...shared, ...extra];
}
function parentRequests() {
  const list = parentRequestRows();
  return (
    heading("Solicitudes", "El estado de tus contactos con conductores.") +
    `<div class="stack-sm">${list.length ? list.map((r) => `<a class="panel task-row" href="${href("solicitud", "apoderado", "android", r.id)}"><div class="task-body"><h3>${esc(publicServices().find((s) => s.id === (r.serviceId || 1))?.name || model.name)}</h3><p>${r.date}</p><span style="display:block;margin-top:8px">${badge(requestStatus[r.status], r.status === "pending" ? "warn" : r.status === "accepted" ? "good" : "")}</span></div>${icon("chevron")}</a>`).join("") : empty("Aún no tienes solicitudes", "Busca un servicio y solicita contacto para coordinar tu traslado.", nav("buscar", "Buscar servicios", "btn primary"), "message")}</div>`
  );
}
function parentRequest() {
  const r = parentRequestRows().find((r) => r.id === Number(current.id));
  if (!r)
    return empty(
      "Solicitud no disponible",
      "Consulta tu bandeja para continuar.",
      nav("solicitudes", "Ver solicitudes", "btn"),
    );
  return (
    heading(
      "Tu solicitud",
      esc(
        publicServices().find((s) => s.id === (r.serviceId || 1))?.name ||
          model.name,
      ),
    ) +
    `<div class="stack-sm"><section class="panel panel-body">${badge(requestStatus[r.status], r.status === "pending" ? "warn" : r.status === "accepted" ? "good" : "")}<p class="small muted" style="margin-top:12px">Enviada el ${r.date}</p><div class="message">${esc(r.message)}</div>${r.status === "accepted" ? notice("El conductor aceptó el contacto", "Ya puedes consultar el correo del servicio.") + dl([["Correo del servicio", esc((r.serviceId || 1) === 1 ? model.email : "servicio.sur@example.test")]]) : r.status === "pending" ? '<p class="small muted">El conductor aún no responde. Te mostraremos el correo del servicio cuando acepte.</p>' : ""}</section>${r.status === "pending" ? button("request-cancel", "Cancelar solicitud", "", "" + r.id) : ""}<p class="small muted">La solicitud no confirma una reserva ni una asignación de pasajero.</p></div>`
  );
}
const webLabels = {
  inicio: "Inicio",
  servicio: "Mi servicio",
  datos: "Datos del servicio",
  documentos: "Documentos",
  revision: "Revisión",
  publicacion: "Publicación",
  rutas: "Rutas",
  pasajeros: "Pasajeros",
  solicitudes: "Solicitudes",
  pagos: "Pagos",
  plan: "Plan y reportes",
  ayuda: "Ayuda y soporte",
  articulo: "Guía de ayuda",
  ticket: "Solicitud de soporte",
  validaciones: "Validaciones",
  expediente: "Expediente",
  conductores: "Conductores",
  conductor: "Gestión del conductor",
};
function renderReviewBar() {
  const items = [
    ["web", "conductor", "inicio", "Conductor", "Web"],
    ["web", "administrador", "validaciones", "Admin", "Web"],
    ["android", "conductor", "hoy", "Conductor", "Android"],
    ["android", "apoderado", "buscar", "Apoderado", "Android"],
  ];
  $("#review-bar").innerHTML =
    `<div class="review-mark"><strong>FurgoPlus · Estudio de experiencia</strong><span>Prototipo local · Datos sintéticos</span></div><nav class="review-tabs" aria-label="Plataforma y rol">${items.map(([p, r, page, label, platform]) => `<a href="${href(page, r, p)}" ${current.platform === p && current.role === r ? 'aria-current="page"' : ""}><span class="platform-label">${platform} ·&nbsp;</span>${label}</a>`).join("")}</nav><div class="review-tools"><label>Estado<select id="scene-select" aria-label="Escenario de revisión">${[
      ["normal", "Normal"],
      ["pendiente", "Pendientes"],
      ["vacio", "Sin registros"],
      ["error", "Error de lectura"],
      ["muchos", "Muchos registros"],
      ["carga", "Cargando"],
      ["incierto", "Resultado incierto"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${scene === v ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><button data-action="guide">Guía</button><button data-action="reset" class="reset" title="Reiniciar datos sintéticos">Reiniciar</button></div>`;
}
function webShell(content) {
  let driver = current.role === "conductor",
    admin = current.role === "administrador";
  let items = driver
    ? [
        ["inicio", "Inicio", "home"],
        ["servicio", "Mi servicio", "service"],
        ["publicacion", "Publicación", "", true],
        ["rutas", "Rutas", "", true],
        ["pasajeros", "Pasajeros", "people"],
        ["solicitudes", "Solicitudes", "message"],
        ["pagos", "Pagos", "payment"],
        ["plan", "Plan y reportes", "chart"],
      ]
    : admin
      ? [
          ["validaciones", "Validaciones", "shield"],
          ["conductores", "Conductores", "people"],
        ]
      : [["inicio", "Inicio", "home"]];
  const servicePages = ["servicio", "datos", "documentos", "revision"];
  const roleName = driver
    ? "Conductor"
    : admin
      ? "Administración"
      : "Apoderado";
  return `<div class="shell"><aside class="sidebar" id="sidebar"><button class="icon-button menu-close" data-action="menu-close" aria-label="Cerrar menú">${icon("close")}</button><img class="brand" src="assets/furgoplus-logo.png" alt="FurgoPlus · Transporte escolar"><p class="brand-caption">${admin ? "Administración del servicio" : "Transporte escolar"}</p><div class="nav-group-label">${admin ? "GESTIÓN" : "TU ESPACIO"}</div><nav class="nav" aria-label="Navegación ${roleName}">${items.map(([p, t, i, sub]) => `<a class="${sub ? "subnav" : ""}" href="${href(p)}" ${current.page === p || (p === "servicio" && servicePages.includes(current.page)) || (p === "conductores" && current.page === "conductor") || (p === "validaciones" && current.page === "expediente") ? 'aria-current="page"' : ""}>${i ? icon(i) : ""}${t}${p === "solicitudes" && model.requests.some((r) => r.status === "pending") ? `<span class="count">${model.requests.filter((r) => r.status === "pending").length}</span>` : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><nav class="nav">${nav("ayuda", icon("help") + "Ayuda y soporte", "", current.role)}</nav><div class="account-mini"><span class="avatar">${driver ? "CL" : admin ? "FP" : "MV"}</span><div><strong>${driver ? "Cristóbal Lagos" : admin ? "Equipo FurgoPlus" : esc(model.parentName)}</strong><span class="small muted">${roleName}</span></div></div>${button("logout", "Cerrar sesión", "quiet compact")}</div></aside><div class="workspace"><header class="topbar"><div><button class="icon-button menu-toggle" data-action="menu" aria-label="Abrir menú" aria-expanded="false" aria-controls="sidebar">${icon("menu")}</button><span>${roleName}</span>${icon("chevron")}<span>${webLabels[current.page] || "Inicio"}</span></div><div class="date-label">${icon("calendar")} 04 nov 2026</div></header><main id="main" class="main screen-${esc(current.page)}">${content}<p class="prototype-note">Estudio visual FurgoPlus · Datos sintéticos · Cambios solo en esta sesión</p></main></div></div>`;
}
function mobileShell(content) {
  const parent = current.role === "apoderado",
    access = current.role === "acceso";
  const subpage = (
    parent
      ? [
          "servicio",
          "comparar",
          "contacto",
          "solicitud",
          "articulo",
          "ticket",
          "ayuda",
        ]
      : ["recorrido", "pasajeros", "cuenta", "articulo", "ticket"]
  ).includes(current.page);
  const title =
    {
      recorrido: "Información del recorrido",
      pasajeros: "Pasajeros",
      cuenta: "Mi cuenta",
      servicio: "Detalle del servicio",
      comparar: "Comparar servicios",
      contacto: "Solicitar contacto",
      solicitud: "Tu solicitud",
      articulo: "Guía de ayuda",
      ticket: "Solicitud de soporte",
      ayuda: "Ayuda y soporte",
    }[current.page] || "FurgoPlus";
  let back = parent
    ? ["contacto"].includes(current.page)
      ? "servicio"
      : ["solicitud"].includes(current.page)
        ? "solicitudes"
        : ["articulo", "ticket"].includes(current.page)
          ? "ayuda"
          : "buscar"
    : ["articulo", "ticket"].includes(current.page)
      ? "ayuda"
      : "hoy";
  const items = parent
    ? [
        ["buscar", "Buscar", "search"],
        ["solicitudes", "Solicitudes", "mail"],
        ["cuenta", "Mi cuenta", "account"],
      ]
    : [
        ["hoy", "Hoy", "home"],
        ["plan", "Mi plan", "shield"],
        ["ayuda", "Ayuda", "help"],
      ];
  return `<div class="mobile-stage"><section class="device" aria-label="Prototipo Android ${parent ? "apoderado" : "conductor"}"><div class="android-status" aria-hidden="true"><span>09:00</span><span class="system-icons">${icon("signal")}${icon("battery")}</span></div><header class="appbar">${subpage ? nav(back, icon("back"), "icon-button", current.role, "android", current.page === "contacto" ? current.id : "") : ""}${subpage ? `<span class="bar-title">${title}</span>` : '<img src="assets/furgoplus-logo.png" alt="FurgoPlus · Transporte escolar">'}${access ? "" : parent ? nav("ayuda", icon("help"), "icon-button") : nav("cuenta", '<span class="avatar">CL</span>', "icon-button")}</header><main id="main" class="mobile-content">${content}</main>${access ? "" : `<nav class="bottom-nav" aria-label="Secciones Android">${items.map(([p, t, i]) => `<a href="${href(p)}" ${current.page === p || (p === "hoy" && !parent && ["pasajeros", "recorrido"].includes(current.page)) || (p === "buscar" && parent && ["servicio", "comparar", "contacto"].includes(current.page)) || (p === "solicitudes" && parent && current.page === "solicitud") ? 'aria-current="page"' : ""}><span class="nav-icon">${icon(i)}</span>${t}</a>`).join("")}</nav>`}<div class="android-gesture" aria-hidden="true"><span></span></div></section><aside class="mobile-guide"><div class="eyebrow">Android · ${parent ? "Apoderado" : "Conductor"}</div><h2>${parent ? "Decidir con claridad. Contactar con confianza." : "La jornada empieza con una acción clara."}</h2><p>${parent ? "Comuna, opciones y contacto. La información privada aparece cuando corresponde." : "Recorrido, estado y pasajeros. Navegación inferior persistente y detalles en su propio destino."}</p><ol>${parent ? "<li>Busca en La Florida y selecciona dos servicios.</li><li>Compara horarios y cupos; abre el detalle.</li><li>Envía una solicitud y revísala en Solicitudes.</li><li>En web Conductor, acepta el contacto. Regresa para ver el correo.</li>" : "<li>Consulta el recorrido y sus pasajeros.</li><li>Inicia el servicio y revisa el estado En curso.</li><li>Finaliza con confirmación.</li><li>Abre Mi plan, Ayuda y Mi cuenta.</li>"}</ol><div class="review-tip">Marco de referencia de 412 px. En un teléfono el marco desaparece. Este HTML representa la experiencia; no ejecuta Flutter ni sustituye la revisión en Samsung.</div></aside></div>`;
}
function pageContent() {
  if (current.role === "acceso")
    return authPage(current.platform === "android");
  if (activeError())
    return (
      heading(
        webLabels[current.page] ||
          { hoy: "Hoy", buscar: "Busca tu transporte", cuenta: "Mi cuenta" }[
            current.page
          ] ||
          "FurgoPlus",
      ) + recovery()
    );
  if (current.page === "articulo") return articlePage();
  if (current.page === "ticket") return ticketPage();
  if (current.platform === "android") {
    if (current.role === "conductor")
      return (
        {
          hoy: mobileToday,
          recorrido: mobileRoute,
          pasajeros: mobilePassengers,
          plan: mobilePlan,
          cuenta: () => mobileAccount(false),
          ayuda: () => helpHome(false, true),
        }[current.page]?.() || mobileToday()
      );
    return (
      {
        buscar: parentSearch,
        servicio: parentService,
        comparar: parentCompare,
        contacto: parentContact,
        solicitudes: parentRequests,
        solicitud: parentRequest,
        cuenta: () => mobileAccount(true),
        ayuda: () => helpHome(false, true),
      }[current.page]?.() || parentSearch()
    );
  }
  if (current.role === "administrador")
    return (
      {
        validaciones: adminValidation,
        expediente: adminDossier,
        conductores: adminDrivers,
        conductor: adminDriver,
        ayuda: () => helpHome(true),
      }[current.page]?.() || adminValidation()
    );
  if (current.role === "apoderado")
    return current.page === "ayuda" ? helpHome(false) : webParent();
  return (
    {
      inicio: webHome,
      servicio: webService,
      datos: webServiceData,
      documentos: webDocuments,
      revision: webReview,
      publicacion: webPublication,
      rutas: webRoutes,
      pasajeros: webPassengers,
      pagos: webPayments,
      solicitudes: webRequests,
      plan: webPlan,
      ayuda: () => helpHome(false),
    }[current.page]?.() || webHome()
  );
}
function render(preserve = false) {
  const previous = current;
  current = locationState();
  if (!model || scene !== current.scene) resetModel(current.scene);
  const focus = document.activeElement,
    focusKey = focus?.dataset?.filter,
    caret = focus?.selectionStart,
    scroll = $(".mobile-content")?.scrollTop || 0;
  const winScroll = window.scrollY;
  if (
    previous &&
    (previous.page !== current.page ||
      previous.id !== current.id ||
      previous.role !== current.role ||
      previous.platform !== current.platform)
  )
    preserve = false;
  document.body.classList.remove("menu-open");
  $("#review-bar").inert = false;
  renderReviewBar();
  const content = pageContent();
  $("#app").innerHTML =
    current.platform === "android"
      ? mobileShell(content)
      : current.role === "acceso"
        ? `<main id="main">${content}</main>`
        : webShell(content);
  document.title = `FurgoPlus · ${webLabels[current.page] || { hoy: "Hoy", buscar: "Buscar", cuenta: "Mi cuenta", comparar: "Comparar", contacto: "Contacto" }[current.page] || "Prototipo"} · ${current.platform === "android" ? "Android" : "Web"}`;
  if (preserve) {
    window.scrollTo(0, winScroll);
    if ($(".mobile-content")) $(".mobile-content").scrollTop = scroll;
    if (focusKey) {
      const next = document.querySelector(`[data-filter="${focusKey}"]`);
      next?.focus({ preventScroll: true });
      if (next?.type === "search" && caret !== null)
        next.setSelectionRange(caret, caret);
    }
  } else {
    window.scrollTo(0, 0);
    $(".mobile-content")?.scrollTo(0, 0);
    if (previous) $("#page-title")?.focus({ preventScroll: true });
  }
}
let dialogReturnFocus;
function openDialog(title, body, context = {}) {
  if (!$("#dialog").open) dialogReturnFocus = document.activeElement;
  dialogContext = context;
  const d = $("#dialog");
  d.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Cerrar diálogo">${icon("close")}</button></div>${body}`;
  if (!d.open) d.showModal();
}
function closeDialog() {
  const d = $("#dialog");
  if (d.open) d.close();
  d.innerHTML = "";
  dialogContext = null;
  dialogReturnFocus?.focus?.({ preventScroll: true });
}
const footer = (text = "Guardar", danger = false) =>
  `<div class="form-footer">${button("close-dialog", "Cancelar")}<button class="btn ${danger ? "danger " : ""}primary">${text}</button></div>`;
function confirmDialog(
  title,
  body,
  type,
  id = "",
  text = "Confirmar",
  danger = false,
  reason = false,
) {
  openDialog(
    title,
    `<form data-form="confirm"><div class="dialog-body stack-sm">${body}${reason ? '<label class="field">Motivo<textarea name="reason" required placeholder="Explica el motivo de esta decisión"></textarea></label>' : ""}</div>${footer(text, danger)}</form>`,
    { type, id },
  );
}
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 5500);
}
function refreshToast(text) {
  closeDialog();
  render(true);
  toast(text);
}
function passengerDialog(id) {
  const p = findPassenger(id);
  if (!p) return;
  const r = findRoute(p.route);
  openDialog(
    esc(p.name),
    `<div class="dialog-body"><div class="split">${badge(p.status, p.status === "Vigente" ? "good" : "")}<span class="small muted">Asignación #${p.id}</span></div>${dl(
      [
        ["Ruta", esc(r?.name)],
        ["Período", `${p.start} al ${p.end}`],
      ],
    )}<details class="disclosure"><summary>Recogida y contacto privado</summary>${dl(
      [
        ["Recogida", esc(p.pickup)],
        ["Apoderado", esc(p.guardian)],
        ["Teléfono", esc(p.phone)],
      ],
    )}</details><div class="actions">${button("passenger-edit", "Editar asignación", "", id)}${p.status !== "Finalizada" ? button("passenger-end", "Finalizar asignación", "danger", id) : ""}</div></div>`,
    { type: "passenger-detail", id },
  );
}
function passengerForm(id) {
  const p = findPassenger(id),
    routeId = p?.route || getF("route", current.id || 1);
  openDialog(
    p ? "Editar asignación" : "Agregar pasajero",
    `<form data-form="passenger"><input name="id" type="hidden" value="${p?.id || ""}"><div class="dialog-body stack-sm">${model.routes.length ? "" : notice("Primero configura una ruta", "Necesitas una ruta antes de asignar pasajeros.", "warn", nav("rutas", "Ir a Rutas", "btn"))}${selectField(
      "Ruta",
      "route",
      model.routes.map((r) => [
        r.id,
        `${r.name} · ${r.capacity - r.used} cupos libres`,
      ]),
      routeId,
    )}<div class="form-grid">${field("Nombre del pasajero", "name", p?.name || "")}${field("Nombre del apoderado", "guardian", p?.guardian || "")}${field("Teléfono del apoderado", "phone", p?.phone || "", "tel")}${field("Instrucciones de recogida", "pickup", p?.pickup || "")}${field("Desde", "start", p?.start || "2026-11-04", "date")}${field("Hasta (incluido)", "end", p?.end || "2026-12-31", "date")}</div><div id="form-feedback" class="field-error" role="alert"></div></div>${footer(p ? "Guardar cambios" : "Agregar pasajero")}</form>`,
    { type: "passenger-form", id },
  );
}
function paymentDetail(id) {
  const p = model.payments.find((p) => p.id === Number(id));
  if (!p) return;
  openDialog(
    "Registro de pago #" + p.id,
    `<div class="dialog-body stack-sm"><div class="split"><h2>${money(p.amount)} CLP</h2>${badge({ paid: "Pagado · manual", pending: "Pendiente", void: "Anulado" }[p.status], p.status === "pending" ? "warn" : p.status === "paid" ? "good" : "")}</div>${dl([["Pasajero / asignación", `${esc(findPassenger(p.assignment)?.name)} · #${p.assignment}`], ["Período del servicio", `${p.start} al ${p.end}`], ["Vencimiento", p.due], ...(p.status === "paid" ? [["Registro manual", "Declarado por el conductor · 04 nov 2026"]] : [])])}<p class="small muted">FurgoPlus no verifica movimientos bancarios ni realiza cobros.</p><div class="actions">${p.status === "pending" ? button("payment-pay", "Marcar pagado", "primary", p.id) : ""}${p.status !== "void" ? button("payment-void", "Anular registro", "danger", p.id) : ""}</div></div>`,
  );
}
function routeForm(id, step = 1) {
  const r = findRoute(id);
  if (step === 1) routeDraft = r ? { ...r } : {};
  const d = routeDraft;
  openDialog(
    r ? "Editar ruta" : "Nueva ruta",
    `<form data-form="route-${step}"><input name="id" type="hidden" value="${r?.id || ""}"><div class="dialog-body stack-sm"><div class="stepper"><span class="${step === 1 ? "current" : ""}">1. Ruta y horario</span><span class="${step === 2 ? "current" : ""}">2. Cobertura y cupos</span></div>${
      step === 1
        ? `${field("Nombre de la ruta", "name", d.name || "")}${selectField(
            "Estado",
            "status",
            [
              ["Activa", "Activa"],
              ["Inactiva", "Inactiva"],
            ],
            d.status || "Activa",
          )}<div class="form-grid">${field("Hora de inicio", "time", d.time || "07:15", "time")}${field("Hora de término", "end", d.end || "08:00", "time")}</div><fieldset style="border:0;padding:0"><legend class="small">Días de servicio</legend><div class="actions">${["Lun", "Mar", "Mié", "Jue", "Vie"].map((t) => `<label class="check"><input name="day" value="${t}" type="checkbox" checked>${t}</label>`).join("")}</div></fieldset>`
        : `${field("Nombre del destino", "destination", d.destination || "")}${field("Dirección del destino (privada)", "address", d.address || "")}${selectField(
            "Comuna de cobertura",
            "commune",
            [
              ["La Florida", "La Florida"],
              ["Puente Alto", "Puente Alto"],
            ],
            d.commune || "La Florida",
          )}${field("Capacidad de pasajeros", "capacity", d.capacity || 12, "number", "Total de pasajeros permitido en esta ruta.")}`
    }<div id="form-feedback" class="field-error" role="alert"></div></div>${footer(step === 1 ? "Continuar" : "Guardar ruta")}</form>`,
    { type: "route", id, step },
  );
}
function guide() {
  openDialog(
    "Guía de revisión",
    `<div class="dialog-body stack-sm"><p class="small muted">Prototipo local · Datos sintéticos. Los cambios duran hasta recargar o pulsar Reiniciar.</p><div class="guide-links"><a href="${href("inicio", "conductor", "web")}"><strong>1. Operar en web</strong><br>Inicio → Solicitudes → aceptar contacto → Pasajeros → agregar → Pagos → registrar y confirmar.</a><a href="#web/conductor/documentos?estado=pendiente"><strong>2. Preparar el servicio</strong><br>Documentos → corregir credencial → enviar revisión → Admin → expediente → aprobar.</a><a href="${href("hoy", "conductor", "android")}"><strong>3. Revisar Android conductor</strong><br>Hoy → recorrido y pasajeros → iniciar → finalizar → Mi plan → Ayuda → cuenta.</a><a href="${href("buscar", "apoderado", "android")}"><strong>4. Revisar Android apoderado</strong><br>Buscar → comparar → detalle → solicitar contacto → Solicitudes. Responder desde web conductor.</a><a href="#web/conductor/pasajeros?estado=muchos"><strong>5. Revisar volumen y estados</strong><br>Usa el selector superior: muchos registros, pendientes, vacío, error, carga y resultado incierto.</a></div><div class="actions">${nav("inicio", "Apoderado web", "btn", "apoderado", "web")}${nav("ingresar", "Acceso web", "btn", "acceso", "web")}${nav("ingresar", "Acceso Android", "btn", "acceso", "android")}</div><p class="small muted">La aceptación visual corresponde a revisión humana. El prototipo no implementa cambios en React o Flutter.</p></div>`,
  );
}
function supportForm() {
  openDialog(
    "Nueva solicitud de soporte",
    `<form data-form="support"><div class="dialog-body stack-sm"><p class="small muted">Cuéntanos qué pasó, sin nombres de estudiantes ni contactos privados.</p>${field("Asunto", "subject")}${selectField(
      "Gravedad",
      "severity",
      [
        ["Normal", "Normal"],
        ["Baja", "Baja"],
        ["Alta", "Alta"],
        ["Crítica", "Crítica · seguridad"],
      ],
      "Normal",
    )}<label class="field">Descripción<textarea name="body" required placeholder="Describe el problema y el paso en que ocurrió"></textarea></label><label class="check privacy-check"><input type="checkbox" name="privacy" required>Revisé el texto y no contiene información privada.</label></div>${footer("Enviar solicitud")}</form>`,
  );
}
function performConfirmed(type, id, reason) {
  const p = model.payments.find((p) => p.id === Number(id));
  if (type === "pay" && p) {
    p.status = "paid";
    refreshToast("Pago registrado manualmente. Sin verificación bancaria.");
  }
  if (type === "void" && p) {
    p.status = "void";
    refreshToast("Registro anulado. No se mueve ni devuelve dinero.");
  }
  if (type === "accept" || type === "decline") {
    const r = model.requests.find((r) => r.id === Number(id));
    if (r) r.status = type === "accept" ? "accepted" : "declined";
    refreshToast(
      type === "accept"
        ? "Contacto aceptado. No se ha asignado ningún pasajero."
        : "Solicitud rechazada.",
    );
  }
  if (type === "cancel-request") {
    const r = parentRequestRows().find((r) => r.id === Number(id));
    if (r) r.status = "cancelled";
    refreshToast("Solicitud cancelada.");
  }
  if (type === "publication-off") {
    model.published = false;
    refreshToast(
      "Tu servicio dejó de mostrarse en las búsquedas de este ejemplo.",
    );
  }
  if (type === "run-end") {
    model.runStates[id] = "completed";
    refreshToast("Servicio finalizado por hoy.");
  }
  if (type.startsWith("account-")) {
    const rec = adminRecord(id);
    rec.accountStatus = {
      "account-suspend": "Suspendido",
      "account-activate": "Activo",
      "account-deactivate": "Desactivado",
    }[type];
    if (type !== "account-activate") rec.published = false;
    rec.audit.unshift({ title: "Estado: " + rec.accountStatus, reason });
    refreshToast("Estado del servicio actualizado en el prototipo.");
  }
  if (type === "approve" || type === "reject") {
    const rec = adminRecord(id);
    rec.review = type === "approve" ? "approved" : "rejected";
    rec.published = false;
    if (type === "reject") rec.observation = reason;
    rec.audit.unshift({
      title:
        type === "approve"
          ? "Información aprobada"
          : "Correcciones solicitadas",
      reason,
    });
    refreshToast(
      type === "approve"
        ? "Información aprobada. Publicación y plan se revisan por separado."
        : "Observaciones enviadas al conductor.",
    );
  }
  if (type === "resolve") {
    const t = tickets.find((t) => t.id === Number(id));
    if (t) {
      t.state = "Resuelta";
      t.events.push({
        by: "Equipo FurgoPlus",
        date: "04 nov · 09:00",
        text: "Resuelta: " + reason,
      });
    }
    refreshToast("Solicitud resuelta con su motivo.");
  }
  if (type === "logout") {
    closeDialog();
    location.hash = href("ingresar", "acceso", current.platform);
    toast("Salida simulada. Los datos del ejemplo permanecen hasta reiniciar.");
  }
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = el.dataset.action,
    id = el.dataset.id || "";
  if (el.tagName !== "INPUT") event.preventDefault();
  switch (action) {
    case "guide":
      guide();
      break;
    case "reset":
      resetModel(scene);
      render();
      toast("Datos sintéticos reiniciados.");
      break;
    case "close-dialog":
      closeDialog();
      break;
    case "menu":
      setMenuOpen(!$("#sidebar").classList.contains("open"));
      break;
    case "menu-close":
      setMenuOpen(false);
      break;
    case "retry":
      model.recovered.add(
        current.platform + "/" + current.role + "/" + current.page,
      );
      render();
      toast("Información recuperada.");
      break;
    case "page":
      pages[current.page] = Number(id);
      render(true);
      $(".result-heading")?.scrollIntoView({ block: "nearest" });
      break;
    case "clear-filters":
      filters[current.page] = {};
      pages[current.page] = 1;
      if (current.page === "pasajeros" && current.id) {
        location.hash = href("pasajeros");
      } else render(true);
      break;
    case "route-filter":
      setF("route", id);
      render(true);
      break;
    case "request-filter":
      setF("status", id);
      selectedRequest = null;
      render(true);
      break;
    case "request-select":
      selectedRequest = Number(id);
      render(true);
      break;
    case "request-accept":
      confirmDialog(
        "Aceptar contacto",
        `<p>El apoderado podrá consultar el correo de tu servicio:</p><strong>${esc(model.email)}</strong><p class="small muted">Aceptar no reserva un cupo ni agrega un pasajero. Coordina el acuerdo con la familia antes de registrar su asignación.</p>`,
        "accept",
        id,
        "Aceptar contacto",
      );
      break;
    case "request-decline":
      confirmDialog(
        "Rechazar solicitud",
        "<p>La solicitud quedará como rechazada y no habilitará el correo de tu servicio.</p>",
        "decline",
        id,
        "Rechazar solicitud",
        true,
      );
      break;
    case "request-cancel":
      confirmDialog(
        "Cancelar solicitud",
        "<p>El conductor ya no podrá aceptar esta solicitud. Podrás enviar una nueva si necesitas volver a coordinar.</p>",
        "cancel-request",
        id,
        "Cancelar solicitud",
        true,
      );
      break;
    case "passenger-new":
      passengerForm();
      break;
    case "passenger-detail":
      passengerDialog(id);
      break;
    case "passenger-edit":
      passengerForm(id);
      break;
    case "passenger-end": {
      const p = findPassenger(id);
      openDialog(
        "Finalizar asignación",
        `<form data-form="passenger-end"><input name="id" type="hidden" value="${id}"><div class="dialog-body stack-sm"><p>${esc(p.name)} · ${esc(findRoute(p.route)?.name)}</p>${field("Último día de traslado (incluido)", "end", "2026-11-04", "date")}<p class="small muted">La asignación se conserva como registro; no se elimina.</p></div>${footer("Confirmar finalización", true)}</form>`,
      );
      break;
    }
    case "payment-detail":
      paymentDetail(id);
      break;
    case "payment-pay": {
      const p = model.payments.find((p) => p.id === Number(id));
      confirmDialog(
        "Registrar manualmente como pagado",
        `${dl([
          ["Pasajero", esc(findPassenger(p.assignment)?.name)],
          ["Registro y monto", `#${p.id} · ${money(p.amount)} CLP`],
          ["Período", `${p.start} al ${p.end}`],
        ])}<p>Confirmas que recibiste el pago por fuera de FurgoPlus.</p>${notice("Registro manual", "FurgoPlus no verifica movimientos bancarios.")}`,
        "pay",
        id,
        "Confirmar registro como pagado",
      );
      break;
    }
    case "payment-void": {
      const p = model.payments.find((p) => p.id === Number(id));
      confirmDialog(
        "Anular registro",
        `<p>${esc(findPassenger(p.assignment)?.name)} · #${p.id} · <strong>${money(p.amount)} CLP</strong></p><p>El registro se conservará como anulado y no podrá volver a marcarse como pagado. Esta acción no devuelve dinero.</p>`,
        "void",
        id,
        "Anular registro",
        true,
      );
      break;
    }
    case "payment-new":
      openDialog(
        "Registrar pago pendiente",
        `<form data-form="payment"><div class="dialog-body stack-sm">${selectField(
          "Pasajero y asignación",
          "assignment",
          model.passengers.map((p) => [
            p.id,
            `${p.name} · ${findRoute(p.route)?.name} · #${p.id}`,
          ]),
        )}${field("Monto acordado (CLP)", "amount", "", "number")}<div class="form-grid">${field("Servicio desde", "start", "2026-11-01", "date")}${field("Servicio hasta", "end", "2026-11-30", "date")}${field("Fecha de vencimiento", "due", "2026-11-05", "date")}</div><p class="small muted">Registra un acuerdo. No genera un cobro bancario.</p><div id="form-feedback" class="field-error" role="alert"></div></div>${footer("Guardar pendiente")}</form>`,
      );
      break;
    case "route-new":
      routeForm();
      break;
    case "route-edit":
      routeForm(id);
      break;
    case "document-preview":
      openDialog(
        "Documento de muestra",
        `<div class="dialog-body"><div class="message"><div class="eyebrow">FurgoPlus · Documento sintético</div><h2 style="margin:16px 0">${["Identidad", "Vehículo", "Credencial"][Number(id)]}</h2><div class="skeleton"></div><div class="skeleton"></div><p>Documento ilustrativo sin datos personales ni valor legal.</p></div><p class="small muted">Los documentos reales mantienen su acceso privado en la aplicación.</p></div>`,
      );
      break;
    case "document-edit":
      if (id !== "2" || model.document === "ok") {
        openDialog(
          "Documento cargado",
          `<div class="dialog-body stack-sm"><p>Archivo privado de muestra. No contiene información personal.</p>${button("document-preview", "Abrir muestra", "", id)}${id === "2" ? button("replace-credential", "Reemplazar credencial", "quiet") : ""}</div>`,
        );
      } else {
        openCredential();
      }
      break;
    case "replace-credential":
      openCredential();
      break;
    case "submit-review":
      model.review = "pending";
      model.published = false;
      render();
      toast(
        "Información enviada a revisión. Puedes continuar desde web Admin → Validaciones.",
      );
      break;
    case "publication-on":
      if (publicationRequirements().every((r) => r[1])) {
        model.published = true;
        render();
        toast("Tu servicio es visible en este ejemplo.");
      }
      break;
    case "publication-off":
      confirmDialog(
        "Dejar de mostrar mi servicio",
        "<p>El servicio dejará de aparecer en nuevas búsquedas. Tus rutas, asignaciones y registros se conservan.</p>",
        "publication-off",
        "",
        "Dejar de mostrar",
      );
      break;
    case "plan-benefits":
      openDialog(
        "Beneficios del plan " + model.plan,
        `<div class="dialog-body">${dl([
          ["Operación", "Rutas, pasajeros y registros manuales de pago."],
          ["Ayuda y soporte", "Guías y atención según disponibilidad."],
          [
            "Reportes",
            model.plan === "Básico"
              ? "No incluidos"
              : model.plan === "Pro"
                ? "Resumen mensual"
                : "Resumen mensual, comparación y tres reportes Excel.",
          ],
        ])}<p class="small muted">Las funciones adicionales dependen del plan y su vigencia. Este prototipo no contrata ni cobra planes.</p></div>`,
      );
      break;
    case "demo-plan":
      model.plan = id;
      render(true);
      break;
    case "report-export":
      openDialog(
        "Descargar reporte Excel",
        `<form data-form="export"><div class="dialog-body stack-sm">${selectField(
          "Tipo de reporte",
          "kind",
          [
            ["pagos", "Pagos manuales"],
            ["recorridos", "Recorridos y cupos"],
            ["solicitudes", "Solicitudes de contacto"],
          ],
        )}<p class="small muted">En este prototipo se muestra la confirmación de la descarga. No se genera un archivo Excel ni se consulta un servidor.</p></div>${footer("Simular descarga")}</form>`,
      );
      break;
    case "support-new":
      supportForm();
      break;
    case "ticket-review": {
      const t = tickets.find((t) => t.id === Number(id));
      if (t) t.state = "En revisión";
      render();
      toast("Solicitud en revisión.");
      break;
    }
    case "ticket-resolve":
      confirmDialog(
        "Resolver solicitud",
        "<p>La respuesta y el historial permanecerán disponibles para el solicitante.</p>",
        "resolve",
        id,
        "Resolver solicitud",
        false,
        true,
      );
      break;
    case "account-suspend":
    case "account-activate":
    case "account-deactivate":
      confirmDialog(
        action === "account-suspend"
          ? "Suspender servicio"
          : action === "account-activate"
            ? "Activar servicio"
            : "Desactivar servicio",
        `<p>${action === "account-activate" ? "La cuenta vuelve a estar activa. Su publicación depende de los demás requisitos." : "El servicio dejará de ser visible. Los registros se conservan."}</p>`,
        action,
        id,
        "Confirmar cambio",
        action !== "account-activate",
        true,
      );
      break;
    case "admin-plan": {
      const rec = adminRecord(id);
      openDialog(
        "Editar plan del conductor",
        `<form data-form="admin-plan"><input name="driverId" type="hidden" value="${id}"><div class="dialog-body stack-sm">${selectField(
          "Plan asignado",
          "plan",
          [
            ["Básico", "Básico"],
            ["Pro", "Pro"],
            ["Elite", "Elite"],
          ],
          rec.plan,
        )}${selectField(
          "Estado administrativo",
          "status",
          [
            ["Vigente", "Activo"],
            ["Inactivo", "Inactivo"],
            ["Suspendido", "Suspendido"],
          ],
          (rec.planAdminStatus === "Activo"
            ? "Vigente"
            : rec.planAdminStatus) || rec.planStatus,
        )}<div class="form-grid">${field("Inicio", "start", rec.planStart || "2026-10-01", "date")}${field("Término", "end", rec.planEnd || "2026-12-31", "date")}</div><label class="field">Motivo<textarea name="reason" required></textarea></label><p class="small muted">El estado activo también requiere fechas vigentes. No habilita por sí solo la publicación.</p><div id="form-feedback" class="field-error" role="alert"></div></div>${footer("Revisar cambio")}</form>`,
      );
      break;
    }
    case "run-select":
      selectedRun = Number(id);
      render();
      break;
    case "run-start":
      model.runStates[id] = "in_progress";
      render(true);
      toast("Servicio iniciado.");
      break;
    case "run-end":
      confirmDialog(
        "¿Finalizar servicio?",
        `<p>${esc(findRoute(id)?.name)} · 04 nov 2026</p><p>El recorrido de hoy quedará finalizado. Confirma cuando hayas terminado el traslado.</p>`,
        "run-end",
        id,
        "Finalizar servicio",
      );
      break;
    case "run-recover":
      model.recovered.add("run" + id);
      model.runStates[id] = "in_progress";
      render();
      toast("Estado consultado: el servicio está en curso.");
      break;
    case "maps":
      openDialog(
        "Destino listo para mapas",
        `<div class="dialog-body stack-sm"><h3>${esc(findRoute(id)?.destination)}</h3><p>${esc(findRoute(id)?.address)}</p><p class="small muted">En Android esta acción abre la app de mapas. Aquí se simula sin enviar la dirección a un servicio externo.</p></div>`,
      );
      break;
    case "compare-toggle": {
      const n = Number(id);
      if (selectedServices.has(n)) selectedServices.delete(n);
      else if (selectedServices.size < 3) selectedServices.add(n);
      else {
        toast("Puedes comparar hasta tres servicios.");
        el.checked = false;
        break;
      }
      render(true);
      break;
    }
    case "compare-hint":
      toast("Selecciona al menos dos servicios para comparar.");
      break;
    case "parent-name":
      openDialog(
        "Editar nombre",
        `<form data-form="parent-name"><div class="dialog-body">${field("Nombre visible", "name", model.parentName)}</div>${footer("Guardar nombre")}</form>`,
      );
      break;
    case "legal":
      openDialog(
        id === "privacidad" ? "Política de privacidad" : "Términos de uso",
        `<div class="dialog-body stack-sm"><p>Vista ilustrativa del acceso al documento legal.</p><p class="small muted">Los textos legales vigentes se conservan en la aplicación existente. Este prototipo no reemplaza esos documentos ni solicita aceptación real.</p></div>`,
      );
      break;
    case "logout":
      confirmDialog(
        "Cerrar sesión",
        "<p>Volverás a la pantalla de acceso de muestra.</p>",
        "logout",
        "",
        "Cerrar sesión",
      );
      break;
    case "toggle-password": {
      const input = document.querySelector('input[name="password"]');
      if (input) input.type = el.checked ? "text" : "password";
      break;
    }
  }
});
function openCredential() {
  openDialog(
    "Actualizar credencial",
    `<form data-form="credential"><div class="dialog-body stack-sm">${notice("Observación del equipo", "La fecha no se lee con claridad. Carga una imagen completa.", "warn")}${selectField("Archivo de demostración", "file", [["legible", "Credencial sintética · imagen legible"]])}${field("Fecha de vencimiento", "expiry", "2026-12-31", "date")}<p class="small muted">Se utiliza un archivo ficticio del prototipo. No selecciones documentos personales.</p></div>${footer("Guardar documento")}</form>`,
  );
}
function formError(form, text) {
  let target = form.querySelector("#form-feedback");
  if (!target) {
    target = document.createElement("p");
    target.id = "form-feedback";
    target.className = "field-error";
    target.setAttribute("role", "alert");
    form
      .querySelector(".dialog-body,.panel-body,.form-section")
      ?.append(target);
  }
  target.textContent = text;
  target.scrollIntoView({ block: "nearest" });
}
document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form)),
    kind = form.dataset.form;
  if (kind === "confirm") {
    const { type, id } = dialogContext || {};
    if (type === "save-plan") {
      const v = dialogContext.pending,
        rec = adminRecord(v.driverId);
      rec.plan = v.plan;
      rec.planAdminStatus = v.status === "Vigente" ? "Activo" : v.status;
      rec.planStatus = v.status;
      rec.planStart = v.start;
      rec.planEnd = v.end;
      if (
        v.status === "Vigente" &&
        (v.start > "2026-11-04" || v.end < "2026-11-04")
      )
        rec.planStatus = v.start > "2026-11-04" ? "Aún no comienza" : "Vencido";
      rec.audit.unshift({
        title: "Plan " + v.plan + " · " + rec.planStatus,
        reason: v.reason,
      });
      if (rec.planStatus !== "Vigente") rec.published = false;
      refreshToast("Plan actualizado. Su publicación se evalúa por separado.");
      return;
    }
    performConfirmed(type, id, data.reason || dialogContext.reason || "");
    return;
  }
  if (kind === "service") {
    model.name = data.name;
    model.summary = data.summary;
    model.email = data.email;
    model.review = "rejected";
    model.observation =
      "Los datos del servicio fueron actualizados y requieren una nueva revisión.";
    model.published = false;
    location.hash = href("revision");
    toast("Datos guardados. Envía los cambios a revisión.");
  }
  if (kind === "credential") {
    model.document = "ok";
    model.documentExpiry = data.expiry;
    model.review = "rejected";
    model.published = false;
    refreshToast(
      "Credencial actualizada. Continúa a Revisión para enviar tus cambios.",
    );
  }
  if (kind === "passenger") {
    if (data.end < data.start)
      return formError(
        form,
        "La fecha de término debe ser igual o posterior al inicio.",
      );
    const route = findRoute(data.route);
    if (!route) return formError(form, "Primero configura una ruta.");
    let p = findPassenger(data.id);
    const today = "2026-11-04",
      active = data.start <= today && data.end >= today;
    if (active && route.used >= route.capacity && (!p || p.route !== route.id))
      return formError(
        form,
        "Esta ruta no tiene cupos para estas fechas. Elige otra ruta o revisa las asignaciones.",
      );
    const record = {
      name: data.name,
      guardian: data.guardian,
      phone: data.phone,
      pickup: data.pickup,
      start: data.start,
      end: data.end,
      route: Number(data.route),
      status:
        data.end < today
          ? "Finalizada"
          : data.start > today
            ? "Futura"
            : "Vigente",
    };
    if (p) Object.assign(p, record);
    else
      model.passengers.push({
        id: Math.max(0, ...model.passengers.map((p) => p.id)) + 1,
        ...record,
      });
    recountCapacity();
    refreshToast(
      p
        ? "Asignación actualizada."
        : "Pasajero asignado. Los cupos de la ruta se actualizaron.",
    );
  }
  if (kind === "passenger-end") {
    const p = findPassenger(data.id);
    if (data.end < p.start)
      return formError(
        form,
        "El término no puede ser anterior al inicio de la asignación.",
      );
    p.end = data.end;
    p.status = data.end < "2026-11-04" ? "Finalizada" : "Vigente";
    recountCapacity();
    refreshToast(
      "Término registrado. El último día indicado permanece incluido.",
    );
  }
  if (kind === "payment") {
    if (data.end < data.start)
      return formError(
        form,
        "Revisa el período: el término debe ser posterior o igual al inicio.",
      );
    if (!findPassenger(data.assignment))
      return formError(form, "Selecciona una asignación de pasajero.");
    model.payments.unshift({
      id: Math.max(500, ...model.payments.map((p) => p.id)) + 1,
      assignment: Number(data.assignment),
      amount: Number(data.amount),
      status: "pending",
      start: data.start,
      end: data.end,
      due: data.due,
    });
    refreshToast("Pago pendiente registrado.");
  }
  if (kind === "route-1") {
    if (data.end <= data.time)
      return formError(
        form,
        "La hora de término debe ser posterior al inicio.",
      );
    const days = new FormData(form).getAll("day");
    if (!days.length) return formError(form, "Selecciona al menos un día.");
    routeDraft = { ...routeDraft, ...data, days };
    routeForm(data.id, 2);
  }
  if (kind === "route-2") {
    const r = findRoute(data.id);
    if (Number(data.capacity) < (r?.used || 0))
      return formError(
        form,
        "La capacidad no puede quedar bajo los cupos ya utilizados.",
      );
    const record = {
      ...routeDraft,
      ...data,
      capacity: Number(data.capacity),
      status: routeDraft.status,
    };
    if (r) Object.assign(r, record, { id: r.id });
    else
      model.routes.push({
        ...record,
        id: Math.max(0, ...model.routes.map((r) => r.id)) + 1,
        used: 0,
      });
    const saved = r || model.routes.at(-1);
    if (saved.status === "Inactiva") model.routeInactive.add(saved.id);
    else model.routeInactive.delete(saved.id);
    refreshToast(
      r ? "Ruta actualizada." : "Ruta creada. Ya puedes asignar pasajeros.",
    );
  }
  if (kind === "validation") {
    const decision = event.submitter?.value === "reject" ? "reject" : "approve";
    if (decision === "reject" && !data.comment.trim())
      return formError(
        form,
        "Escribe qué debe corregir el conductor antes de solicitar cambios.",
      );
    confirmDialog(
      decision === "approve" ? "Aprobar información" : "Solicitar correcciones",
      `<p>${decision === "approve" ? "Confirmas la revisión de los datos y documentos de este envío. No publica ni activa el plan." : esc(data.comment)}</p>`,
      decision,
      data.driverId,
      decision === "approve" ? "Confirmar aprobación" : "Enviar observaciones",
    );
    dialogContext.reason = data.comment;
  }
  if (kind === "admin-plan") {
    if (data.end < data.start)
      return formError(
        form,
        "La fecha de término debe ser posterior o igual al inicio.",
      );
    const pending = { ...data };
    confirmDialog(
      "Confirmar cambio de plan",
      `${dl([
        ["Plan", esc(data.plan)],
        ["Estado", esc(data.status)],
        ["Fechas", `${data.start} al ${data.end}`],
        ["Motivo", esc(data.reason)],
      ])}<p class="small muted">El cambio quedará en el historial.</p>`,
      "save-plan",
      "",
      "Guardar plan",
    );
    dialogContext.pending = pending;
  }
  if (kind === "export") {
    refreshToast(
      "Descarga de " + data.kind + " simulada. No se generó un archivo.",
    );
  }
  if (kind === "support") {
    const id = Math.max(204, ...tickets.map((t) => t.id)) + 1;
    tickets.unshift({
      id,
      subject: data.subject,
      severity: data.severity,
      state: "Abierta",
      message: data.body,
      events: [
        {
          by: current.role === "administrador" ? "Equipo FurgoPlus" : "Tú",
          text: data.body,
          date: "04 nov · 09:00",
        },
      ],
    });
    closeDialog();
    location.hash = href("ticket", current.role, current.platform, id);
    toast("Solicitud enviada al equipo.");
  }
  if (kind === "ticket-reply") {
    const t = tickets.find((t) => t.id === Number(data.ticketId));
    t.events.push({
      by: current.role === "administrador" ? "Equipo FurgoPlus" : "Tú",
      text: data.body,
      date: "04 nov · 09:00",
    });
    if (current.role !== "administrador") t.state = "En revisión";
    render(true);
    toast("Respuesta agregada a la conversación.");
  }
  if (kind === "parent-search") {
    setF("commune", data.commune);
    searched = true;
    render(true);
  }
  if (kind === "contact") {
    const serviceId = Number(data.serviceId),
      id = Math.max(104, ...model.requests.map((r) => r.id)) + 1;
    const r = {
      id,
      serviceId,
      name: model.parentName,
      status: "pending",
      date: "04 nov · 09:00",
      message: data.message,
      email: "familia.vega@example.test",
    };
    model.parentRequests.push(r);
    if (serviceId === 1) model.requests.unshift(r);
    location.hash = href("solicitud", "apoderado", "android", id);
    toast("Solicitud enviada. No se ha reservado un cupo.");
  }
  if (kind === "parent-name") {
    const old = model.parentName;
    model.parentName = data.name;
    model.requests
      .filter((r) => r.name === old)
      .forEach((r) => (r.name = data.name));
    refreshToast("Nombre visible actualizado.");
  }
  if (kind === "login") {
    const platform = current.platform;
    const parent =
      current.page === "registro" || data.email.includes("familia");
    if (data.name) model.parentName = data.name;
    location.hash = href(
      platform === "android"
        ? parent
          ? "buscar"
          : "hoy"
        : parent
          ? "inicio"
          : "inicio",
      parent ? "apoderado" : "conductor",
      platform,
    );
    toast("Sesión de muestra iniciada.");
  }
});
function recountCapacity() {
  for (const r of model.routes)
    r.used = model.passengers.filter(
      (p) =>
        p.route === r.id && p.start <= "2026-11-04" && p.end >= "2026-11-04",
    ).length;
}
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.dataset.filter && el.tagName === "INPUT") {
    setF(el.dataset.filter, el.value);
    render(true);
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.id === "scene-select") {
    const next = el.value;
    const path = location.hash.slice(1).split("?")[0] || "web/conductor/inicio";
    location.hash = "#" + path + (next === "normal" ? "" : "?estado=" + next);
    return;
  }
  if (el.dataset.filter && el.tagName === "SELECT") {
    setF(el.dataset.filter, el.value);
    render(true);
  }
});
$("#dialog").addEventListener("close", () => {
  if (!$("#dialog").open) {
    dialogContext = null;
    $("#dialog").innerHTML = "";
  }
});
function setMenuOpen(open) {
  const sidebar = $("#sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  $(".workspace").inert = open;
  $("#review-bar").inert = open;
  $(".menu-toggle").setAttribute("aria-expanded", String(open));
  if (open) {
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    sidebar.setAttribute("aria-label", "Navegación del producto");
    $(".menu-close").focus();
  } else {
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    sidebar.removeAttribute("aria-label");
    $(".menu-toggle").focus({ preventScroll: true });
  }
}

document.addEventListener("keydown", (event) => {
  const sidebar = $("#sidebar.open");
  if (!sidebar || $("#dialog").open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    setMenuOpen(false);
  } else if (event.key === "Tab") {
    const controls = Array.from(
      sidebar.querySelectorAll("a[href],button"),
    ).filter((control) => control.getClientRects().length && !control.disabled);
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
const menuLayout = matchMedia("(max-width: 48rem)");
menuLayout.addEventListener("change", () => {
  if ($("#sidebar.open")) setMenuOpen(false);
});

// Review chrome and the visual viewport can change independently of CSS width
// (text scaling, orientation, browser chrome and the on-screen keyboard).
function syncViewport() {
  const root = document.documentElement;
  const height = window.visualViewport?.height || innerHeight;
  root.style.setProperty(
    "--review-height",
    `${$("#review-bar").getBoundingClientRect().height}px`,
  );
  root.style.setProperty("--usable-height", `${height}px`);
  root.style.setProperty(
    "--visual-top",
    `${window.visualViewport?.offsetTop || 0}px`,
  );
  root.classList.toggle("short-viewport", height <= 512);
}
new ResizeObserver(syncViewport).observe($("#review-bar"));
window.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("resize", () => {
  syncViewport();
  const input = document.activeElement;
  if (input?.matches("input:not([type=checkbox]),textarea,select"))
    requestAnimationFrame(() => input.scrollIntoView({ block: "nearest" }));
});
window.visualViewport?.addEventListener("scroll", syncViewport);

// Fragment navigation can revisit the same URL without firing hashchange.
// Clear transient modal state on navigation, never on viewport resize.
window.addEventListener("popstate", () => {
  if ($("#dialog").open) closeDialog();
});
window.addEventListener("hashchange", () => {
  closeDialog();
  render();
});
render();
syncViewport();
