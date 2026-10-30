import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import React, { act, useState } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// Isolated component tests; native keyboard/AX/rendering checks live in
// verify-pricing-browser.mjs. No backend, app accounts or persisted state.
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: "custom",
});
let root;
let dom;
try {
  const { plans, IVA_PERCENT, priceBreakdown, formatCLP } =
    await server.ssrLoadModule("/src/content/plans.ts");
  const { Pricing, PricingView } = await server.ssrLoadModule(
    "/src/components/Pricing.tsx",
  );
  function TestPricing() {
    const [showBreakdown, setShowBreakdown] = useState(false);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(PricingView, {
        showBreakdown,
        onChange: setShowBreakdown,
      }),
      React.createElement(Pricing, { showBreakdown }),
    );
  }
  const expected = [
    { code: "basic", totalCLP: 19990, netCLP: 16798, ivaCLP: 3192 },
    { code: "pro", totalCLP: 39990, netCLP: 33605, ivaCLP: 6385 },
    { code: "elite", totalCLP: 69990, netCLP: 58815, ivaCLP: 11175 },
  ];
  assert.equal(IVA_PERCENT, 19);
  assert.equal(plans.length, expected.length);
  for (const [i, { code, ...amounts }] of expected.entries()) {
    assert.equal(plans[i].code, code);
    assert.equal(plans[i].monthlyCLP, amounts.totalCLP);
    assert.deepEqual(priceBreakdown(plans[i].monthlyCLP), amounts);
  }
  // Include rounding up/down, zero and small totals. IVA is the remainder,
  // rather than rounding two independently computed amounts.
  for (const [total, net, iva] of [
    [0, 0, 0],
    [1, 1, 0],
    [3, 3, 0],
    [4, 3, 1],
    [100, 84, 16],
    [118, 99, 19],
    [119, 100, 19],
    [120, 101, 19],
  ]) {
    assert.deepEqual(priceBreakdown(total), {
      totalCLP: total,
      netCLP: net,
      ivaCLP: iva,
    });
  }
  for (let total = 0; total <= 100_000; total++) {
    const { netCLP, ivaCLP } = priceBreakdown(total);
    assert.ok(Number.isInteger(netCLP) && Number.isInteger(ivaCLP));
    assert.equal(netCLP + ivaCLP, total);
    assert.ok(Math.abs(netCLP - total / 1.19) <= 0.5);
  }
  assert.equal(formatCLP(19990), "$19.990");
  assert.equal(formatCLP(3192), "$3.192");

  dom = new JSDOM(
    `<div id="root">${renderToString(React.createElement(TestPricing))}</div>`,
    { url: "https://landing.furgoplus.test/", pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Event",
    "MouseEvent",
  ]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { document } = dom.window;
  const { hydrateRoot } = await import("react-dom/client");
  const hydrationErrors = [];
  await act(async () => {
    root = hydrateRoot(
      document.getElementById("root"),
      React.createElement(TestPricing),
      {
        onRecoverableError: (error) => hydrationErrors.push(error.message),
      },
    );
  });
  assert.deepEqual(hydrationErrors, []);
  const group = document.querySelector('.pricing-view[role="group"]');
  assert.equal(group.getAttribute("aria-label"), "Opciones de IVA");
  assert.equal(document.querySelector("fieldset, legend, input"), null);
  assert.equal(document.getElementById("pricing-view-help"), null);
  assert.match(
    document.getElementById(group.getAttribute("aria-describedby")).textContent,
    /Propuesta académica · Precios referenciales con IVA, sin contratación habilitada/,
  );
  const buttons = [...group.querySelectorAll("button")];
  assert.equal(buttons.length, 2);
  assert.deepEqual(
    buttons.map((button) => button.textContent.trim()),
    ["IVA incluido", "Desglose"],
  );
  for (const button of buttons) {
    assert.equal(button.type, "button");
    assert.ok(document.getElementById(button.getAttribute("aria-controls")));
    assert.equal(button.disabled, false);
    assert.equal(button.tabIndex, 0);
  }
  const totalTexts = [...document.querySelectorAll(".plan-price")].map(
    (el) => el.textContent,
  );
  const assertCards = (breakdown) => {
    assert.equal(
      document.querySelectorAll(".plan-breakdown").length,
      breakdown ? 3 : 0,
    );
    assert.deepEqual(
      [...document.querySelectorAll(".plan-price")].map((el) => el.textContent),
      totalTexts,
    );
    assert.equal(group.querySelectorAll('[aria-pressed="true"]').length, 1);
    assert.equal(
      buttons[breakdown ? 1 : 0].getAttribute("aria-pressed"),
      "true",
    );
    for (const { code, totalCLP, netCLP, ivaCLP } of expected) {
      const card = document.querySelector(`.plan-${code}`);
      assert.ok(document.getElementById(card.getAttribute("aria-labelledby")));
      assert.equal(
        card.querySelector(".plan-total-label").textContent,
        "Total con IVA incluido",
      );
      assert.ok(
        card.querySelector(".plan-total-label").classList.contains("sr-only"),
        "Total label must not add space above the original price",
      );
      assert.equal(
        card.querySelector(".plan-price").textContent,
        `${formatCLP(totalCLP)}CLP / mes`,
      );
      assert.equal(
        card.getAttribute("aria-describedby"),
        "pricing-academic-note",
      );
      assert.match(
        document.getElementById(card.getAttribute("aria-describedby"))
          .textContent,
        /sin contratación habilitada/,
      );
      assert.equal(card.querySelectorAll(".pricing-feature").length, 3);
      for (const feature of card.querySelectorAll(".pricing-feature.future"))
        assert.match(feature.textContent, /Futuro/);
      for (const feature of card.querySelectorAll(".pricing-feature.testing"))
        assert.match(feature.textContent, /Experimental/);
      assert.match(
        document.querySelector("#pricing-academic-note").textContent,
        /Informes mensuales desde Pro; informes avanzados y archivos XLSX en Elite.*Asistentes experimentales, sin servicio comercial disponible/,
      );
      assert.equal(card.querySelectorAll("a, button, input, del, s").length, 0);
      if (breakdown) {
        const dl = card.querySelector("dl");
        assert.deepEqual(
          [...dl.querySelectorAll("dt")].map((el) => el.textContent),
          ["Valor neto", "IVA (19 %)"],
        );
        assert.deepEqual(
          [...dl.querySelectorAll("dd")].map((el) => el.textContent),
          [`${formatCLP(netCLP)} CLP`, `${formatCLP(ivaCLP)} CLP`],
        );
      }
    }
  };
  assertCards(false);
  const status = document.querySelector('[role="status"]');
  assert.equal(status.getAttribute("aria-atomic"), "true");
  for (const breakdown of [true, false, true, false]) {
    const target = buttons[breakdown ? 1 : 0];
    target.focus();
    await act(async () => target.click());
    assertCards(breakdown);
    assert.equal(
      document.activeElement,
      target,
      "Changing view must keep focus on the control",
    );
    assert.match(
      status.textContent,
      breakdown ? /Desglose visible/ : /Vista de precio final/,
    );
    assert.match(status.textContent, /El precio total se mantiene/);
  }
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
  console.log(
    "PASS: IVA/rounding, exact demo amounts, whole-peso sums, CLP formatting, default view, hydration, repeated view changes, invariant totals, compact button labels/group/states, status updates and focus preservation.",
  );
  console.log(
    "DOM evidence only. Native keyboard, accessibility tree and layout require test:pricing:browser; real screen-reader speech requires manual review.",
  );
} finally {
  if (root) await act(async () => root.unmount());
  dom?.window.close();
  await server.close();
}
