import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// One reproducible batch; every run owns its artifacts, so old screenshots
// cannot accidentally count as evidence for a new build. No server or network.
const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.env.npm_execpath) {
  throw new Error("Run this audit using npm run audit:fedora");
}
const startedAt = new Date().toISOString();
const artifactsRoot = path.join(root, "qa-artifacts");
const runName = `final-${startedAt.replace(/[:.]/g, "-")}`;
const runDir = path.join(artifactsRoot, runName);
await mkdir(runDir, { recursive: true });
const report = {
  startedAt,
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  playwrightModule: process.env.LANDING_PLAYWRIGHT_MODULE || "local playwright-core",
  browserPath: process.env.LANDING_BROWSER_PATH || "Playwright managed Chromium",
  scope: "Task 13 landing only; intercepted production dist; no backend or external services",
  steps: [],
  buildFiles: [],
  screenshots: [],
  browserSuites: [],
  humanAcceptance: "PENDING: real browser zoom, visual judgment, Orca and presentation on Fedora",
};
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesIn(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
}
async function step(name, args, browser = false) {
  const start = Date.now();
  console.log(`RUN ${name}`);
  const log = `${runName}/${name}.log`;
  // Direct file descriptors preserve output even in restricted runtimes whose
  // child-process pipes do not deliver data events.
  const logFile = await open(path.join(artifactsRoot, log), "w");
  const result = await new Promise((resolve) => {
    let diagnostic = "";
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, LANDING_QA_DIR: runDir, NO_COLOR: "1" },
      stdio: ["ignore", logFile.fd, logFile.fd],
    });
    const timer = setTimeout(() => {
      diagnostic += "\nAudit timeout after 10 minutes\n";
      child.kill("SIGKILL");
    }, 600_000);
    child.on("error", (error) => { diagnostic += `\n${error.stack}\n`; });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, diagnostic });
    });
  });
  await logFile.close();
  const output = await readFile(path.join(artifactsRoot, log), "utf8") + result.diagnostic;
  await writeFile(path.join(artifactsRoot, log), output);
  process.stdout.write(output);
  const status = result.code === 0 ? "PASS"
    : browser && /checks NOT RUN: Chromium could not start/.test(output)
      ? "NOT_RUN_BROWSER" : "FAIL";
  report.steps.push({ name, status, exitCode: result.code, signal: result.signal,
    durationMs: Date.now() - start, log });
  return status;
}

// Build failure prevents tests from silently auditing stale dist output.
const build = await step("build", [process.env.npm_execpath, "run", "build"]);
if (build === "PASS") {
  for (const file of await filesIn(path.join(root, "dist"))) {
    report.buildFiles.push({ file: path.relative(root, file),
      sha256: createHash("sha256").update(await readFile(file)).digest("hex") });
  }
  for (const [name, script, browser] of [
    ["audit-runner", "browser-cases.test.mjs", false],
    ["content", "verify-content.mjs", false],
    ["interactions", "verify-interactions.mjs", false],
    ["pricing", "verify-pricing.mjs", false],
    ["states-browser", "verify-browser-states.mjs", true],
    ["browser", "verify-browser.mjs", true],
    ["pricing-browser", "verify-pricing-browser.mjs", true],
    ["dialog-browser", "verify-dialog-focus.mjs", true],
  ]) await step(name, [`scripts/${script}`], browser);
} else {
  report.steps.push({ name: "remaining checks", status: "NOT_RUN_BUILD_FAILED" });
}
if (build === "PASS") {
  const currentFiles = await filesIn(path.join(root, "dist"));
  const current = await Promise.all(currentFiles.map(async (file) => ({ file: path.relative(root, file),
    sha256: createHash("sha256").update(await readFile(file)).digest("hex") })));
  const unchanged = JSON.stringify(current) === JSON.stringify(report.buildFiles);
  report.steps.push({ name: "build-unchanged-during-audit", status: unchanged ? "PASS" : "FAIL" });
  if (!unchanged) console.error("FAIL: dist changed during the audit. Run the batch again without another concurrent build.");
}
report.screenshots = (await filesIn(runDir)).filter((file) => file.endsWith(".png"))
  .map((file) => path.relative(artifactsRoot, file));
for (const file of (await filesIn(runDir)).filter((file) => file.endsWith("-cases.json"))) {
  report.browserSuites.push({ file: path.relative(artifactsRoot, file),
    ...JSON.parse(await readFile(file, "utf8")) });
}
report.finishedAt = new Date().toISOString();
const completeBrowserReports = ["browser", "states", "pricing", "dialog"].every((name) =>
  report.browserSuites.some((suite) => suite.suite === name && suite.status === "PASS" && suite.cases.length > 0));
report.automatedStatus = report.steps.every((item) => item.status === "PASS") && completeBrowserReports
  ? "PASS" : report.steps.some((item) => item.status === "FAIL") ? "FAIL" : "INCOMPLETE";
const reportJSON = JSON.stringify(report, null, 2) + "\n";
await writeFile(path.join(runDir, "report.json"), reportJSON);
await writeFile(path.join(artifactsRoot, "final-report.json"), reportJSON);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
await writeFile(path.join(artifactsRoot, "final-report.html"), `<!doctype html>
<html lang="es-CL"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FurgoPlus · Auditoría Task 13</title>
<style>body{font:18px/1.6 system-ui;max-width:960px;margin:32px auto;padding:0 20px;color:#182c3e}table{border-collapse:collapse;width:100%}td,th{border:1px solid #68788d;padding:10px;text-align:left}img{max-width:100%;height:auto}a{color:#0752ac}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Task 13 · ${escape(report.automatedStatus)}</h1>
<p>${escape(startedAt)} · ${escape(report.platform)} · Node ${escape(report.node)}</p>
<p>La aceptación visual y humana está pendiente. NOT_RUN_BROWSER significa que no se ejecutaron las comprobaciones de navegador.</p>
<table><caption>Resultados automatizados</caption><tr><th>Prueba</th><th>Resultado</th><th>Registro</th></tr>
${report.steps.map((item) => `<tr><td>${escape(item.name)}</td><td>${escape(item.status)}</td><td>${item.log ? `<a href="${escape(item.log)}">Ver registro</a>` : "—"}</td></tr>`).join("\n")}</table>
<p><a href="final-report.json">Metadatos y SHA-256 del build</a></p>
<h2>Casos independientes de navegador</h2>
<p>Una aserción fallida detiene solo su escenario. Sus acciones dependientes posteriores no se consideran ejecutadas. Cada escenario siguiente comienza en una página nueva. RUNNING indica ejecución interrumpida, nunca PASS.</p>
${report.browserSuites.map((suite) => `<details open><summary>${escape(suite.suite)} · ${escape(suite.status)} · ${suite.cases.length} casos</summary><p><a href="${escape(suite.file)}">Detalle y diagnósticos JSON</a></p><table><tr><th>Caso</th><th>Resultado</th><th>Error</th></tr>${suite.cases.map((item) => `<tr><td>${escape(item.name)}</td><td>${escape(item.status)}</td><td>${item.error ? `<pre>${escape(item.error)}</pre>` : "—"}</td></tr>`).join("\n")}</table></details>`).join("\n")}
<h2>Capturas de esta ejecución (${report.screenshots.length})</h2>
${report.screenshots.length ? report.screenshots.map((file) => `<details><summary>${escape(path.basename(file))}</summary><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt="Captura ${escape(path.basename(file))}"></a></details>`).join("\n") : "<p>Sin capturas nuevas. Revisar los registros de inicio de Chromium.</p>"}
</html>`);
console.log(`\nAutomated status: ${report.automatedStatus}; human acceptance PENDING.`);
for (const suite of report.browserSuites) console.log(`${suite.suite}: ${JSON.stringify(suite.counts || { status: suite.status })}`);
console.log(`Report: ${path.join(artifactsRoot, "final-report.html")}`);
process.exitCode = report.automatedStatus === "PASS" ? 0 : 1;
