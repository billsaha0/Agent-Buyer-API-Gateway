import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { LogStreamEvent } from "@/types/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let lastCheckTime = new Date(); 

  const customReadable = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: LogStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({ type: "ping" });

      const interval = setInterval(async () => {
        try {
          const newLogs = await prisma.auditLog.findMany({
            where: { timestamp: { gt: lastCheckTime } },
            orderBy: { timestamp: "desc" },
            include: { session: { select: { agentName: true } } }
          });

          if (newLogs.length > 0) {
            lastCheckTime = newLogs[0].timestamp;
            sendEvent({ type: "logs", data: newLogs }); 
          }
        } catch (error) {
          console.error("SSE Prisma Error:", error);
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