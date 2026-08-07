/**
 * Storefront domain logic: catalog loading, order creation, download tokens,
 * and the file-based order ledger. No database — JSON on disk by design.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signArtifact, encodeToken, decodeToken, type SignedArtifact } from "./sign.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Repo root, whether running from src/ (tsx) or dist/ (node). */
export const ROOT = resolve(__dirname, "..");

export interface CatalogItem {
  sku: string;
  type: "digital" | "physical";
  name: string;
  description: string;
  price: string;
  asset?: string;
  contentType?: string;
  license?: string;
  fulfillment?: string;
  weightGrams?: number;
}

export interface Catalog {
  store: {
    name: string;
    merchantId: string;
    currency: string;
    supportEmail: string;
    shipsTo: string[];
  };
  items: CatalogItem[];
}

let catalogCache: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (!catalogCache) {
    const raw = readFileSync(join(ROOT, "config", "catalog.json"), "utf8");
    catalogCache = JSON.parse(raw) as Catalog;
  }
  return catalogCache;
}

export function findItem(sku: string): CatalogItem | undefined {
  return loadCatalog().items.find((i) => i.sku === sku);
}

const DATA_DIR = join(ROOT, "data");
const ORDERS_FILE = join(DATA_DIR, "orders.json");

interface OrderRecord {
  orderId: string;
  sku: string;
  type: "digital" | "physical";
  price: string;
  createdAt: string;
  shipTo?: { name?: string; address?: string; country?: string };
}

function readOrders(): OrderRecord[] {
  if (!existsSync(ORDERS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(ORDERS_FILE, "utf8")) as OrderRecord[];
  } catch {
    return [];
  }
}

function appendOrder(order: OrderRecord): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const all = readOrders();
  all.push(order);
  writeFileSync(ORDERS_FILE, JSON.stringify(all, null, 2));
}

const DOWNLOAD_TTL_SECONDS = Number(process.env.DOWNLOAD_TTL_SECONDS ?? 3600);

export interface DigitalPurchase {
  orderId: string;
  sku: string;
  item: string;
  kind: "digital";
  downloadUrl: string;
  downloadExpiresAt: string;
  contentType: string;
  contentSha256: string;
  license: string;
  purchasedAt: string;
}

export interface PhysicalPurchase {
  orderId: string;
  sku: string;
  item: string;
  kind: "physical";
  fulfillment: {
    status: "accepted";
    promise: string;
    shipTo: { name: string; address: string; country: string };
    weightGrams: number;
  };
  supportEmail: string;
  purchasedAt: string;
}

/**
 * Execute a purchase. Digital goods get a signed, time-limited download URL;
 * physical goods get a signed order confirmation + fulfillment record.
 * Either way the artifact is IN this response — nothing is delivered later
 * that isn't already claimable from what the buyer holds.
 */
export function purchase(
  sku: string,
  shipTo: { name?: string; address?: string; country?: string },
): SignedArtifact<DigitalPurchase | PhysicalPurchase> {
  const item = findItem(sku);
  if (!item) throw new NotFoundError(`Unknown SKU: ${sku}`);

  const orderId = `ord_${randomUUID()}`;
  const purchasedAt = new Date().toISOString();
  appendOrder({ orderId, sku, type: item.type, price: item.price, createdAt: purchasedAt, shipTo });

  if (item.type === "digital") {
    const assetPath = join(ROOT, item.asset!);
    const bytes = readFileSync(assetPath);
    const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS;
    const token = encodeToken({ sku, orderId, exp });
    const artifact: DigitalPurchase = {
      orderId,
      sku,
      item: item.name,
      kind: "digital",
      downloadUrl: `/download/${token}`,
      downloadExpiresAt: new Date(exp * 1000).toISOString(),
      contentType: item.contentType ?? "application/octet-stream",
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
      license: item.license ?? "single-purchaser license",
      purchasedAt,
    };
    return signArtifact(artifact);
  }

  const catalog = loadCatalog();
  const artifact: PhysicalPurchase = {
    orderId,
    sku,
    item: item.name,
    kind: "physical",
    fulfillment: {
      status: "accepted",
      promise: item.fulfillment ?? "ships within 10 business days",
      shipTo: {
        name: shipTo.name ?? "(provide ?name= on the buy request)",
        address: shipTo.address ?? "(provide ?address= on the buy request)",
        country: shipTo.country ?? catalog.store.shipsTo[0],
      },
      weightGrams: item.weightGrams ?? 0,
    },
    supportEmail: catalog.store.supportEmail,
    purchasedAt,
  };
  return signArtifact(artifact);
}

export interface DownloadResult {
  bytes: Buffer;
  contentType: string;
  filename: string;
}

/** Validate a signed download token and return the asset. */
export function redeemDownload(token: string): DownloadResult {
  const payload = decodeToken(token);
  if (!payload) throw new AuthError("Invalid or tampered download token");
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new AuthError("Download token expired — re-purchase to get a fresh link");
  }
  const item = findItem(String(payload.sku));
  if (!item || item.type !== "digital" || !item.asset) {
    throw new NotFoundError("Asset no longer available");
  }
  return {
    bytes: readFileSync(join(ROOT, item.asset)),
    contentType: item.contentType ?? "application/octet-stream",
    filename: item.asset.split("/").pop() ?? item.sku,
  };
}

export class NotFoundError extends Error {}
export class AuthError extends Error {}
