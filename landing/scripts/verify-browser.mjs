import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCaseRunner, serveDist, freshPage, loadPage, widths } from "./browser-cases.mjs";
import { chromium } from "./browser-support.mjs";
import { assertNoPageOverflow, diagnoseViewports } from "./overflow-diagnostics.mjs";
import { startDialogFocusTrace, assertDialogFocusCycle, recordDialogFocus } from "./verify-dialog-focus.mjs";

// Intercept a test origin and serve only dist files. No listening port, external
// requests, user browser, real product accounts, backend or private data needed.
const artifacts = process.env.LANDING_QA_DIR
  ? path.resolve(process.env.LANDING_QA_DIR)
  : fileURLToPath(new URL("../qa-artifacts/", import.meta.url));
// Run only the affected navigation cases locally; the full suite remains the default.
const navigationOnly = process.argv.includes("--navigation-only");
await mkdir(artifacts, { recursive: true });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.LANDING_BROWSER_PATH
      ? { executablePath: process.env.LANDING_BROWSER_PATH }
      : {}),
  });
} catch (error) {
  await writeFile(`${artifacts}/browser-launch-error.log`, String(error));
  console.error("Browser checks NOT RUN: Chromium could not start.");
  console.error(
    String(error)
      .split("\n")
      .find((line) => line.includes("FATAL:")) ?? String(error).split("\n")[0],
  );
  console.error(`Diagnostic: ${artifacts}/browser-launch-error.log`);
  process.exit(1);
}
try {
  console.log(`Chromium ${browser.version()}`);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const failures = [];
  const externalRequests = [];
  await serveDist(context, failures, externalRequests);
  const cases = createCaseRunner({ artifacts, suite: navigationOnly ? "browser-navigation" : "browser", browser });
  let page;
  const run = async (name, width, height, action, motion = "reduce") => {
    if (navigationOnly && !name.startsWith("mobile menu ")) return;
    page = await freshPage(context, failures);
    try {
      return await cases.run(name, async () => {
        await loadPage(page, width, height, motion);
        await action(page);
      }, page);
    } finally { await page.close(); }
  };
  const checkOverflow = (label) => assertNoPageOverflow(page, artifacts, label);
  if (process.env.LANDING_OVERFLOW_DIAGNOSTICS === "1")
    await run("optional overflow diagnostics", 320, 960, () => diagnoseViewports(page, artifacts));
  const checkTargets = async (label) => {
    const issues = await page.locator("a, button, summary").evaluateAll((els) =>
      els.filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map((el) => ({
          name: el.getAttribute("aria-label") || el.textContent.trim(),
          width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height
        })),
    );
    assert.deepEqual(issues, [], `Targets below 44 × 44px: ${label}`);
  };
  for (const width of widths) {
    await run(`${width}px conductor`, width, 960, async () => {
      assert.equal(await page.locator("h1").count(), 1);
      await checkOverflow(`${width}px conductor`);
      assert.equal(
        await page
          .locator(".animated-route")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      const reading = await page.evaluate(() => {
        const visible = (el) =>
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden" &&
          !el.closest('svg,.sr-only,[aria-hidden="true"]');
        const small = [...document.querySelectorAll("body *")]
          .filter(
            (el) =>
              visible(el) &&
              [...el.childNodes].some(
                (node) =>
                  node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
              ),
          )
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14)
          .map((el) => ({
            text: el.textContent.trim().slice(0, 70),
            size: getComputedStyle(el).fontSize,
          }));
        const images = [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src);
        return {
          small,
          images,
          storage: { local: localStorage.length, session: sessionStorage.length },
        };
      });
      assert.deepEqual(
        reading.small,
        [],
        `Text below 14px at ${width}px: ${JSON.stringify(reading.small)}`,
      );
      assert.deepEqual(reading.images, [], "All brand artwork must load");
      assert.deepEqual(
        reading.storage,
        { local: 0, session: 0 },
        "No persistent demo state",
      );
      assert.equal(
        await page
          .locator(".phone-product")
          .evaluate((el) => getComputedStyle(el).transform),
        "none",
        "No scaled-down devices",
      );
      assert.equal(await page.locator(".menu-button").isVisible(), width <= 960);
      await page.screenshot({
        path: `${artifacts}/${width}-full.png`,
        fullPage: true,
      });
      await checkTargets(`${width}px conductor`);
    });
    await run(`${width}px apoderado profiles`, width, 960, async () => {
      await page.getByRole("tab", { name: "Soy apoderado" }).click();
      assert.equal(
        await page.locator(".web-product").isVisible(),
        width > 1000,
        "On smaller screens parents see their own mobile experience first",
      );
      await page.getByRole("button", { name: "Perfil B" }).click();
      assert.match(await page.locator(".phone-profile").innerText(), /Transportista B/);
      assert.equal(await page.getByRole("button", { name: "Perfil B" }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: "Perfil A" }).click();
      assert.match(await page.locator(".phone-profile").innerText(), /Transportista A.*2 cupos/s);
      await checkTargets(`${width}px apoderado`);
      await checkOverflow(`${width}px apoderado`);
      await page.locator("#experience-panel").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${artifacts}/${width}-parent.png`, fullPage: true });
      await writeFile(`${artifacts}/${width}-parent-aria.yml`, await page.locator("body").ariaSnapshot());
    });
  }
  await run("320px comparison disclosure", 320, 960, async () => {
    // Exercise the disclosures at the narrowest supported viewport as well.
    await page.locator(".comparison-details > summary").click();
    await checkOverflow("320px expanded comparison");
    await page.locator(".comparison-scroll").focus();
    assert.equal(
      await page
        .locator(".comparison-scroll")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".comparison-scroll").scrollLeft > 0, null, { timeout: 2000 });
    await checkOverflow("keyboard scroll of comparison at 320px");
    assert.match(
      await page.locator(".maturity-note").innerText(),
      /Disponibilidad comercial futura:.*no habilitada/s,
    );
  });
  // Expanded comparisons need their own matrix: closed disclosures cannot
  // expose absolute labels escaping the table's horizontal scroll container.
  const comparisonEvidence = [];
  const recordComparison = async (label) => {
    comparisonEvidence.push(await page.locator(".comparison-scroll").evaluate((el, label) => {
      const rect = el.getBoundingClientRect();
      const table = el.querySelector("table");
      const last = el.querySelector("thead th:last-child").getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        label, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, pageScrollX: scrollX,
        left: rect.left, right: rect.right, clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft,
        tableWidth: table.getBoundingClientRect().width, lastColumnRight: last.right,
        focused: el === document.activeElement, outline: style.outlineStyle,
        outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset,
        escapedLabels: [...el.querySelectorAll(".sr-only")].filter((label) =>
          !label.offsetParent || !el.contains(label.offsetParent)).length
      };
    }, label));
    await writeFile(`${artifacts}/comparison-checks.json`, JSON.stringify(comparisonEvidence, null, 2) + "\n");
    return comparisonEvidence.at(-1);
  };
  for (const width of widths) {
    for (const audience of ["apoderado", "conductor"]) {
      for (const view of ["IVA incluido", "Desglose"]) {
        const label = `${width}px ${audience} ${view} comparison`;
        await run(label, width, 960, async () => {
          const summary = page.locator(".comparison-details > summary");
          const scroller = page.locator(".comparison-scroll");
          await summary.click();
          await page.locator(`#tab-${audience}`).click();
          await page.getByRole("button", { name: view, exact: true }).click();
          await scroller.evaluate((el) => { el.scrollLeft = 0; });
          await recordComparison(`${label} open`);
          await checkOverflow(`${label} open`);
          await scroller.scrollIntoViewIfNeeded();
          await summary.focus();
          await page.keyboard.press("Tab");
          const start = await recordComparison(`${label} focus`);
          await checkOverflow(`${label} focus/scrollIntoView`);
          assert.ok(start.focused && start.outline !== "none" && parseFloat(start.outlineWidth) >= 2,
            `Comparison keyboard focus visible: ${label}`);
          assert.equal(start.escapedLabels, 0, `Accessible label boxes contained: ${label}`);
          assert.ok(start.tableWidth >= 640, `Full-size comparison table: ${label}`);
          assert.equal(start.pageScrollX, 0, `No lateral page movement: ${label}`);
          const screenshot = width <= 390 && audience === "apoderado" && view === "IVA incluido";
          if (screenshot) await page.screenshot({ path: `${artifacts}/${width}-comparison-start.png` });
          if (start.scrollWidth > start.clientWidth) {
            // Traverse to the final column using only the region's native keys.
            for (let step = 0; step < Math.ceil((start.scrollWidth - start.clientWidth) / 20) + 2; step++)
              await page.keyboard.press("ArrowRight");
            await page.waitForFunction(() => {
              const el = document.querySelector(".comparison-scroll");
              return el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
            }, null, { timeout: 3000 });
            const end = await recordComparison(`${label} last column`);
            assert.ok(end.focused, `Keyboard focus remains in comparison: ${label}`);
            assert.ok(end.lastColumnRight <= end.right + 1, `Last column reachable: ${label}`);
            assert.equal(end.pageScrollX, 0, `Keys scroll only the comparison: ${label}`);
            await checkOverflow(`${label} last column`);
            if (screenshot) await page.screenshot({ path: `${artifacts}/${width}-comparison-end.png` });
            await page.keyboard.press("ArrowLeft");
            await page.waitForFunction((previous) => document.querySelector(".comparison-scroll").scrollLeft < previous,
              end.scrollLeft, { timeout: 2000 });
          }
          await page.locator(".comparison-scroll thead th:last-child").scrollIntoViewIfNeeded();
          await checkOverflow(`${label} last column scrollIntoView`);
          await summary.focus();
          await page.keyboard.press("Enter");
          assert.equal(await page.locator(".comparison-details").evaluate((el) => el.open), false);
          await checkOverflow(`${label} closed`);
          await page.keyboard.press("Space");
          assert.equal(await page.locator(".comparison-details").evaluate((el) => el.open), true);
          await checkOverflow(`${label} reopened`);
        });
      }
    }
  }
  await run("audience keyboard and route selection", 1440, 1000, async () => {
    await page.getByRole("tab", { name: "Soy apoderado" }).click();
    await page.getByRole("button", { name: "Perfil B" }).click();
    assert.match(
      await page.locator(".phone-profile").innerText(),
      /Transportista B/,
    );
    await page.getByRole("tab", { name: "Soy apoderado" }).focus();
    await page.keyboard.press("Home");
    assert.equal(
      await page.locator("#tab-conductor").getAttribute("aria-selected"),
      "true",
    );
    assert.equal(
      await page
        .locator("#tab-conductor")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    for (const [key, audience] of [["End", "apoderado"], ["ArrowLeft", "conductor"], ["ArrowRight", "apoderado"], ["Home", "conductor"]]) {
      await page.keyboard.press(key);
      assert.equal(await page.locator(`#tab-${audience}`).getAttribute("aria-selected"), "true");
      assert.ok(await page.locator(`#tab-${audience}`).evaluate((el) => el === document.activeElement));
    }
    await page.getByRole("button", { name: /Regreso a casa/ }).click();
    assert.match(await page.locator(".phone-route").innerText(), /15:30/);
    assert.equal(await page.getByRole("button", { name: /Regreso a casa/ }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: /Ida al colegio/ }).click();
    assert.match(await page.locator(".phone-route").innerText(), /07:15/);
  });
  await run("privacy desktop dialog", 1440, 1000, async () => {
    await startDialogFocusTrace(page);
    await page
      .getByRole("button", { name: "Privacidad" })
      .click();
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
    assert.match(await page.locator("dialog").innerText(), /mismo sitio/);
    assert.match(await page.locator("dialog").innerText(), /dirección IP/);
    await assertDialogFocusCycle(page, artifacts, "privacy-desktop");
    await page.keyboard.press("Escape");
    await recordDialogFocus(page, artifacts, "privacy-desktop", "Escape");
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
    assert.equal(
      await page
        .getByRole("button", { name: "Privacidad" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
  });
  await run("project desktop dialog content", 1440, 1000, async () => {
    await page
      .getByRole("button", { name: "Sobre el proyecto", exact: true })
      .click();
    assert.match(
      await page.locator("dialog").innerText(),
      /Feria de Software 2027/,
    );
    assert.match(await page.locator("dialog").innerText(), /Aspiramos/);
    await page.keyboard.press("Escape");
  });
  await run("mobile menu Escape and anchor focus", 390, 844, async () => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    assert.equal(await page.locator("#mobile-menu").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#mobile-menu").isVisible(), false);
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.locator('#mobile-menu a[href="#planes"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#mobile-menu").isVisible(), false);
    assert.ok(
      await page.locator("#planes").evaluate((el) => el === document.activeElement),
      "Mobile navigation transfers keyboard focus to the destination",
    );
  });
  await run("FAQ pointer disclosure", 390, 844, async () => {
    await page
      .getByText("¿Puedo ver la ubicación del furgón en tiempo real?", {
        exact: true,
      })
      .click();
    assert.equal(
      await page.locator("#pregunta-1").evaluate((el) => el.open),
      true,
    );
  });
  for (let index = 0; index < 6; index++) {
    await run(`FAQ ${index + 1} native Enter/Space`, 390, 844, async () => {
      const summary = page.locator(".faq-list summary").nth(index);
      await summary.focus();
      const wasOpen = await summary.evaluate((el) => el.parentElement.open);
      await page.keyboard.press("Enter");
      assert.equal(await summary.evaluate((el) => el.parentElement.open), !wasOpen);
      await page.keyboard.press("Space");
      assert.equal(await summary.evaluate((el) => el.parentElement.open), wasOpen);
    });
  }
  for (const label of ["Sobre el proyecto", "Términos y condiciones", "Privacidad", "Accesibilidad"]) {
    await run(`390px dialog ${label}`, 390, 844, async () => {
      const trigger = page.getByRole("button", { name: label, exact: true });
      await startDialogFocusTrace(page);
      await trigger.click();
      await assertDialogFocusCycle(page, artifacts, `390-${label}`);
      await checkTargets(`dialog ${label}`);
      await page.getByRole("button", { name: "Cerrar información" }).click();
      await recordDialogFocus(page, artifacts, `390-${label}`, "close button");
      assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
      assert.ok(await trigger.evaluate((el) => el === document.activeElement));
    });
  }
  for (const width of [1440, 390]) {
    const inventory = await freshPage(context, failures);
    let links = [];
    await cases.run(`${width}px anchor inventory`, async () => {
      await loadPage(inventory, width, 900);
      links = await inventory.locator('a[href^="#"]:not(#mobile-menu a)').evaluateAll((els) =>
        els.map((el, index) => ({
          index, text: el.textContent, href: el.getAttribute("href"),
          visible: el.getClientRects().length > 0
        })).filter((el) => el.visible));
      assert.ok(links.length > 0);
    }, inventory);
    await inventory.close();
    for (const { index, text, href } of links) {
      await run(`${width}px anchor ${index} ${text.trim()} ${href}`, width, 900, async () => {
        const link = page.locator('a[href^="#"]:not(#mobile-menu a)').nth(index);
        const target = href.slice(1);
        await link.focus();
        await page.keyboard.press("Enter");
        assert.ok(await page.locator(`[id="${target}"]`).evaluate((el) => el === document.activeElement), `Anchor focus: ${target}`);
        if (text.includes("Ver demo del")) {
          const audience = text.includes("apoderado") ? "apoderado" : "conductor";
          assert.equal(await page.locator(`#tab-${audience}`).getAttribute("aria-selected"), "true");
        }
      });
    }
    if (width === 390) {
      for (let index = 0; index < 5; index++) {
        await run(`mobile menu anchor ${index + 1}`, width, 900, async () => {
          await page.getByRole("button", { name: "Abrir menú" }).click();
          const link = page.locator("#mobile-menu a").nth(index);
          const href = await link.getAttribute("href");
          if (href?.startsWith("#")) {
            const target = href.slice(1);
            assert.ok(target, "Internal anchors must have a destination");
            await link.focus();
            await page.keyboard.press("Enter");
            assert.ok(await page.locator(`[id="${target}"]`).evaluate((el) => el === document.activeElement));
          } else {
            assert.match(href ?? "", /^https?:\/\//, "Only internal anchors or HTTP(S) links are allowed");
            assert.equal(href, "https://demo.furgoplus.cl");
            assert.equal(await link.getAttribute("target"), "_blank");
            assert.deepEqual((await link.getAttribute("rel") ?? "").split(/\s+/).sort(), ["noopener", "noreferrer"]);
            assert.equal(await page.getByRole("link", { name: "Abrir demo (abre en una nueva pestaña)", exact: true }).count(), 1);
            // This anchor inventory activates only internal destinations. Inspect
            // external link semantics and focus without starting a navigation or
            // adding an exception to the context's external-request guard.
            await link.focus();
            assert.ok(await link.evaluate((el) => el === document.activeElement), "External link is focusable");
            await page.keyboard.press("Escape");
          }
          assert.equal(await page.locator("#mobile-menu").isVisible(), false);
        });
      }
    }
    await run(`${width}px complete Tab cycle`, width, 900, async () => {
      // A complete Tab cycle must return to the skip link without trapping focus.
      await page.goto("https://landing.furgoplus.test/", { waitUntil: "networkidle" });
      await page.keyboard.press("Tab");
      assert.ok(await page.locator(".skip-link").evaluate((el) => el === document.activeElement));
      let returned = false;
      for (let step = 0; step < 80; step++) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          const style = getComputedStyle(el);
          return {
            skip: el.matches(".skip-link"), body: el === document.body,
            visible: el.getClientRects().length > 0, outline: style.outlineStyle,
            width: parseFloat(style.outlineWidth)
          };
        });
        // Chromium may focus browser chrome for one step when cycling the page.
        if (!focused.body) {
          assert.ok(focused.visible && focused.outline !== "none" && focused.width >= 2, "Keyboard focus must be visible");
        }
        if (focused.skip) { returned = true; break; }
      }
      assert.ok(returned, "Keyboard traversal must finish without a trap");
    });
  }
  // Effective CSS viewports for 200%/400% browser zoom from 1280 × 900.
  // This tests reflow, not real browser zoom or OS magnification; both remain
  // explicit human checks. deviceScaleFactor would only change pixel density.
  for (const [label, width, height] of [["reflow-200", 640, 450], ["reflow-400", 320, 225]]) {
    for (const audience of ["conductor", "apoderado"]) {
      await run(`${label} ${audience} layout`, width, height, async () => {
        await page.locator(`#tab-${audience}`).click();
        await checkOverflow(`${label} ${audience}`);
        await page.getByRole("button", { name: "Desglose", exact: true }).click();
        await page.locator(".comparison-details > summary").focus();
        if (!(await page.locator(".comparison-details").evaluate((el) => el.open)))
          await page.keyboard.press("Enter");
        await checkOverflow(`${label} ${audience} expanded plans`);
        await checkTargets(`${label} ${audience}`);
        await page.screenshot({ path: `${artifacts}/${label}-${audience}.png`, fullPage: true });
      });
    }
    await run(`${label} short menu`, width, height, async () => {
      await page.getByRole("button", { name: "Abrir menú" }).click();
      const lastLink = page.locator("#mobile-menu a").last();
      await lastLink.focus();
      assert.ok(await lastLink.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }), "Last mobile menu link stays reachable in a short viewport");
      await page.screenshot({ path: `${artifacts}/${label}-menu.png` });
      await page.keyboard.press("Escape");
    });
    await run(`${label} short dialog`, width, height, async () => {
      await page.getByRole("button", { name: "Accesibilidad", exact: true }).click();
      await checkOverflow(`${label} dialog`);
      await page.getByRole("button", { name: "Entendido", exact: true }).focus();
      assert.ok(await page.getByRole("button", { name: "Entendido", exact: true }).evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }), "Dialog confirmation remains reachable");
      await page.keyboard.press("Enter");
    });
  }
  await run("original motion preference regression", 1440, 900, async () => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("https://landing.furgoplus.test/", {
      waitUntil: "networkidle",
    });
    assert.equal(
      await page
        .locator(".animated-route")
        .evaluate((el) => getComputedStyle(el).animationName),
      "route-draw",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".animated-route")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.ok(
      await page
        .locator(".reveal")
        .evaluateAll((els) =>
          els.every((el) => getComputedStyle(el).opacity === "1"),
        ),
      "Motion preference changes keep content visible",
    );
  }, "no-preference");
  await cases.run("no automatic external requests on fresh load", async () => {
    const cleanContext = await browser.newContext({ reducedMotion: "reduce" });
    const automaticRequests = [], loadErrors = [];
    try {
      await serveDist(cleanContext, loadErrors, automaticRequests);
      const cleanPage = await freshPage(cleanContext, loadErrors);
      await loadPage(cleanPage, 390, 900);
      assert.deepEqual(automaticRequests, [], "Fresh landing must not request any external destination");
      assert.deepEqual(loadErrors, [], "Fresh landing must load without browser or asset errors");
    } finally {
      await cleanContext.close();
    }
  });
  await cases.run("no cookies", async () => assert.deepEqual(await context.cookies(), [], "The landing does not install cookies"));
  await cases.run("runtime and assets", async () => assert.deepEqual(failures, [], "Browser errors/assets"));
  await cases.run("no external requests", async () => assert.deepEqual(externalRequests, [], "Unexpected external requests"));
  await cases.finish();
  console.log(`Screenshots for human review: ${artifacts}. Real zoom and visual acceptance remain manual.`);
} finally {
  await browser.close();
}
