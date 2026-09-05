import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { masterSecret, agentName, requestedBudget } = await req.json();

    // 1. Authenticate the incoming agent
    if (masterSecret !== process.env.AGENT_GATEWAY_SECRET) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Generate a cryptographically secure short-lived token
    const rawToken = crypto.randomBytes(32).toString("hex");
    
    // 3. Hash the token for database storage (Security Best Practice)
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 4. Create the session (Valid for exactly 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const session = await prisma.agentSession.create({
      data: {
        agentName: agentName || "Autonomous-Agent",
        apiKeyHash: tokenHash,
        budgetLimit: requestedBudget || 1000000, // Default to ₹10,000
        expiresAt,
      }
    });

    // 5. Return the raw token to the agent (it will never be shown again)
    return NextResponse.json({
      status: "success",
      message: "Temporary session token generated.",
      data: {
        sessionId: session.id,
        token: rawToken, // The agent must use this for /search and /checkout
        expiresAt,
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}