# x402-storefront — agent skill

Self-hosted store with x402 checkout. Digital goods are delivered in the paid
response as a signed, time-limited download URL plus license; physical goods
return a signed order confirmation and fulfillment record. Browse the catalog
for free, then pay per item with USDC over the x402 protocol — no account, no
API key, no checkout session.

**Base URL**: `{BASE_URL}` (e.g. `http://localhost:4021` when self-hosted)

Machine-readable price sheet: `{BASE_URL}/.well-known/x402`

## Endpoints

### GET /catalog — free
Returns the store, both payment rails, and every item with its price and buy route.

Response (excerpt):
```json
{
  "store": { "name": "x402 Storefront", "shipsTo": ["US", "CA", "GB", "DE", "JP"] },
  "items": [
    { "sku": "guide-agentic-commerce", "type": "digital", "price": "$0.05", "buy": "GET /buy/guide-agentic-commerce" },
    { "sku": "stickers-x402", "type": "physical", "price": "$0.10", "buy": "GET /buy/stickers-x402" }
  ]
}
```

### GET /buy/:sku — priced per item (see /catalog or /.well-known/x402)
Pays for and returns the item in one call.

Query params (physical items only): `name`, `address`, `country` — shipping details.

Digital response:
```json
{
  "payload": {
    "orderId": "ord_…", "sku": "guide-agentic-commerce", "kind": "digital",
    "downloadUrl": "/download/<signed-token>",
    "downloadExpiresAt": "2026-08-07T13:00:00.000Z",
    "contentType": "text/markdown",
    "contentSha256": "…",
    "license": "single-purchaser, non-transferable, unlimited personal/agent use",
    "purchasedAt": "2026-08-07T12:00:00.000Z"
  },
  "signature": "hex…", "algorithm": "HMAC-SHA256", "canonicalization": "sorted-keys-json"
}
```
Fetch `downloadUrl` (free, no payment) before `downloadExpiresAt` to get the bytes.
Verify integrity with `contentSha256`.

Physical response:
```json
{
  "payload": {
    "orderId": "ord_…", "sku": "stickers-x402", "kind": "physical",
    "fulfillment": {
      "status": "accepted",
      "promise": "ships within 5 business days",
      "shipTo": { "name": "Ada", "address": "1 Main St", "country": "US" },
      "weightGrams": 20
    },
    "supportEmail": "merchant@example.com",
    "purchasedAt": "…"
  },
  "signature": "hex…", "algorithm": "HMAC-SHA256"
}
```
The signed confirmation is your receipt-of-action; keep `orderId` + `signature`.

### GET /download/:token — free
Redeems a signed download token from a digital purchase. Returns the raw asset
bytes with correct `Content-Type`. 403 if the token is expired or tampered.

### GET /verify?payload=<json>&signature=<hex> — free
Returns `{ "valid": true|false }` for any signed artifact from this store.
Offline alternative: HMAC-SHA256 over canonical JSON (keys sorted recursively,
no whitespace) with the store's `SIGNING_SECRET`.

## Payment

**Pay in USDC on Base or Solana — your client picks the rail.**

- Protocol: **x402** (HTTP 402 → signed USDC authorization → retry with `X-PAYMENT` header)
- Asset: **USDC** on both rails
- Facilitators are rail-specific: `https://x402.org/facilitator` settles the EVM
  rail (override: `FACILITATOR_URL`), `https://facilitator.payai.network` settles
  the Solana rail (override: `SOLANA_FACILITATOR_URL`)

| Rail | Network | payTo |
| --- | --- | --- |
| EVM | `base-sepolia` (default) or `base` via `NETWORK=base` | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (default) or `solana-devnet` via `SOLANA_NETWORK=devnet` | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

The first unpaid request returns `402` with an `accepts[]` array holding **one
entry per rail**. Choose either, sign the payload for that network, and retry
with `X-PAYMENT: <base64 payload>`:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header required — pay in USDC on Base or Solana, your pick.",
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required", "mimeType": "application/json" },
    { "scheme": "exact", "network": "solana", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required", "mimeType": "application/json" }
  ]
}
```

Pay with `x402-fetch` (EVM), a Solana x402 client, or any x402-capable wallet.
The settlement receipt — including which rail settled it — arrives in the
`X-PAYMENT-RESPONSE` response header.

## Errors

| Status | Meaning |
| --- | --- |
| 402 | Payment required / invalid payment — body contains `accepts[]` requirements |
| 403 | Download token expired or tampered |
| 404 | Unknown SKU or asset |
| 400 | Malformed verify request |

Discovery: this file (skill.md at repo root) + [`/.well-known/x402`]({BASE_URL}/.well-known/x402) + `openapi.json`.

Contact: nichxbt@gmail.com
