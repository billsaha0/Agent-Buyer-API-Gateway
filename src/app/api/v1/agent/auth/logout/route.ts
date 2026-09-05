import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // 1. Hash the incoming token to find it in the database
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Update the session status to REVOKED
    const session = await prisma.agentSession.update({
      where: { apiKeyHash: tokenHash },
      data: { status: "REVOKED" }
    });

    await prisma.auditLog.create({
      data: {
        sessionId: session.id,
        actionType: "SESSION_REVOKED",
        isSuccess: true,
        payload: { reason: "Agent explicitly logged out" }
      }
    });

    return NextResponse.json({ status: "success", message: "Token successfully revoked." });

  } catch (error: unknown) {
    // 1. Log the actual error on your Next.js server for debugging
    console.error("Logout API Error:", error);

    // 2. Return a safe, generic message to the external caller
    return NextResponse.json(
      { error: "Invalid token or session already revoked." }, 
      { status: 400 }
    );
  }
}