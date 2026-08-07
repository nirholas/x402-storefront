/**
 * x402-storefront — self-hosted store with x402 checkout.
 *
 * Free routes:    GET /catalog, GET /download/:token, GET /verify, GET /health,
 *                 GET /.well-known/x402, static demo at /
 * Paid routes:    GET /buy/:sku — priced per item from config/catalog.json
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "x402-express";
import type { RoutesConfig, Network } from "x402-express";
import { join } from "node:path";
import {
  ROOT,
  loadCatalog,
  purchase,
  redeemDownload,
  NotFoundError,
  AuthError,
} from "./service.js";
import { verify } from "./sign.js";

const payTo = process.env.PAY_TO_ADDRESS;
if (!payTo || !/^0x[0-9a-fA-F]{40}$/.test(payTo)) {
  console.error(
    "FATAL: PAY_TO_ADDRESS env var is required (0x… EVM address that receives USDC).\n" +
      "  export PAY_TO_ADDRESS=0xYourWalletAddress",
  );
  process.exit(1);
}

const network = (process.env.NETWORK ?? "base-sepolia") as Network;
const facilitatorUrl = (process.env.FACILITATOR_URL ??
  "https://x402.org/facilitator") as `${string}://${string}`;

const catalog = loadCatalog();

/** One exact paid route per SKU, priced from the catalog. */
const routePrices: RoutesConfig = {};
for (const item of catalog.items) {
  routePrices[`GET /buy/${item.sku}`] = {
    price: item.price,
    network,
    config: {
      description: `${item.name} — ${item.type === "digital" ? "delivered in-response via signed download URL" : "signed order confirmation + fulfillment record"}`,
      mimeType: "application/json",
    },
  };
}

const app = express();
app.use(express.json());

app.use(paymentMiddleware(payTo as `0x${string}`, routePrices, { url: facilitatorUrl }));

// ————— Free routes —————

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "x402-storefront", network });
});

app.get("/catalog", (_req, res) => {
  res.json({
    store: catalog.store,
    network,
    payment: { protocol: "x402", asset: "USDC", facilitator: facilitatorUrl },
    items: catalog.items.map((i) => ({
      sku: i.sku,
      type: i.type,
      name: i.name,
      description: i.description,
      price: i.price,
      buy: `GET /buy/${i.sku}`,
      ...(i.license ? { license: i.license } : {}),
      ...(i.fulfillment ? { fulfillment: i.fulfillment } : {}),
    })),
  });
});

app.get("/download/:token", (req, res) => {
  try {
    const dl = redeemDownload(req.params.token);
    res
      .setHeader("Content-Type", dl.contentType)
      .setHeader("Content-Disposition", `attachment; filename="${dl.filename}"`)
      .send(dl.bytes);
  } catch (err) {
    handleError(err, res);
  }
});

/** Offline-verifiable signatures, also checkable here for convenience. */
app.get("/verify", (req, res) => {
  const { payload, signature } = req.query;
  if (typeof payload !== "string" || typeof signature !== "string") {
    res.status(400).json({
      error: "bad_request",
      hint: "GET /verify?payload=<url-encoded JSON>&signature=<hex>",
    });
    return;
  }
  try {
    const parsed = JSON.parse(payload);
    res.json({ valid: verify(parsed, signature) });
  } catch {
    res.status(400).json({ error: "bad_request", hint: "payload must be valid JSON" });
  }
});

// ————— Paid routes (require x402 payment via middleware above) —————

app.get("/buy/:sku", (req, res) => {
  try {
    const artifact = purchase(req.params.sku, {
      name: str(req.query.name),
      address: str(req.query.address),
      country: str(req.query.country),
    });
    res.json(artifact);
  } catch (err) {
    handleError(err, res);
  }
});

// ————— Static: human demo + .well-known —————

app.get("/.well-known/x402", (_req, res) => {
  res.type("application/json");
  res.sendFile(join(ROOT, "public", ".well-known", "x402"));
});
app.use(express.static(join(ROOT, "public")));

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function handleError(err: unknown, res: express.Response): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "not_found", message: err.message });
  } else if (err instanceof AuthError) {
    res.status(403).json({ error: "forbidden", message: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
}

const port = Number(process.env.PORT ?? 4021);
app.listen(port, () => {
  console.log(`\nx402-storefront listening on http://localhost:${port}`);
  console.log(`  network: ${network}  facilitator: ${facilitatorUrl}  payTo: ${payTo}\n`);
  console.log("  Free routes:");
  console.log("    GET /catalog             item list with prices");
  console.log("    GET /download/:token     redeem a signed download token");
  console.log("    GET /verify              verify any signed artifact");
  console.log("    GET /.well-known/x402    machine-readable price sheet\n");
  console.log("  Paid routes (x402, USDC):");
  for (const item of catalog.items) {
    console.log(`    GET /buy/${item.sku}`.padEnd(40) + `${item.price}  ${item.name}`);
  }
  console.log("");
});
