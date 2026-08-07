# For AI agents

How an autonomous agent discovers this store, pays, and what it gets back.

## Discovery

Two artifacts are published for machines:

1. **[`skill.md`](https://github.com/nirholas/x402-storefront/blob/main/skill.md)** (repo root, also servable at `{BASE_URL}/skill.md`) —
   plain-language instructions an LLM can read directly: endpoints, prices,
   params, response schemas, error codes.
2. **`{BASE_URL}/.well-known/x402`** — the machine-readable price sheet
   (`x402Version`, `resources[]` with price/networks/asset/outputSchema).
   Each resource carries an `accepts[]` array listing **both rails**, so a
   budgeting agent knows before it spends whether it can pay from its Base
   balance, its Solana balance, or either.
   Registries like [x402scan.com](https://x402scan.com), the **x402 Bazaar**,
   and [agentic.market](https://agentic.market) index this format — submit your
   deployment URL there so agents can find your store without prior knowledge.

`openapi.json` (OpenAPI 3.1, includes the 402 response schema) completes the
trio for codegen-style clients.

## Paying — two rails, your pick

Every paid route answers an unpaid request with a 402 whose `accepts[]` array
holds one payment-requirements object per rail:

| Rail | Network | Asset | payTo |
| --- | --- | --- | --- |
| EVM | `base-sepolia` (or `base`) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (or `solana-devnet`) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Match on `network`, sign for that chain, and retry with `X-PAYMENT`. The price,
the route, and the returned artifact are identical either way.

### EVM with `x402-fetch`

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

### Solana

```ts
const res = await fetch(url);                        // 402
const { accepts } = await res.json();
const sol = accepts.find(a => a.network.startsWith("solana"));

// Build an SPL USDC transfer of `sol.maxAmountRequired` (atomic, 6 decimals)
// to `sol.payTo` for the mint in `sol.asset`, sign it, and wrap it:
const header = Buffer.from(JSON.stringify({
  x402Version: 1, scheme: "exact", network: sol.network,
  payload: { transaction: signedTxBase64 },
})).toString("base64");

const paid = await fetch(url, { headers: { "X-PAYMENT": header } });
const artifact = await paid.json();
```

If `extra.feePayer` is present on the Solana accept, that sponsor account pays
the SOL network fee — the buyer needs only USDC.

## What you get back

- **Digital**: `payload.downloadUrl` (free fetch, valid until
  `payload.downloadExpiresAt`), `contentSha256` for integrity, and a license
  string. The purchase is complete the moment the 200 arrives — nothing to poll.
- **Physical**: a signed order confirmation with a fulfillment record. Keep
  `orderId` + `signature`; the merchant's `supportEmail` is in the payload.
- Both are HMAC-SHA256-signed over canonical JSON — verify at `GET /verify` or
  offline.
- The USDC settlement receipt is in the `X-PAYMENT-RESPONSE` response header —
  base64 JSON with `rail` (`evm` | `solana`), `network`, `transaction`, and
  `payer`. Decode with `decodeXPaymentResponse` from `x402-fetch`, or
  `JSON.parse(atob(header))`.

## MCP integration

To give Claude these abilities as tools (`browse_catalog`, `buy_item`), see
[`examples/mcp-tool.md`](https://github.com/nirholas/x402-storefront/blob/main/examples/mcp-tool.md) —
a complete MCP server plus `claude_desktop_config.json` entry.

## Operator checklist for agent traffic

- Keep `/.well-known/x402` accurate — agents budget from it before paying, and
  it must list both rails if you accept both.
- Keep both `PAY_TO_ADDRESS` and `SOLANA_PAY_TO_ADDRESS` set unless you mean to
  turn a rail off; dropping one halves the wallets that can buy from you.
- Don't rotate `SIGNING_SECRET` casually; outstanding download tokens die with it.
- List the deployment on x402scan.com / x402 Bazaar / agentic.market.
- Digital assets should be idempotent: same SKU, same bytes, same `contentSha256`.

Questions or listing help: **nichxbt@gmail.com**
