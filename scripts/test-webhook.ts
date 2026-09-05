import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function simulateRazorpayWebhook() {
  // 1. Setup the exact variables
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "my_secure_webhook_secret_123";
  const rzpOrderId = "insert_your_razorpay_orderId";

  console.log(`\nSimulating Razorpay Webhook for Order: ${rzpOrderId}`);

  // 2. Build the exact JSON payload Razorpay sends
  const payload = {
    entity: "event",
    account_id: "acc_test_123456",
    event: "payment.authorized",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: `pay_mock_${Date.now()}`,
          entity: "payment",
          amount: 850000,
          currency: "INR",
          status: "authorized",
          order_id: rzpOrderId,
          method: "upi",
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(payload);

  // 3. Generate the cryptographic signature
  const signature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  console.log(`Generated Signature: ${signature}`);
  console.log(`Sending POST request to localhost...`);

  // 4. Fire the request at your Next.js server
  try {
    const res = await fetch(`${BASE_URL}/api/v1/webhooks/razorpay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: rawBody,
    });

    const data = await res.json();
    console.log(`\nResponse Status: ${res.status}`);
    console.log(`Response Body:`, data);
  } catch (error) {
    console.error("\nRequest failed:", error);
  }
}

simulateRazorpayWebhook();