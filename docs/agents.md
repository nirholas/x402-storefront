# For AI agents

How an autonomous agent discovers this store, pays, and what it gets back.

## Discovery

Two artifacts are published for machines:

1. **[`skill.md`](https://github.com/nirholas/x402-storefront/blob/main/skill.md)** (repo root, also servable at `{BASE_URL}/skill.md`) —
   plain-language instructions an LLM can read directly: endpoints, prices,
   params, response schemas, error codes.
2. **`{BASE_URL}/.well-known/x402`** — the machine-readable price sheet
   (`x402Version`, `resources[]` with price/network/asset/outputSchema).
   Registries like [x402scan.com](https://x402scan.com), the **x402 Bazaar**,
   and [agentic.market](https://agentic.market) index this format — submit your
   deployment URL there so agents can find your store without prior knowledge.

`openapi.json` (OpenAPI 3.1, includes the 402 response schema) completes the
trio for codegen-style clients.

## Paying

Any x402 client works. With `x402-fetch`:

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const payFetch = wrapFetchWithPayment(fetch, privateKeyToAccount(process.env.PRIVATE_KEY));
const res = await payFetch("https://store.example.com/buy/guide-agentic-commerce");
const artifact = await res.json();          // signed purchase, delivered now
```

The wrapper handles 402 → sign EIP-3009 USDC authorization → retry. Cap spend
with the third argument (atomic units): `wrapFetchWithPayment(fetch, acct, 100_000n)`
refuses anything over $0.10.

## What you get back

- **Digital**: `payload.downloadUrl` (free fetch, valid until
  `payload.downloadExpiresAt`), `contentSha256` for integrity, and a license
  string. The purchase is complete the moment the 200 arrives — nothing to poll.
- **Physical**: a signed order confirmation with a fulfillment record. Keep
  `orderId` + `signature`; the merchant's `supportEmail` is in the payload.
- Both are HMAC-SHA256-signed over canonical JSON — verify at `GET /verify` or
  offline.
- The USDC settlement receipt (tx hash, payer) is in the `X-PAYMENT-RESPONSE`
  response header — decode with `decodeXPaymentResponse` from `x402-fetch`.

## MCP integration

To give Claude these abilities as tools (`browse_catalog`, `buy_item`), see
[`examples/mcp-tool.md`](https://github.com/nirholas/x402-storefront/blob/main/examples/mcp-tool.md) —
a complete MCP server plus `claude_desktop_config.json` entry.

## Operator checklist for agent traffic

- Keep `/.well-known/x402` accurate — agents budget from it before paying.
- Don't rotate `SIGNING_SECRET` casually; outstanding download tokens die with it.
- List the deployment on x402scan.com / x402 Bazaar / agentic.market.
- Digital assets should be idempotent: same SKU, same bytes, same `contentSha256`.
