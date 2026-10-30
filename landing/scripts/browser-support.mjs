import path from "node:path";
import { pathToFileURL } from "node:url";

// Reuse an existing external Playwright installation without adding product
// dependencies. An explicit path fails loudly if it is invalid; no fallback
// silently changes the selected runtime.
const modulePath = process.env.LANDING_PLAYWRIGHT_MODULE;
if (modulePath && !path.isAbsolute(modulePath)) {
  throw new Error("LANDING_PLAYWRIGHT_MODULE must be an absolute module file path");
}
const playwright = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright-core"
);
export const chromium = playwright.chromium;
