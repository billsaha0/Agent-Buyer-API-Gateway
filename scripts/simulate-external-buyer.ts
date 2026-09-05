// scripts/simulate-external-buyer.ts
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

// Ensure we use the exact model version from your working script
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const MASTER_SECRET = process.env.AGENT_GATEWAY_SECRET || "super_secure_internal_gateway_secret";

async function runExternalBuyer(intent: string) {
  console.log(`EXTERNAL BUYER AGENT ACTIVATED`);
  console.log(`Identity: "Nova-External-Shopper"`);
  console.log(`Intent: "${intent}"`);

  let activeToken = "";

  try {
    // STEP 0: PROTOCOL & TOOL DISCOVERY
    console.log(`[0/5] Discovering Gateway capabilities (/tools)...`);
    const toolsRes = await fetch(`${BASE_URL}/api/v1/agent/tools`);
    if (!toolsRes.ok) throw new Error(`Tool discovery failed with status ${toolsRes.status}`);
    
    const toolsData = await toolsRes.json();
    const availableToolNames = toolsData.tools?.map((t: { name: string }) => t.name) || [];
    console.log(`Discovered ${availableToolNames.length} dynamic tools: [${availableToolNames.join(", ")}]`);

    // STEP 1: LOGIN & ACQUIRE SHORT-LIVED TOKEN
    console.log(`\n[1/5] Requesting short-lived session token...`);
    const loginRes = await fetch(`${BASE_URL}/api/v1/agent/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        masterSecret: MASTER_SECRET,
        agentName: "Nova-External-Shopper",
        requestedBudget: 5000000 // ₹50,000 in paise
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error || loginRes.statusText}`);
    activeToken = loginData.data.token;
    console.log(`✔ Token acquired. Expires at: ${new Date(loginData.data.expiresAt).toLocaleTimeString()}`);

    // STEP 2: SEMANTIC SEARCH
    console.log(`\n[2/5] Querying merchant's semantic catalog...`);
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

    // STEP 3: AI DECISION MAKING (REASONING)
    console.log(`\n[3/5] Analyzing catalog and deciding what to buy...`);
    
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

    // STEP 4: EXECUTE CHECKOUT
    console.log(`\n[4/5] Executing transaction via merchant gateway...`);
    
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
      if (checkoutData.data?.paymentLinkUrl) {
        console.log(`   ❯ Payment Link: ${checkoutData.data.paymentLinkUrl}`);
      }
    } else {
      console.log(`TRANSACTION GATED / BLOCKED: ${checkoutData.error}`);
    }

  } catch (error) {
    console.error(`Fatal Error:`, error);
  } finally {
    // STEP 5: CLEANUP & LOGOUT
    if (activeToken) {
      console.log(`\n[5/5] Revoking short-lived token...`);
      await fetch(`${BASE_URL}/api/v1/agent/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeToken })
      });
      console.log(`Token successfully revoked. Session closed.`);
    }
  }
}

// TEST SCENARIOS
async function main() {
  await runExternalBuyer("I am outfitting a small workstation. I need an ergonomic desk chair for long hours.");
}

main();