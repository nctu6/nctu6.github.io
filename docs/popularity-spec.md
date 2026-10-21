# 0x6.ai /popularity.json — unified spec v1

Every 0x6.ai work implements exactly this. No per-site variations.

## Endpoint
- URL: `https://<work-domain>/popularity.json` (e.g. https://agentusecases.0x6.ai/popularity.json)
- Method GET, HTTP 200, `Content-Type: application/json; charset=utf-8`
- Headers: `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600`
- Must be reachable by a plain non-browser client (Node fetch from GitHub Actions runners):
  exempt this exact path from any Cloudflare bot challenge / WAF / Turnstile.

## Body (exact keys, no extras)
```json
{
  "version": 1,
  "id": "<apps.json id of this work>",
  "metric": "pageviews_30d",
  "score": 12345,
  "window_days": 30,
  "updated": "2026-10-21T00:00:00Z"
}
```
- `score`: non-negative integer = human page views over the trailing 30 days, bots/crawlers excluded.
- `updated`: ISO 8601 UTC with `Z`, time the number was computed.
- ids: `x-feed`, `agentusecases`, `amex-web`, `taiwan-last-train` (LINE stickers is pinned first on 0x6.ai and needs no endpoint).

## Counting rule (same for all)
- Count page views of the work's public web pages on its own domain only.
- Exclude bots (Cloudflare bot flag / known crawler UAs), health checks, and `/popularity.json` itself.
- No app downloads, followers, or other metrics mixed in, so scores are comparable.
- Aggregate number only: no IPs, user IDs, or other personal data stored or exposed.
- Recompute once per day (daily; not hourly). If no data yet, publish `"score": 0`.

## Consumer (owned by 0x6.ai bot)
- A daily GitHub Actions job in nctu6.github.io fetches every endpoint, validates the schema
  (version==1, id matches, integer score), keeps the last good value on failure, and writes
  `popularity.json` in the site repo. The browser never calls the work domains.

## Adding a new work
- Every new listed app in `apps.json` (`"listed": true`) must set
  `"popularityApi": "https://<domain>/popularity.json"`, where `<domain>` is that entry's `domain`.
- The work must implement this spec exactly, with no variations: same URL path, headers, body keys, metric and counting rule.
- Until it has data, the endpoint still publishes `"score": 0`.
- Only a pinned app (`"pinned": true`, currently LINE stickers) may omit `popularityApi`.
  `scripts/update-popularity.mjs` prints a GitHub Actions warning for any listed, non-pinned app without one,
  or with a `popularityApi` that is not `https://<domain>/popularity.json`.
