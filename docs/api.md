# API reference

Base URL: your deployment (default `http://localhost:4021`).
Machine-readable versions: [`openapi.json`](https://github.com/nirholas/x402-storefront/blob/main/openapi.json) ·
[`/.well-known/x402`](https://github.com/nirholas/x402-storefront/blob/main/public/.well-known/x402)

Paid routes speak x402: an unpaid request returns **402** with `accepts[]`
payment requirements; retry with a signed `X-PAYMENT` header to get **200**.

---

## GET /catalog — free

Lists every item with price and buy route.

```json
{
  "store": { "name": "x402 Storefront", "merchantId": "x402-storefront-demo", "shipsTo": ["US","CA","GB","DE","JP"] },
  "network": "base-sepolia",
  "payment": { "protocol": "x402", "asset": "USDC", "facilitator": "https://x402.org/facilitator" },
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
| 402 | No/invalid payment — body carries `accepts[]` requirements |
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

`{ "ok": true, "service": "x402-storefront", "network": "base-sepolia" }`

## GET /.well-known/x402 — free

The x402 discovery manifest: every paid resource with price, network, asset,
and output schema. Index-ready for x402scan.com, the x402 Bazaar, and
agentic.market.
