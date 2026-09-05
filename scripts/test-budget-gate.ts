import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const MASTER_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function testBudgetGate() {
  console.log("TEST : FINANCIAL BOUNDS (BUDGET GATE)");

  // 1. Allocate a tiny budget of ₹10 (1,000 paise)
  const TINY_BUDGET = 1000;
  console.log(`[1/3] Authenticating agent with restricted budget: ₹${TINY_BUDGET / 100}`);

  const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentName: "Restricted-Budget-Agent",
      masterSecret: MASTER_SECRET,
      requestedBudget: TINY_BUDGET,
    }),
  });
  
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginData.error || loginRes.statusText}`);
  }
  
  const token = loginData.data.token;

  // 2. Fetch a catalog item that costs more than ₹10
  const searchRes = await fetch(`${BASE_URL}/api/v1/agent/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      query: "monitor desk chair laptop", 
      apiKey: token, 
      limit: 1 
    }),
  });
  
  const searchData = await searchRes.json();
  if (!searchRes.ok || !searchData.products || searchData.products.length === 0) {
    throw new Error("Search failed or returned no results.");
  }
  
  const product = searchData.products[0];

  console.log(`[2/3] Target product: "${product.name}" priced at ₹${product.price / 100}`);

  // 3. Attempt to purchase
  console.log(`[3/3] Attempting checkout exceeding allocated budget...`);
  const checkoutRes = await fetch(`${BASE_URL}/api/v1/agent/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      quantity: 1,
      idempotencyKey: crypto.randomUUID(),
      apiKey: token,
    }),
  });

  const checkoutData = await checkoutRes.json();
  console.log(`Status: ${checkoutRes.status} ${checkoutRes.statusText}`);
  console.log(`Response:`, checkoutData);

  if (checkoutRes.status === 403) {
    console.log("\nPASS: Gateway intercepted transaction. Financial bound strictly enforced.");
  } else {
    console.log("\nFAIL: Budget gate did not halt overspending.");
  }

  // 4. Cleanup (Optional but good practice)
  await fetch(`${BASE_URL}/api/v1/agent/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
}

testBudgetGate().catch(console.error);