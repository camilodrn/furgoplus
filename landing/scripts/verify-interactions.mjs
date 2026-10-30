import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import React, { act } from "react";
import { createServer } from "vite";
import { JSDOM } from "jsdom";

// DOM interaction evidence only. Native dialog behavior, rendering and focus
// trapping belong to the real-browser suite, never to jsdom emulation.
const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const dom = new JSDOM(html, {
  url: "https://landing.furgoplus.test/",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLDetailsElement",
  "HTMLDialogElement",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
]) {
  globalThis[key] =
    key === "window"
      ? dom.window
      : key === "document"
        ? dom.window.document
        : dom.window[key];
}
dom.window.matchMedia = (query) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  addEventListener() {},
  removeEventListener() {},
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: "custom",
});
let reactRoot;
try {
  const { App } = await server.ssrLoadModule("/src/App.tsx");
  const { hydrateRoot } = await import("react-dom/client");
  const hydrationErrors = [];
  await act(async () => {
    reactRoot = hydrateRoot(
      document.getElementById("root"),
      React.createElement(App),
      { onRecoverableError: (error) => hydrationErrors.push(error.message) },
    );
  });
  assert.deepEqual(
    hydrationErrors,
    [],
    "Prerender must hydrate without mismatches",
  );
  assert.equal(
    document.querySelectorAll(".reveal-pending").length,
    0,
    "Reduced motion keeps sections visible",
  );
  const click = async (selector) => {
    const element = document.querySelector(selector);
    assert.ok(element, `Missing control: ${selector}`);
    await act(async () => {
      element.click();
    });
  };
  const priceTotals = [...document.querySelectorAll(".plan-price")].map(
    (el) => el.textContent,
  );
  await click(".plans-heading .pricing-view button:last-child");
  assert.equal(document.querySelectorAll(".plan-breakdown").length, 3);
  assert.deepEqual(
    [...document.querySelectorAll(".plan-price")].map((el) => el.textContent),
    priceTotals,
  );
  await click(".plans-heading .pricing-view button:first-child");
  assert.equal(document.querySelectorAll(".plan-breakdown").length, 0);
  await click(".route-row:nth-child(2)");
  assert.match(
    document.querySelector(".route-detail").textContent,
    /Regreso a casa.*15:30 a 16:15/,
  );
  assert.match(document.querySelector(".phone-route").textContent, /5 de 8/);
  await click("#tab-apoderado");
  assert.equal(
    document.querySelector("#tab-apoderado").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    document.querySelector("#experience-panel").getAttribute("aria-labelledby"),
    "tab-apoderado",
  );
  await click(".profile-switch button:nth-child(2)");
  assert.match(
    document.querySelector(".phone-profile").textContent,
    /Transportista B.*15:30–16:15/s,
  );
  await act(async () => {
    document
      .querySelector("#tab-apoderado")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      );
  });
  assert.equal(
    document.querySelector("#tab-conductor").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(document.activeElement.id, "tab-conductor");
  await act(async () => {
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });
  assert.equal(document.activeElement.id, "tab-apoderado");
  assert.equal(document.querySelector("#tab-conductor").tabIndex, -1);
  await act(async () => {
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
  });
  assert.equal(document.activeElement.id, "tab-apoderado");
  await act(async () => {
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });
  assert.equal(document.activeElement.id, "tab-conductor");
  await click(".benefit-column:not(.family) .light-link");
  assert.equal(
    document.querySelector("#tab-conductor").getAttribute("aria-selected"),
    "true",
  );
  await click(".family .light-link");
  assert.equal(
    document.querySelector("#tab-apoderado").getAttribute("aria-selected"),
    "true",
  );
  await click(".menu-button");
  assert.equal(document.querySelector("#mobile-menu").hidden, false);
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  assert.equal(document.querySelector("#mobile-menu").hidden, true);
  assert.equal(document.activeElement, document.querySelector(".menu-button"));
  await click(".menu-button");
  await click("#mobile-menu a");
  assert.equal(document.querySelector("#mobile-menu").hidden, true);
  // Test application focus handlers, not the browser's native Tab/Escape logic.
  // These stubs only expose open/close lifecycle events to the React component.
  const dialog = document.querySelector("dialog");
  dialog.showModal = () => dialog.setAttribute("open", "");
  dialog.close = () => {
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  };
  const info = [...document.querySelectorAll(".footer-column button")];
  const footer = document.querySelector("footer");
  assert.doesNotMatch(footer.textContent, /Dominio previsto/i);
  assert.match(footer.textContent, /Proyecto académico\s+demostrativo/);
  assert.equal(document.querySelectorAll("dialog").length, 1, "All information shares one dialog");
  for (const link of footer.querySelectorAll("a")) {
    assert.ok(link.hash.length > 1 && document.getElementById(link.hash.slice(1)), "Footer links have existing destinations");
  }
  const terms = info.find((button) => button.textContent.trim() === "Términos y condiciones");
  assert.ok(terms, "Terms are reachable from the footer");
  await act(async () => { terms.click(); });
  assert.match(dialog.textContent, /propuesta académica demostrativa de FurgoPlus/);
  assert.match(dialog.textContent, /datos ficticios.*únicamente con fines ilustrativos/);
  assert.match(dialog.textContent, /no existe contratación comercial habilitada/);
  assert.match(dialog.textContent, /no permite contratar transporte escolar, reservar cupos ni procesar pagos/);
  assert.match(dialog.textContent, /precios y planes publicados tienen fines académicos y no constituyen una oferta de contratación/);
  assert.equal(document.activeElement, dialog.querySelector(".dialog-close"));
  await click(".dialog-content > .button");
  assert.equal(document.activeElement, terms, "Terms restore their own opener");
  const privacy = info.find((button) => button.textContent.trim() === "Privacidad");
  await act(async () => {
    info
      .find(
        (button) => button.textContent.trim() === "Privacidad",
      )
      .click();
  });
  assert.match(dialog.textContent, /mismo sitio/);
  assert.match(dialog.textContent, /dirección IP/);
  assert.match(dialog.textContent, /registros de acceso/);
  assert.doesNotMatch(dialog.textContent, /Tu visita, sin datos personales/);
  const first = dialog.querySelector(".dialog-close");
  const last = dialog.querySelector(".dialog-content > .button");
  assert.equal(document.activeElement, first, "Opening focuses inside after the content update commits");
  const tab = async (element, shiftKey = false, ctrlKey = false) => {
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, ctrlKey,
      bubbles: true, cancelable: true });
    await act(async () => { element.dispatchEvent(event); });
    return event.defaultPrevented;
  };
  for (let cycle = 0; cycle < 3; cycle++) {
    assert.equal(await tab(first, true), true, "Reverse boundary is handled");
    assert.equal(document.activeElement, last, "Shift+Tab reaches the final control");
    assert.equal(await tab(last), true, "Forward boundary is handled");
    assert.equal(document.activeElement, first, "Tab wraps to the first control");
  }
  assert.equal(await tab(first), false, "Forward movement inside stays native");
  last.focus(); // jsdom has no native sequential keyboard navigation.
  assert.equal(await tab(last, true), false, "Reverse movement inside stays native");
  assert.equal(await tab(last, false, true), false, "Browser Ctrl+Tab shortcut is not intercepted");
  await click(".dialog-close");
  assert.equal(dialog.hasAttribute("open"), false);
  assert.equal(document.activeElement, privacy, "Closing restores the actual privacy opener");
  await act(async () => {
    info
      .find((button) => button.textContent.trim() === "Sobre el proyecto")
      .click();
  });
  assert.match(
    dialog.textContent,
    /Noviembre de 2026.*Feria de Software 2027/s,
  );
  assert.match(dialog.textContent, /Aspiramos/);
  assert.doesNotMatch(dialog.textContent, /dominio previsto|no implica que esté publicado/i);
  assert.equal(document.activeElement, first, "Content changes preserve the initial focus target");
  await click(".dialog-content > .button");
  assert.equal(document.activeElement, info.find((button) => button.textContent.trim() === "Sobre el proyecto"));
  const accessibility = info.find((button) => button.textContent.trim() === "Accesibilidad");
  await act(async () => { accessibility.click(); });
  assert.equal(document.activeElement, first);
  await act(async () => { dialog.click(); });
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, accessibility, "Backdrop closure restores its own opener");
  console.log(
    "PASS: hydration, route selection, profile selection, audience CTAs, tab keyboard navigation, mobile menu, dialog initial focus/boundary handlers and opener restoration. Native Tab/Escape remain browser checks.",
  );
  console.log(
    "DOM checks only; responsive rendering and native browser accessibility remain separate.",
  );
} finally {
  if (reactRoot) await act(async () => reactRoot.unmount());
  await server.close();
  dom.window.close();
}
