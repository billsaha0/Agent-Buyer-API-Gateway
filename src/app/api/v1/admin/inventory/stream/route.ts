import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import type { Product } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// 1. Define the exact fields we are selecting from the database
type InventoryItem = Pick<Product, "id" | "name" | "price" | "stock" | "category">;

// 2. Define the strict union type for the stream events
type InventoryStreamEvent = 
  | { type: "ping" }
  | { type: "inventory"; data: InventoryItem[] };

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let previousStateHash = "";

  const customReadable = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: InventoryStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({ type: "ping" });

      const interval = setInterval(async () => {
        try {
          const products = await prisma.product.findMany({
            select: { id: true, name: true, price: true, stock: true, category: true },
          });

          const currentStateHash = JSON.stringify(products);
          if (currentStateHash !== previousStateHash) {
            previousStateHash = currentStateHash;
            sendEvent({ type: "inventory", data: products });
          }
        } catch (error) {
          console.error("SSE Inventory Error:", error);
        }
      }, 3000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}