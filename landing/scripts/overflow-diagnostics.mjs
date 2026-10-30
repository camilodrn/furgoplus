import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

// Real layout measurements only: jsdom cannot diagnose browser overflow.
export async function inspectOverflow(page) {
  return page.evaluate(() => {
    const selector = (el) => {
      if (el === document.documentElement) return "html";
      if (el === document.body) return "body";
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
        const siblings = [...node.parentElement.children];
        parts.unshift(`${node.localName}:nth-child(${siblings.indexOf(node) + 1})`);
      }
      return parts.join(" > ") || "body";
    };
    const measure = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        selector: selector(el), classes: el.getAttribute("class"),
        left: rect.left + scrollX, right: rect.right + scrollX,
        top: rect.top + scrollY, bottom: rect.bottom + scrollY,
        width: rect.width, height: rect.height,
        clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft,
        display: style.display, position: style.position,
        minWidth: style.minWidth, maxWidth: style.maxWidth,
        flexDirection: style.flexDirection, flexShrink: style.flexShrink,
        gridTemplateColumns: style.gridTemplateColumns,
        overflowX: style.overflowX, whiteSpace: style.whiteSpace,
        clipPath: style.clipPath, contain: style.contain, transform: style.transform,
      };
    };
    const candidates = [...document.querySelectorAll("body *")]
      // Visually hidden absolute labels still contribute to layout overflow.
      .filter((el) => el.getClientRects().length && !el.matches("svg *")
        && getComputedStyle(el).visibility !== "hidden")
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right + scrollX > innerWidth || rect.left + scrollX < 0
          || el.scrollWidth > el.clientWidth + 1;
      })
      .map((el) => {
        const box = measure(el);
        const ancestors = [];
        for (let parent = el.parentElement; parent; parent = parent.parentElement)
          ancestors.push(parent);
        // Absolute boxes can escape a DOM ancestor's overflow when their
        // containing block lies outside it. closest('.comparison-scroll') alone
        // cannot establish containment. offsetParent identifies that block here.
        const block = box.position === "absolute" ? el.offsetParent : null;
        let left = box.left;
        let right = box.right;
        const clippingAncestors = ancestors.filter((parent) => {
          if (parent === document.body || parent === document.documentElement) return false;
          if (box.position === "absolute" && (!block || !parent.contains(block))) return false;
          return /^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowX);
        });
        for (const parent of clippingAncestors) {
          const rect = parent.getBoundingClientRect();
          const edge = rect.left + scrollX + parent.clientLeft;
          left = Math.max(left, edge);
          right = Math.min(right, edge + parent.clientWidth);
        }
        const outside = right > left && (right > innerWidth || left < 0);
        const ownOverflow = box.scrollWidth > box.clientWidth + 1;
        const classification = outside ? "page-protrusion"
          : clippingAncestors.length || (ownOverflow && box.overflowX !== "visible")
            ? "contained-overflow" : "unresolved-overflow";
        const scroller = el.closest(".comparison-scroll");
        return {
          ...box, classification,
          text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 100),
          effectiveBounds: { left, right },
          parent: el.parentElement ? measure(el.parentElement) : null,
          ancestors: ancestors.map(measure),
          containingBlock: block ? measure(block) : null,
          clippingAncestors: clippingAncestors.map(selector),
          comparisonAncestor: scroller ? selector(scroller) : null,
          containedBy: clippingAncestors[0] ? selector(clippingAncestors[0])
            : ownOverflow && box.overflowX !== "visible" ? selector(el) : null,
          escapedComparison: !!scroller && box.position === "absolute"
            && (!block || !scroller.contains(block)),
        };
      });
    // Prefer the outermost exposed boxes; keep every measurement in JSON.
    const exposed = candidates.filter((item) => item.classification === "page-protrusion");
    const real = exposed.filter((item) => !exposed.some((parent) =>
      parent !== item && item.ancestors.some((ancestor) => ancestor.selector === parent.selector)));
    return {
      url: location.href, viewport: { width: innerWidth, height: innerHeight },
      scrollPosition: { x: scrollX, y: scrollY },
      activeElement: selector(document.activeElement),
      document: { clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth },
      body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
      overflow: document.documentElement.scrollWidth > innerWidth,
      summary: {
        realOverflowElements: real.map(({ selector, classes, left, right, position, escapedComparison }) =>
          ({ selector, classes, left, right, position, escapedComparison })),
        containedCount: candidates.filter((item) => item.classification === "contained-overflow").length,
        unresolvedCount: candidates.filter((item) => item.classification === "unresolved-overflow").length,
      },
      candidates,
    };
  });
}

async function saveDiagnostic(page, directory, label, report) {
  const file = `${directory}/overflow-${label.replace(/[^a-z0-9-]/gi, "-")}`;
  await writeFile(`${file}.json`, JSON.stringify({ label, ...report }, null, 2) + "\n");
  const real = report.summary.realOverflowElements;
  console.log(`Overflow ${label}: document ${report.document.scrollWidth}/${report.viewport.width}px; exposed ${real.length}, contained ${report.summary.containedCount}, unresolved ${report.summary.unresolvedCount}.`);
  for (const item of real.slice(0, 5))
    console.log(`  ${item.selector}${item.classes ? ` (${item.classes})` : ""}: ${item.left.toFixed(1)}..${item.right.toFixed(1)}px${item.escapedComparison ? "; absolute box escapes comparison" : ""}`);
  if (real.length > 5) console.log(`  +${real.length - 5} exposed elements in JSON.`);
  if (report.overflow && !real.length)
    console.log("  No exposed DOM box identified: inspect JSON, pseudo-elements and containing blocks; page assertion still fails.");
  console.log(`Artifact: ${file}.json`);
  if (report.overflow) {
    try { await page.screenshot({ path: `${file}.png`, fullPage: true }); }
    catch (error) { console.error(`Overflow screenshot unavailable: ${String(error)}`); }
  }
}

export async function assertNoPageOverflow(page, directory, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) await saveDiagnostic(page, directory, label, await inspectOverflow(page));
  assert.ok(!overflow, `Horizontal page overflow: ${label}`);
}

// Controlled browser evidence, only in opt-in diagnostics. Each temporary
// stylesheet is removed in finally; source and accessible labels are unchanged.
async function diagnoseComparisonContainment(page, directory) {
  await page.setViewportSize({ width: 320, height: 960 });
  await page.goto("https://landing.furgoplus.test/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#tab-apoderado").click();
  await page.locator("#experience-panel").scrollIntoViewIfNeeded();
  await page.locator(".comparison-details > summary").click();
  const cases = [
    ["320-comparison-original-static", ".comparison-scroll { position: static !important; }"],
    ["320-comparison-static-without-label-boxes", ".comparison-scroll { position: static !important; } .comparison-scroll .sr-only { display: none !important; }"],
    ["320-comparison-current-css", ""],
  ];
  for (const [label, content] of cases) {
    const style = await page.addStyleTag({ content });
    try {
      const report = await inspectOverflow(page);
      report.horizontalScrollProbe = await page.evaluate(() => {
        const original = { left: scrollX, top: scrollY, behavior: "instant" };
        window.scrollTo({ left: 100000, top: scrollY, behavior: "instant" });
        const maxScrollX = scrollX;
        window.scrollTo(original);
        return { maxScrollX };
      });
      await saveDiagnostic(page, directory, label, report);
    } finally {
      await style.evaluate((el) => el.remove());
    }
  }
}

// Optional preflight completes the whole requested matrix before assertions
// stop either suite. Run LANDING_OVERFLOW_DIAGNOSTICS=1 npm run audit:fedora.
export async function diagnoseViewports(page, directory) {
  await diagnoseComparisonContainment(page, directory);
  for (const width of [320, 360, 390, 820, 1000, 1024]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("https://landing.furgoplus.test/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    for (const audience of ["conductor", "apoderado"]) {
      await page.locator(`#tab-${audience}`).click();
      for (const expanded of [false, true]) {
        await page.getByRole("button", { name: expanded ? "Desglose" : "IVA incluido", exact: true }).click();
        await page.locator(".comparison-details").evaluate((el, open) => { el.open = open; }, expanded);
        const label = `${width}-${audience}-${expanded ? "expanded" : "included"}`;
        await saveDiagnostic(page, directory, label, await inspectOverflow(page));
      }
    }
  }
}
