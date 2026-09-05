import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getEmbedding } from "@/lib/gemini";
import { SearchRequestSchema, SearchResultProduct } from "@/types/agent";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 1. Strict Input Validation via Zod
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format },
        { status: 400 }
      );
    }

    const { apiKey, query, maxPrice, limit } = parsed.data;

    // 2. Authenticate the Agent Session
    const tokenHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // GATE: RATE LIMITING
    const { checkRateLimit } = await import("@/lib/rate-limit");
    
    const rateLimit = checkRateLimit(tokenHash); 

    if (!rateLimit.success) {
      console.warn(`[RATE LIMIT] Agent throttled. Token Hash: ${tokenHash}`);
      return NextResponse.json(
        { 
          error: "Too Many Requests", 
          message: `Agent exceeded the ${rateLimit.limit} requests/min limit.` 
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimit.reset).toISOString()
          }
        }
      );
    }

    const session = await prisma.agentSession.findUnique({
      where: { apiKeyHash: tokenHash },
    });

    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or revoked agent token" },
        { status: 401 }
      );
    }

    if (new Date() > session.expiresAt) {
      // Auto-revoke the expired token in the database for cleanup
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { status: "REVOKED" }
      });
      return NextResponse.json(
        { error: "Unauthorized: Token has expired" },
        { status: 401 }
      );
    }

    // 3. Generate Vector Embedding for the search intent
    const queryVector = await getEmbedding(query);
    const vectorString = `[${queryVector.join(",")}]`;

    // 4. Perform Cosine Similarity Search using pgvector in PostgreSQL
    // 1 - (embedding <=> vector) calculates the cosine similarity score (0 to 1)
    const rawResults = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        category: string;
        description: string;
        similarity: number;
      }>
    >`
      SELECT 
        id, 
        name, 
        price, 
        stock, 
        category, 
        description,
        1 - (embedding <=> ${vectorString}::vector) AS similarity
      FROM "Product"
      WHERE stock > 0
      ${maxPrice ? Prisma.sql`AND price <= ${maxPrice}` : Prisma.empty}
      ORDER BY embedding <=> ${vectorString}::vector ASC
      LIMIT ${limit};
    `;

    const formattedProducts: SearchResultProduct[] = rawResults.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      stock: item.stock,
      category: item.category,
      description: item.description,
      similarityScore: parseFloat(Number(item.similarity).toFixed(4)),
    }));

    // 5. Write to Immutable AuditLog
    await prisma.auditLog.create({
      data: {
        sessionId: session.id,
        actionType: "SEMANTIC_SEARCH",
        isSuccess: true,
        payload: {
          query,
          maxPrice,
          matchesFound: formattedProducts.length,
          topMatch: formattedProducts[0]?.name || null,
        },
      },
    });

    // 6. Return Structured Agent Response
    return NextResponse.json({
      status: "success",
      query,
      resultsCount: formattedProducts.length,
      products: formattedProducts,
    });
  } catch (error: unknown) {
    console.error("Search API Error:", error);

    // Safely extract the message by checking if it's an Error object
    const errorMessage = error instanceof Error 
      ? error.message 
      : "An unknown error occurred";

    return NextResponse.json(
      { error: "Internal Gateway Error", message: errorMessage },
      { status: 500 }
    );
  }
}