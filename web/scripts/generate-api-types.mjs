import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(
  new URL("../../backend/openapi.json", import.meta.url),
);
const targetPath = fileURLToPath(
  new URL("../src/api-types.ts", import.meta.url),
);
const document = JSON.parse(readFileSync(schemaPath, "utf8"));
const healthSchema =
  document.paths["/api/v1/health/"].get.responses["200"].content[
    "application/json"
  ].schema;

if (
  healthSchema.type !== "object" ||
  healthSchema.required?.join(",") !== "status" ||
  healthSchema.properties?.status?.enum?.length !== 1
) {
  throw new Error("Unsupported health response schema");
}

const generated = `// Generated from backend/openapi.json. Do not edit by hand.\nexport type Health = { status: ${JSON.stringify(healthSchema.properties.status.enum[0])} };\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(targetPath, "utf8") !== generated) {
    throw new Error("API types have drifted; run npm run contract:generate");
  }
} else {
  writeFileSync(targetPath, generated);
}
