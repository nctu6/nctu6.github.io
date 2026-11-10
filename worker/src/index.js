// Portaly 串接的 Cloudflare Worker
//
// 路由：
//   POST /api/checkout          建立 Portaly 結帳，回傳 { checkoutUrl }（前端導向該網址）
//   POST /portaly/callback      接收 Portaly 回呼，驗證簽章後才處理
//
// 機密（用 `wrangler secret put` 設定，不要寫進程式或 wrangler.toml）：
//   PORTALY_API_KEY        Portaly API 金鑰
//   PORTALY_CALLBACK_SECRET 該金鑰的 callbackSecret（用來驗證回呼）
//   PORTALY_PLAN_ID        贊助方案的 planId
//
// 注意：本檔不記錄任何金鑰；錯誤訊息也不回傳內部細節。

const MAX_SKEW_MS = 5 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsPreflight(env);
    }

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return withCors(await handleCheckout(request, env), env);
    }

    if (url.pathname === "/portaly/callback" && request.method === "POST") {
      return handleCallback(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

// ---------- 建立結帳 ----------

async function handleCheckout(request, env) {
  if (!env.PORTALY_API_KEY || !env.PORTALY_PLAN_ID) {
    return json({ error: "server_not_configured" }, 500);
  }

  let body = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // 只允許前端傳入這幾個欄位，其餘一律忽略，避免被任意覆寫
  const payload = {
    planId: env.PORTALY_PLAN_ID,
    callbackUrl: env.CALLBACK_URL,
    successRedirectUrl: env.SUCCESS_REDIRECT_URL,
  };
  // 結帳逾時或無法完成時，Portaly 會連回這裡；舊的 session 不能重用，所以要指向能重新發起贊助的頁面
  if (env.CANCEL_REDIRECT_URL) payload.cancelRedirectUrl = env.CANCEL_REDIRECT_URL;
  if (Number.isFinite(body.amount)) payload.amount = body.amount; // 動態金額方案才需要

  let res;
  try {
    res = await fetch(`${env.PORTALY_API_HOST}/api/creator-subscription/checkout-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PORTALY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.checkoutUrl) {
    return json({ error: "checkout_failed", status: res.status }, 502);
  }

  // 只回傳前端需要的欄位
  return json({ checkoutUrl: data.data.checkoutUrl, expiresAt: data.data.expiresAt });
}

// ---------- 回呼 ----------

async function handleCallback(request, env) {
  if (!env.PORTALY_CALLBACK_SECRET) {
    return new Response("server_not_configured", { status: 500 });
  }

  const event = request.headers.get("x-portaly-event");
  const timestamp = request.headers.get("x-portaly-timestamp");
  const signature = request.headers.get("x-portaly-signature");
  const rawBody = await request.text();

  const ok = await verifyCallback({
    secret: env.PORTALY_CALLBACK_SECRET,
    event,
    timestamp,
    signature,
    rawBody,
  });
  if (!ok) {
    return new Response("invalid signature", { status: 401 });
  }

  // 簽章驗證通過後才能產生任何副作用。
  // 目前只把最少的稽核欄位寫進 Workers 日誌（不含 email、姓名、電話等個資，也不含簽章或密鑰）。
  // 正式的訂單帳本在 Portaly 後台；若之後要寄感謝信或寫資料庫，需依下面的 idempotencyKey 去重複。
  const body = JSON.parse(rawBody);
  console.log(JSON.stringify(auditRecord(event, body)));
  return new Response("ok", { status: 200 });
}

/**
 * 依 Portaly 規格挑出最少的稽核欄位，並算出事件專屬的去重複 key：
 * - checkout.completed / checkout.failed：event + sessionId
 * - payment.succeeded：event + subscriptionId + chargedAt
 * - payment.failed：event + subscriptionId + failedAt
 * - payment.refunded / refund_failed：event + orderId
 */
export function auditRecord(event, body) {
  const subscriptionId = body.subscriptionId || body.sessionId || null;
  let idempotencyKey;
  switch (event) {
    case "creator_subscription.checkout.completed":
    case "creator_subscription.checkout.failed":
      idempotencyKey = `${event}:${body.sessionId}`;
      break;
    case "creator_subscription.payment.succeeded":
      idempotencyKey = `${event}:${subscriptionId}:${body.chargedAt}`;
      break;
    case "creator_subscription.payment.failed":
      idempotencyKey = `${event}:${subscriptionId}:${body.failedAt}`;
      break;
    case "creator_subscription.payment.refunded":
    case "creator_subscription.payment.refund_failed":
      idempotencyKey = `${event}:${body.orderId}`;
      break;
    default:
      idempotencyKey = null; // 生命週期事件沒有文件記載的投遞識別碼
  }
  return {
    type: "portaly_callback",
    event,
    mode: body.mode || "live",
    status: body.status ?? null,
    sessionId: body.sessionId ?? null,
    subscriptionId,
    orderId: body.orderId ?? null,
    merchantOrderNumber: body.merchantOrderNumber ?? null,
    planId: body.planId ?? null,
    amount: body.amount ?? null,
    currency: body.currency ?? null,
    failureReason: body.failureReason ?? null,
    idempotencyKey,
  };
}

/**
 * 依 Portaly 規格驗證回呼：
 * - 簽章 = HMAC-SHA256( secret, timestamp + "." + stableJson(JSON.parse(rawBody)) )，輸出小寫 hex
 * - timestamp 為 ISO 時間字串，與現在時間相差不得超過 5 分鐘
 * - x-portaly-event 必須等於 body 內的 event 欄位
 */
export async function verifyCallback({ secret, event, timestamp, signature, rawBody }) {
  if (!secret || !event || !timestamp || !signature) return false;

  const sentAt = Date.parse(timestamp);
  if (Number.isNaN(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) return false;

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  if (!parsed || parsed.event !== event) return false;

  const signed = `${timestamp}.${stableJson(parsed)}`;
  const expected = await hmacHex(secret, signed);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

/**
 * 與 Portaly 參考實作一致：物件鍵以 localeCompare 排序，不跳脫 & < >。
 * 注意：這不是標準 JSON 排序，必須照規格，否則簽章不會一致。
 */
export function stableJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- 共用 ----------

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function corsPreflight(env) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function withCors(res, env) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
  return new Response(res.body, { status: res.status, headers });
}
