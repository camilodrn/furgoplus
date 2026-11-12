// Human-run Fedora acceptance helper. Real React + real read-only API; no mocks.
// Use only the isolated academic origin with synthetic data. No session is saved.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";

const origin = new URL(process.argv[2] || "http://127.0.0.1:15173");
if (!["127.0.0.1", "localhost"].includes(origin.hostname)) {
  throw new Error("Usa únicamente el origen académico local de Fedora.");
}
const output = resolve(process.argv[3] || "/tmp/furgoplus-admin-acceptance");
const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href)
  : await import("playwright");
const browser = await playwright.chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const evidence = {
  origin: origin.origin,
  startedAt: new Date().toISOString(),
  mode: "real-app-readonly",
  screenshots: [],
  skipped: [],
  blocked: [],
  consoleErrors: [],
  accepted: false,
};
await mkdir(output, { recursive: true });
page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== origin.origin) return route.abort();
  const login =
    url.pathname === "/api/v1/auth/login/" && request.method() === "POST";
  // Downloads also append audit records, so they are excluded even though GET.
  if (
    url.pathname.startsWith("/api/") &&
    (!(["GET", "HEAD", "OPTIONS"].includes(request.method()) || login) ||
      /\/documents\/\d+\/download\//.test(url.pathname))
  ) {
    evidence.blocked.push({ method: request.method(), path: url.pathname });
    return route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        code: "readonly_acceptance",
        message: "Acción excluida de la revisión visual de solo lectura.",
        fields: {},
      }),
    });
  }
  return route.continue();
});
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
try {
  await page.goto(origin.origin);
  await terminal.question(
    "Inicia sesión manualmente como administrador académico en la ventana abierta. No cambies datos. Pulsa Enter aquí al terminar: ",
  );
  await page
    .getByRole("navigation", { name: "Administración", exact: true })
    .waitFor();
  const source = await context.request.get(
    `${origin.origin}/src/AdminOverview.tsx`,
  );
  const sourceText = await source.text();
  if (!source.ok() || !sourceText.includes("Inicio administrativo"))
    throw new Error(
      "El servidor no entrega AdminOverview.tsx de este lote. No se capturará una versión anterior.",
    );
  const detailSource = await context.request.get(
    `${origin.origin}/src/AdminControls.tsx`,
  );
  const detailCss = await context.request.get(
    `${origin.origin}/src/admin-coherence.css`,
  );
  if (
    !detailSource.ok() ||
    !(await detailSource.text()).includes(
      "Secciones del detalle del conductor",
    ) ||
    !detailCss.ok() ||
    !(await detailCss.text()).includes("admin-driver-snapshot")
  )
    throw new Error(
      "El servidor no entrega el detalle reorganizado de este lote. No se capturará una versión anterior.",
    );
  async function navigate(name) {
    const button = page
      .getByRole("navigation", {
        name: name === "Ayuda y soporte" ? "Ayuda" : "Administración",
        exact: true,
      })
      .getByRole("button", { name, exact: true });
    if (!(await button.isVisible()))
      await page.getByRole("button", { name: "Menú", exact: true }).click();
    await button.click();
    await page.waitForLoadState("networkidle");
  }
  async function capture(name, size) {
    await page.waitForLoadState("networkidle");
    const filename = `${name}-${size.width}x${size.height}.png`;
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    await page.screenshot({ path: resolve(output, filename), fullPage: true });
    evidence.screenshots.push({
      file: filename,
      viewport: size,
      horizontalOverflow: overflow,
    });
  }
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await navigate("Inicio");
    await capture("inicio", size);
    await navigate("Conductores");
    await capture("conductores", size);
    const driver = page
      .getByRole("button", { name: "Ver conductor", exact: true })
      .first();
    if (await driver.count()) {
      await driver.click();
      const detailNavigation = page.getByRole("navigation", {
        name: "Secciones del detalle del conductor",
      });
      for (const [label, suffix] of [
        ["Resumen", "resumen"],
        ["Estado", "estado"],
        ["Validaciones", "validaciones"],
        ["Historial", "historial"],
        ["Plan", "plan"],
      ]) {
        await detailNavigation
          .getByRole("tab", { name: label, exact: true })
          .click();
        await capture(`conductor-${suffix}`, size);
      }
      const plan = page.getByRole("button", {
        name: "Administrar plan",
        exact: true,
      });
      if ((await plan.count()) && (await plan.isEnabled())) {
        await plan.click();
        await capture("plan-editor-sin-guardar", size);
        await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      }
    } else
      evidence.skipped.push({
        screen: "conductor y plan",
        viewport: size,
        reason: "Sin conductores recibidos",
      });
    await navigate("Validaciones");
    await capture("validaciones", size);
    const review = page
      .getByRole("button", { name: "Revisar", exact: true })
      .first();
    if (await review.count()) {
      await review.click();
      await capture("expediente", size);
    } else
      evidence.skipped.push({
        screen: "expediente",
        viewport: size,
        reason: "Sin envíos recibidos",
      });
    await navigate("Ayuda y soporte");
    await page
      .getByRole("button", { name: "Panel de soporte", exact: true })
      .click();
    await capture("soporte", size);
    const ticket = page
      .getByRole("button", { name: /^Revisar solicitud #/ })
      .first();
    if (await ticket.count()) {
      await ticket.click();
      await capture("caso", size);
    } else
      evidence.skipped.push({
        screen: "caso",
        viewport: size,
        reason: "Sin casos recibidos",
      });
    await page
      .getByRole("button", { name: "Guías de ayuda", exact: true })
      .click();
    await capture("guias", size);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigate("Inicio");
  await terminal.question(
    "Revisa ahora zoom real 200/400 %, Tab/Shift+Tab, Escape y foco. No envíes decisiones, formularios ni descargues documentos. Pulsa Enter al finalizar: ",
  );
  evidence.finishedAt = new Date().toISOString();
  evidence.humanAcceptance =
    "Registrar resultado y observaciones en TASK12_ADMIN_INTEGRAL.md; las capturas no aceptan el bloque automáticamente.";
} catch (error) {
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  terminal.close();
  await browser.close();
}
