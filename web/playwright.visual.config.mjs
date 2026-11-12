// Prepared configuration: install the two authorized dev dependencies on Fedora.
// Deliberately independent of Vitest; never starts/rebuilds services.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  testMatch: "**/*.visual.mjs",
  globalSetup: "./visual/academic-preflight.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  outputDir: "/tmp/furgoplus-t12-playwright/results",
  reporter: [["line"]],
  // A missing/unreviewed reference must never be silently created.
  updateSnapshots: "none",
  use: {
    baseURL: "http://127.0.0.1:15173",
    browserName: "chromium",
    launchOptions: { chromiumSandbox: true },
    locale: "es-CL",
    timezoneId: "America/Santiago",
    colorScheme: "light",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    acceptDownloads: false,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [1440, 1280, 768, 390, 320].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: width >= 1280 ? 900 : 844 } },
  })),
});
