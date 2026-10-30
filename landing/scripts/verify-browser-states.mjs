import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./browser-support.mjs";
import { createCaseRunner, serveDist, freshPage, loadPage } from "./browser-cases.mjs";
import { assertNoPageOverflow } from "./overflow-diagnostics.mjs";
import { startDialogFocusTrace, assertDialogFocusCycle } from "./verify-dialog-focus.mjs";

async function motionState(page, step) {
  return page.evaluate((step) => ({
    step, time: performance.now(), reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    elements: [...document.querySelectorAll(".reveal,.hero-copy,.hero-art,.map-label-home,.map-label-school,.animated-route,.product-layout")].map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        className: el.getAttribute("class"), text: el.textContent.trim().slice(0, 70),
        opacity: style.opacity, transform: style.transform, visibility: style.visibility,
        transitionDuration: style.transitionDuration, transitionDelay: style.transitionDelay,
        animationName: style.animationName, top: rect.top, bottom: rect.bottom,
        animations: el.getAnimations().map((animation) => ({
          type: animation.constructor.name, playState: animation.playState,
          currentTime: animation.currentTime, timing: animation.effect.getComputedTiming()
        }))
      };
    }),
  }), step);
}

// Synchronize to the browser rendering lifecycle, never a guessed sleep.
async function rendered(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function assertReadable(state) {
  assert.ok(state.elements.length > 0, "Motion fixture must contain content");
  assert.deepEqual(state.elements.filter((el) => el.opacity !== "1" || el.visibility !== "visible").map(({ className, opacity, visibility }) => ({ className, opacity, visibility })), [],
    `All content immediately readable: ${state.step}`);
}

async function saveMotion(page, artifacts, label, states) {
  await writeFile(`${artifacts}/motion-${label}.json`, JSON.stringify(states, null, 2) + "\n");
}

export async function runMotionCases(run, artifacts) {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 225]]) {
    await run(`motion ${width} initial reduce and audience update`, width, height, async (page) => {
      const states = [await motionState(page, "initial reduce")];
      await page.locator("#tab-apoderado").click();
      states.push(await motionState(page, "parent mounted under reduce"));
      await saveMotion(page, artifacts, `${width}-initial`, states);
      for (const state of states) {
        assertReadable(state);
        assert.equal(state.scrollBehavior, "auto");
        assert.ok(state.elements.every((el) => el.animationName === "none"), "No reduced-motion animation");
      }
    });
    await run(`motion ${width} normal to reduce timeline`, width, height, async (page) => {
      const states = [await motionState(page, "normal before change")];
      assert.ok(states[0].elements.some((el) => el.className.includes("reveal-pending")), "Exercise offscreen pending reveals");
      await page.emulateMedia({ reducedMotion: "reduce" });
      states.push(await motionState(page, "immediately after reduce"));
      await rendered(page);
      states.push(await motionState(page, "after render frames"));
      // Observe completion for diagnosis only. The assertion below still uses
      // the immediate snapshot; waiting cannot turn a hidden frame into PASS.
      await page.waitForFunction(() => [...document.querySelectorAll(".reveal")]
        .every((el) => getComputedStyle(el).opacity === "1"));
      states.push(await motionState(page, "settled"));
      await saveMotion(page, artifacts, `${width}-change`, states);
      assertReadable(states[1]);
      assertReadable(states[2]);
    }, "no-preference");
    await run(`motion ${width} reduce during reveal transition`, width, height, async (page) => {
      await page.locator(".family").evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await page.waitForFunction(() => document.querySelector(".family").getAnimations()
        .some((animation) => animation.constructor.name === "CSSTransition" && animation.playState === "running"));
      const states = [await motionState(page, "reveal transition active")];
      await page.emulateMedia({ reducedMotion: "reduce" });
      states.push(await motionState(page, "reduce cancels active reveal"));
      await saveMotion(page, artifacts, `${width}-interrupted`, states);
      assertReadable(states[1]);
      assert.ok(states[1].elements.every((el) => el.animations.length === 0), "Reduced motion cancels active content animations");
    }, "no-preference");
    await run(`motion ${width} repeated preference changes`, width, height, async (page) => {
      const states = [];
      for (const preference of ["reduce", "no-preference", "reduce", "no-preference"]) {
        await page.emulateMedia({ reducedMotion: preference });
        await rendered(page);
        // Await actual finite transitions to distinguish persistent re-hiding
        // from an intermediate frame when restoring normal motion.
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => { }))));
        states.push(await motionState(page, preference));
      }
      await saveMotion(page, artifacts, `${width}-roundtrip`, states);
      for (const state of states) assertReadable(state);
    }, "no-preference");
    await run(`motion ${width} keyboard focus in pending content`, width, height, async (page) => {
      const target = page.locator(".family .light-link");
      await target.focus();
      const evidence = await target.evaluate((el) => ({
        focused: el === document.activeElement,
        ancestors: [...function*() { for (let node = el; node; node = node.parentElement) yield node; }()]
          .map((node) => ({
            className: node.className, opacity: getComputedStyle(node).opacity,
            visibility: getComputedStyle(node).visibility
          })),
      }));
      await writeFile(`${artifacts}/motion-${width}-focus.json`, JSON.stringify(evidence, null, 2) + "\n");
      assert.ok(evidence.focused);
      assert.ok(evidence.ancestors.every((el) => el.opacity === "1" && el.visibility === "visible"),
        "Focused controls must not remain inside transparent reveal content");
    }, "no-preference");
  }
  await run("normal motion scroll reveals every section", 390, 844, async (page) => {
    for (const el of await page.locator(".reveal").all()) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForFunction((node) => getComputedStyle(node).opacity === "1", await el.elementHandle());
    }
    assertReadable(await motionState(page, "all revealed after scroll"));
    await assertNoPageOverflow(page, artifacts, "normal motion after full scroll");
  }, "no-preference");
  await run("no IntersectionObserver fallback", 390, 844, async (page) => {
    await page.addInitScript(() => { delete window.IntersectionObserver; });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator(".reveal-pending").count(), 0);
    assert.ok(await page.locator(".reveal").evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1")));
  }, "no-preference");
}

export async function runResizeCases(run, artifacts) {
  for (const source of ["mobile link", "mobile button", "desktop link", "desktop CTA"]) {
    const mobile = source.startsWith("mobile");
    await run(`resize focus ${source} across 960px`, mobile ? 960 : 961, 900, async (page) => {
      if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click();
      const selector = {
        "mobile link": '#mobile-menu a[href="#planes"]', "mobile button": ".menu-button",
        "desktop link": '.desktop-nav a[href="#planes"]', "desktop CTA": ".nav-cta"
      }[source];
      await page.locator(selector).focus();
      await page.setViewportSize({ width: mobile ? 961 : 960, height: 900 });
      await rendered(page);
      const state = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el.localName, className: el.className, text: el.textContent.trim().slice(0, 60),
          visible: el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible",
          body: el === document.body, menuHidden: document.querySelector("#mobile-menu").hidden
        };
      });
      await writeFile(`${artifacts}/resize-${source.replaceAll(" ", "-")}.json`, JSON.stringify(state, null, 2) + "\n");
      assert.ok(!state.body && state.visible, "Resizing must preserve focus on a visible navigation control");
      if (mobile) {
        assert.ok(state.menuHidden, "Desktop closes the mobile menu state");
        await page.setViewportSize({ width: 390, height: 844 });
        await rendered(page);
        assert.equal(await page.locator("#mobile-menu").isVisible(), false, "Returning to mobile must not reopen a stale menu");
      }
    });
  }
  await run("resize does not steal focus outside navigation", 390, 844, async (page) => {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.locator("#tab-apoderado").focus();
    await page.setViewportSize({ width: 1440, height: 900 });
    await rendered(page);
    assert.ok(await page.locator("#tab-apoderado").evaluate((el) => el === document.activeElement));
    await page.setViewportSize({ width: 390, height: 844 });
    await rendered(page);
    assert.ok(await page.locator("#tab-apoderado").evaluate((el) => el === document.activeElement));
    assert.equal(await page.locator("#mobile-menu").isVisible(), false);
  });
  await run("resize expanded content and open modal without reload", 1440, 900, async (page) => {
    await page.locator("#tab-apoderado").click();
    await page.getByRole("button", { name: "Perfil B" }).click();
    await page.getByRole("button", { name: "Desglose", exact: true }).click();
    await page.locator(".comparison-details > summary").click();
    for (const [width, height] of [[320, 225], [1000, 700], [390, 844], [1920, 960]]) {
      await page.setViewportSize({ width, height });
      await assertNoPageOverflow(page, artifacts, `live resize ${width}`);
      assert.match(await page.locator(".phone-profile").innerText(), /Transportista B/);
      assert.equal(await page.locator(".plan-breakdown").count(), 3);
      assert.ok(await page.locator(".comparison-details").evaluate((el) => el.open));
    }
    await page.getByRole("button", { name: "Accesibilidad", exact: true }).click();
    await page.setViewportSize({ width: 320, height: 225 });
    await assertNoPageOverflow(page, artifacts, "live resize dialog 320");
    await startDialogFocusTrace(page);
    await assertDialogFocusCycle(page, artifacts, "live-resize-dialog");
    await page.keyboard.press("Escape");
    assert.ok(await page.getByRole("button", { name: "Accesibilidad", exact: true }).evaluate((el) => el === document.activeElement));
  });
  for (const width of [1440, 390, 320]) {
    for (const audience of ["conductor", "apoderado"]) {
      for (const textSize of [100, 200]) {
        const label = `${textSize}% text ${width}px ${audience}`;
        await run(label, width, 900, async (page) => {
          await page.addStyleTag({ content: `html { font-size: ${textSize}%; }` });
          await page.locator(`#tab-${audience}`).click();
          await page.getByRole("button", { name: "Desglose", exact: true }).click();
          const clipped = await inspectClippedText(page);
          await writeFile(`${artifacts}/text-${textSize}-${width}-${audience}.json`, JSON.stringify(clipped, null, 2) + "\n");
          await assertNoPageOverflow(page, artifacts, label);
          assert.deepEqual(clipped, [], `Visible text clipped by non-scrollable containers: ${label}`);
          await page.screenshot({ path: `${artifacts}/text-${textSize}-${width}-${audience}.png`, fullPage: true });
        });
      }
    }
  }
}

async function inspectClippedText(page) {
  return page.evaluate(() => {
    const issues = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, el = node.parentElement;
      if (!node.textContent.trim() || el.closest('svg,script,style,.sr-only,[aria-hidden="true"]') || !el.getClientRects().length) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width && r.height);
      for (let parent = el; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
        const clipX = /^(hidden|clip)$/.test(style.overflowX);
        const clipY = /^(hidden|clip)$/.test(style.overflowY);
        if (rects.some((r) => (clipX && (r.left < rect.left - 1 || r.right > rect.right + 1)) ||
          (clipY && (r.top < rect.top - 1 || r.bottom > rect.bottom + 1)))) {
          issues.push({ text: node.textContent.trim(), element: el.className, container: parent.className,
            overflowX: style.overflowX, overflowY: style.overflowY });
          break;
        }
      }
    }
    return issues;
  });
}

async function main() {
  const artifacts = process.env.LANDING_QA_DIR ? path.resolve(process.env.LANDING_QA_DIR)
    : fileURLToPath(new URL("../qa-artifacts/states/", import.meta.url));
  await mkdir(artifacts, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.LANDING_BROWSER_PATH ? { executablePath: process.env.LANDING_BROWSER_PATH } : {}) });
  } catch (error) {
    await writeFile(`${artifacts}/states-browser-launch-error.log`, String(error));
    console.error("State browser checks NOT RUN: Chromium could not start.");
    process.exitCode = 1;
    return;
  }
  try {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const errors = [], external = [];
    await serveDist(context, errors, external);
    const cases = createCaseRunner({ artifacts, suite: "states", browser });
    const run = async (name, width, height, action, motion = "reduce") => {
      const page = await freshPage(context, errors);
      try {
        return await cases.run(name, async () => {
          await loadPage(page, width, height, motion);
          await action(page);
        }, page);
      } finally { await page.close(); }
    };
    await runMotionCases(run, artifacts);
    await runResizeCases(run, artifacts);
    const noJS = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    await serveDist(noJS, errors, external);
    const staticPage = await freshPage(noJS, errors);
    await cases.run("prerender readable without JavaScript", async () => {
      await loadPage(staticPage, 320, 900);
      assert.equal(await staticPage.locator("h1").count(), 1);
      assert.ok(await staticPage.locator(".reveal").evaluateAll((els) => els.length > 0 && els.every((el) => getComputedStyle(el).opacity === "1")));
      assert.equal(await staticPage.locator(".plan-price").count(), 3);
      await staticPage.locator(".comparison-details > summary").click();
      assert.ok(await staticPage.locator(".comparison-details").evaluate((el) => el.open));
      await assertNoPageOverflow(staticPage, artifacts, "JavaScript disabled expanded comparison");
    }, staticPage);
    await noJS.close();
    await cases.run("states runtime/assets", async () => assert.deepEqual(errors, []));
    await cases.run("states no external requests", async () => assert.deepEqual(external, []));
    await cases.run("states no cookies", async () => assert.deepEqual(await context.cookies(), []));
    await cases.finish();
  } finally { await browser.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
