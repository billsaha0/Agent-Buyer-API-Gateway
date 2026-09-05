import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const MASTER_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function testIdempotency() {
  console.log("TEST : IDEMPOTENCY & DUPLICATE PREVENTION");

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentName: "Idempotency-Test-Agent",
      masterSecret: MASTER_SECRET,
      requestedBudget: 5000000,
    }),
  });
  
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error || loginRes.statusText}`);
  
  const token = loginData.data.token;

  // 2. Fetch a product to buy
  const searchRes = await fetch(`${BASE_URL}/api/v1/agent/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      query: "chair", 
      apiKey: token, 
      limit: 1 
    }),
  });
  
  const searchData = await searchRes.json();
  if (!searchRes.ok || !searchData.products || searchData.products.length === 0) {
    throw new Error("No product found in catalog to test.");
  }
  
  const product = searchData.products[0];
  const sharedIdempotencyKey = crypto.randomUUID();
  const checkoutPayload = {
    productId: product.id,
    quantity: 1,
    idempotencyKey: sharedIdempotencyKey,
    apiKey: token,
  };

  // 3. First Attempt (Expected: Success)
  console.log(`\n[Attempt 1] Sending checkout with Key: ${sharedIdempotencyKey}`);
  const firstRes = await fetch(`${BASE_URL}/api/v1/agent/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });
  console.log(`Status: ${firstRes.status} ${firstRes.statusText}`);
  const firstData = await firstRes.json();
  console.log(`Payload:`, firstData);

  // 4. Second Attempt (Expected: Caught by Idempotency check)
  console.log(`\n[Attempt 2] Retrying exact same request (simulating network drop)...`);
  const retryRes = await fetch(`${BASE_URL}/api/v1/agent/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });
  console.log(`Status: ${retryRes.status} ${retryRes.statusText}`);
  const retryData = await retryRes.json();
  console.log(`Payload:`, retryData);

  // Validate against the exact message configured in your checkout route
  if (retryData.message === "Order already processed (Idempotent response)") {
    console.log("\nPASS: Duplicate transaction blocked gracefully. Zero double-charging occurred.");
  } else {
    console.log("\nFAIL: Gateway processed a duplicate purchase or failed to detect the idempotency key.");
  }

  // 5. Cleanup
  await fetch(`${BASE_URL}/api/v1/agent/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
}

testIdempotency().catch(console.error);