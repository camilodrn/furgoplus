import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCaseRunner, serveDist, freshPage, loadPage } from "./browser-cases.mjs";
import { chromium } from "./browser-support.mjs";

export async function startDialogFocusTrace(page) {
  await page.evaluate(() => {
    window.__dialogFocusEvents = [];
    window.__dialogFocusSteps = [];
    if (window.__dialogFocusListener) return;
    window.__dialogFocusListener = true;
    const describe = (el) => el ? {
      tag: el.localName, id: el.id,
      class: el.getAttribute?.("class"), name: el.getAttribute?.("aria-label") || el.textContent?.trim().slice(0, 80)
    } : null;
    for (const type of ["focusin", "focusout", "keydown"]) {
      document.addEventListener(type, (event) => {
        if (type === "keydown" && !["Tab", "Escape"].includes(event.key)) return;
        const dialog = document.querySelector("dialog");
        window.__dialogFocusEvents.push({
          type, time: performance.now(), key: event.key,
          shift: event.shiftKey, prevented: event.defaultPrevented,
          target: describe(event.target), relatedTarget: describe(event.relatedTarget),
          active: describe(document.activeElement), documentHasFocus: document.hasFocus(),
          open: dialog.open, inside: dialog.contains(document.activeElement)
        });
        if (window.__dialogFocusEvents.length > 200) window.__dialogFocusEvents.shift();
      });
    }
  });
}

export async function recordDialogFocus(page, directory, label, step) {
  const report = await page.evaluate((step) => {
    const dialog = document.querySelector("dialog");
    const el = document.activeElement;
    const style = getComputedStyle(el);
    const state = {
      step, time: performance.now(), open: dialog.open,
      modal: dialog.matches(":modal"), inside: dialog.contains(el),
      documentHasFocus: document.hasFocus(),
      active: {
        tag: el.localName, id: el.id, class: el.getAttribute("class"),
        name: el.getAttribute("aria-label") || el.textContent.trim().slice(0, 80)
      },
      closeFocused: el === dialog.querySelector(".dialog-close"),
      confirmFocused: el === dialog.querySelector(".dialog-content > .button"),
      outline: style.outlineStyle, outlineWidth: style.outlineWidth
    };
    window.__dialogFocusSteps.push(state);
    return { state, steps: window.__dialogFocusSteps, events: window.__dialogFocusEvents };
  }, step);
  const file = path.join(directory, `dialog-focus-${label.replace(/[^a-z0-9-]/gi, "-")}.json`);
  await writeFile(file, JSON.stringify({ label, ...report }, null, 2) + "\n");
  return { ...report.state, file };
}

export async function assertDialogFocusCycle(page, directory, label) {
  let state = await recordDialogFocus(page, directory, label, "opened");
  assert.ok(state.open && state.modal, `Dialog must be natively modal: ${state.file}`);
  assert.ok(state.closeFocused, `Opening focuses Cerrar información: ${state.file}`);
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 6; i++) {
      const wasClose = state.closeFocused;
      await page.keyboard.press(key);
      state = await recordDialogFocus(page, directory, label, `${key} ${i + 1}`);
      // Keep the original containment requirement; body/browser-chrome focus
      // is not accepted as a passing intermediate state.
      assert.equal(state.inside, true, `Native dialog must contain focus: ${state.file}`);
      assert.ok(state.open && state.modal, `Tab must preserve the modal: ${state.file}`);
      assert.ok(wasClose ? state.confirmFocused : state.closeFocused,
        `Both dialog controls must remain reachable: ${state.file}`);
      assert.ok(state.outline !== "none" && parseFloat(state.outlineWidth) >= 2,
        `Dialog keyboard focus must remain visible: ${state.file}`);
    }
  }
}

async function run() {
  const artifacts = process.env.LANDING_QA_DIR ? path.resolve(process.env.LANDING_QA_DIR)
    : fileURLToPath(new URL("../qa-artifacts/dialog-focus/", import.meta.url));
  await mkdir(artifacts, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.LANDING_BROWSER_PATH ? { executablePath: process.env.LANDING_BROWSER_PATH } : {})
    });
  } catch (error) {
    await writeFile(path.join(artifacts, "browser-launch-error.log"), String(error));
    console.error("Dialog focus browser checks NOT RUN: Chromium could not start.");
    console.error(String(error).split("\n").find((line) => line.includes("FATAL:")) || String(error).split("\n")[0]);
    process.exitCode = 1;
    return;
  }
  try {
    console.log(`Chromium ${browser.version()}`);
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const errors = [];
    const externalRequests = [];
    await serveDist(context, errors, externalRequests);
    const cases = createCaseRunner({ artifacts, suite: "dialog", browser });
    for (const width of [1440, 390, 360, 320]) {
      for (const name of ["Términos y condiciones", "Privacidad", "Sobre el proyecto", "Accesibilidad"]) {
        for (const close of ["Escape", "Cerrar información", "Entendido"]) {
          const label = `${width}-${name}-${close}`;
          const page = await freshPage(context, errors);
          await cases.run(label, async () => {
            await loadPage(page, width, 900);
            const trigger = page.getByRole("button", { name, exact: true });
            await startDialogFocusTrace(page);
            await trigger.focus();
            await page.keyboard.press("Enter");
            await assertDialogFocusCycle(page, artifacts, label);
            if (close === "Escape") await page.keyboard.press("Escape");
            else await page.getByRole("button", { name: close, exact: true }).click();
            await page.waitForFunction(() => !document.querySelector("dialog").open);
            const state = await recordDialogFocus(page, artifacts, label, `closed by ${close}`);
            assert.equal(state.open, false, `Dialog closes: ${state.file}`);
            assert.ok(await trigger.evaluate((el) => el === document.activeElement),
              `Closing restores the exact opener: ${state.file}`);
          }, page);
          await page.close();
        }
      }
    }
    await cases.run("dialog runtime/assets", async () => assert.deepEqual(errors, [], "Dialog runtime errors"));
    await cases.run("dialog no external requests", async () => assert.deepEqual(externalRequests, []));
    await cases.run("dialog no cookies", async () => assert.deepEqual(await context.cookies(), []));
    await cases.finish();
  } finally { await browser.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
