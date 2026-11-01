// Read-only identity/source check. No compose up/run/build, migrations or seeds.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { academicOrigin } from "./readonly.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = "furgoplus-task12-academic";
const database = "furgoplus_task12_academic";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function docker(...args) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(
      "Preflight bloqueado: Docker/servicio académico no disponible. No iniciar ni reconstruir automáticamente.",
    );
  }
}
function running(service, hostPort, containerPort) {
  const ids = docker(
    "ps",
    "--filter",
    `label=com.docker.compose.project=${project}`,
    "--filter",
    `label=com.docker.compose.service=${service}`,
    "--format",
    "{{.ID}}",
  )
    .split(/\s+/)
    .filter(Boolean);
  if (ids.length !== 1)
    throw new Error(`Se requiere un único ${service} académico activo.`);
  const info = JSON.parse(docker("inspect", ids[0]))[0];
  if (
    !info.State.Running ||
    info.Config.Labels["com.docker.compose.project"] !== project
  )
    throw new Error("Identidad Docker incorrecta.");
  if (hostPort) {
    const bindings = info.NetworkSettings.Ports[`${containerPort}/tcp`];
    if (
      bindings?.length !== 1 ||
      bindings[0].HostIp !== "127.0.0.1" ||
      bindings[0].HostPort !== hostPort
    )
      throw new Error("Puertos académicos incorrectos.");
  }
  return {
    id: ids[0],
    info,
    env: Object.fromEntries(
      info.Config.Env.map((item) => {
        const index = item.indexOf("=");
        return [item.slice(0, index), item.slice(index + 1)];
      }),
    ),
  };
}
function files(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(`${directory}/${entry.name}`, `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}
async function localFetch(path) {
  const response = await fetch(academicOrigin + path, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`HTTP académico no disponible: ${path}`);
  return response.text();
}
export default async function preflight() {
  const backend = running("backend", "18082", "8000");
  const web = running("web", "15173", "5173");
  const db = running("db");
  for (const [service, container, networks] of [
    ["web", web, [`${project}_frontend`]],
    ["backend", backend, [`${project}_database`, `${project}_frontend`]],
    ["db", db, [`${project}_database`]],
  ]) {
    const actual = Object.keys(container.info.NetworkSettings.Networks).sort();
    if (
      container.info.Config.Labels["com.docker.compose.service"] !== service ||
      JSON.stringify(actual) !== JSON.stringify(networks.sort())
    )
      throw new Error("Red o servicio ajeno al académico.");
  }
  if (
    Object.values(db.info.NetworkSettings.Ports ?? {}).some(
      (bindings) => bindings?.length,
    )
  )
    throw new Error("PostgreSQL académico no debe publicar puertos.");
  if (
    backend.env.DJANGO_SETTINGS_MODULE !== "config.settings_academic" ||
    backend.env.ACADEMIC_PROJECT !== project ||
    backend.env.DB_NAME !== database ||
    backend.env.DB_HOST !== "db" ||
    web.env.VITE_API_PROXY_TARGET !== "http://backend:8000"
  )
    throw new Error("Backend/proxy ajeno al académico.");
  const volume = db.info.Mounts.find(
    (mount) => mount.Destination === "/var/lib/postgresql/data",
  );
  if (volume?.Name !== `${project}_pg_data` || db.env.POSTGRES_DB !== database)
    throw new Error("Base/volumen ajenos al académico.");
  // Existing command verifies the actual database identity and authorized scenario.
  // Capture output in memory: do not persist account data or the environment.
  docker(
    "exec",
    backend.id,
    "python",
    "manage.py",
    "audit_academic_scenario",
    "--expect-project",
    project,
    "--expect-database",
    database,
  );
  const hashes = {};
  for (const path of [
    ...files(`${root}src`).map((name) => `src/${name}`),
    "vite.config.ts",
  ]) {
    const bytes = readFileSync(`${root}${path}`);
    const remote = docker("exec", web.id, "sha256sum", `/app/${path}`).split(
      /\s/,
    )[0];
    hashes[path] = digest(bytes);
    if (hashes[path] !== remote)
      throw new Error(`Fuente servida desactualizada: ${path}`);
  }
  // A matching file in a stopped/old Vite process is insufficient. Check HTTP too.
  const served = await localFetch("/src/App.tsx");
  const encoded = served.match(
    /sourceMappingURL=data:application\/json;base64,([^\s]+)/,
  )?.[1];
  const sourceMap =
    encoded && JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (
    !sourceMap?.sourcesContent?.includes(
      readFileSync(`${root}src/App.tsx`, "utf8"),
    )
  )
    throw new Error(
      "No se puede demostrar que HTTP sirve App.tsx actual (sourcemap requerido).",
    );
  await localFetch("/api/v1/health/");
  mkdirSync("/tmp/furgoplus-t12-playwright", { recursive: true });
  writeFileSync(
    "/tmp/furgoplus-t12-playwright/preflight.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        origin: academicOrigin,
        project,
        database,
        hashes,
        humanReviewed: false,
      },
      null,
      2,
    ),
  );
}
