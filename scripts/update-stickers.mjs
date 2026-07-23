import { writeFile } from "node:fs/promises";

const AUTHOR_URL = "https://store.line.me/stickershop/author/5344394/zh-Hant";
const OUT_FILE = new URL("../stickers.json", import.meta.url);

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
  const match = html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function resolveUrl(value) {
  try {
    return new URL(value, AUTHOR_URL).href;
  } catch {
    return "";
  }
}

function parseItems(html) {
  const blocks = html.match(/<li\b[^>]*data-test=["']author-item["'][\s\S]*?<\/li>/gi) ?? [];
  const seen = new Set();

  return blocks.map((block) => {
    const link = block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
    const imageTag = block.match(/<img\b[^>]*src=["'][^"']*stickershop\.line-scdn\.net[^"']*["'][^>]*>/i)?.[0] ?? "";
    const titleHtml = block.match(/<p\b[^>]*data-test=["']item-name["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
    const image = resolveUrl(attr(imageTag, "src"));
    const title = stripTags(titleHtml || attr(imageTag, "alt") || "LINE 貼圖作品");
    const href = resolveUrl(link || AUTHOR_URL);

    return { title, href, image };
  }).filter((item) => {
    const key = item.href || item.image || item.title;
    if (!item.image || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const response = await fetch(AUTHOR_URL, {
  headers: {
    "accept-language": "zh-TW,zh-Hant;q=0.9,en;q=0.5",
    "user-agent": "Mozilla/5.0 0x6.ai sticker data updater"
  }
});

if (!response.ok) {
  throw new Error(`LINE STORE returned HTTP ${response.status}`);
}

const html = await response.text();
const items = parseItems(html);

if (!items.length) {
  throw new Error("No LINE STORE sticker items found");
}

const data = {
  source: AUTHOR_URL,
  count: items.length,
  items
};

await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated stickers.json with ${items.length} items.`);
