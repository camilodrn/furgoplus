import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const demoUrl = "https://demo.furgoplus.cl";
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const dom = new JSDOM(html);
const { document } = dom.window;
for (const section of [".hero-actions", ".cta-inner"]) {
  const internal = document.querySelector(`${section} a[href="#producto"]`);
  assert.ok(internal, `${section} keeps the interactive landing demo`);
  assert.equal(internal.textContent.trim(), "Ver cómo funciona");
  assert.equal(internal.getAttribute("target"), null);
  assert.equal(document.querySelectorAll(`${section} a`).length, 1);
}
for (const selector of [".nav-cta", "#mobile-menu a:last-child", ".demo-explainer > .demo-link"]) {
  const external = document.querySelector(selector);
  assert.equal(external.getAttribute("href"), demoUrl);
  assert.equal(external.getAttribute("target"), "_blank");
  assert.deepEqual(external.rel.split(/\s+/).sort(), ["noopener", "noreferrer"]);
  assert.match(external.querySelector(".sr-only").textContent, /abre en una nueva pestaña/);
  assert.equal(external.querySelector('[aria-hidden="true"]').textContent, "↗");
}
assert.match(document.querySelector(".nav-cta").textContent, /Abrir demo/);
const strip = document.querySelector("#producto .demo-explainer");
assert.equal(strip.children.length, 2, "Closing strip contains only the main text and demo link");
assert.match(strip.querySelector(":scope > p").textContent,
  /Planifica en la web y consulta tu jornada en el celular/);
assert.match(strip.querySelector(":scope > .demo-link").textContent, /Probar la aplicación/);
assert.equal(document.querySelector("#product-demo-note"), null);
assert.equal(document.querySelector(".product-demo-access"), null, "Rejected isolated block is absent");
assert.equal(strip.querySelector(".demo-link").hasAttribute("aria-describedby"), false,
  "Removed description does not leave a broken accessibility reference");
assert.match(document.querySelector(".demo-instruction").textContent,
  /Selecciona un recorrido para verlo en el celular/);
assert.equal(document.querySelector(".demo-instruction").nextElementSibling.id, "experience-panel");
assert.equal(document.querySelectorAll(`a[href="${demoUrl}"]`).length, 3);
for (const link of document.querySelectorAll('a[href]')) {
  const href = link.getAttribute("href");
  if (!href.startsWith("#")) {
    assert.equal(href, demoUrl, "Only the requested public demo is external");
    continue;
  }
  const target = document.getElementById(href.slice(1));
  assert.ok(target, `Internal destination exists: ${href}`);
  if (target.matches("main, section")) assert.equal(target.tabIndex, -1);
}
for (const selector of [".benefit-column .light-link", ".family .light-link"]) {
  assert.equal(document.querySelector(selector).getAttribute("href"), "#producto");
}
assert.ok(document.querySelector('a[href="#como-funciona"]'));
assert.ok(document.querySelector("#tab-conductor"));
assert.ok(document.querySelector("#tab-apoderado"));
assert.match(document.querySelector(".cta-stage").textContent, /Sin inscripciones abiertas/);
dom.window.close();
console.log("PASS: single hero/closing CTAs, navbar/product demo access, external URL, new-tab accessibility/security and preserved internal destinations (generated HTML).");

if (process.argv.includes("--browser")) {
  const { chromium } = await import("./browser-support.mjs");
  const { serveDist, loadPage } = await import("./browser-cases.mjs");
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.LANDING_BROWSER_PATH ? { executablePath: process.env.LANDING_BROWSER_PATH } : {}) });
  } catch (error) {
    console.error("NOT RUN: focused browser checks; Chromium could not start.");
    console.error(String(error).split("\n").find((line) => line.includes("FATAL:")) ?? String(error).split("\n")[0]);
    process.exit(1);
  }
  try {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const errors = [], unexpected = [];
    await serveDist(context, errors, unexpected);
    // Fulfil only the exact demo destination: tests verify popup navigation
    // without relying on or interacting with the live public service.
    await context.route(`${demoUrl}/`, (route) => route.fulfill({ contentType: "text/html", body: "Demo destination test" }));
    for (const width of [1440, 1000, 701, 390, 320]) {
      const page = await context.newPage();
      await loadPage(page, width);
      for (const section of [".hero-actions", ".cta-inner"]) {
        const internal = page.locator(`${section} a[href="#producto"]`);
        await internal.click();
        assert.equal(new URL(page.url()).hash, "#producto");
        await page.waitForFunction(() => document.activeElement.id === "producto");
      }
      const navigationSelector = width > 960 ? ".nav-cta" : "#mobile-menu a:last-child";
      for (const selector of [navigationSelector, ".demo-explainer > .demo-link"]) {
        if (selector.startsWith("#mobile-menu")) {
          await page.locator(".menu-button").click();
          assert.equal(await page.locator(".menu-button").getAttribute("aria-expanded"), "true");
        }
        const external = page.locator(selector);
        await external.scrollIntoViewIfNeeded();
        const box = await external.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.height >= 44,
          `${selector} fits and retains its touch target at ${width}px`);
        await external.focus();
        const popupReady = page.waitForEvent("popup");
        await page.keyboard.press("Enter");
        const popup = await popupReady;
        await popup.waitForLoadState("domcontentloaded");
        assert.equal(popup.url(), `${demoUrl}/`);
        assert.equal(await popup.evaluate(() => window.opener), null);
        assert.equal(new URL(page.url()).hash, "#producto", "Original page stays on the landing");
        await popup.close();
        if (selector.startsWith("#mobile-menu")) {
          assert.equal(await page.locator(".menu-button").getAttribute("aria-expanded"), "false");
        }
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const closing = await page.locator("#producto").evaluate((section) => {
        const strip = section.querySelector(".demo-explainer");
        const text = strip.querySelector(":scope > p").getBoundingClientRect();
        const link = strip.querySelector(":scope > .demo-link").getBoundingClientRect();
        const bounds = strip.getBoundingClientRect();
        const sectionBounds = section.getBoundingClientRect();
        const style = getComputedStyle(section);
        return {
          bottomSpace: sectionBounds.bottom - Math.max(text.bottom, link.bottom)
            - parseFloat(style.borderBottomWidth),
          topSpace: Math.min(text.top, link.top) - bounds.top
            - parseFloat(getComputedStyle(strip).borderTopWidth),
          centerDifference: Math.abs((text.top + text.bottom - link.top - link.bottom) / 2),
          mobileGap: link.top - text.bottom,
        };
      });
      assert.ok(closing.bottomSpace >= 24 && closing.bottomSpace <= 32,
        `Product closing bottom spacing stays compact at ${width}px`);
      assert.ok(closing.topSpace >= 24 && closing.topSpace <= 32,
        `Product divider keeps comfortable spacing at ${width}px`);
      if (width > 700) assert.ok(closing.centerDifference <= 1, "Desktop text/link align vertically");
      else assert.ok(closing.mobileGap >= 0 && closing.mobileGap <= 12, "Mobile closing stays compact without overlap");
      await page.locator("#tab-apoderado").click();
      assert.equal(await page.locator("#tab-apoderado").getAttribute("aria-selected"), "true");
      await page.locator("#tab-conductor").click();
      assert.equal(await page.locator("#tab-conductor").getAttribute("aria-selected"), "true");
      await page.close();
      console.log(`PASS: focused CTA navigation, popups and interactive demo at ${width}px.`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
  } finally { await browser.close(); }
}
