import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: "custom",
});
try {
  const { App } = await server.ssrLoadModule("/src/App.tsx");
  const documentPath = new URL("../dist/index.html", import.meta.url);
  const html = await readFile(documentPath, "utf8");
  const markup = renderToString(React.createElement(App));
  if (!html.includes('<div id="root"></div>'))
    throw new Error("Missing prerender target");
  await writeFile(
    documentPath,
    html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`),
  );
  console.log("Prerendered complete landing content into dist/index.html.");
} finally {
  await server.close();
}
