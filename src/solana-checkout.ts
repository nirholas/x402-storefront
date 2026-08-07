/**
 * Solana checkout endpoint for the browser demo at `public/index.html`.
 *
 * Phantom signs serialized transactions but does not build instructions, so the
 * human/Solana path needs a small server helper that (a) assembles the unsigned
 * SPL-USDC transfer and (b) base64-wraps the user-signed transaction into the
 * `X-PAYMENT` envelope. It never sees a private key and cannot move funds.
 *
 * Agents paying programmatically build their own payload and skip this entirely.
 * If `@three-ws/x402-payment-modal` isn't installed the route degrades to 503
 * and the EVM rail keeps working.
 */
import type { Request, RequestHandler, Response } from "express";

type ModalServer = typeof import("@three-ws/x402-payment-modal/server");

let cached: ModalServer | null | undefined;

async function load(): Promise<ModalServer | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await import("@three-ws/x402-payment-modal/server");
  } catch {
    cached = null;
    console.warn(
      "[x402] Solana browser checkout disabled — install @three-ws/x402-payment-modal to enable it.",
    );
  }
  return cached;
}

export function solanaCheckoutHandler(): RequestHandler {
  const rpcUrl = process.env.SOLANA_RPC_URL || undefined;
  const devnetRpcUrl = process.env.SOLANA_DEVNET_RPC_URL || undefined;

  return async function x402Checkout(req: Request, res: Response): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-idempotency-key");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed", error_description: "use POST" });
      return;
    }
    const mod = await load();
    if (!mod) {
      res.status(503).json({
        error: "solana_checkout_unavailable",
        error_description: "@three-ws/x402-payment-modal is not installed; pay on Base instead",
      });
      return;
    }
    const { status, body } = await mod.handleCheckout({
      action: String(req.query.action ?? ""),
      body: (req.body ?? {}) as Record<string, unknown>,
      options: { ...(rpcUrl ? { rpcUrl } : {}), ...(devnetRpcUrl ? { devnetRpcUrl } : {}) },
    });
    res.status(status).json(body);
  };
}
