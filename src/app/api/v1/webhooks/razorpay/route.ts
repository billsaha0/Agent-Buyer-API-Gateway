import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // We must read the body as raw text to verify the HMAC signature correctly
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
    }

    // GATE 3: SECURITY SIGNATURE VERIFICATION
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Webhook signature mismatch. Possible spoofing attack.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Signature verified, safe to parse JSON
    const event = JSON.parse(rawBody);

    // HANDLE AUTHORIZATION EVENT
    if (event.event === "payment.authorized") {
      const paymentEntity = event.payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;

      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: rzpOrderId },
      });

      if (order && order.status === "PENDING") {
        // Atomically update the order and log the successful capture
        await prisma.$transaction([
          prisma.order.update({
            where: { id: order.id },
            data: { status: "AUTHORIZED" },
          }),
          prisma.auditLog.create({
            data: {
              sessionId: order.sessionId,
              actionType: "PAYMENT_AUTHORIZED_WEBHOOK",
              isSuccess: true,
              payload: {
                paymentId: paymentEntity.id,
                rzpOrderId: rzpOrderId,
                method: paymentEntity.method,
              },
            },
          }),
        ]);
        console.log(`Webhook processed: Order ${order.id} marked as AUTHORIZED.`);
      }
    }

    // Always return a 200 OK so Razorpay knows you received the webhook
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Gateway Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}