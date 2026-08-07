/**
 * x402-storefront — self-hosted store with x402 checkout.
 *
 * Free routes:    GET /catalog, GET /download/:token, GET /verify, GET /health,
 *                 GET /.well-known/x402, static demo at /
 * Paid routes:    GET /buy/:sku — priced per item from config/catalog.json
 */
import "dotenv/config";
import express from "express";
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
import { buildRails, describeRails, paywall, type RoutePrices } from "./payments.js";
import { ROUTE_SCHEMAS } from "./schemas.js";
import { solanaCheckoutHandler } from "./solana-checkout.js";

const rails = buildRails();
const catalog = loadCatalog();

/** Request/response contract for `/buy/:sku`, generated from `openapi.json`. */
const buySchema = ROUTE_SCHEMAS["GET /buy/:sku"];

/** Cheapest thing in the store — the quote for a SKU we do not recognise. */
const floorPrice = catalog.items
  .map((i) => i.price)
  .sort((a, b) => Number(a.replace("$", "")) - Number(b.replace("$", "")))[0];

/**
 * `/buy/:sku` is priced per item, which is why the OpenAPI document declares it
 * `mode: "dynamic"` over the catalog's min/max rather than a single amount. The
 * price for a given request is resolved here, from the catalog, at request time.
 *
 * The whole `/buy/` space is paywalled — including SKUs the catalog does not
 * contain. That is deliberate: the x402scan discovery spec requires a probe to
 * reach a 402 challenge before any existence check runs, so an unknown SKU is
 * quoted at the store's floor price instead of being rejected with a 404. The
 * 404 still happens, after payment, in the route handler.
 *
 * A recognised SKU republishes the generated schema with `sku` pinned to that
 * item, so an agent reading the challenge sees exactly which product this URL
 * sells rather than a bare string parameter.
 */
const routePrices: RoutePrices = {
  "GET /buy/:sku": (req) => {
    const sku = decodeURIComponent(req.path.split("/")[2] ?? "");
    const item = catalog.items.find((i) => i.sku === sku);

    if (!item) {
      return {
        price: floorPrice,
        description: `Unknown SKU "${sku}" — see GET /catalog for what this store sells`,
        mimeType: "application/json",
        outputSchema: buySchema,
      };
    }

    return {
      price: item.price,
      description: `${item.name} — ${
        item.type === "digital"
          ? "signed time-limited download URL + license, in-response"
          : "signed order confirmation + fulfillment record, in-response"
      }`,
      mimeType: "application/json",
      outputSchema: {
        input: {
          ...buySchema.input,
          pathParams: { sku: { type: "string", const: item.sku, description: item.name } },
        },
        output: buySchema.output,
      },
    };
  },
};

const app = express();
app.use(express.json());

/**
 * Solana checkout helper. Phantom signs transactions but cannot build them, so
 * the browser modal POSTs here to assemble the SPL transfer and wrap the signed
 * transaction into an X-PAYMENT envelope. Agents paying programmatically never
 * touch this route.
 */
app.all("/api/x402-checkout", solanaCheckoutHandler());

/** Dual-rail paywall — pay in USDC on Base or Solana, the client picks. */
app.use(paywall(routePrices, rails));

// ————— Free routes —————

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "x402-storefront", rails: rails.map((r) => r.network) });
});

app.get("/catalog", (_req, res) => {
  res.json({
    store: catalog.store,
    payment: {
      protocol: "x402",
      asset: "USDC",
      note: "Pay in USDC on Base or Solana — your client picks the rail.",
      rails: rails.map((r) => ({ rail: r.id, network: r.network, payTo: r.payTo })),
    },
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
  console.log(`\nx402-storefront listening on http://localhost:${port}\n`);
  console.log("  Payment rails (USDC — the client picks):");
  for (const line of describeRails(rails)) console.log(`    ${line}`);
  console.log("\n  Free routes:");
  console.log("    GET /catalog             item list with prices");
  console.log("    GET /download/:token     redeem a signed download token");
  console.log("    GET /verify              verify any signed artifact");
  console.log("    GET /.well-known/x402    machine-readable price sheet");
  console.log("    GET /                    human checkout demo\n");
  console.log("  Paid routes (x402, USDC on Base or Solana):");
  for (const item of catalog.items) {
    console.log(`    GET /buy/${item.sku}`.padEnd(40) + `${item.price}  ${item.name}`);
  }
  console.log("");
});
