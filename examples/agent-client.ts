/**
 * Agent client example: browse the catalog, pay for a digital item with x402,
 * verify the signature, and download the asset.
 *
 * This store is dual-rail — every 402 quotes USDC on **Base** and on **Solana**,
 * and the client picks. `x402-fetch` covers the EVM rail out of the box, which
 * is what this example uses; see the commented Solana section at the bottom for
 * the other rail, and examples/curl.md for the raw wire format of both.
 *
 * Usage:
 *   export PRIVATE_KEY=0x…                  # testnet wallet with Base Sepolia USDC
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

// 2. Look at the unpaid 402 first — both rails are quoted here.
const sku = "art-payment-required";
const quote = await (await fetch(`${BASE_URL}/buy/${sku}`)).json();
console.log("\n402 quote — accepted rails:");
for (const a of quote.accepts ?? []) {
  console.log(`  ${String(a.network).padEnd(14)} ${a.maxAmountRequired.padStart(8)} atomic USDC → ${a.payTo}`);
}

// 3. Paid: buy the cheapest digital item over the EVM rail.
console.log(`\nBuying ${sku} on the EVM rail …`);
const res = await payFetch(`${BASE_URL}/buy/${sku}`);
if (!res.ok) {
  console.error(`Purchase failed: ${res.status}`, await res.text());
  process.exit(1);
}
const artifact = await res.json();
console.log("\nSigned purchase artifact:");
console.log(JSON.stringify(artifact, null, 2));

// 4. The settlement receipt lives in the X-PAYMENT-RESPONSE header.
//    `rail` names the chain that settled it ("evm" or "solana").
const receiptHeader = res.headers.get("x-payment-response");
if (receiptHeader) {
  console.log("\nX-PAYMENT-RESPONSE (settlement receipt):");
  console.log(JSON.stringify(decodeXPaymentResponse(receiptHeader), null, 2));
}

// 5. Free: redeem the signed time-limited download URL
const dl = await fetch(`${BASE_URL}${artifact.payload.downloadUrl}`);
console.log(`\nDownload: HTTP ${dl.status}, Content-Type ${dl.headers.get("content-type")}`);
const bytes = Buffer.from(await dl.arrayBuffer());
console.log(`Received ${bytes.length} bytes. First line: ${bytes.toString("utf8").split("\n")[0]}`);

// 6. Free: verify the artifact signature server-side
const verifyUrl = `${BASE_URL}/verify?payload=${encodeURIComponent(
  JSON.stringify(artifact.payload),
)}&signature=${artifact.signature}`;
const verdict = await (await fetch(verifyUrl)).json();
console.log(`\nSignature valid: ${verdict.valid}`);

// ————— Paying on the Solana rail instead —————
//
// The same route, price, and artifact — only the signature differs. Pick the
// Solana entry out of `accepts`, sign an SPL USDC transfer for it, and send the
// envelope in X-PAYMENT:
//
//   const unpaid = await fetch(`${BASE_URL}/buy/${sku}`);
//   const { accepts } = await unpaid.json();
//   const sol = accepts.find((a) => String(a.network).startsWith("solana"));
//   //   sol.asset             → the USDC SPL mint
//   //   sol.payTo             → the merchant's Solana address
//   //   sol.maxAmountRequired → atomic USDC (6 decimals)
//   //   sol.extra?.feePayer   → sponsor paying the SOL network fee, if offered
//
//   // Build + sign the SPL transfer with your Solana wallet or
//   // @solana/kit, then base64-wrap it:
//   const header = Buffer.from(JSON.stringify({
//     x402Version: 1,
//     scheme: "exact",
//     network: sol.network,
//     payload: { transaction: signedTxBase64 },
//   })).toString("base64");
//
//   const res = await fetch(`${BASE_URL}/buy/${sku}`, { headers: { "X-PAYMENT": header } });
//   const artifact = await res.json();   // identical shape to the EVM path
//
// In a browser, the drop-in modal on the demo page at `/` does all of this with
// Phantom automatically — it reads both rails straight out of the 402.
