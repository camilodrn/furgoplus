const { chromium } = require(process.env.FURGOPLUS_PLAYWRIGHT || "playwright");
const fs = require("fs"),
  assert = require("assert"),
  path = require("path"),
  { pathToFileURL } = require("url");
const out = __dirname;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.FURGOPLUS_CHROMIUM
      ? { executablePath: process.env.FURGOPLUS_CHROMIUM }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    requests = [],
    checks = [];
  page.setDefaultTimeout(5000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method() }),
  );
  const go = async (route, reset = false) => {
    if (reset) await page.goto("http://127.0.0.1:8768/#" + route);
    else await page.evaluate((r) => (location.hash = r), route);
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(25);
  };
  const click = async (action, id) =>
    page
      .locator(
        `[data-action="${action}"]${id !== undefined ? `[data-id="${id}"]` : ""}`,
      )
      .first()
      .click();
  const ok = (name, condition) => {
    assert(condition, name);
    checks.push(name);
  };
  const val = async (fn) => page.evaluate(fn);
  await go("web/conductor/pasajeros", true);
  await page.locator('[data-filter="q"]').fill("Nicolas");
  ok(
    "Accent-insensitive search covers records outside visible page",
    (await page.locator("tbody").textContent()).includes("Nicolás Vega"),
  );
  await click("clear-filters");
  await click("route-filter", "2");
  await click("passenger-new");
  for (const [name, value] of Object.entries({
    name: "Pasajero Sintético",
    guardian: "Familia Sintética",
    phone: "+56 9 0000 0000",
    pickup: "Punto de ejemplo",
  }))
    await page.locator(`#dialog [name="${name}"]`).fill(value);
  await page
    .locator('#dialog button[type="submit"],#dialog button:not([type])')
    .last()
    .click();
  ok(
    "Full-route conflict preserves assignment draft",
    await page
      .locator("#form-feedback")
      .textContent()
      .then((x) => x.includes("no tiene cupos")),
  );
  await page.locator('#dialog [name="route"]').selectOption("1");
  await page.locator("#dialog .form-footer button").last().click();
  ok(
    "Assignment updates route capacity",
    await val(() => findRoute(1).used === 9),
  );
  await go("web/conductor/pagos");
  await page.locator('[data-filter="status"]').selectOption("pending");
  await click("payment-detail");
  await click("payment-pay");
  ok(
    "Payment confirmation states manual bank distinction",
    (await page.locator("#dialog").textContent()).includes(
      "no verifica movimientos bancarios",
    ),
  );
  await click("close-dialog");
  ok(
    "Cancel payment does not mutate",
    await val(
      () => model.payments.find((p) => p.id === 504).status === "pending",
    ),
  );
  await click("payment-detail", "504");
  await click("payment-pay", "504");
  await page.locator("#dialog .form-footer button").last().click();
  ok(
    "Confirm payment updates status",
    await val(() => model.payments.find((p) => p.id === 504).status === "paid"),
  );
  await go("web/conductor/documentos?estado=pendiente");
  await click("document-edit", "2");
  await page.locator("#dialog .form-footer button").last().click();
  await go("web/conductor/revision?estado=pendiente");
  await click("submit-review");
  await go("web/administrador/expediente/1?estado=pendiente");
  await page
    .getByRole("button", { name: "Aprobar información", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar aprobación", exact: true })
    .click();
  ok(
    "Approval preserves publication and plan distinction",
    await val(
      () =>
        model.review === "approved" &&
        !model.published &&
        model.planStatus === "Suspendido",
    ),
  );
  await go("web/administrador/conductor/1?estado=pendiente");
  await click("admin-plan", "1");
  await page.locator('#dialog [name="status"]').selectOption("Vigente");
  await page
    .locator('#dialog [name="reason"]')
    .fill("Plan sintético para revisión");
  await page
    .getByRole("button", { name: "Revisar cambio", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar plan", exact: true }).click();
  await go("web/conductor/publicacion?estado=pendiente");
  await click("publication-on");
  ok(
    "Complete review journey enables explicit publication",
    await val(() => model.published),
  );
  await go("web/administrador/conductor/2?estado=pendiente");
  await click("account-activate", "2");
  await page
    .locator('#dialog [name="reason"]')
    .fill("Activación sintética del segundo servicio");
  await page
    .getByRole("button", { name: "Confirmar cambio", exact: true })
    .click();
  ok(
    "Admin action isolates selected driver",
    await val(
      () =>
        adminRecord(2).accountStatus === "Activo" &&
        model.accountStatus === "Activo",
    ),
  );
  await go("android/conductor/hoy");
  await click("run-start", "1");
  await click("run-end", "1");
  await click("close-dialog");
  ok(
    "Cancel finish preserves run in progress",
    await val(() => model.runStates[1] === "in_progress"),
  );
  await click("run-end", "1");
  await page
    .getByRole("button", { name: "Finalizar servicio", exact: true })
    .last()
    .click();
  ok(
    "Run journey reaches completed state",
    await val(() => model.runStates[1] === "completed"),
  );
  await go("android/apoderado/buscar");
  await page
    .getByRole("button", { name: "Buscar servicios", exact: true })
    .click();
  await click("compare-toggle", "1");
  await click("compare-toggle", "2");
  await go("android/apoderado/comparar");
  ok(
    "Comparison includes selected services",
    (await page.locator(".comparison-grid .panel").count()) === 2,
  );
  await go("android/apoderado/contacto/1");
  await page
    .locator('[name="message"]')
    .fill("Consulta sintética sobre un traslado de mañana");
  await page.locator('[name="consent"]').check();
  await page
    .getByRole("button", { name: "Enviar solicitud", exact: true })
    .click();
  const rid = await val(() => model.requests[0].id);
  await go("web/conductor/solicitudes");
  await click("request-select", rid);
  await click("request-accept", rid);
  await page.locator("#dialog .form-footer button").last().click();
  await go("android/apoderado/solicitud/" + rid);
  ok(
    "Cross-role contact reveals service email after acceptance",
    (await page.locator("#main").textContent()).includes(
      "servicio.aromos@example.test",
    ),
  );
  ok(
    "Accepted contact does not automatically add passengers",
    await val(() => model.passengers.length === 26),
  );
  await go("android/apoderado/contacto/1");
  ok(
    "Duplicate contact points to existing request",
    (await page.locator("#main").textContent()).includes(
      "Ya tienes una solicitud",
    ),
  );
  await go("web/conductor/ayuda");
  await click("support-new");
  await page
    .locator('#dialog [name="subject"]')
    .fill("Consulta sintética de soporte");
  await page
    .locator('#dialog [name="body"]')
    .fill("No encuentro el período del reporte de prueba.");
  await page.locator('#dialog [name="privacy"]').check();
  await page
    .getByRole("button", { name: "Enviar solicitud", exact: true })
    .click();
  const tid = await val(() => tickets[0].id);
  await go("web/administrador/ticket/" + tid);
  await page
    .locator('#main [name="body"]')
    .fill("Respuesta sintética del equipo");
  await page.locator('#main [name="privacy"]').check();
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
  ok(
    "Support conversation retains both sides",
    await val(() => tickets[0].events.length === 2),
  );
  await go("android/conductor/hoy?estado=incierto");
  ok(
    "Uncertain run blocks repeat start",
    (await page.locator('[data-action="run-start"]').count()) === 0,
  );
  await click("run-recover", "1");
  ok(
    "Uncertain run recovers by read before action",
    await val(() => model.runStates[1] === "in_progress"),
  );
  await go("web/conductor/pagos?estado=error");
  ok(
    "Read error does not show invented zero totals",
    (await page.locator(".metrics").count()) === 0,
  );
  await click("retry");
  ok(
    "Read retry restores content",
    (await page.locator(".metrics").count()) === 1,
  );
  await go("web/conductor/pagos?estado=muchos");
  await page.locator('[data-filter="status"]').selectOption("pending");
  await click("page", "2");
  ok(
    "Pagination changes visible range",
    await page
      .locator(".pager")
      .textContent()
      .then((x) => x.includes("6–10")),
  );
  const routes = [
    "web/conductor/inicio",
    "web/conductor/servicio",
    "web/conductor/datos",
    "web/conductor/documentos",
    "web/conductor/revision",
    "web/conductor/publicacion",
    "web/conductor/rutas",
    "web/conductor/pasajeros",
    "web/conductor/pagos",
    "web/conductor/solicitudes",
    "web/conductor/plan",
    "web/conductor/ayuda",
    "web/conductor/articulo/2",
    "web/conductor/ticket/204",
    "web/administrador/validaciones",
    "web/administrador/expediente/1",
    "web/administrador/conductores",
    "web/administrador/conductor/1",
    "web/administrador/ayuda",
    "web/apoderado/inicio",
    "web/apoderado/ayuda",
    "web/acceso/ingresar",
    "web/acceso/registro",
    "android/acceso/ingresar",
    "android/acceso/registro",
    "android/conductor/hoy",
    "android/conductor/recorrido/1",
    "android/conductor/pasajeros/1",
    "android/conductor/plan",
    "android/conductor/ayuda",
    "android/conductor/cuenta",
    "android/apoderado/buscar",
    "android/apoderado/servicio/1",
    "android/apoderado/comparar",
    "android/apoderado/contacto/1",
    "android/apoderado/solicitudes",
    "android/apoderado/solicitud/105",
    "android/apoderado/cuenta",
    "android/apoderado/ayuda",
  ];
  const sweep = [];
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: width < 450 ? 844 : 1000 });
    for (const route of routes) {
      await go(route);
      const issue = await page.evaluate(() => ({
        headings: document.querySelectorAll("h1").length,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      if (issue.headings !== 1 || issue.overflow)
        throw Error(JSON.stringify({ route, width, ...issue }));
      sweep.push({ route, width, ...issue });
    }
  }
  for (const state of [
    "normal",
    "pendiente",
    "vacio",
    "error",
    "muchos",
    "carga",
    "incierto",
  ])
    for (const route of [
      "web/conductor/pasajeros",
      "web/conductor/pagos",
      "web/conductor/publicacion",
      "web/administrador/validaciones",
      "android/conductor/hoy",
      "android/apoderado/buscar",
    ]) {
      await go(route + "?estado=" + state);
      ok(
        "State " + state + " renders " + route,
        (await page.locator("h1").count()) === 1,
      );
    }
  ok("No browser JavaScript or console errors", errors.length === 0);
  ok(
    "No external network requests",
    requests.every((r) => r.url.startsWith("http://127.0.0.1:8768/")),
  );
  ok(
    "No network writes",
    requests.every((r) => r.method === "GET"),
  );
  await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
  ok(
    "Direct file opening works",
    await page
      .locator("h1")
      .textContent()
      .then((x) => x.includes("Tu servicio")),
  );
  ok("Direct file opening has no console errors", errors.length === 0);
  fs.writeFileSync(
    out + "/validation.json",
    JSON.stringify(
      {
        checks,
        sweep,
        errors,
        requests: [...new Map(requests.map((r) => [r.url, r])).values()],
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      routeViewportChecks: sweep.length,
      errors,
    }),
  );
  const screenshots = [
    ["web/conductor/inicio", "web-inicio-1440", 1440, 1000],
    ["web/conductor/servicio", "web-mi-servicio-1440", 1440, 1000],
    ["web/conductor/pasajeros", "web-pasajeros-1440", 1440, 1000],
    [
      "web/conductor/pasajeros?estado=muchos",
      "web-pasajeros-muchos-1280",
      1280,
      900,
    ],
    ["web/conductor/pagos", "web-pagos-1440", 1440, 1000],
    ["web/conductor/solicitudes", "web-solicitudes-1440", 1440, 1000],
    ["web/conductor/plan", "web-plan-reportes-1440", 1440, 1000],
    ["web/conductor/rutas", "web-rutas-1280", 1280, 900],
    ["web/conductor/ayuda", "web-ayuda-1440", 1440, 1000],
    [
      "web/administrador/validaciones?estado=pendiente",
      "web-validaciones-1440",
      1440,
      1000,
    ],
    [
      "web/administrador/expediente/1?estado=pendiente",
      "web-expediente-1440",
      1440,
      1000,
      "review",
    ],
    ["web/administrador/conductor/1", "web-administracion-1440", 1440, 1000],
    [
      "web/administrador/ayuda?estado=muchos",
      "web-soporte-criticos-1440",
      1440,
      1000,
    ],
    ["android/conductor/hoy", "android-hoy-412", 1080, 1000],
    ["android/conductor/hoy", "android-hoy-390", 390, 844],
    ["android/conductor/pasajeros/1", "android-pasajeros-390", 390, 844],
    ["android/conductor/plan", "android-plan-390", 390, 844],
    ["android/apoderado/buscar", "android-buscar-412", 1080, 1000, "search"],
    ["android/apoderado/servicio/1", "android-servicio-390", 390, 844],
    ["android/apoderado/contacto/1", "android-contacto-390", 390, 844],
    ["android/apoderado/solicitudes", "android-solicitudes-390", 390, 844],
    ["android/apoderado/comparar", "android-comparar-390", 390, 844, "compare"],
    [
      "android/apoderado/comparar",
      "android-comparar-tres-320",
      320,
      844,
      "compare3",
    ],
    ["web/conductor/pagos?estado=vacio", "web-pagos-vacio-1280", 1280, 900],
    ["web/conductor/pasajeros?estado=error", "web-error-1280", 1280, 900],
    [
      "android/conductor/hoy?estado=incierto",
      "android-estado-incierto-390",
      390,
      844,
    ],
    ["web/conductor/pagos", "web-confirmar-pago-1280", 1280, 900, "payment"],
  ];
  const captures = [];
  for (const [route, name, width, height, prepare] of screenshots) {
    await page.setViewportSize({ width, height });
    await go(route, true);
    if (prepare === "review") {
      await page.evaluate(() => {
        model.review = "pending";
        model.document = "ok";
        render();
      });
    }
    if (prepare === "search")
      await page
        .getByRole("button", { name: "Buscar servicios", exact: true })
        .click();
    if (prepare === "compare" || prepare === "compare3") {
      await page.evaluate(
        (n) => {
          selectedServices = new Set(n === 3 ? [1, 2, 3] : [1, 2]);
          render();
        },
        prepare === "compare3" ? 3 : 2,
      );
    }
    if (prepare === "payment") {
      await page.locator('[data-filter="status"]').selectOption("pending");
      await click("payment-detail");
      await click("payment-pay");
    }
    await page.evaluate(() => document.activeElement?.blur());
    const layout = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      mobileOverflow:
        !!document.querySelector(".mobile-content") &&
        document.querySelector(".mobile-content").scrollWidth >
          document.querySelector(".mobile-content").clientWidth,
    }));
    assert(
      !layout.pageOverflow && !layout.mobileOverflow,
      JSON.stringify({ name, layout }),
    );
    await page.screenshot({ path: out + "/" + name + ".png", fullPage: true });
    captures.push({
      route,
      width,
      height,
      setup: prepare || null,
      file: name + ".png",
      ...layout,
    });
  }
  fs.writeFileSync(
    out + "/captures.json",
    JSON.stringify({ captures, errors }, null, 2),
  );
  console.log(JSON.stringify({ screenshots: captures.length, errors }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
