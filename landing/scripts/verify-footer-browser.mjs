import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "./browser-support.mjs";
import { createCaseRunner, serveDist, freshPage, loadPage } from "./browser-cases.mjs";

// Focused final presentation checks; does not invoke the integral audit.
const artifacts = process.env.LANDING_QA_DIR ? path.resolve(process.env.LANDING_QA_DIR)
  : fileURLToPath(new URL("../qa-artifacts/footer-final/", import.meta.url));
await mkdir(artifacts, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.LANDING_BROWSER_PATH ? { executablePath: process.env.LANDING_BROWSER_PATH } : {}) });
} catch (error) {
  await writeFile(path.join(artifacts, "browser-launch-error.log"), String(error));
  console.error("Footer geometry checks NOT RUN: Chromium could not start.");
  process.exitCode = 1;
}
if (browser) {
  try {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const errors = [], externalRequests = [];
    await serveDist(context, errors, externalRequests);
    const cases = createCaseRunner({ artifacts, suite: "footer-final", browser });
    for (const width of [320, 360, 390, 1440]) {
      const page = await freshPage(context, errors);
      await cases.run(`${width} line spacing, footer targets and layout`, async () => {
        await loadPage(page, width, 900);
        const geometry = await page.evaluate(() => {
          const solution = document.querySelector(".solution-copy");
          const rect = solution.getBoundingClientRect();
          const style = getComputedStyle(solution);
          return {
            viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
            border: parseFloat(style.borderLeftWidth), padding: parseFloat(style.paddingLeft),
            left: rect.left, right: rect.right,
            contentLefts: [".solution-mark", "h3", ":scope > p", ".connection-strip"]
              .map((selector) => solution.querySelector(selector).getBoundingClientRect().left),
            footerTargets: [...document.querySelectorAll("footer a, footer button")].map((el) => {
              const box = el.getBoundingClientRect();
              return { text: el.textContent.trim(), left: box.left, right: box.right, height: box.height,
                valid: el.tagName === "BUTTON" || !!document.getElementById(el.hash.slice(1)) };
            }),
          };
        });
        await writeFile(path.join(artifacts, `geometry-${width}.json`), JSON.stringify(geometry, null, 2));
        assert.equal(geometry.border, 1, "Decorative line remains visible");
        assert.equal(geometry.padding, width <= 700 ? 16 : 48, "Mobile gap increases; desktop stays unchanged");
        for (const left of geometry.contentLefts) assert.ok(Math.abs(left - geometry.left - 1 - geometry.padding) < 1, "Icon, heading and text stay aligned");
        assert.ok(geometry.documentWidth <= width, "No horizontal page overflow");
        assert.ok(geometry.left >= 0 && geometry.right <= width, "Solution remains within viewport");
        for (const target of geometry.footerTargets) {
          assert.ok(target.valid, `Working footer destination: ${target.text}`);
          assert.ok(target.height >= 44, `Touch target: ${target.text}`);
          assert.ok(target.left >= 0 && target.right <= width, `Target within viewport: ${target.text}`);
        }
        await page.locator(".solution-copy").screenshot({ path: path.join(artifacts, `solution-${width}.png`) });
        await page.locator("footer").screenshot({ path: path.join(artifacts, `footer-${width}.png`) });
        await page.getByRole("button", { name: "Sobre el proyecto", exact: true }).focus();
        for (const name of ["Términos y condiciones", "Privacidad", "Accesibilidad"]) {
          const trigger = page.getByRole("button", { name, exact: true });
          await page.keyboard.press("Tab");
          const focus = await trigger.evaluate((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const describe = (node) => ({
              tag: node.localName, text: node.textContent.trim(),
              focused: node === document.activeElement, focusVisible: node.matches(":focus-visible"),
              outline: getComputedStyle(node).outline, outlineOffset: getComputedStyle(node).outlineOffset,
              boxShadow: getComputedStyle(node).boxShadow,
            });
            const clippingAncestors = [];
            for (let parent = el.parentElement; parent; parent = parent.parentElement) {
              const css = getComputedStyle(parent);
              if ([css.overflowX, css.overflowY].some((value) => value !== "visible")) {
                const box = parent.getBoundingClientRect();
                clippingAncestors.push({ tag: parent.localName, class: parent.className,
                  overflowX: css.overflowX, overflowY: css.overflowY, rect: box.toJSON() });
              }
            }
            return {
              target: describe(el), active: describe(document.activeElement),
              outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
              rect: rect.toJSON(), scrollX, scrollY, viewport: { width: innerWidth, height: innerHeight },
              clippingAncestors,
            };
          });
          const label = `${width}-${name.replaceAll(" ", "-")}`;
          await writeFile(path.join(artifacts, `focus-${label}.json`), JSON.stringify(focus, null, 2));
          if (width === 320 || !focus.target.focused || !focus.target.focusVisible)
            await page.screenshot({ path: path.join(artifacts, `focus-${label}.png`) });
          assert.ok(focus.target.focused, `Keyboard Tab reaches the exact footer button: ${name}`);
          assert.ok(focus.target.focusVisible && focus.outlineStyle !== "none" && focus.outlineWidth >= 2,
            `Visible keyboard focus: ${name}`);
          const ring = focus.outlineWidth + Math.max(0, parseFloat(focus.target.outlineOffset));
          assert.ok(focus.rect.left - ring >= 0 && focus.rect.right + ring <= focus.viewport.width
            && focus.rect.top - ring >= 0 && focus.rect.bottom + ring <= focus.viewport.height,
            `Focus indicator stays within viewport after keyboard scrolling: ${name}`);
          await page.keyboard.press("Enter");
          assert.equal(await page.locator("dialog:modal").count(), 1);
          if (name === "Términos y condiciones") {
            const terms = await page.getByRole("dialog").innerText();
            assert.match(terms, /propuesta académica demostrativa de FurgoPlus/);
            assert.match(terms, /datos ficticios.*únicamente con fines ilustrativos/);
            assert.match(terms, /no existe contratación comercial habilitada/);
            assert.match(terms, /no permite contratar transporte escolar, reservar cupos ni procesar pagos/);
            assert.match(terms, /precios y planes publicados tienen fines académicos y no constituyen una oferta de contratación/);
            await page.getByRole("dialog").screenshot({ path: path.join(artifacts, `terms-${width}.png`) });
          }
          // open=false can precede the queued close event. Wait for that event
          // (and its focus-restoring handler) before tabbing to the next button.
          const dialog = page.locator("dialog");
          await dialog.evaluate((el) => {
            el.removeAttribute("data-qa-close-observed");
            el.addEventListener("close", () => el.setAttribute("data-qa-close-observed", "true"), { once: true });
          });
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => {
            const el = document.querySelector("dialog");
            return !el.open && el.hasAttribute("data-qa-close-observed");
          });
          await dialog.evaluate((el) => el.removeAttribute("data-qa-close-observed"));
          assert.ok(await trigger.evaluate((el) => el === document.activeElement));
        }
      }, page);
      await page.close();
    }
    await cases.run("footer runtime/assets", async () => assert.deepEqual(errors, []));
    await cases.run("footer no external requests", async () => assert.deepEqual(externalRequests, []));
    await cases.finish();
  } finally { await browser.close(); }
}
