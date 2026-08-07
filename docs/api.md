# API reference

Base URL: your deployment (default `http://localhost:4021`).
Machine-readable versions: [`openapi.json`](https://github.com/nirholas/x402-storefront/blob/main/openapi.json) ·
[`/.well-known/x402`](https://github.com/nirholas/x402-storefront/blob/main/public/.well-known/x402)

Paid routes speak x402: an unpaid request returns **402** with an `accepts[]`
array holding **one entry per payment rail**; retry with a signed `X-PAYMENT`
header to get **200**.

**Pay in USDC on Base or Solana — your client picks the rail.**

| Rail | Network | Asset | payTo |
| --- | --- | --- | --- |
| EVM | `base-sepolia` (default) / `base` | USDC `0x036CbD…F7e` (sepolia) | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (default) / `solana-devnet` | USDC `EPjFWdd5…Dt1v` | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Every 402 body looks like this (amounts are atomic USDC, 6 decimals):

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header required — pay in USDC on Base or Solana, your pick.",
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "mimeType": "application/json", "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" } },
    { "scheme": "exact", "network": "solana", "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "mimeType": "application/json", "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "decimals": 6 } }
  ]
}
```

On success, `X-PAYMENT-RESPONSE` is base64 JSON:
`{ "success": true, "rail": "evm" | "solana", "network", "transaction", "payer" }`.

---

## GET /catalog — free

Lists every item with price and buy route.

```json
{
  "store": { "name": "x402 Storefront", "merchantId": "x402-storefront-demo", "shipsTo": ["US","CA","GB","DE","JP"] },
  "payment": {
    "protocol": "x402", "asset": "USDC",
    "note": "Pay in USDC on Base or Solana — your client picks the rail.",
    "rails": [
      { "rail": "evm", "network": "base-sepolia", "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402" },
      { "rail": "solana", "network": "solana", "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW" }
    ]
  },
  "items": [
    { "sku": "guide-agentic-commerce", "type": "digital", "name": "Field Guide to Agentic Commerce",
      "price": "$0.05", "buy": "GET /buy/guide-agentic-commerce", "license": "single-purchaser…" }
  ]
}
```

---

## GET /buy/:sku — paid, price per item

| Param | In | Notes |
| --- | --- | --- |
| `sku` | path | From `/catalog` |
| `name` | query | Physical items: ship-to name |
| `address` | query | Physical items: ship-to address |
| `country` | query | Physical items: ship-to country code |

**Digital 200** — signed download grant:

```json
{
  "payload": {
    "orderId": "ord_4f…", "sku": "art-payment-required", "item": "\"402 Payment Required\" wall art (SVG)",
    "kind": "digital",
    "downloadUrl": "/download/eyJza3Ui….sig",
    "downloadExpiresAt": "2026-08-07T13:00:00.000Z",
    "contentType": "image/svg+xml",
    "contentSha256": "9c2f…",
    "license": "personal display license",
    "purchasedAt": "2026-08-07T12:00:00.000Z"
  },
  "signature": "b1a4…", "algorithm": "HMAC-SHA256", "canonicalization": "sorted-keys-json"
}
```

**Physical 200** — signed order confirmation:

```json
{
  "payload": {
    "orderId": "ord_77…", "sku": "stickers-x402", "item": "x402 sticker pack", "kind": "physical",
    "fulfillment": {
      "status": "accepted", "promise": "ships within 5 business days",
      "shipTo": { "name": "Ada", "address": "1 Main St, Springfield", "country": "US" },
      "weightGrams": 20
    },
    "supportEmail": "merchant@example.com",
    "purchasedAt": "2026-08-07T12:00:00.000Z"
  },
  "signature": "e00c…", "algorithm": "HMAC-SHA256", "canonicalization": "sorted-keys-json"
}
```

**Errors**

| Status | Case |
| --- | --- |
| 402 | No/invalid payment — body carries `accepts[]` for both rails |
| 404 | Unknown SKU |

---

## GET /download/:token — free

Redeems the signed, time-limited token embedded in `downloadUrl`.
Responds with the raw bytes and the item's `Content-Type` /
`Content-Disposition: attachment`.

| Status | Case |
| --- | --- |
| 200 | Bytes delivered |
| 403 | Token expired or signature invalid |
| 404 | Asset removed from catalog |

---

## GET /verify?payload=&signature= — free

`payload` = URL-encoded JSON of the artifact's `payload` object,
`signature` = hex HMAC. Returns `{ "valid": true | false }`.
Offline check: HMAC-SHA256 over canonical JSON (recursively sorted keys, no
whitespace) with `SIGNING_SECRET`.

---

## GET /health — free

`{ "ok": true, "service": "x402-storefront", "rails": ["base-sepolia", "solana"] }`

## GET /.well-known/x402 — free

The x402 discovery manifest: every paid resource with price, both networks,
asset, an `accepts[]` preview of the live challenge, and the output schema.
Index-ready for x402scan.com, the x402 Bazaar, and agentic.market.

---

## POST /api/x402-checkout — free (browser Solana helper)

Used only by the drop-in payment modal on the demo page. `?action=prepare`
builds an unsigned SPL USDC transfer for the chosen accept; `?action=encode`
wraps the user-signed transaction into an `X-PAYMENT` envelope. It never holds a
key and cannot move funds. Returns 503 when
`@three-ws/x402-payment-modal` is not installed — the Base rail is unaffected.
