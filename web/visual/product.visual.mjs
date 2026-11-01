import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { protectContext } from "./readonly.mjs";

// Selectors grounded in the current source, runtime verification pending Fedora.
// No registration, submit of business forms, plan edits, decisions or downloads.
async function navigate(page, role, label) {
  const name =
    label === "Ayuda y soporte"
      ? "Ayuda"
      : role === "driver"
        ? "Secciones del conductor"
        : "Administración";
  const button = page
    .getByRole("navigation", { name, exact: true })
    .getByRole("button", { name: label, exact: true });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "Menú", exact: true }).click();
  await button.click();
  await page.waitForLoadState("networkidle");
}
async function capture(page, testInfo, name) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading").first()).toBeVisible();
  if (!/^(W01|W02|W06|S04)-/.test(name)) {
    await expect(
      page.getByRole("form", { name: "Inicio de sesión", exact: true }),
    ).not.toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  const directory = testInfo.outputPath(name);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/full.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: `${directory}/viewport.png`,
    animations: "disabled",
  });
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    // DOM geometry is diagnostic; inspect clipped/local scroll regions manually.
    overflow: [...document.querySelectorAll("main *")]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width && (box.right > innerWidth + 1 || box.left < -1);
      })
      .slice(0, 50)
      .map((node) => ({ tag: node.tagName, class: node.className })),
  }));
  const axe = await new AxeBuilder({ page }).analyze(); // All default rules; no excludes.
  // Persist findings, not outerHTML/text which might accidentally contain form data.
  const summarize = (rows) =>
    rows.map(({ id, impact, help, helpUrl, nodes }) => ({
      id,
      impact,
      help,
      helpUrl,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }));
  await writeFile(
    `${directory}/audit.json`,
    JSON.stringify(
      {
        screen: name,
        project: testInfo.project.name,
        geometry,
        axeVersion: axe.testEngine.version,
        violations: summarize(axe.violations),
        incomplete: summarize(axe.incomplete),
        passedRuleIds: axe.passes.map(({ id }) => id),
        rendered: true,
        inspectedByAgent: false,
        humanReviewed: false,
      },
      null,
      2,
    ),
  );
  expect
    .soft(geometry.scrollWidth, `${name}: desbordamiento horizontal`)
    .toBeLessThanOrEqual(geometry.width + 1);
  expect
    .soft(
      axe.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map(({ target }) => target),
      })),
      `${name}: axe`,
    )
    .toEqual([]);
  // No reference snapshots exist yet: captures are candidates for human review.
}
async function optional(page, testInfo, locator, name) {
  if (await locator.count()) {
    await locator.first().click();
    await capture(page, testInfo, name);
    return true;
  }
  await writeFile(
    testInfo.outputPath(`${name}-pending.json`),
    JSON.stringify({
      screen: name,
      rendered: false,
      reason:
        "No hay un registro/control autorizado recibido para esta subvista.",
      humanReviewed: false,
    }),
  );
  return false;
}
async function login(page, role, guard) {
  const prefix = role.toUpperCase();
  const email = process.env[`TASK12_${prefix}_EMAIL`];
  const password = process.env[`TASK12_${prefix}_PASSWORD`];
  if (!email?.endsWith("@example.test") || !password)
    throw new Error(
      `Faltan credenciales sintéticas ${prefix} en variables de sesión; no usar archivos del repositorio.`,
    );
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", {
      name: role === "driver" ? "Secciones del conductor" : "Administración",
      exact: true,
      includeHidden: true, // Compact sidebar is closed after login.
    }),
  ).toBeAttached();
  guard.sealLogin();
}

test("acceso, registro sin envío y lectores legales", async ({
  page,
  context,
}, testInfo) => {
  const guard = await protectContext(context);
  guard.sealLogin();
  await page.goto("/");
  await expect(
    page.getByRole("form", { name: "Inicio de sesión", exact: true }),
  ).toBeVisible();
  await capture(page, testInfo, "W01-login");
  // Client validation only: an empty form cannot consume the login exception.
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await capture(page, testInfo, "S04-login-invalido");
  for (const label of ["Privacidad", "Términos"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await capture(page, testInfo, `W06-${label}`);
    await page.keyboard.press("Escape");
  }
  // The control label is verified at runtime; never create an account.
  await optional(
    page,
    testInfo,
    page.getByRole("button", {
      name: "Crear cuenta de conductor",
      exact: true,
    }),
    "W02-registro-sin-enviar",
  );
  expect(guard.blocked, "Tráfico inesperado detenido por la barrera").toEqual(
    [],
  );
});

for (const role of ["driver", "admin"]) {
  test(`${role}: recorridos académicos de solo lectura`, async ({
    page,
    context,
  }, testInfo) => {
    const guard = await protectContext(context);
    try {
      await page.goto("/");
      await login(page, role, guard);
      await navigate(page, role, "Inicio");
      await capture(
        page,
        testInfo,
        role === "driver" ? "W07-inicio" : "A01-inicio",
      );
      if (role === "driver") {
        await navigate(page, role, "Mi servicio");
        await capture(page, testInfo, "W08-servicio");
        for (const [label, id] of [
          ["Datos", "W09"],
          ["Documentos", "W10"],
          ["Revisión e historial", "W12-W13"],
        ]) {
          await navigate(page, role, "Mi servicio");
          await page
            .getByRole("navigation", { name: "Mi servicio", exact: true })
            .getByRole("button", { name: label, exact: true })
            .click();
          await capture(page, testInfo, `${id}-${label}`);
        }
        for (const [label, id] of [
          ["Publicación", "W14"],
          ["Rutas", "W15"],
          ["Pasajeros", "W18"],
          ["Solicitudes", "W22"],
          ["Pagos", "W24"],
          ["Plan y reportes", "W28-W31"],
        ]) {
          await navigate(page, role, label);
          await capture(page, testInfo, `${id}-${label}`);
          if (label === "Pagos")
            await optional(
              page,
              testInfo,
              page.getByRole("button", { name: /^Ver registro/ }),
              "W25-pago-detalle",
            );
          if (label === "Pasajeros")
            await optional(
              page,
              testInfo,
              page.getByRole("button", { name: /^Detalle de / }),
              "W19-pasajero-detalle",
            );
        }
      } else {
        await navigate(page, role, "Conductores");
        await capture(page, testInfo, "A02-conductores");
        await optional(
          page,
          testInfo,
          page.getByRole("button", { name: /^Filtros(?: \(|$)/ }),
          "A03-filtros",
        );
        await page.keyboard.press("Escape");
        if (
          await optional(
            page,
            testInfo,
            page.getByRole("button", { name: "Ver conductor", exact: true }),
            "A04-ficha",
          )
        ) {
          for (const [label, id] of [
            ["Estado", "A05"],
            ["Plan", "A07"],
            ["Validaciones", "A09"],
            ["Historial", "A10"],
          ]) {
            await page
              .getByRole("navigation", {
                name: "Secciones del detalle del conductor",
              })
              .getByRole("tab", { name: label, exact: true })
              .click();
            await capture(page, testInfo, `${id}-${label}`);
          }
        }
        await navigate(page, role, "Validaciones");
        await capture(page, testInfo, "A11-validaciones");
        await optional(
          page,
          testInfo,
          page.getByRole("button", { name: "Revisar", exact: true }),
          "A12-expediente-sin-decidir",
        );
      }
      await navigate(page, role, "Ayuda y soporte");
      await capture(page, testInfo, `${role}-H01-ayuda`);
      await page
        .getByRole("button", {
          name: role === "admin" ? "Panel de soporte" : "Mis solicitudes",
          exact: true,
        })
        .click();
      await capture(page, testInfo, `${role}-H02-H06-soporte`);
      await optional(
        page,
        testInfo,
        page.getByRole("button", { name: /^Revisar solicitud #/ }),
        `${role}-H04-H07-caso`,
      );
    } finally {
      await writeFile(
        testInfo.outputPath("blocked-requests.json"),
        JSON.stringify(guard.blocked, null, 2),
      );
      expect
        .soft(
          guard.blocked,
          "Solicitudes inesperadas bloqueadas: revisar antes de aceptar evidencia",
        )
        .toEqual([]);
    }
  });
}
