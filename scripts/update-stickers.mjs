import { writeFile } from "node:fs/promises";

const AUTHOR_URL = "https://store.line.me/stickershop/author/5344394/zh-Hant";
const OUT_FILE = new URL("../stickers.json", import.meta.url);
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

/**
 * Last-resort: scrape CDN preview URLs and synthesize product links from IDs.
 * Order follows first appearance in the page.
 */
function parseCdnPreviewImages(html, items, seen) {
  const re =
    /https?:\/\/stickershop\.line-scdn\.net\/stickershop\/v1\/product\/(\d+)\/[^"'\\\s>]+/gi;

  let match;
  while ((match = re.exec(html))) {
    const id = match[1];
    const image = match[0].replace(/&amp;/g, "&");
    pushItem(items, seen, {
      title: `LINE 貼圖 ${id}`,
      href: `/stickershop/product/${id}/zh-Hant`,
      image
    });
  }
}

function parseItems(html) {
  const items = [];
  const seen = new Set();

  parseAuthorItemBlocks(html, items, seen);
  if (!items.length) parseProductAnchors(html, items, seen);
  if (!items.length) parseCdnPreviewImages(html, items, seen);

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

const response = await fetch(AUTHOR_URL, {
  headers: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "zh-TW,zh-Hant;q=0.9,en;q=0.5",
    "user-agent": BROWSER_UA
  }
});

if (!response.ok) {
  throw new Error(`LINE STORE returned HTTP ${response.status}`);
}

const html = await response.text();
const items = parseItems(html);

if (!items.length) {
  throw new Error(`No LINE STORE sticker items found. ${diagnoseEmpty(html)}`);
}

const data = {
  source: AUTHOR_URL,
  count: items.length,
  items
};

await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated stickers.json with ${items.length} items.`);
