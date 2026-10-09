# x402-storefront

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![x402](https://img.shields.io/badge/payments-x402-0052ff.svg)](https://x402.org)
[![USDC on Base + Solana](https://img.shields.io/badge/USDC-Base%20%2B%20Solana-2775ca.svg)](https://x402.org)

Self-hosted store with x402 checkout — sell **digital goods delivered in-response**
(signed, time-limited download URL + license) and **physical goods** (signed order
confirmation + fulfillment record). Buyers need a wallet, not an account.

**Pay in USDC on Base or Solana — your client picks the rail.**

## Why x402 for this

A store for AI agents can't rely on signup forms, sessions, or card checkout —
agents want to discover an item and own it in one HTTP round trip. x402 turns
`402 Payment Required` into a working checkout: the server quotes a USDC price
in the response, the client signs a transfer authorization and retries, and the
200 body **is** the purchase. Per-item pricing with zero subscription overhead.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-storefront
cd x402-storefront && npm install
cp .env.example .env            # ships with working payTo addresses — edit to get paid yourself
npm run dev                     # store at http://localhost:4021
```

First 402, no wallet needed:

```bash
curl -s http://localhost:4021/buy/art-payment-required | jq '.accepts[] | {network, payTo, maxAmountRequired}'
```

```json
{ "network": "base-sepolia", "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "maxAmountRequired": "10000" }
{ "network": "solana",       "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "maxAmountRequired": "10000" }
```

Two rails in one challenge — pay whichever you hold.

Full paid flow (funded Base Sepolia wallet — free USDC at [faucet.circle.com](https://faucet.circle.com)):

```bash
export PRIVATE_KEY=0x…
npm run client
```

## API

| Route | Price | What you get back |
| --- | --- | --- |
| `GET /catalog` | free | Items, prices, buy routes |
| `GET /buy/guide-agentic-commerce` | $0.05 | Signed download grant (markdown guide) + license |
| `GET /buy/dataset-http-402` | $0.02 | Signed download grant (JSON dataset) + license |
| `GET /buy/art-payment-required` | $0.01 | Signed download grant (SVG art) + license |
| `GET /buy/stickers-x402` | $0.10 | Signed order confirmation + fulfillment record |
| `GET /buy/tee-pay-per-call` | $0.25 | Signed order confirmation + fulfillment record |
| `GET /download/:token` | free | The purchased bytes (token from a digital purchase) |
| `GET /verify` | free | `{valid}` for any signed artifact |

Prices and items are yours to edit in [`config/catalog.json`](config/catalog.json) —
paid routes are generated from it at startup.

## How x402 works

1. `GET /buy/:sku` with no payment → **402** + an `accepts[]` array with **one entry per rail** (price, network, payTo, USDC mint/contract).
2. The client picks a rail and signs for it — an EIP-3009 USDC transfer authorization on Base, or an SPL USDC transfer on Solana.
3. Retry with `X-PAYMENT: <base64 signed payload>`.
4. The server verifies + settles through the facilitator and answers **200** with the artifact. The settlement receipt — tx hash plus which rail settled it — rides in the `X-PAYMENT-RESPONSE` header.

```
GET /buy/:sku                    402  accepts: [ base-sepolia USDC , solana USDC ]
GET /buy/:sku  X-PAYMENT: …      200  { payload: {...}, signature }   +  X-PAYMENT-RESPONSE
```

### Dual-rail configuration

| Rail | Default network | Mainnet switch | payTo env |
| --- | --- | --- | --- |
| EVM (Base) | `base-sepolia` | `NETWORK=base` | `PAY_TO_ADDRESS` |
| Solana | `solana` | already mainnet; `SOLANA_NETWORK=devnet` for testing | `SOLANA_PAY_TO_ADDRESS` |

Both default to the x402 Suite's public receive addresses so the demo runs with
zero setup — set your own to receive funds. A rail with a missing or malformed
address is dropped from `accepts` with a warning; the other keeps working.

## Real backend / keys

No third-party API keys at all — inventory is yours (`config/catalog.json`,
digital assets in `assets/`). Orders are appended to `data/orders.json`
(file-based, no database). Set `SIGNING_SECRET` in production; a labeled dev
secret is used otherwise.

## Human checkout

`public/index.html` is a working storefront page using the drop-in
[`@three-ws/x402-payment-modal`](https://www.npmjs.com/package/@three-ws/x402-payment-modal):
every catalog item gets a **Pay & buy** button, the modal handles wallet
connection and payment, and the signed artifact renders on `x402:result`.
The modal ships SIWX re-entry (returning buyers reauthorize with one signature)
and per-site spending caps, and it reads both rails straight out of the 402
challenge — Phantom for Solana, an injected wallet for Base, no extra wiring.
It is a proprietary package referenced from CDN — not part of this Apache-2.0
codebase.

The Solana browser path needs one small helper route, `POST /api/x402-checkout`
([`src/solana-checkout.ts`](src/solana-checkout.ts)): Phantom signs transactions
but cannot build them, so the server assembles the unsigned SPL transfer and
wraps the signed one. It never sees a key and cannot move funds. Agents paying
programmatically skip it entirely.

## For AI agents

- **[skill.md](skill.md)** — agent-readable instructions for every endpoint.
- **[/.well-known/x402](public/.well-known/x402)** — machine-readable price sheet, indexable by [x402scan.com](https://x402scan.com), the x402 Bazaar, and [agentic.market](https://agentic.market). List your deployment there so agents can find it.
- **[examples/mcp-tool.md](examples/mcp-tool.md)** — expose the store as MCP tools for Claude.
- **[examples/agent-client.ts](examples/agent-client.ts)** — full pay-and-download flow with `x402-fetch`.

## Docs

Site: **https://nirholas.github.io/x402-storefront/** —
[tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [for agents](docs/agents.md)

Part of the [x402 Suite](https://github.com/nirholas/x402-suite).

## Support

Questions, bugs, or listing requests: **nichxbt@gmail.com**

## License

[Apache-2.0](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nirholas/x402-storefront&type=Date)](https://www.star-history.com/#nirholas/x402-storefront&Date)
