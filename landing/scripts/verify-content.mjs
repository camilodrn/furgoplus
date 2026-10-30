import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const html = await readFile(`${dist}index.html`, "utf8");
const { document } = new JSDOM(html).window;
assert.equal(document.documentElement.lang, "es-CL");
assert.equal(document.querySelectorAll("h1").length, 1);
assert.equal(document.querySelectorAll("main").length, 1);
// Permanent editorial guardrails: see EDITORIAL_GUIDELINES.md. These protect
// structure and brevity; meaning and visual hierarchy still need human review.
for (const section of document.querySelectorAll("main > section")) {
  assert.equal(
    section.querySelectorAll("h1, h2").length,
    1,
    "One primary heading per section",
  );
}
for (const list of document.querySelectorAll("main ul")) {
  if (list.closest("details")) continue;
  assert.ok(
    list.children.length <= 3,
    "At most three visible benefits per block",
  );
}
assert.ok(
  document.querySelector(".steps").children.length <= 3,
  "At most three visible steps",
);
const sentences = new Intl.Segmenter("es", { granularity: "sentence" });
for (const subtitle of document.querySelectorAll(
  ".hero-description, .solution-copy > p, .product-heading > p, .benefit-column > p, .how-heading > p, .plans-heading-aside > p, .faq-heading > p, .step > p, .cta-inner > p",
)) {
  assert.ok(
    [...sentences.segment(subtitle.textContent.trim())].length <= 1,
    "Subtitles must stay within one sentence",
  );
}

// Vehicle geometry: both visible wheels must sit on the same longitudinal
// plane, with aligned centres and a ground shadow beneath both contact points.
const van = document.querySelector(".illustrated-van");
const wheels = [...van.querySelectorAll(".van-wheel")];
assert.equal(wheels.length, 2);
assert.equal(
  wheels[0].parentElement,
  wheels[1].parentElement,
  "Wheels share one side plane",
);
const matrix = wheels[0].parentElement
  .getAttribute("transform")
  .match(/^matrix\(([^)]+)\)$/)[1]
  .split(/[ ,]+/)
  .map(Number);
assert.equal(matrix.length, 6);
const [a, b, c, d, e, f] = matrix;
const centres = wheels.map((wheel) => {
  const translation = wheel
    .getAttribute("transform")
    .match(/^translate\(([^)]+)\)$/);
  assert.ok(
    translation,
    "Wheels use the side plane without independent rotation",
  );
  return translation[1].split(/[ ,]+/).map(Number);
});
assert.equal(centres[0][1], centres[1][1], "Both axles align along the sill");
const shadow = van.querySelector(".van-shadow");
assert.equal(
  van.firstElementChild,
  shadow,
  "Ground shadow stays behind the vehicle",
);
const shadowCX = Number(shadow.getAttribute("cx"));
const shadowCY = Number(shadow.getAttribute("cy"));
const shadowRX = Number(shadow.getAttribute("rx"));
const shadowRY = Number(shadow.getAttribute("ry"));
const angle =
  (Number(shadow.getAttribute("transform").match(/^rotate\(([-\d.]+)/)[1]) *
    Math.PI) /
  180;
const cos = Math.cos(angle),
  sin = Math.sin(angle);
for (const [i, wheel] of wheels.entries()) {
  const [tire, hub] = wheel.querySelectorAll("ellipse");
  const rx = Number(tire.getAttribute("rx"));
  const ry = Number(tire.getAttribute("ry"));
  assert.ok(
    rx > Number(hub.getAttribute("rx")) && ry > Number(hub.getAttribute("ry")),
  );
  assert.ok(
    Math.abs(centres[0][0] - centres[1][0]) > 2 * rx,
    "Distinct front and rear axles",
  );
  const [x, y] = centres[i];
  const lowerRadius = Math.hypot(b * rx, d * ry);
  const contactX =
    a * x + c * y + e + (a * b * rx ** 2 + c * d * ry ** 2) / lowerRadius;
  const contactY = b * x + d * y + f + lowerRadius;
  const dx = contactX - shadowCX,
    dy = contactY - shadowCY;
  const onGround =
    ((dx * cos + dy * sin) / shadowRX) ** 2 +
    ((-dx * sin + dy * cos) / shadowRY) ** 2;
  assert.ok(onGround <= 1, "Each tire meets the same ground shadow");
}
assert.equal(
  [...document.querySelector("h1").childNodes]
    .map((node) => (node.nodeName === "BR" ? " " : node.textContent))
    .join("")
    .replace(/\s+/g, " ")
    .trim(),
  "Un buen día empieza con un buen trayecto.",
);
assert.match(
  document.querySelector('meta[name="description"]').content,
  /proyecto chileno/,
);
assert.equal(
  document.querySelector('meta[name="robots"]').content,
  "noindex, nofollow",
);
const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
for (const link of document.querySelectorAll("a[href]")) {
  const href = link.getAttribute("href");
  if (!href.startsWith("#")) {
    assert.equal(href, "https://demo.furgoplus.cl", `Unexpected external/private link: ${href}`);
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener noreferrer");
    continue;
  }
  assert.ok(document.getElementById(href.slice(1)), `Broken anchor: ${href}`);
  const target = document.getElementById(href.slice(1));
  if (target.matches("main, section"))
    assert.equal(target.getAttribute("tabindex"), "-1", "Section links have a keyboard focus destination");
}
for (const element of document.querySelectorAll(
  "[aria-controls], [aria-labelledby], [aria-describedby]",
)) {
  for (const attribute of [
    "aria-controls",
    "aria-labelledby",
    "aria-describedby",
  ]) {
    for (const id of (element.getAttribute(attribute) ?? "")
      .split(/\s+/)
      .filter(Boolean)) {
      assert.ok(document.getElementById(id), `Missing ARIA target: ${id}`);
    }
  }
}
for (const button of document.querySelectorAll("button")) {
  assert.ok(
    (button.getAttribute("aria-label") ?? button.textContent).trim(),
    "Button without a name",
  );
}
assert.equal(document.querySelectorAll("#preguntas details").length, 6);
assert.equal(document.querySelectorAll(".plan").length, 3);
assert.equal(
  document.querySelectorAll("form, input").length,
  0,
  "No data collection in the landing",
);
const priceButtons = [
  ...document.querySelectorAll(".plans-heading .pricing-view button"),
];
assert.deepEqual(
  priceButtons.map((button) => button.textContent.trim()),
  ["IVA incluido", "Desglose"],
);
assert.deepEqual(
  priceButtons.map((button) => button.getAttribute("aria-pressed")),
  ["true", "false"],
);
assert.equal(
  document.querySelector("#pricing-view-help, .pricing-view legend"),
  null,
);
assert.equal(document.querySelectorAll(".plan-breakdown").length, 0);
for (const [id, price] of [
  ["basic", "$19.990"],
  ["pro", "$39.990"],
  ["elite", "$69.990"],
]) {
  assert.match(
    document.querySelector(`.plan-${id} .plan-price`).textContent,
    new RegExp(price.replace(/[.$]/g, "\\$&")),
  );
}
assert.match(
  document.querySelector("#pricing-academic-note").textContent,
  /Precios referenciales con IVA, sin contratación habilitada/,
);
assert.match(
  document.querySelector("#pricing-academic-note").textContent,
  /Informes mensuales desde Pro; informes avanzados y archivos XLSX en Elite\. Asistentes experimentales, sin servicio comercial disponible/,
  "Academic implementation, experiments and commercial availability must be distinct",
);
for (const code of ["pro", "elite"])
  assert.equal(
    document.querySelector(`.plan-${code} .plan-label`).textContent,
    "MVP académico",
    "Implemented academic capabilities must not be presented as future work",
  );
assert.match(
  document.querySelector(".parent-pricing").textContent,
  /Acceso inicial gratuito/,
);
assert.equal(document.querySelectorAll(".pricing-feature.future").length, 0);
assert.equal(
  document.querySelectorAll(".pricing-feature.testing").length,
  1,
  "The highlighted FAQ assistant remains experimental despite implemented permissions",
);
assert.match(
  document.querySelector(".plan-pro .pricing-feature.testing").textContent,
  /Asistente FAQ automatizado.*Experimental/,
);
const rows = [...document.querySelectorAll(".comparison-details tbody tr")];
const expectedCapabilities = [
  ["Publicación, rutas, solicitudes y registro manual de pagos", "available", [true, true, true]],
  ["Informes mensuales", "available", [false, true, true]],
  ["Informes avanzados y comparación con el mes anterior", "available", [false, false, true]],
  ["Tres tipos de exportación XLSX", "available", [false, false, true]],
  ["Asistente FAQ automatizado", "testing", [false, true, true]],
  ["Asistente contextual", "testing", [false, false, true]],
];
assert.equal(rows.length, expectedCapabilities.length);
for (const [i, [label, status, included]] of expectedCapabilities.entries()) {
  assert.equal(rows[i].querySelector("th").firstChild.textContent, label);
  assert.equal(
    rows[i].querySelector(".maturity").textContent,
    status === "available" ? "Implementado en MVP académico" : "Experimental",
  );
  const cells = [...rows[i].querySelectorAll("td")];
  assert.deepEqual(cells.map((cell) => !!cell.querySelector("svg")), included);
  for (const [j, cell] of cells.entries()) {
    if (included[j]) assert.equal(
      cell.querySelector(".sr-only").textContent,
      status === "available" ? "Implementado en MVP académico" : "Experimental",
    );
    else assert.ok(cell.querySelector('[aria-label="No contemplado en este plan"]'));
  }
}
assert.match(
  document.querySelector(".comparison-footnote").textContent,
  /tres tipos de XLSX: pagos manuales, recorridos\/cupos y solicitudes de contacto; no es un cupo de tres descargas al mes.*Básico no incluye informes mensuales/,
);
assert.match(
  document.querySelector("#pregunta-planes").textContent,
  /sin contratación ni disponibilidad comercial habilitadas.*Básico no incluye informes mensuales; Pro y Elite sí.*Elite añade informes avanzados y archivos XLSX para hojas de cálculo.*experimentales.*falta completar su integración y experiencia de uso/s,
);
assert.doesNotMatch(
  document.querySelector("#planes").textContent + document.querySelector("#pregunta-planes").textContent,
  /cambiar de plan no añade funciones|Ampliación futura|extras de Pro y Elite son futuros/,
);
assert.equal(document.querySelector("main .milestones"), null);
assert.match(
  document.querySelector("dialog #project-milestones").textContent,
  /2026.*2027/s,
);
assert.match(
  document.querySelector("dialog #project-milestones").textContent,
  /Aspiramos/,
);
assert.equal(
  [...document.querySelectorAll("main > section")][2].id,
  "producto",
  "The demo follows the proposition",
);
assert.equal(
  document.querySelector(".hero-actions .button").textContent.trim(),
  "Ver cómo funciona",
);
assert.equal(
  document.querySelector(".hero-actions .button").getAttribute("href"),
  "#producto",
);
assert.equal(
  document.querySelectorAll(".product-layout a").length,
  0,
  "Illustrative logos are not extra CTAs",
);
assert.equal(
  document.querySelector(
    ".pricing-context, .plan-availability, .plan-feature-group, .plan-state",
  ),
  null,
);
assert.equal(
  document.querySelector("#plans-title").textContent.trim(),
  "Un plan para cada etapa.",
);
const pricingBody = document.querySelector(".plans-heading").nextElementSibling;
assert.equal(
  [...pricingBody.children].find((el) => !el.classList.contains("sr-only")).id,
  "pricing-cards",
  "Cards must be the first visible content after the heading",
);
for (const plan of document.querySelectorAll(".plan")) {
  assert.equal(
    plan.querySelectorAll(".pricing-feature").length,
    3,
    "Three brief highlights per card",
  );
  assert.equal(plan.getAttribute("aria-describedby"), "pricing-academic-note");
}
for (const feature of document.querySelectorAll(".pricing-feature.future"))
  assert.match(feature.textContent, /Futuro/);
assert.equal(document.querySelectorAll("#pricing-academic-note").length, 1);
assert.match(
  document.querySelector(".comparison-details").textContent,
  /Implementado en MVP académico.*activación manual.*documentos vigentes.*Experimental:.*permisos y lógica.*integración y UX siguen pendientes de cierre.*Disponibilidad comercial futura:.*no habilitada.*sin fecha confirmada.*no certifica permisos, seguros ni seguridad/s,
);
for (const list of document.querySelectorAll(".benefit-column .feature-list"))
  assert.equal(list.children.length, 3);
assert.equal(document.querySelectorAll(".step-note").length, 0);
assert.ok(
  document.querySelectorAll('img[src="/brand/furgoplus-logo.png"]').length >= 4,
);
for (const element of document.querySelectorAll(
  'link[href], script[src], img[src], meta[property="og:image"]',
)) {
  const path =
    element.getAttribute("href") ??
    element.getAttribute("src") ??
    element.getAttribute("content");
  assert.ok(
    path.startsWith("/") && !path.startsWith("//"),
    `External resource: ${path}`,
  );
  assert.ok(
    (await stat(`${dist}${path.slice(1)}`)).isFile(),
    `Missing resource: ${path}`,
  );
}
const sizes = {};
for (const file of await readdir(`${dist}assets`)) {
  if (file.endsWith(".js") || file.endsWith(".css"))
    sizes[file] = (await stat(`${dist}assets/${file}`)).size;
}
assert.ok(
  Object.entries(sizes)
    .filter(([name]) => name.endsWith(".js"))
    .every(([, size]) => size < 300_000),
  "JS budget exceeded",
);
assert.ok(
  Object.entries(sizes)
    .filter(([name]) => name.endsWith(".css"))
    .every(([, size]) => size < 60_000),
  "CSS budget exceeded",
);
for (const file of [
  "AdwaitaSans-Regular.woff",
  "LiberationSerif-Italic.woff",
]) {
  const buffer = await readFile(`${dist}fonts/${file}`);
  assert.equal(buffer.subarray(0, 4).toString(), "wOFF");
  assert.equal(buffer.readUInt32BE(8), buffer.length, "Invalid WOFF length");
}
const brand = await readFile(`${dist}brand/furgoplus-logo.png`);
const authorizedBrand = await readFile(
  new URL("../../web/public/brand/furgoplus-logo.png", import.meta.url),
);
assert.equal(
  createHash("sha256").update(brand).digest("hex"),
  createHash("sha256").update(authorizedBrand).digest("hex"),
  "Use the existing authorized artwork without alteration",
);
for (const [file] of Object.entries(sizes).filter(([name]) =>
  name.endsWith(".css"),
)) {
  const css = await readFile(`${dist}assets/${file}`, "utf8");
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const target = match[1].replace(/["']/g, "").trim();
    assert.ok(
      target.startsWith("/") && !target.startsWith("//"),
      `External CSS resource: ${target}`,
    );
    assert.ok((await stat(`${dist}${target.slice(1)}`)).isFile());
  }
  assert.doesNotMatch(css, /@import\s/, "No external CSS imports");
  assert.doesNotMatch(
    css,
    /scale\(0\./,
    "Devices must not be shrunk for layout",
  );
}
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sourceFiles(`${directory}/${entry.name}`)
          : [`${directory}/${entry.name}`],
      ),
    )
  ).flat();
}
for (const file of await sourceFiles(
  fileURLToPath(new URL("../src/", import.meta.url)),
)) {
  const source = await readFile(file, "utf8");
  assert.doesNotMatch(
    source,
    /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|document\.cookie)/,
    `Unexpected network or persistence code: ${file}`,
  );
}
console.log(
  "PASS: prerender, semantic structure, anchors, ARIA references, named buttons, local resources, pricing, maturity, secondary project information and privacy source checks.",
);
console.log("Asset sizes (uncompressed bytes):", sizes);
console.log(
  "These checks do not validate browser layout, actual contrast, screen-reader behavior or motion quality.",
);
