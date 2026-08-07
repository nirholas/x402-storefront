# Field Guide to Agentic Commerce

*Purchased through x402-storefront. Thank you for paying per request.*

## 1. Why machine-payable HTTP

API keys assume a human signed up first. Subscriptions assume recurring intent.
AI agents have neither: they discover a service, need it once, and move on.
The x402 pattern (HTTP 402 + USDC on Base) lets a server quote a price in the
response itself and lets any wallet-holding client pay and retry in one round trip.

## 2. The contract that matters

**Every paid route returns the purchased artifact in the 200 response body.**
If your route can only trigger a side effect, restructure it:

- Async work → pay-per-poll: each paid call returns a snapshot plus the delta.
- Future delivery → return a signed claim instrument immediately.
- Reservations → refundable hold with a signed hold record in-response.

## 3. Pricing

- Price the marginal cost of the call plus margin — micro amounts ($0.001–$0.05) beat auth friction.
- Per-item pricing beats one flat "buy" price; publish it in `/.well-known/x402`.
- Keep free discovery routes (catalog, health, manifest) out of the paywall.

## 4. Artifacts

Sign everything you return: HMAC-SHA256 over canonical JSON is enough for
offline verification. Include expiry on anything time-limited.

## 5. Discovery

Ship three files: `skill.md` (agent-readable instructions), `/.well-known/x402`
(machine-readable price sheet), and `openapi.json`. List yourself on
x402scan.com, the x402 Bazaar, and agentic.market.

*License: single-purchaser, non-transferable. © the merchant, Apache-2.0 code.*
