import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const schemaPath = fileURLToPath(
  new URL("../../backend/openapi.json", import.meta.url),
);
const targetPath = fileURLToPath(
  new URL("../src/api-types.ts", import.meta.url),
);
const document = JSON.parse(readFileSync(schemaPath, "utf8"));
function typeOf(schema) {
  if (schema.enum)
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.type))
    return schema.type.map((type) => typeOf({ type })).join(" | ");
  if (schema.type === "string") return "string";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "null") return "null";
  if (schema.type === "object") {
    return `{ ${Object.entries(schema.properties ?? {})
      .map(
        ([key, value]) =>
          `${key}${schema.required?.includes(key) ? "" : "?"}: ${typeOf(value)}`,
      )
      .join("; ")} }`;
  }
  throw new Error(`Unsupported schema: ${JSON.stringify(schema)}`);
}

const types = [
  ["Health", "/api/v1/health/", "get", "200"],
  ["Csrf", "/api/v1/auth/csrf/", "get", "200"],
  ["Identity", "/api/v1/auth/me/", "get", "200"],
  ["LoginResponse", "/api/v1/auth/login/", "post", "200"],
  ["RegisterRequest", "/api/v1/auth/register/", "post", "request"],
  ["LoginRequest", "/api/v1/auth/login/", "post", "request"],
  ["LogoutResponse", "/api/v1/auth/logout/", "post", "200"],
];
const raw = `// Generated from backend/openapi.json. Do not edit by hand.\n${types
  .map(([name, path, method, status]) => {
    const operation = document.paths[path]?.[method];
    if (!operation) throw new Error(`Missing ${method} ${path}`);
    const schema =
      status === "request"
        ? operation.requestBody?.content?.["application/json"]?.schema
        : operation.responses[status]?.content?.["application/json"]?.schema;
    if (!schema) throw new Error(`Missing schema ${name}`);
    return `export type ${name} = ${typeOf(schema)};`;
  })
  .join("\n")}\n`;
const generated = await prettier.format(raw, { parser: "typescript" });

if (process.argv.includes("--check")) {
  if (readFileSync(targetPath, "utf8") !== generated) {
    throw new Error("API types have drifted; run npm run contract:generate");
  }
} else {
  writeFileSync(targetPath, generated);
}
