import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // 1. Extract and validate parameters
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const sort = searchParams.get("sort") || "name";
    
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(limit, 100));
    const skip = (validPage - 1) * validLimit;

    // 2. Determine sorting logic dynamically
    const orderBy = sort === "stock" 
      ? { stock: "asc" as const } 
      : { name: "asc" as const };

    // 3. Fetch data and total count concurrently
    const [products, totalItems] = await prisma.$transaction([
      prisma.product.findMany({
        skip,
        take: validLimit,
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          category: true,
          description: true,
        },
        orderBy
      }),
      prisma.product.count()
    ]);

    return NextResponse.json({
      status: "success",
      pagination: {
        currentPage: validPage,
        limit: validLimit,
        totalItems,
        totalPages: Math.ceil(totalItems / validLimit),
        hasNextPage: validPage * validLimit < totalItems,
      },
      data: products,
    });
  } catch (error) {
    console.error("Catalog API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}