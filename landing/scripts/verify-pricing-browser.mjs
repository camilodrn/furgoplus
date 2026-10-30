import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCaseRunner, serveDist, freshPage, loadPage, widths } from "./browser-cases.mjs";
import { chromium } from "./browser-support.mjs";
import { assertNoPageOverflow } from "./overflow-diagnostics.mjs";

// Run after npm run build. All resources are served by interception, without
// opening a port, using a user browser or contacting any external service.
const artifacts = process.env.LANDING_QA_DIR
  ? path.resolve(process.env.LANDING_QA_DIR, "pricing")
  : fileURLToPath(new URL("../qa-artifacts/pricing/", import.meta.url));
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
  console.error("Pricing browser checks NOT RUN: Chromium could not start.");
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
  const errors = [];
  const externalRequests = [];
  await serveDist(context, errors, externalRequests);
  const cases = createCaseRunner({ artifacts, suite: "pricing", browser });
  let page;
  for (const width of widths) {
    page = await freshPage(context, errors);
    await cases.run(`${width}px pricing keyboard, amounts, AX and layout`, async () => {
      await loadPage(page, width, 960);
      const group = page.getByRole("group", { name: "Opciones de IVA" });
      const total = group.getByRole("button", {
        name: "IVA incluido",
        exact: true,
      });
      const breakdown = group.getByRole("button", {
        name: "Desglose",
        exact: true,
      });
      const expected = [
        ["Básico", "$19.990", "$16.798", "$3.192"],
        ["Pro", "$39.990", "$33.605", "$6.385"],
        ["Elite", "$69.990", "$58.815", "$11.175"],
      ];
      const checkCards = async (expanded) => {
        assert.equal(
          await page.locator(".plan-breakdown").count(),
          expanded ? 3 : 0,
        );
        for (const [name, gross, net, iva] of expected) {
          const card = page.getByRole("article", { name, exact: true });
          assert.equal(
            await card.locator(".plan-price").innerText(),
            `${gross}\nCLP / mes`,
          );
          assert.ok(await card.locator(".plan-price").isVisible());
          // Semantic tree exposed to assistive technology, including persistent
          // totals. This does not claim to test real screen-reader speech.
          const snapshot = await card.ariaSnapshot();
          assert.ok(snapshot.includes("Total con IVA incluido"));
          assert.ok(snapshot.includes(gross));
          assert.equal(
            await card.getAttribute("aria-describedby"),
            "pricing-academic-note",
          );
          assert.equal(await card.locator(".pricing-feature").count(), 3);
          if (expanded) {
            assert.ok(snapshot.includes("Valor neto"));
            assert.ok(snapshot.includes("IVA (19 %)"));
            assert.ok(snapshot.includes(`${net} CLP`));
            assert.ok(snapshot.includes(`${iva} CLP`));
          } else {
            assert.ok(!snapshot.includes("Valor neto"));
          }
        }
      };
      await assertNoPageOverflow(page, artifacts, `${width}px IVA included`);
      assert.equal(
        await total.getAttribute("aria-pressed"),
        "true",
        "Default view includes IVA",
      );
      await checkCards(false);
      assert.ok(
        await group.evaluate((el) => !!el.closest(".plans-heading")),
        "Control stays in the existing heading",
      );
      if (width > 800) {
        const heading = await page.locator(".plans-heading").boundingBox();
        const cards = await page.locator("#pricing-cards").boundingBox();
        assert.ok(
          cards.y - (heading.y + heading.height) <= 40,
          "Cards follow the heading without explanatory blocks",
        );
        await page.locator(".plans-heading").scrollIntoViewIfNeeded();
        assert.ok(
          await page
            .locator(".plan-price")
            .evaluateAll((els) =>
              els.every((el) => el.getBoundingClientRect().bottom <= innerHeight),
            ),
          "Heading, selector and all three prices fit in the desktop viewport",
        );
      }
      const controlSize = await group.boundingBox();
      assert.ok(controlSize.width <= 300, `IVA control too wide at ${width}px`);
      assert.ok(controlSize.height <= 50, `IVA control too tall at ${width}px`);
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${artifacts}/${width}-included.png`,
        fullPage: true,
      });
      await total.focus();
      await page.keyboard.press("Shift+Tab");
      assert.ok(
        !(await group.evaluate((el) => el.contains(document.activeElement))),
      );
      await page.keyboard.press("Tab");
      assert.ok(await total.evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Tab");
      assert.ok(await breakdown.evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Enter");
      assert.equal(await breakdown.getAttribute("aria-pressed"), "true");
      assert.ok(await breakdown.evaluate((el) => el === document.activeElement));
      assert.match(
        await page.getByRole("status").textContent(),
        /Desglose visible/,
      );
      await checkCards(true);
      await page.keyboard.press("Tab");
      assert.ok(
        await page
          .locator(".comparison-details > summary")
          .evaluate((el) => el === document.activeElement),
      );
      await page.keyboard.press("Shift+Tab");
      assert.ok(await breakdown.evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Shift+Tab");
      assert.ok(await total.evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Space");
      assert.equal(await total.getAttribute("aria-pressed"), "true");
      await checkCards(false);
      // Both native buttons support Space and preserve focus.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Space");
      assert.equal(await breakdown.getAttribute("aria-pressed"), "true");
      await checkCards(true);

      // Inspect Chromium's actual accessibility tree for native group/button
      // names, states, description and live-region semantics.
      const cdp = await context.newCDPSession(page);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const axGroup = nodes.find(
        (node) =>
          node.role?.value === "group" && node.name?.value === "Opciones de IVA",
      );
      assert.match(
        axGroup?.description?.value ?? "",
        /Propuesta académica · Precios referenciales con IVA, sin contratación habilitada/,
      );
      for (const [label, checked] of [
        ["IVA incluido", false],
        ["Desglose", true],
      ]) {
        const button = nodes.find(
          (node) => node.role?.value === "button" && node.name?.value === label,
        );
        assert.ok(button, `Missing accessible button: ${label}`);
        assert.equal(
          button.properties.find((property) => property.name === "pressed")?.value
            .value,
          String(checked),
        );
      }
      const status = nodes.find((node) => node.role?.value === "status");
      assert.equal(
        status?.properties.find((property) => property.name === "live")?.value
          .value,
        "polite",
      );
      await cdp.detach();

      await assertNoPageOverflow(page, artifacts, `${width}px IVA breakdown`);
      const layoutIssues = await page
        .locator(".pricing-view, .plan")
        .evaluateAll((roots) =>
          roots.flatMap((root) =>
            [...root.querySelectorAll("button, p:not(.sr-only), dt, dd")].flatMap(
              (el) => {
                const style = getComputedStyle(el);
                const issues = [];
                if (el.scrollWidth > el.clientWidth + 1)
                  issues.push(`Overflow: ${el.textContent}`);
                if (parseFloat(style.fontSize) < 14)
                  issues.push(`Small text: ${el.textContent}`);
                if (
                  el.matches("button") &&
                  el.getBoundingClientRect().height < 44
                )
                  issues.push("Small button target");
                return issues;
              },
            ),
          ),
        );
      assert.deepEqual(layoutIssues, [], `${width}px pricing layout`);
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${artifacts}/${width}-breakdown.png`,
        fullPage: true,
      });
      await total.click();
      await checkCards(false);
    }, page);
    await page.close();
  }
  await cases.run("pricing runtime/assets", async () => assert.deepEqual(errors, []));
  await cases.run("pricing no external requests", async () => assert.deepEqual(externalRequests, []));
  await cases.run("pricing no cookies", async () => assert.deepEqual(await context.cookies(), []));
  await cases.finish();
  console.log(`Screenshots: ${artifacts}. Actual screen-reader speech still requires manual review.`);
} finally {
  await browser.close();
}
