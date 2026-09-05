import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEmbedding } from "@/lib/gemini";
import { CreateProductSchema } from "@/types/admin";
import z from "zod";

export async function POST(req: NextRequest) {
  try {
    // 1. Admin Authentication
    const adminSecret = req.headers.get("x-admin-secret");
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized admin access" }, { status: 401 });
    }

    // 2. Validate Payload
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Invalid payload",
          details: z.treeifyError(parsed.error) 
        }, 
        { status: 400 }
      );
    }
    const { name, price, stock, category, description } = parsed.data;

    // 3. Generate Vector Embedding
    const textToEmbed = `${name}: ${description}`;
    const vectorArray = await getEmbedding(textToEmbed);
    const vectorString = `[${vectorArray.join(',')}]`;

    // 4 & 5. Insert and Vectorize Atomically
    // Wrapping in a transaction ensures we never write a product to DB without its vector
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: { name, price, stock, category, description }
      });

      await tx.$executeRaw`UPDATE "Product" SET embedding = ${vectorString}::vector WHERE id = ${newProduct.id}`;
      
      return newProduct;
    });

    return NextResponse.json({
      status: "success",
      message: "Product added and vectorized successfully",
      data: product
    });

  } catch (error) {
    console.error("Admin API Error:", error);
    return NextResponse.json({ error: "Failed to add product" }, { status: 500 });
  }
}