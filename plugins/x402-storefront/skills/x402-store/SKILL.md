---
name: x402-store
description: Browse a catalog and buy digital or physical goods through an x402 checkout, with signed download URLs and order confirmations. Use when an agent needs to purchase an item or run a store.
---

# x402-storefront store checkout

No account, API key or checkout session: browse for free, pay per item. Digital goods return a signed, time-limited download URL and license. Physical goods return a signed order confirmation.

## Run the server

The repo is a self-hosted Express service. It is not published to npm, so run it from a clone.

```bash
git clone https://github.com/nirholas/x402-storefront && cd x402-storefront
npm install
cp .env.example .env   # optional: the defaults run out of the box
npm run dev            # listens on http://localhost:4021 (override with PORT)
```

Set `PAY_TO_ADDRESS` (Base) and `SOLANA_PAY_TO_ADDRESS` (Solana) in `.env` to receive payments yourself.
The catalog is `config/catalog.json` (skus such as `guide-agentic-commerce`, `stickers-x402`).
`GET http://localhost:4021/.well-known/x402` lists every route with its price, and `GET /health` is the liveness probe.

## Routes

| Route | Price | Purpose |
|---|---|---|
| `GET /catalog` | free | Store, rails and every item with price and buy route |
| `GET /buy/:sku` | per item | Pay and receive the item. Physical items also take query `name`, `address`, `country` |
| `GET /download/:token` | free | Fetch the bytes from a digital order's `downloadUrl` before `downloadExpiresAt` |
| `GET /verify?payload=<json>&signature=<hex>` | free | Verify a signed order |
| `GET /health`, `GET /.well-known/x402` | free | Liveness and the price sheet |

The full request and response schemas are in `skill.md` at the repo root (the running server also serves it at `GET /skill.md`).

## Paying

Paid routes answer an unpaid request with HTTP 402 and an `accepts` array with one entry per rail (USDC on Base and USDC on Solana). A client picks an entry, signs, and retries with the `X-PAYMENT` header. The 200 body carries the artifact and an `X-PAYMENT-RESPONSE` header carries the settlement receipt. Any x402 client works (`x402-fetch` with `viem` on the EVM rail). Each paid call spends real USDC on whichever network the server is configured for (`NETWORK`, `SOLANA_NETWORK`), so show the user the route, price and network and get a yes before paying.

## Worked example

```bash
curl -s http://localhost:4021/catalog
```

Read the item `price` from the catalog, get the user's yes, then pay `GET /buy/guide-agentic-commerce` with an x402 client. Fetch `payload.downloadUrl` (free) and compare the bytes with `contentSha256`.
