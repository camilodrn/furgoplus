import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("independent failures accumulate, later cases execute, and final exit stays nonzero", async () => {
  const root = fileURLToPath(new URL("../qa-artifacts/", import.meta.url));
  await mkdir(root, { recursive: true });
  const artifacts = await mkdtemp(`${root}runner-test-`);
  const runnerURL = new URL("./browser-cases.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createCaseRunner } from ${JSON.stringify(runnerURL)};
    const runner = createCaseRunner({ artifacts: ${JSON.stringify(artifacts)}, suite: "sentinel", browser: { version: () => "test double" } });
    await runner.run("first defect", async () => assert.equal(1, 2));
    await runner.run("second defect", async () => { throw new Error("independent defect"); });
    await runner.run("later scenario", async () => assert.equal(2, 2));
    await runner.finish();
  `], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(await readFile(`${artifacts}/sentinel-cases.json`, "utf8"));
  assert.equal(report.status, "FAIL");
  assert.deepEqual(report.cases.map((item) => item.status), ["FAIL", "FAIL", "PASS"]);
  assert.deepEqual(report.counts, { passed: 1, failed: 2, incomplete: 0 });
  assert.match(report.cases[0].error, /AssertionError/);
  assert.match(report.cases[1].error, /independent defect/);
});

test("unfinished reports cannot masquerade as a complete PASS", async () => {
  const root = fileURLToPath(new URL("../qa-artifacts/", import.meta.url));
  await mkdir(root, { recursive: true });
  const artifacts = await mkdtemp(`${root}runner-test-`);
  const { createCaseRunner } = await import("./browser-cases.mjs");
  const runner = createCaseRunner({ artifacts, suite: "unfinished", browser: { version: () => "test double" } });
  await runner.run("completed prefix only", async () => { });
  const report = JSON.parse(await readFile(`${artifacts}/unfinished-cases.json`, "utf8"));
  assert.equal(report.status, "RUNNING");
  assert.equal(report.finishedAt, undefined);
});
