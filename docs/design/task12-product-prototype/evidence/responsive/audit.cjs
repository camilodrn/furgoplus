/* Review tooling only. No dependency is added to the operational project. */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const out = __dirname;
const base = pathToFileURL(path.resolve(out, "../../index.html")).href;
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
const routes = [
  "web/conductor/inicio",
  "web/conductor/servicio",
  "web/conductor/datos",
  "web/conductor/documentos",
  "web/conductor/rutas",
  "web/conductor/pasajeros",
  "web/conductor/pagos",
  "web/conductor/solicitudes",
  "web/conductor/plan",
  "web/conductor/ayuda",
  "web/administrador/validaciones",
  "web/administrador/expediente/1",
  "web/administrador/conductores",
  "web/administrador/conductor/1",
  "web/administrador/ayuda",
  "android/conductor/hoy",
  "android/conductor/recorrido/1",
  "android/conductor/pasajeros/1",
  "android/conductor/plan",
  "android/conductor/cuenta",
  "android/apoderado/buscar",
  "android/apoderado/servicio/1",
  "android/apoderado/comparar",
  "android/apoderado/contacto/1",
  "android/apoderado/solicitudes",
  "android/apoderado/cuenta",
  "android/acceso/registro",
  "web/acceso/ingresar",
];
const representative = [
  "web/conductor/pasajeros",
  "web/administrador/validaciones",
  "android/conductor/hoy",
  "android/apoderado/buscar",
];
const cases = [];
const add = (route, width, height, kind = "viewport", extra = {}) =>
  cases.push({ route, width, height, kind, ...extra });
for (const width of widths)
  for (const route of routes) add(route, width, width < 768 ? 844 : 1000);
for (const width of [
  450, 451, 600, 759, 760, 761, 767, 769, 959, 960, 961, 999, 1000, 1001, 1023,
  1025, 1250, 1251, 1599, 1600,
])
  for (const route of representative) add(route, width, 900, "intermediate");
for (const [width, height] of [
  [568, 320],
  [844, 390],
  [932, 430],
])
  for (const route of [...representative, "android/apoderado/contacto/1"])
    add(route, width, height, "landscape");
for (const state of ["vacio", "carga", "error", "muchos"])
  for (const route of representative)
    for (const width of [320, 768, 1440])
      add(`${route}?estado=${state}`, width, width < 768 ? 844 : 1000, "state");
for (const route of [
  ...representative,
  "android/apoderado/contacto/1",
  "web/administrador/expediente/1",
])
  for (const width of [320, 768, 1440])
    add(route, width, 900, "text-200", { textScale: 200 });
// Effective CSS widths model reflow at desktop zoom; they do NOT certify real browser zoom.
for (const width of [640, 720, 960])
  for (const route of representative)
    add(route, width, 500, "zoom-reflow-approximation");
for (const [route, action] of [
  ["web/conductor/pasajeros", "passenger-new"],
  ["web/conductor/ayuda", "support-new"],
  ["web/administrador/conductor/1", "admin-plan"],
  ["android/conductor/cuenta", "logout"],
])
  for (const [width, height] of [
    [320, 480],
    [844, 320],
    [1440, 900],
  ])
    add(route, width, height, "dialog", { action });
for (const route of ["web/conductor/inicio", "web/administrador/validaciones"])
  for (const width of [320, 768, 1024]) add(route, width, 844, "navigation");

const report = {
  timestamp: new Date().toISOString(),
  status: "pending",
  method: "Playwright; file://; Chromium; no server or app APIs",
  limitations: [
    "Real browser zoom at 200% must be checked manually.",
    "Reduced viewport height models available space, not a native mobile keyboard.",
    "Screenshots require human inspection for visual overlap and reading order.",
    "Android here is HTML, not Flutter, TalkBack or a physical device.",
  ],
  cases: cases.map((item) => ({ ...item, status: "pending" })),
  captures: [],
  errors: [],
};
function save() {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function audit(page) {
  return page.evaluate(() => {
    const visible = (el) =>
      el.getClientRects().length &&
      getComputedStyle(el).visibility !== "hidden";
    const label = (el) =>
      el.getAttribute("aria-label") ||
      el.textContent.trim().slice(0, 70) ||
      el.name;
    const mobile = document.querySelector(".mobile-content");
    const main = document.querySelector("#main");
    const controls = [
      ...document.querySelectorAll(
        "#main .btn, #main .text-button, #main .back-link, #main summary, #main .pager button, " +
          "#main select, .bottom-nav a, .appbar a, .menu-toggle, #dialog[open] button, #dialog[open] input:not([type=hidden]), #dialog[open] select",
      ),
    ].filter(visible);
    const smallTargets = controls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 43.9 || r.height < 43.9;
      })
      .map(label);
    const clippedButtons = [...document.querySelectorAll("button,.btn")]
      .filter(visible)
      .filter(
        (el) =>
          el.scrollHeight > el.clientHeight + 2 ||
          el.scrollWidth > el.clientWidth + 2,
      )
      .map(label);
    const formOverflow = [
      ...document.querySelectorAll(
        ".field input,.field select,.field textarea",
      ),
    ]
      .filter(visible)
      .filter((el) => {
        const a = el.getBoundingClientRect(),
          b = el.closest(".field").getBoundingClientRect();
        return a.width > b.width + 1 || a.left < b.left - 1;
      })
      .map(label);
    const meters = [...document.querySelectorAll("[role=meter]")].filter(
      visible,
    );
    const badMeters = meters
      .filter((el) => {
        const r = el.getBoundingClientRect(),
          fill = el.firstElementChild.getBoundingClientRect();
        return (
          r.width < 24 ||
          r.height < 6 ||
          fill.width > r.width + 1 ||
          fill.height !== r.height
        );
      })
      .map(label);
    return {
      headings: document.querySelectorAll("h1").length,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      mobileOverflow: !!mobile && mobile.scrollWidth > mobile.clientWidth + 1,
      mainWidth: main?.clientWidth,
      smallTargets,
      clippedButtons,
      formOverflow,
      badMeters,
      tables: [...document.querySelectorAll("table")].map((table) => ({
        display: getComputedStyle(table).display,
        allCellsLabelled: [...table.querySelectorAll("td")].every((td) =>
          td.hasAttribute("data-label"),
        ),
      })),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        visualHeight: visualViewport?.height,
      },
    };
  });
}
(async () => {
  let browser;
  try {
    const { chromium } = require(
      process.env.FURGOPLUS_PLAYWRIGHT || "playwright",
    );
    browser = await chromium.launch({
      headless: true,
      ...(process.env.FURGOPLUS_CHROMIUM
        ? { executablePath: process.env.FURGOPLUS_CHROMIUM }
        : {}),
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    report.browser = browser.version();
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push(m.text());
    });
    page.on("request", (r) => {
      if (!r.url().startsWith("file:") && !r.url().startsWith("data:"))
        report.errors.push(`Unexpected request: ${r.method()} ${r.url()}`);
    });
    const go = async (item) => {
      await page.setViewportSize({ width: item.width, height: item.height });
      await page.goto(base + "#" + item.route);
      await page.locator("h1").waitFor();
      if (item.textScale)
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = size + "%";
        }, item.textScale);
      if (item.route.includes("/comparar"))
        await page.evaluate(() => {
          selectedServices = new Set([1, 2, 3]);
          render();
        });
      if (
        item.route.includes("/apoderado/buscar") &&
        !/[?]estado=(error|carga)/.test(item.route)
      )
        await page
          .getByRole("button", { name: "Buscar servicios", exact: true })
          .click();
      // Two animation frames let fonts, the ResizeObserver and layout settle.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    };
    for (const item of report.cases) {
      try {
        await go(item);
        if (item.action) {
          await page.locator(`[data-action="${item.action}"]`).first().click();
          await page.locator("dialog[open]").waitFor();
          const lastInput = page
            .locator("dialog input:not([type=hidden]),dialog textarea")
            .last();
          if (await lastInput.count()) await lastInput.focus();
        }
        if (item.kind === "navigation" && item.width <= 768) {
          await page.locator(".menu-toggle").click();
          await page.keyboard.press("Shift+Tab");
          item.focusContained = await page.evaluate(
            () => !!document.activeElement.closest("#sidebar"),
          );
          await page.keyboard.press("Escape");
          item.closedWithEscape = await page
            .locator("#sidebar")
            .evaluate((el) => !el.classList.contains("open"));
        }
        item.measurements = await audit(page);
        const m = item.measurements;
        item.status =
          m.headings === 1 &&
          !m.pageOverflow &&
          !m.mobileOverflow &&
          !m.smallTargets.length &&
          !m.clippedButtons.length &&
          !m.formOverflow.length &&
          !m.badMeters.length &&
          m.tables.every((t) => t.allCellsLabelled) &&
          item.focusContained !== false &&
          item.closedWithEscape !== false
            ? "automated-pass-human-review-pending"
            : "fail";
      } catch (e) {
        item.status = "fail";
        item.error = e.message;
      }
    }
    const captures = [];
    for (const route of representative)
      for (const width of [320, 390, 768, 1440, 1920])
        captures.push({
          route,
          width,
          height: width < 768 ? 844 : 1000,
          kind: "capture",
        });
    captures.push(
      {
        route: "android/apoderado/contacto/1",
        width: 844,
        height: 390,
        kind: "landscape",
      },
      {
        route: "web/conductor/pasajeros",
        width: 320,
        height: 480,
        kind: "dialog",
        action: "passenger-new",
      },
      {
        route: "web/administrador/expediente/1",
        width: 768,
        height: 1000,
        kind: "text-200",
        textScale: 200,
      },
      {
        route: "android/apoderado/comparar",
        width: 320,
        height: 844,
        kind: "compare-three",
      },
    );
    for (const item of captures) {
      await go(item);
      if (item.action)
        await page.locator(`[data-action="${item.action}"]`).first().click();
      await page.evaluate(() => document.activeElement?.blur());
      const file = `${item.route.replaceAll("/", "-")}-${item.width}x${item.height}-${item.kind}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      report.captures.push({ ...item, file });
    }
    const links = report.captures
      .map(
        (c) =>
          `<figure><figcaption>${c.route} · ${c.width} × ${c.height} · ${c.kind}</figcaption><a href="${c.file}"><img loading="lazy" src="${c.file}" alt="${c.route}"></a></figure>`,
      )
      .join("\n");
    fs.writeFileSync(
      path.join(out, "gallery.html"),
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capturas responsive</title><style>body{font:1rem system-ui;margin:1rem;background:#f5f7fb;color:#202b3a}main{display:flex;flex-wrap:wrap;gap:1rem}figure{margin:0;width:min(100%,40rem)}img{max-width:100%;height:auto;border:1px solid #d8e0eb}figcaption{padding:1rem 0;overflow-wrap:anywhere}</style><h1>Comparación responsive</h1><p>Pendiente de inspección humana. Dimensiones en píxeles CSS; imágenes completas, sin estirar.</p><main>${links}</main></html>`,
    );
    report.status =
      report.cases.some((c) => c.status === "fail") || report.errors.length
        ? "fail"
        : "automated-pass-human-review-pending";
  } catch (e) {
    report.status = "blocked";
    report.blocker = e.message;
  } finally {
    if (browser) await browser.close();
    save();
    console.log(
      JSON.stringify({
        status: report.status,
        planned: report.cases.length,
        passed: report.cases.filter(
          (c) => c.status === "automated-pass-human-review-pending",
        ).length,
        failed: report.cases.filter((c) => c.status === "fail").length,
        captures: report.captures.length,
        blocker: report.blocker?.split("\n")[0],
      }),
    );
    if (["blocked", "fail"].includes(report.status)) process.exitCode = 1;
  }
})();
