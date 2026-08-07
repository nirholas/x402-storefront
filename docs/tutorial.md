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

`.env.example` ships with working defaults for **both payment rails**, so the
store runs immediately. Change these two to receive funds yourself:

```
# EVM (Base / Base Sepolia) USDC receive address
PAY_TO_ADDRESS=0x40252CFDF8B20Ed757D61ff157719F33Ec332402
# Solana USDC receive address
SOLANA_PAY_TO_ADDRESS=WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW
```

Every paid route offers both rails and the buyer picks. If you only want one,
delete the other address — that rail is dropped from the 402 challenge with a
warning, and the remaining rail keeps working.

Optionally set `SIGNING_SECRET` (artifact signatures) — a labeled dev secret is
used otherwise.

Your inventory lives in `config/catalog.json`. Each item has a `sku`, `type`
(`digital` | `physical`), `price` (e.g. `"$0.05"`), and for digital items an
`asset` path. Edit freely; paid routes are rebuilt from this file at startup.

## 3. Run the server

```bash
npm run dev
```

The startup banner lists both payment rails and every paid route with its price:

```
  Payment rails (USDC — the client picks):
    evm    base-sepolia   USDC → 0x40252CFDF8B20Ed757D61ff157719F33Ec332402  via https://x402.org/facilitator
    solana solana         USDC → WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW  via https://x402.org/facilitator
```

The human checkout demo is at `http://localhost:4021/`.

## 4. Your first 402

```bash
curl -s http://localhost:4021/buy/art-payment-required \
  | jq '.accepts[] | {network, asset, payTo, maxAmountRequired}'
```

```json
{
  "network": "base-sepolia",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
  "maxAmountRequired": "10000"
}
{
  "network": "solana",
  "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
  "maxAmountRequired": "10000"
}
```

`HTTP/1.1 402 Payment Required` with an `accepts[]` array holding **one entry per
rail** — price in atomic USDC (6 decimals, so `10000` = $0.01), the network, the
`payTo` address, and the USDC contract or mint. This is the entire "checkout
page", and the client chooses which rail to settle on.

## 5. A paid call

### Base (EVM)

You need a wallet with Base Sepolia USDC (free from the
[Circle faucet](https://faucet.circle.com)). Base Sepolia ETH is **not** needed —
x402 uses gasless EIP-3009 transfers.

```bash
export PRIVATE_KEY=0xYourTestKey
npm run client
```

### Solana

Pick the `solana` entry from `accepts[]` instead, sign an SPL USDC transfer to
its `payTo`, and send the same base64 `X-PAYMENT` envelope. Any Solana-capable
x402 client does this; in a browser the drop-in payment modal at `/` handles it
with Phantom automatically. Both rails end at the same 200 and the same signed
artifact — only `X-PAYMENT-RESPONSE` differs, naming the rail that settled.

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
NETWORK=base                     # EVM rail: base-sepolia -> base mainnet
SOLANA_NETWORK=mainnet-beta      # Solana rail (already the default)
FACILITATOR_URL=https://your-mainnet-facilitator.example
SIGNING_SECRET=<long random string>
PUBLIC_BASE_URL=https://store.example.com
```

- Use a facilitator that settles on Base mainnet (e.g. Coinbase CDP's x402
  facilitator). Point `SOLANA_FACILITATOR_URL` at a Solana-capable facilitator
  if it differs.
- `PAY_TO_ADDRESS` and `SOLANA_PAY_TO_ADDRESS` now receive real USDC.
- `PUBLIC_BASE_URL` makes the `resource` field in your 402 quotes match your
  public URL — agents and facilitators check it.
- Put the server behind HTTPS; the `resource` URLs in your 402 quotes should be
  your public URL.

## Where to next

- [API reference](api.md)
- [For AI agents](agents.md) — discovery, MCP, listings
- [examples/curl.md](https://github.com/nirholas/x402-storefront/blob/main/examples/curl.md) — the raw wire flow
