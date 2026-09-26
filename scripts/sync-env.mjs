#!/usr/bin/env node
/**
 * Push production environment variables to Vercel (and optionally the Railway worker)
 * from one local file, so a new project or a rotated secret is a single command.
 *
 *   cp .env.example .env.production   # fill in PRODUCTION values (gitignored — never commit it)
 *   npx vercel link                   # once: links this folder to your Vercel project
 *   npm run env:push -- --dry-run     # preview which variables would be set
 *   npm run env:push                  # push to Vercel (then redeploy)
 *   npm run env:push -- --railway     # also update the Railway worker service
 *
 * Options: --file <path>  --environment production|preview  --project <vercel project>
 *          --railway-service <name> (default "worker")
 * Values are passed on stdin, never on the command line, and are never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const file = option("file", ".env.production");
const environment = option("environment", "production");
const project = option("project");
const railwayService = option("railway-service", "worker");
const dryRun = has("dry-run");
const toRailway = has("railway");

const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXT_PUBLIC_APP_URL"];
/** Values that are fine locally but dangerous in production. */
const FORBIDDEN_IN_PRODUCTION = { WHATSAPP_PROVIDER: "sandbox", ALLOW_TEST_BILLING: "true", STORAGE_DRIVER: "local" };
/** Stored as Vercel "sensitive" variables (write-only in the dashboard). */
const SENSITIVE = /SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|DATABASE_URL|REDIS_URL/;
/** Only the web app needs these; the worker skips them. */
const WEB_ONLY = new Set(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "WHATSAPP_VERIFY_TOKEN", "ADMIN_EMAILS", "BILLING_PROVIDER", "ALLOW_TEST_BILLING", "CUSTOM_DOMAIN_CNAME_TARGET"]);

function parseEnv(text) {
  const vars = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    if (value !== "") vars.set(m[1], value); // empty values are skipped, not pushed
  }
  return vars;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(file)) fail(`${file} not found. Create it with: cp .env.example ${file} (then fill in production values)`);
const vars = parseEnv(readFileSync(file, "utf8"));

const missing = REQUIRED.filter((k) => !vars.has(k));
if (missing.length) fail(`${file} is missing: ${missing.join(", ")}`);
if (environment === "production") {
  const bad = Object.entries(FORBIDDEN_IN_PRODUCTION).filter(([k, v]) => vars.get(k) === v);
  if (bad.length) fail(`Not allowed in production: ${bad.map(([k, v]) => `${k}=${v}`).join(", ")}. Remove from ${file}.`);
  if (/localhost|127\.0\.0\.1/.test(vars.get("NEXT_PUBLIC_APP_URL"))) fail("NEXT_PUBLIC_APP_URL points to localhost — use your live https:// URL.");
}
const notUrls = ["NEXT_PUBLIC_APP_URL", "S3_PUBLIC_URL", "S3_ENDPOINT", "AI_API_URL", "WHATSAPP_API_URL"].filter((k) => vars.has(k) && !/^https?:\/\//.test(vars.get(k)));
if (notUrls.length) fail(`${notUrls.join(", ")} must start with https:// (e.g. https://media.example.com).`);

if (!dryRun && !project && !existsSync(".vercel/project.json")) {
  fail('This folder isn\'t linked to a Vercel project. Run "npx vercel link" (or pass --project <name>), then run this again.');
}

/** The Vercel CLI prints JSON errors in non-interactive mode; surface their message. */
function cliError(output, secret) {
  const json = output.slice(output.indexOf("{"));
  let message;
  try {
    message = JSON.parse(json).message;
  } catch {
    message = output.split("\n").map((l) => l.trim()).filter((l) => l && l !== "}" && l !== "{").pop();
  }
  return (message ?? "unknown error").replaceAll(secret, "***");
}

console.log(`${dryRun ? "[dry run] " : ""}${vars.size} variables from ${file} → Vercel (${environment})${project ? ` project ${project}` : ""}${toRailway ? ` + Railway (${railwayService})` : ""}\n`);

let failures = 0;
for (const [key, value] of vars) {
  const sensitive = SENSITIVE.test(key) && !key.startsWith("NEXT_PUBLIC_");
  const label = `${key}${sensitive ? " (secret)" : ""}`;
  if (dryRun) {
    console.log(`  • ${label}`);
    continue;
  }
  const result = spawnSync(
    "npx",
    ["--yes", "vercel", "env", "add", key, environment, "--force", "--yes", "--non-interactive", sensitive ? "--sensitive" : "--no-sensitive", ...(project ? ["--project", project] : [])],
    { input: value, encoding: "utf8" },
  );
  if (result.status === 0) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label} — ${cliError(`${result.stdout ?? ""}${result.stderr ?? ""}`, value)}`);
  }
}

if (toRailway && !dryRun) {
  const workerVars = [...vars].filter(([k]) => !WEB_ONLY.has(k));
  const setArgs = workerVars.flatMap(([k, v]) => ["--set", `${k}=${v}`]);
  const result = spawnSync("npx", ["--yes", "@railway/cli", "variables", "--service", railwayService, "--skip-deploys", ...setArgs], { encoding: "utf8" });
  if (result.status === 0) console.log(`\n  ✓ Railway (${railwayService}): ${workerVars.length} variables`);
  else {
    failures++;
    console.log(`\n  ✗ Railway — run "npx @railway/cli login" and "npx @railway/cli link" first, then retry.`);
  }
}

if (dryRun) process.exit(0);
if (failures) fail(`${failures} update(s) failed — fix the errors above and run again (it's safe to re-run).`);
console.log(`\nDone. Redeploy so the new values take effect: Vercel → Deployments → latest → ⋯ → Redeploy (or push to main).`);
