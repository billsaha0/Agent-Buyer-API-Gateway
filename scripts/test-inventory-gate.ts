import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const GATEWAY_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function testInventoryGate() {
  console.log("TEST : INVENTORY GATE (OVER-ORDERING)");

  const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentName: "Bulk-Buyer-Agent",
      gatewaySecret: GATEWAY_SECRET,
      budgetLimit: 100000000, // High budget so budget gate does not trigger
    }),
  });
  const { sessionToken, apiKey } = await loginRes.json();
  const token = sessionToken || apiKey;

  // 1. Get product stock
  const searchRes = await fetch(`${BASE_URL}/api/v1/agent/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "desk", apiKey: token, limit: 1 }),
  });
  const searchData = await searchRes.json();
  const product = searchData.data?.[0] || searchData.results?.[0];

  console.log(`Target item: "${product.name}" (Current stock: ${product.stock})`);

  // 2. Intentionally demand an impossible quantity
  const impossibleQty = (product.stock || 10) + 5000;
  console.log(`Attempting purchase of ${impossibleQty} units...`);

  const checkoutRes = await fetch(`${BASE_URL}/api/v1/agent/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      quantity: impossibleQty,
      idempotencyKey: crypto.randomUUID(),
      apiKey: token,
    }),
  });

  const checkoutData = await checkoutRes.json();
  console.log(`Status: ${checkoutRes.status} ${checkoutRes.statusText}`);
  console.log(`Response:`, checkoutData);

  if (checkoutRes.status === 400 && checkoutData.error?.toLowerCase().includes("stock")) {
    console.log("\nPASS: Inventory Gate prevented order of unavailable stock.");
  } else {
    console.log("\nFAIL: Gateway allowed over-order or did not flag insufficient stock.");
  }
}

testInventoryGate().catch(console.error);