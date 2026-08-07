/**
 * Agent client example: browse the catalog, pay for a digital item with x402,
 * verify the signature, and download the asset.
 *
 * Usage:
 *   export PRIVATE_KEY=0x…            # testnet wallet with Base Sepolia USDC
 *   export BASE_URL=http://localhost:4021   # optional
 *   npm run client
 *
 * Get testnet USDC on Base Sepolia from the Circle faucet: https://faucet.circle.com
 */
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4021";
const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("Set PRIVATE_KEY to a funded Base Sepolia wallet key (see https://faucet.circle.com)");
  process.exit(1);
}

const account = privateKeyToAccount(pk as `0x${string}`);
const payFetch = wrapFetchWithPayment(fetch, account);

// 1. Free: browse the catalog
const catalog = await (await fetch(`${BASE_URL}/catalog`)).json();
console.log("Catalog:");
for (const item of catalog.items) {
  console.log(`  ${item.sku.padEnd(28)} ${String(item.price).padEnd(7)} ${item.type}`);
}

// 2. Paid: buy the cheapest digital item
const sku = "art-payment-required";
console.log(`\nBuying ${sku} …`);
const res = await payFetch(`${BASE_URL}/buy/${sku}`);
if (!res.ok) {
  console.error(`Purchase failed: ${res.status}`, await res.text());
  process.exit(1);
}
const artifact = await res.json();
console.log("\nSigned purchase artifact:");
console.log(JSON.stringify(artifact, null, 2));

// 3. The settlement receipt lives in the X-PAYMENT-RESPONSE header
const receiptHeader = res.headers.get("x-payment-response");
if (receiptHeader) {
  console.log("\nX-PAYMENT-RESPONSE (settlement receipt):");
  console.log(JSON.stringify(decodeXPaymentResponse(receiptHeader), null, 2));
}

// 4. Free: redeem the signed time-limited download URL
const dl = await fetch(`${BASE_URL}${artifact.payload.downloadUrl}`);
console.log(`\nDownload: HTTP ${dl.status}, Content-Type ${dl.headers.get("content-type")}`);
const bytes = Buffer.from(await dl.arrayBuffer());
console.log(`Received ${bytes.length} bytes. First line: ${bytes.toString("utf8").split("\n")[0]}`);

// 5. Free: verify the artifact signature server-side
const verifyUrl = `${BASE_URL}/verify?payload=${encodeURIComponent(
  JSON.stringify(artifact.payload),
)}&signature=${artifact.signature}`;
const verdict = await (await fetch(verifyUrl)).json();
console.log(`\nSignature valid: ${verdict.valid}`);
