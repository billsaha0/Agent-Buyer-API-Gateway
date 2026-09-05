// src/app/api/v1/admin/inventory/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEmbedding } from "@/lib/gemini";
import { UpdateProductSchema } from "@/types/admin";
import { Prisma } from "@/generated/prisma/client";

// Update price, stock, or description
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const productId = resolvedParams.id;

    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const currentProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 1. Update standard fields
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: parsed.data
    });

    // 2. If name or description changed, we MUST recalculate the AI vector
    if (parsed.data.name || parsed.data.description) {
      const newName = parsed.data.name || currentProduct.name;
      const newDesc = parsed.data.description || currentProduct.description;
      
      const vectorArray = await getEmbedding(`${newName}: ${newDesc}`);
      const vectorString = `[${vectorArray.join(',')}]`;
      
      await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorString}::vector WHERE id = ${productId}`;
    }

    return NextResponse.json({ status: "success", data: updatedProduct });
  } catch (error) {
    console.error("Unknown error occurred:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE: Remove discontinued items
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const productId = resolvedParams.id;

    await prisma.product.delete({
      where: { id: productId }
    });

    return NextResponse.json({ status: "success", message: "Product deleted" });
  } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                return NextResponse.json({
                    error: "Cannot delete product because it exists in past order histories. Set stock to 0 instead."
                }, { status: 409 });
            }
        }
        return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
    }
}