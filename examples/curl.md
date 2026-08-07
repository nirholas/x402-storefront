# Raw x402 flow with curl

This walkthrough shows exactly what happens on the wire: 402 → pay → 200.

## 1. Browse for free

```bash
curl -s http://localhost:4021/catalog | jq '.items[] | {sku, price, type}'
```

## 2. Hit a paid route without payment → HTTP 402

```bash
curl -si http://localhost:4021/buy/art-payment-required | head -30
```

You get `402 Payment Required` and a JSON body with payment requirements:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10000",
      "resource": "http://localhost:4021/buy/art-payment-required",
      "description": "\"402 Payment Required\" wall art (SVG) — …",
      "payTo": "0xYourMerchantAddress",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "maxTimeoutSeconds": 60
    }
  ]
}
```

`maxAmountRequired` is atomic USDC (6 decimals): `10000` = $0.01.

## 3. Pay

The `X-PAYMENT` header is a base64-encoded, EIP-712-signed USDC transfer
authorization. Producing it by hand is not practical with curl alone — use the
bundled client, which does the 402 → sign → retry loop for you:

```bash
export PRIVATE_KEY=0x…   # funded Base Sepolia wallet (https://faucet.circle.com)
npm run client
```

Under the hood the client re-sends the same request as:

```bash
curl -s http://localhost:4021/buy/art-payment-required \
  -H "X-PAYMENT: <base64 signed payment payload>"
```

## 4. HTTP 200 with the artifact and settlement receipt

The 200 body is the signed purchase artifact (download URL + license).
The `X-PAYMENT-RESPONSE` response header is the base64 settlement receipt
(transaction hash, network, payer).

## 5. Redeem the download (free)

```bash
curl -s "http://localhost:4021/download/<token-from-artifact>" -o art.svg
```

## 6. Verify the artifact signature (free)

```bash
PAYLOAD='{"orderId":"…", …}'   # exact payload object from step 4
curl -s "http://localhost:4021/verify?payload=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$PAYLOAD")&signature=<hex>"
```
