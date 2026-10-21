import { readFile, writeFile } from "node:fs/promises";

/* Collects each app's live popularity from its `popularityApi` (apps.json) into popularity.json.
   Endpoint schema: docs/popularity-spec.md (v1: version, id, metric "pageviews_30d", integer score, window_days 30, updated).
   An app whose fetch or validation fails keeps its last good value. The file is only rewritten when a value changed. */
const APPS_FILE = new URL("../apps.json", import.meta.url);
const OUT_FILE = new URL("../popularity.json", import.meta.url);
const TIMEOUT_MS = 10000;
const USER_AGENT = "0x6.ai-popularity-bot/1.0 (+https://0x6.ai/)";

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

/* Exact schema from docs/popularity-spec.md (v1). Anything else is rejected. */
const SPEC_KEYS = ["id", "metric", "score", "updated", "version", "window_days"];
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

function validate(body, id) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not a JSON object");
  const keys = Object.keys(body).sort();
  if (keys.join() !== SPEC_KEYS.join()) throw new Error(`keys must be exactly ${SPEC_KEYS.join(", ")} (got ${keys.join(", ") || "none"})`);
  if (body.version !== 1) throw new Error(`version must be 1 (got ${JSON.stringify(body.version)})`);
  if (body.id !== id) throw new Error(`id must be "${id}" (got ${JSON.stringify(body.id)})`);
  if (body.metric !== "pageviews_30d") throw new Error(`metric must be "pageviews_30d" (got ${JSON.stringify(body.metric)})`);
  if (!Number.isSafeInteger(body.score) || body.score < 0) throw new Error(`score must be a non-negative integer (got ${JSON.stringify(body.score)})`);
  if (body.window_days !== 30) throw new Error(`window_days must be 30 (got ${JSON.stringify(body.window_days)})`);
  if (typeof body.updated !== "string" || !ISO_UTC.test(body.updated) || Number.isNaN(Date.parse(body.updated))) {
    throw new Error(`updated must be ISO 8601 UTC ending in Z (got ${JSON.stringify(body.updated)})`);
  }
  return { score: body.score, metric: body.metric, updated: body.updated };
}

async function fetchScore(url, id) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`invalid JSON (${response.headers.get("content-type") || "no content-type"})`);
      }
      return validate(body, id);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  const { apps = [] } = await readJson(APPS_FILE, {});
  const previous = await readJson(OUT_FILE, { apps: {} });
  const oldApps = previous && typeof previous.apps === "object" && previous.apps ? previous.apps : {};
  const sources = apps.filter((app) => app && app.id && typeof app.popularityApi === "string" && app.popularityApi);

  /* Spec rule for every work (docs/popularity-spec.md, "Adding a new work"): flag missing or non-standard endpoints. */
  for (const app of apps) {
    if (!app || !app.listed || app.pinned) continue;
    const expected = app.domain ? `https://${app.domain}/popularity.json` : "https://<domain>/popularity.json";
    if (!app.popularityApi) {
      console.log(`::warning title=Missing popularityApi::${app.id} is listed but has no popularityApi; add "popularityApi": "${expected}" to apps.json (see docs/popularity-spec.md).`);
    } else if (app.popularityApi !== expected) {
      console.log(`::warning title=Non-standard popularityApi::${app.id} popularityApi is ${app.popularityApi}; the spec requires ${expected}.`);
    }
  }

  const results = await Promise.all(sources.map(async (app) => {
    try {
      const entry = await fetchScore(app.popularityApi, app.id);
      console.log(`ok    ${app.id}: ${entry.score}${entry.metric ? ` (${entry.metric})` : ""}`);
      return [app.id, entry];
    } catch (error) {
      const kept = oldApps[app.id];
      console.warn(`fail  ${app.id}: ${error.message}${kept ? `; keeping last good score ${kept.score}` : "; no previous score"}`);
      return [app.id, kept || null];
    }
  }));

  const nextApps = {};
  for (const [id, entry] of results) if (entry) nextApps[id] = entry;

  if (JSON.stringify(nextApps) === JSON.stringify(oldApps)) {
    console.log("No popularity changes.");
    return;
  }
  const out = { updated: new Date().toISOString(), apps: nextApps };
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote popularity.json with ${Object.keys(nextApps).length} scored app(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
