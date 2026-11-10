# Portaly 串接 Worker

這是部署在 Cloudflare Workers 的小型伺服器端函式，負責：

- `POST /api/checkout`：用 Portaly API 建立贊助結帳，回傳 `checkoutUrl`。
- `POST /portaly/callback`：接收 Portaly 回呼，先驗證 HMAC 簽章，通過才處理。

金鑰不會出現在前端或本 repo 中，全部使用 Wrangler secret 設定。

## 部署步驟

請在本機執行（需要已登入 Cloudflare 的帳號）：

```bash
cd worker
npx wrangler login
npx wrangler secret put PORTALY_API_KEY
npx wrangler secret put PORTALY_CALLBACK_SECRET
npx wrangler secret put PORTALY_PLAN_ID
npx wrangler deploy
```

部署後會得到 `https://portaly-bridge.<你的子網域>.workers.dev` 之類的網址。

接著：

1. 修改 [wrangler.toml](wrangler.toml) 的 `CALLBACK_URL`，改成實際的 Worker 網址加上 `/portaly/callback`，然後重新 `npx wrangler deploy`。
2. 到 Portaly 後台把回呼網址設為同一個 `CALLBACK_URL`。
3. 確認 `SUCCESS_REDIRECT_URL` 是你希望買家付款後回去的頁面。

## 本機測試

```bash
cd worker
npx wrangler dev
```

`wrangler dev` 會讀取 secret（本機需另外用 `.dev.vars` 提供，此檔已被 `.gitignore` 排除，**不要提交**）。

`.dev.vars` 範例（只在本機建立，不要 commit）：

```
PORTALY_API_KEY=...
PORTALY_CALLBACK_SECRET=...
PORTALY_PLAN_ID=...
```

## 前端呼叫方式

前端不要直接帶金鑰呼叫 Portaly，改為呼叫 Worker：

```js
const res = await fetch("https://portaly-bridge.<你的子網域>.workers.dev/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}), // 動態金額方案才需要 { amount: 100 }
});
const { checkoutUrl } = await res.json();
location.href = checkoutUrl; // 直接導向，不要自己拼接網址
```

Worker 只允許 `ALLOWED_ORIGIN`（預設 `https://0x6.ai`）的跨網域請求。

## 回呼處理

- 簽章驗證通過後，會把最少的稽核欄位（事件、mode、sessionId、subscriptionId、orderId、金額、狀態、去重複 key）寫進 Workers Logs，不記錄 email、姓名、電話、簽章或密鑰。
- 正式的訂單帳本以 Portaly 後台為準。
- 若之後要寄感謝信或寫資料庫，請依 `auditRecord()` 算出的 `idempotencyKey` 去重複（Portaly 可能重送同一事件）。
- 簽章邏輯已通過 Portaly `portaly-payment` skill 的官方測試向量（7/7）。
