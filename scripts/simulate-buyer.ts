import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const MASTER_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function runAutonomousBuyer(intent: string) {
  console.log(`\nBUYER AGENT ACTIVATED`);
  console.log(`Intent: "${intent}"`);

  let activeToken = "";

  try {
    // STEP 0: LOGIN & ACQUIRE SHORT-LIVED TOKEN
    console.log(`[0/4] Requesting short-lived session token...`);
    const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        masterSecret: MASTER_SECRET,
        agentName: "Gemini-Test-Shopper",
        requestedBudget: 5000000 // ₹50,000
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error("Login failed");
    activeToken = loginData.data.token;
    console.log(`Token acquired. Expires at: ${new Date(loginData.data.expiresAt).toLocaleTimeString()}`);

    // STEP 1: SEMANTIC SEARCH
    console.log(`[1/4] Querying merchant's semantic catalog...`);
    const searchRes = await fetch(`${BASE_URL}/api/v1/agent/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: activeToken, 
        query: intent,
        limit: 3 
      })
    });
    
    const searchData = await searchRes.json();
    if (!searchRes.ok || searchData.resultsCount === 0) {
      console.log(`Search failed or returned no results.`);
      return;
    }
    console.log(`Found ${searchData.resultsCount} potential items.`);

    // STEP 2: AI DECISION MAKING (REASONING)
    console.log(`[2/4] Analyzing catalog and deciding what to buy...`);
    
    const decisionPrompt = `
    You are an autonomous purchasing agent for a tech company. 
    Your user's intent is: "${intent}".
    
    Here is the JSON catalog returned from the merchant:
    ${JSON.stringify(searchData.products, null, 2)}
    
    Evaluate the catalog. If a product matches the intent, select the best one.
    Determine a reasonable quantity based on the prompt (default to 1 if unspecified).
    
    Respond ONLY with a valid JSON object in this exact format:
    {
      "productId": "the-uuid-here",
      "quantity": 1,
      "reasoning": "A brief, 1-sentence explanation of your choice."
    }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: decisionPrompt,
      config: { responseMimeType: "application/json" }
    });

    let decisionText = response.text;
    if (!decisionText) throw new Error("Agent returned empty response.");
    
    decisionText = decisionText.replace(/```json/g, "").replace(/```/g, "").trim();
    const decision = JSON.parse(decisionText);
    
    console.log(`Decision Made:`);
    console.log(`   ❯ Product ID: ${decision.productId}`);
    console.log(`   ❯ Quantity:   ${decision.quantity}`);
    console.log(`   ❯ Reasoning:  ${decision.reasoning || "N/A"}`);

    // STEP 3: EXECUTE CHECKOUT
    console.log(`[3/4] Executing transaction via merchant gateway...`);
    
    const idempotencyKey = crypto.randomUUID(); 
    const checkoutPayload = {
      apiKey: activeToken,
      productId: decision.productId,
      quantity: decision.quantity,
      idempotencyKey 
    };

    const checkoutRes = await fetch(`${BASE_URL}/api/v1/agent/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload)
    });

    const checkoutData = await checkoutRes.json();
    
    if (checkoutRes.ok) {
      console.log(`TRANSACTION SUCCESSFUL`);
      console.log(`   ❯ Razorpay Order ID: ${checkoutData.data.razorpayOrderId}`);
    } else if (checkoutRes.status === 403) {
      console.log(`BUDGET EXCEEDED`);
      console.log(`   ❯ Message: ${checkoutData.error}`);
    } else {
      console.log(`TRANSACTION GATED / BLOCKED: ${checkoutData.error}`);
    }

  } catch (error) {
    console.error(`Fatal Error:`, error);
  } finally {
    // STEP 4: CLEANUP & LOGOUT
    if (activeToken) {
      console.log(`\n[4/4] Revoking short-lived token...`);
      await fetch(`${BASE_URL}/api/v1/agent/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeToken })
      });
      console.log(`Token successfully revoked. Session closed.\n`);
    }
  }
}

// TEST SCENARIOS
async function main() {
  // Scenario 1: Standard Success (Will fit in budget)
  await runAutonomousBuyer("My lower back hurts from coding. I need a comfortable mesh chair.");
  
  // Scenario 2: HITL Trigger (Will exceed ₹50,000 budget and generate Payment Link)
  await runAutonomousBuyer("I am setting up a new gaming arena. Buy 3 4K monitors.");
}

main();