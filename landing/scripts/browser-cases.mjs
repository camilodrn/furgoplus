import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const widths = [1920, 1440, 1280, 1024, 1000, 960, 820, 768, 720, 390, 360, 320];
export const origin = "https://landing.furgoplus.test";

// Each independent scenario owns a fresh page. Assertions still throw: only
// the failed scenario stops, and its dependent actions are not called PASS.
// Persist after every case so a crash/outer timeout cannot erase earlier data.
export function createCaseRunner({ artifacts, suite, browser }) {
  const report = {
    suite, browser: browser.version(), startedAt: new Date().toISOString(),
    status: "RUNNING", cases: []
  };
  const file = path.join(artifacts, `${suite}-cases.json`);
  const save = () => writeFile(file, JSON.stringify(report, null, 2) + "\n");
  return {
    async run(name, action, page) {
      const item = { name, status: "RUNNING", startedAt: new Date().toISOString() };
      report.cases.push(item);
      await save();
      const start = Date.now();
      try {
        await action();
        item.status = "PASS";
      } catch (error) {
        item.status = "FAIL";
        item.error = error.stack || String(error);
        item.dependentActions = "Actions after the failing assertion were NOT RUN";
        if (page && !page.isClosed()) {
          try {
            item.state = await page.evaluate(() => {
              const el = document.activeElement;
              const style = getComputedStyle(el);
              return {
                url: location.href, viewport: { width: innerWidth, height: innerHeight },
                scrollX, scrollY, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
                documentWidth: document.documentElement.scrollWidth,
                active: {
                  tag: el.localName, id: el.id, className: el.getAttribute("class"),
                  text: el.textContent.trim().slice(0, 100), opacity: style.opacity,
                  visibility: style.visibility, display: style.display
                },
                dialogOpen: document.querySelector("dialog")?.open
              };
            });
            item.screenshot = `${suite}-failure-${report.cases.length}.png`;
            await page.screenshot({ path: path.join(artifacts, item.screenshot), timeout: 5000 });
          } catch (diagnosticError) { item.diagnosticError = String(diagnosticError); }
        }
      }
      item.durationMs = Date.now() - start;
      await save();
      console.log(`${item.status}: ${name}${item.error ? `\n${item.error}` : ""}`);
      return item.status === "PASS";
    },
    async finish() {
      report.finishedAt = new Date().toISOString();
      report.counts = {
        passed: report.cases.filter((item) => item.status === "PASS").length,
        failed: report.cases.filter((item) => item.status === "FAIL").length,
        incomplete: report.cases.filter((item) => item.status === "RUNNING").length
      };
      report.status = report.counts.failed || report.counts.incomplete || !report.cases.length ? "FAIL" : "PASS";
      await save();
      console.log(`${suite}: ${report.counts.passed} PASS, ${report.counts.failed} FAIL, ${report.counts.incomplete} incomplete. ${file}`);
      if (report.status !== "PASS") process.exitCode = 1;
      return report.status === "PASS";
    },
  };
}

export async function serveDist(context, errors, externalRequests) {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      externalRequests.push(url.href);
      return route.abort();
    }
    try {
      const name = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
      const file = path.resolve(dist, name);
      if (!file.startsWith(dist)) throw new Error(`Invalid asset path: ${name}`);
      await route.fulfill({
        body: await readFile(file), contentType: {
          ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
          ".svg": "image/svg+xml", ".png": "image/png", ".woff": "font/woff",
        }[path.extname(file)] ?? "application/octet-stream"
      });
    } catch (error) {
      errors.push(String(error));
      await route.fulfill({ status: 404 });
    }
  });
}

export async function freshPage(context, errors) {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) => errors.push(`Request failed: ${request.url()}`));
  return page;
}

export async function loadPage(page, width = 1440, height = 960, reducedMotion = "reduce") {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}
