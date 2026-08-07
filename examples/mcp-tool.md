# Exposing x402-storefront as an MCP tool for Claude

Any MCP server can wrap this store so Claude (or another MCP client) can buy
items with a funded wallet. The pattern: one tool per operation, `x402-fetch`
for payment, artifact returned as the tool result.

## Minimal MCP server (TypeScript)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.STOREFRONT_URL ?? "http://localhost:4021";
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const payFetch = wrapFetchWithPayment(fetch, account);

const server = new McpServer({ name: "x402-storefront", version: "0.1.0" });

server.tool("browse_catalog", "List items and prices (free)", {}, async () => {
  const r = await fetch(`${BASE_URL}/catalog`);
  return { content: [{ type: "text", text: await r.text() }] };
});

server.tool(
  "buy_item",
  "Buy an item by SKU; pays USDC via x402 and returns the signed artifact",
  {
    sku: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
    country: z.string().optional(),
  },
  async ({ sku, name, address, country }) => {
    const qs = new URLSearchParams();
    if (name) qs.set("name", name);
    if (address) qs.set("address", address);
    if (country) qs.set("country", country);
    const r = await payFetch(`${BASE_URL}/buy/${sku}?${qs}`);
    return { content: [{ type: "text", text: await r.text() }] };
  },
);

await server.connect(new StdioServerTransport());
```

## claude_desktop_config.json

```json
{
  "mcpServers": {
    "x402-storefront": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server.ts"],
      "env": {
        "STOREFRONT_URL": "http://localhost:4021",
        "PRIVATE_KEY": "0x… funded Base Sepolia key"
      }
    }
  }
}
```

## Spending safety

Cap per-call spend by passing a `maxValue` (atomic USDC units) as the third
argument to `wrapFetchWithPayment(fetch, account, 250_000n)` — that example
refuses anything above $0.25. For budgets, per-merchant caps, and approval
thresholds, see the x402-agent-wallet pattern in the
[x402 Suite](https://github.com/nirholas/x402-suite).
