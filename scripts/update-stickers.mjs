import { readFile, writeFile } from "node:fs/promises";

const AUTHOR_URL = "https://store.line.me/stickershop/author/5344394/zh-Hant";
const OUT_FILE = new URL("../stickers.json", import.meta.url);
const MAX_PAGES = 20;
/* Refuse to write when the scrape shrinks sharply (e.g. a region-limited or partial page). */
const MIN_KEEP_RATIO = 0.5;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function decodeEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const number = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _;
    }

    return named[entity] ?? _;
  });
}

function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
}

function attr(html, name) {
  const match = html.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function resolveUrl(value) {
  try {
    return new URL(value, AUTHOR_URL).href;
  } catch {
    return "";
  }
}

function pushItem(items, seen, { title, href, image }) {
  const resolvedHref = resolveUrl(href);
  const resolvedImage = resolveUrl(image);
  if (!resolvedImage) return;

  const key = resolvedHref || resolvedImage;
  if (!key || seen.has(key)) return;

  seen.add(key);
  items.push({
    title: stripTags(title || attr(`<img alt="${title || ""}">`, "alt") || "LINE 貼圖作品"),
    href: resolvedHref || AUTHOR_URL,
    image: resolvedImage
  });
}

/** Prefer author-item cards when present (stable data-test hooks). */
function parseAuthorItemBlocks(html, items, seen) {
  const blocks =
    html.match(/<li\b[^>]*data-test\s*=\s*["']author-item["'][\s\S]*?<\/li>/gi) ?? [];

  for (const block of blocks) {
    const link = block.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const imageTag =
      block.match(
        /<img\b[^>]*src\s*=\s*["'][^"']*stickershop\.line-scdn\.net[^"']*["'][^>]*>/i
      )?.[0] ?? "";
    const titleHtml =
      block.match(/<[^>]*data-test\s*=\s*["']item-name["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ??
      "";

    pushItem(items, seen, {
      title: titleHtml || attr(imageTag, "alt") || "LINE 貼圖作品",
      href: link || AUTHOR_URL,
      image: attr(imageTag, "src")
    });
  }
}

/**
 * Fallback when data-test hooks disappear: pair each stickershop product
 * anchor with a CDN preview image inside the same anchor body.
 */
function parseProductAnchors(html, items, seen) {
  const re =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/stickershop\/product\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = re.exec(html))) {
    const href = match[1];
    const body = match[2];
    const image =
      body.match(
        /src\s*=\s*["'](https?:\/\/stickershop\.line-scdn\.net\/[^"']+)["']/i
      )?.[1] ?? "";
    if (!image) continue;

    const title =
      body.match(/data-test\s*=\s*["']item-name["'][^>]*>([\s\S]*?)<\//i)?.[1] ??
      body.match(/alt\s*=\s*["']([^"']+)["']/i)?.[1] ??
      `LINE 貼圖 ${href.match(/\/product\/(\d+)/)?.[1] ?? ""}`;

    pushItem(items, seen, { title, href, image });
  }
}

function parseItems(html) {
  const items = [];
  const seen = new Set();

  parseAuthorItemBlocks(html, items, seen);
  if (!items.length) parseProductAnchors(html, items, seen);

  return items;
}

function diagnoseEmpty(html) {
  const title = stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "");
  const len = html.length;
  const authorItems = (html.match(/data-test\s*=\s*["']author-item["']/gi) ?? []).length;
  const productLinks = (html.match(/\/stickershop\/product\/\d+/g) ?? []).length;
  const cdnImages = (html.match(/stickershop\.line-scdn\.net\/stickershop\/v1\/product\/\d+/g) ?? [])
    .length;
  const challenge = /captcha|challenge|access denied|just a moment|cf-browser|bot.?detect/i.test(
    html
  );

  return [
    `Fetched ${AUTHOR_URL} (${len} bytes).`,
    `title=${title || "(none)"}`,
    `markers: author-item=${authorItems}, productLinks=${productLinks}, cdnImages=${cdnImages}, challengeLike=${challenge}`,
    "LINE STORE markup may have changed, or this IP received a bot/challenge shell without product cards.",
    "Open the author URL in a browser; if products show there, retry or adjust parsing."
  ].join(" ");
}

/** Total the author page declares, e.g. "<span>63 項</span>" / "63 items". */
function declaredTotal(html) {
  const m = html.match(/<span>\s*(\d+)\s*(?:項|items?|件)\s*<\/span>/i);
  return m ? Number(m[1]) : null;
}

function pageUrl(page) {
  return page === 1 ? AUTHOR_URL : `${AUTHOR_URL}?page=${page}`;
}

async function fetchPage(page) {
  const response = await fetch(pageUrl(page), {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-TW,zh-Hant;q=0.9,en;q=0.5",
      "user-agent": BROWSER_UA
    }
  });
  if (page > 1 && response.status === 404) return null;
  if (!response.ok) throw new Error(`LINE STORE returned HTTP ${response.status} for page ${page}`);
  return response.text();
}

async function previousCount() {
  try {
    const old = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return Array.isArray(old.items) ? old.items.length : 0;
  } catch {
    return 0;
  }
}

const firstHtml = await fetchPage(1);
const total = declaredTotal(firstHtml);
const items = parseItems(firstHtml);

if (!items.length) {
  throw new Error(`No LINE STORE sticker items found. ${diagnoseEmpty(firstHtml)}`);
}

/* The author page is paginated (36 per page): follow ?page=N until a page adds nothing. */
let html = firstHtml;
for (let page = 2; page <= MAX_PAGES && new RegExp(`[?&]page=${page}\\b`).test(html); page += 1) {
  html = await fetchPage(page);
  if (!html) break;
  const before = items.length;
  const more = parseItems(html);
  const seen = new Set(items.map((item) => item.href || item.image));
  for (const item of more) {
    const key = item.href || item.image;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }
  console.log(`Page ${page}: +${items.length - before} items.`);
  if (items.length === before) break;
}

const prev = await previousCount();
const allowShrink = process.env.ALLOW_STICKER_SHRINK === "1";
const problems = [];
if (total !== null && items.length < total) {
  problems.push(`the page declares ${total} items but only ${items.length} were parsed`);
}
if (prev > 1 && (items.length <= 1 || items.length < prev * MIN_KEEP_RATIO)) {
  problems.push(`item count dropped from ${prev} to ${items.length} (below ${MIN_KEEP_RATIO * 100}%)`);
}
if (problems.length && !allowShrink) {
  console.log(`::error title=Sticker data not updated::${problems.join("; ")}. Kept the existing stickers.json. ${diagnoseEmpty(firstHtml)}`);
  process.exit(1);
}

const data = {
  source: AUTHOR_URL,
  count: items.length,
  items
};

await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated stickers.json with ${items.length} items${total !== null ? ` (page declares ${total})` : ""}.`);
