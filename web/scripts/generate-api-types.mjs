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
  if (schema.oneOf) return schema.oneOf.map(typeOf).join(" | ");
  if (schema.enum)
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.type))
    return schema.type.map((type) => typeOf({ type })).join(" | ");
  if (schema.type === "string") return "string";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") return `(${typeOf(schema.items)})[]`;
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
  ["DriverProfile", "/api/v1/driver/profile/", "get", "200"],
  ["DriverProfileUpdate", "/api/v1/driver/profile/", "patch", "request"],
  ["DriverChecklist", "/api/v1/driver/validation/checklist/", "get", "200"],
  ["DriverDocuments", "/api/v1/driver/documents/", "get", "200"],
  ["DriverDocument", "/api/v1/driver/documents/", "post", "201"],
  ["DriverValidations", "/api/v1/driver/validations/", "get", "200"],
  ["DriverValidation", "/api/v1/driver/validations/submit/", "post", "200"],
  ["AdminValidations", "/api/v1/admin/validations/", "get", "200"],
  ["AdminValidation", "/api/v1/admin/validations/{id}/", "get", "200"],
  [
    "ObservationInput",
    "/api/v1/admin/validations/{id}/approve/",
    "post",
    "request",
  ],
  ["Publication", "/api/v1/driver/publication/", "get", "200"],
  ["PublicationInput", "/api/v1/driver/publication/", "patch", "request"],
  ["Communes", "/api/v1/driver/communes/", "get", "200"],
  ["Routes", "/api/v1/driver/routes/", "get", "200"],
  ["Route", "/api/v1/driver/routes/", "post", "201"],
  ["RouteInput", "/api/v1/driver/routes/", "post", "request"],
  ["RouteUpdate", "/api/v1/driver/routes/{id}/", "patch", "request"],
  ["DriverSummary", "/api/v1/driver/summary/", "get", "200"],
  ["Assignments", "/api/v1/driver/passenger-assignments/", "get", "200"],
  ["Assignment", "/api/v1/driver/passenger-assignments/", "post", "201"],
  [
    "AssignmentInput",
    "/api/v1/driver/passenger-assignments/",
    "post",
    "request",
  ],
  [
    "AssignmentUpdate",
    "/api/v1/driver/passenger-assignments/{id}/",
    "patch",
    "request",
  ],
  ["Payments", "/api/v1/driver/payments/", "get", "200"],
  ["Payment", "/api/v1/driver/payments/", "post", "201"],
  ["PaymentInput", "/api/v1/driver/payments/", "post", "request"],
  ["Plans", "/api/v1/admin/plans/", "get", "200"],
  [
    "AdminSubscription",
    "/api/v1/admin/drivers/{id}/subscription/",
    "get",
    "200",
  ],
  [
    "SubscriptionInput",
    "/api/v1/admin/drivers/{id}/subscription/",
    "post",
    "request",
  ],
  ["DiscoveryDrivers", "/api/v1/discovery/drivers/", "get", "200"],
  ["DiscoveryDriver", "/api/v1/discovery/drivers/{id}/", "get", "200"],
  ["DriverContactRequests", "/api/v1/driver/contact-requests/", "get", "200"],
  [
    "DriverContactRequest",
    "/api/v1/driver/contact-requests/{id}/",
    "get",
    "200",
  ],
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
