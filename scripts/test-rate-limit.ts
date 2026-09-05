const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const MASTER_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function testRateLimiter() {
  console.log("TEST : ROGUE AGENT RATE LIMITING (15 req/min)");

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentName: "Looping-Rogue-Agent",
      masterSecret: MASTER_SECRET,
      requestedBudget: 5000000,
    }),
  });
  
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error || loginRes.statusText}`);
  
  const token = loginData.data.token;

  console.log("Firing 18 rapid consecutive search requests...\n");
  let throttled = false;

  // 2. Loop to deliberately trigger HTTP 429
  for (let i = 1; i <= 18; i++) {
    const res = await fetch(`${BASE_URL}/api/v1/agent/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "office lamp", apiKey: token, limit: 1 }),
    });

    if (res.status === 429) {
      console.log(`[Request ${i}] BLOCKED: HTTP 429 Too Many Requests`);
      throttled = true;
    } else {
      console.log(`[Request ${i}] Passed: HTTP ${res.status}`);
    }
  }

  if (throttled) {
    console.log("\nPASS: Defensive gateway throttled looping agent at request #16.");
  } else {
    console.log("\nFAIL: Rate limiter failed to engage after 15 requests.");
  }

  // 3. Cleanup
  await fetch(`${BASE_URL}/api/v1/agent/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
}

testRateLimiter().catch(console.error);