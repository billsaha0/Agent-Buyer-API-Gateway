import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";
import { CheckoutRequestSchema } from "@/types/agent";
import crypto from "crypto";
import z from "zod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 1. Strict Validation
    const parsed = CheckoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errors = z.treeifyError(parsed.error);
      return NextResponse.json({ error: "Invalid payload", details: errors }, { status: 400 });
    }

    const { apiKey, productId, quantity, idempotencyKey } = parsed.data;

    // GATE 0: IDEMPOTENCY CHECK (Prevents Double-Charge)
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey }
    });

    if (existingOrder) {
      console.log(`Idempotency catch: Returning existing order for key ${idempotencyKey}`);
      return NextResponse.json({
        status: "success",
        message: "Order already processed (Idempotent response)",
        data: {
          internalOrderId: existingOrder.id,
          razorpayOrderId: existingOrder.razorpayOrderId,
          amountDueInPaisa: existingOrder.amountInPaisa,
          remainingAgentBudget: "Already deducted in original transaction"
        }
      });
    }

    // 2. Fetch Session & Product
    const tokenHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    
    const session = await prisma.agentSession.findUnique({ 
      where: { apiKeyHash: tokenHash } 
    });
    const product = await prisma.product.findUnique({ 
      where: { id: productId } 
    });

    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized: Invalid or revoked agent token" }, { status: 401 });
    }
    
    if (new Date() > session.expiresAt) {
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { status: "REVOKED" }
      });
      return NextResponse.json({ error: "Unauthorized: Token has expired" }, { status: 401 });
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const totalCostInPaisa = product.price * quantity;

    // GATE 1: INVENTORY CHECK
    if (product.stock < quantity) {
      await prisma.auditLog.create({
        data: {
          sessionId: session.id,
          actionType: "CHECKOUT_REJECTED_INVENTORY",
          isSuccess: false,
          payload: { productId, requested: quantity, available: product.stock },
        }
      });
      return NextResponse.json({ 
        error: "Insufficient stock", 
        availableStock: product.stock 
      }, { status: 409 });
    }

    // GATE 2: FINANCIAL BOUNDS (BUDGET LIMIT)
    if (session.budgetSpent + totalCostInPaisa > session.budgetLimit) {
      await prisma.auditLog.create({
        data: {
          sessionId: session.id,
          actionType: "CHECKOUT_REJECTED_BUDGET",
          isSuccess: false,
          payload: { 
            totalCostInPaisa,
            remainingBudget: session.budgetLimit - session.budgetSpent 
          },
        }
      });
      return NextResponse.json({ 
        error: "Budget limit exceeded. Transaction gated." 
      }, { status: 403 });
    }

    // CREATE RAZORPAY ORDER
    const rzpOrder = await razorpay.orders.create({
      amount: totalCostInPaisa,
      currency: "INR",
      receipt: `rcpt_${session.id.slice(0,8)}_${Date.now()}`,
    });

    // DATABASE COMMIT & AUDIT TRAIL
    const [order, updatedSession] = await prisma.$transaction([
      prisma.order.create({
        data: {
          sessionId: session.id,
          razorpayOrderId: rzpOrder.id,
          idempotencyKey,
          amountInPaisa: totalCostInPaisa,
          status: "PENDING",
          items: {
            create: [{ productId: product.id, quantity }]
          }
        }
      }),
      prisma.agentSession.update({
        where: { id: session.id },
        data: { budgetSpent: { increment: totalCostInPaisa } }
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { stock: { decrement: quantity } }
      }),
      prisma.auditLog.create({
        data: {
          sessionId: session.id,
          actionType: "CHECKOUT_SUCCESS",
          isSuccess: true,
          payload: { 
            razorpayOrderId: rzpOrder.id, 
            productId, 
            quantity,
            totalCostInPaisa 
          },
        }
      })
    ]);

    return NextResponse.json({
      status: "success",
      message: "Order generated successfully",
      data: {
        internalOrderId: order.id,
        razorpayOrderId: rzpOrder.id,
        amountDueInPaisa: totalCostInPaisa,
        remainingAgentBudget: updatedSession.budgetLimit - updatedSession.budgetSpent
      }
    });

  } catch (error: unknown) {

    const errorMessage = error instanceof Error 
      ? error.message 
      : "An unknown error occurred";
    
    console.error("Checkout Gateway Error:", errorMessage);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}