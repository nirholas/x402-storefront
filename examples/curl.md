# Raw x402 flow with curl

This walkthrough shows exactly what happens on the wire: 402 → pay → 200.

## 1. Browse for free

```bash
curl -s http://localhost:4021/catalog | jq '.items[] | {sku, price, type}'
```

## 2. Hit a paid route without payment → HTTP 402

```bash
curl -si http://localhost:4021/buy/art-payment-required | head -40
```

You get `402 Payment Required` and a JSON body with **one payment-requirements
object per rail** — Base and Solana:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header required — pay in USDC on Base or Solana, your pick.",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required",
      "description": "\"402 Payment Required\" wall art (SVG) — signed time-limited download URL + license, in-response",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required",
      "description": "\"402 Payment Required\" wall art (SVG) — signed time-limited download URL + license, in-response",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "decimals": 6 }
    }
  ]
}
```

`maxAmountRequired` is atomic USDC (6 decimals): `10000` = $0.01 — the same
price on either rail. Filter to the one you can pay:

```bash
curl -s http://localhost:4021/buy/art-payment-required \
  | jq '.accepts[] | select(.network | startswith("solana"))'
```

## 3. Pay

The `X-PAYMENT` header is base64 JSON wrapping a signature for the rail you
picked — an EIP-712/EIP-3009 USDC transfer authorization on Base, or a signed
SPL USDC transfer on Solana. Producing either by hand is not practical with curl
alone, so use the bundled client, which does the 402 → sign → retry loop for
you (EVM rail):

```bash
export PRIVATE_KEY=0x…   # funded Base Sepolia wallet (https://faucet.circle.com)
npm run client
```

Under the hood the client re-sends the same request as:

```bash
curl -s http://localhost:4021/buy/art-payment-required \
  -H "X-PAYMENT: <base64 signed payment payload>"
```

The envelope it base64-encodes looks like this — swap `network` and the payload
shape to settle on Solana instead:

```json
{ "x402Version": 1, "scheme": "exact", "network": "base-sepolia",
  "payload": { "signature": "0x…", "authorization": { "from": "0x…", "to": "0x40252C…", "value": "10000", "…": "…" } } }
```

```json
{ "x402Version": 1, "scheme": "exact", "network": "solana",
  "payload": { "transaction": "<base64 signed SPL transfer>" } }
```

The server reads `network`, matches it against the rail you were quoted, then
verifies and settles through the facilitator.

## 4. HTTP 200 with the artifact and settlement receipt

The 200 body is the signed purchase artifact (download URL + license).
The `X-PAYMENT-RESPONSE` response header is the base64 settlement receipt:

```bash
curl -si … | grep -i x-payment-response | cut -d' ' -f2 | base64 -d | jq
```

```json
{ "success": true, "rail": "solana", "network": "solana",
  "transaction": "5v8…", "payer": "9xQ…" }
```

`rail` tells you which chain settled it.

## 5. Redeem the download (free)

```bash
curl -s "http://localhost:4021/download/<token-from-artifact>" -o art.svg
```

## 6. Verify the artifact signature (free)

```bash
PAYLOAD='{"orderId":"…", …}'   # exact payload object from step 4
curl -s "http://localhost:4021/verify?payload=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$PAYLOAD")&signature=<hex>"
```
