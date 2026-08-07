# Tutorial: from clone to first sale

This walks you from zero to a working x402 store: install → env → run →
first 402 → paid call → reading the artifact → mainnet.

## 1. Install

```bash
git clone https://github.com/nirholas/x402-storefront
cd x402-storefront
npm install
```

Requires Node 18+.

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and set the one required variable:

```
PAY_TO_ADDRESS=0xYourWalletAddress   # where USDC lands
```

Optionally set `SIGNING_SECRET` (artifact signatures) — a labeled dev secret is
used otherwise.

Your inventory lives in `config/catalog.json`. Each item has a `sku`, `type`
(`digital` | `physical`), `price` (e.g. `"$0.05"`), and for digital items an
`asset` path. Edit freely; paid routes are rebuilt from this file at startup.

## 3. Run the server

```bash
npm run dev
```

The startup banner lists every paid route with its price. The human checkout
demo is at `http://localhost:4021/`.

## 4. Your first 402

```bash
curl -si http://localhost:4021/buy/art-payment-required | head -25
```

You'll see `HTTP/1.1 402 Payment Required` and a JSON body with an `accepts[]`
array — the machine-readable quote: price in atomic USDC, the network, your
`payTo` address, and the USDC contract. This is the entire "checkout page".

## 5. A paid call

You need a wallet with Base Sepolia USDC (free from the
[Circle faucet](https://faucet.circle.com)) and a little Base Sepolia ETH is
**not** needed — x402 uses gasless EIP-3009 transfers.

```bash
export PRIVATE_KEY=0xYourTestKey
npm run client
```

`examples/agent-client.ts` browses the catalog, buys the $0.01 SVG, prints the
signed artifact and the decoded `X-PAYMENT-RESPONSE` settlement receipt,
downloads the asset, and verifies the signature.

## 6. Reading the artifact

Digital purchase (the interesting fields):

```json
{
  "payload": {
    "orderId": "ord_…",
    "downloadUrl": "/download/eyJ…",
    "downloadExpiresAt": "2026-08-07T13:00:00Z",
    "contentSha256": "…",
    "license": "single-purchaser …"
  },
  "signature": "…", "algorithm": "HMAC-SHA256"
}
```

- `downloadUrl` is free to fetch until `downloadExpiresAt` (default 1h,
  tune with `DOWNLOAD_TTL_SECONDS`).
- `contentSha256` lets the buyer verify the exact bytes.
- `signature` is HMAC-SHA256 over the canonical JSON of `payload` — check it
  at `GET /verify` or offline with the shared secret.

Physical purchases return a signed order confirmation with a fulfillment
record (`status: "accepted"`, shipping promise, ship-to details). Orders are
appended to `data/orders.json` for the merchant.

## 7. Going to mainnet

```
NETWORK=base
FACILITATOR_URL=https://your-mainnet-facilitator.example
SIGNING_SECRET=<long random string>
```

- Use a facilitator that settles on Base mainnet (e.g. Coinbase CDP's x402
  facilitator).
- `PAY_TO_ADDRESS` now receives real USDC.
- Put the server behind HTTPS; the `resource` URLs in your 402 quotes should be
  your public URL.

## Where to next

- [API reference](api.md)
- [For AI agents](agents.md) — discovery, MCP, listings
- [examples/curl.md](https://github.com/nirholas/x402-storefront/blob/main/examples/curl.md) — the raw wire flow
