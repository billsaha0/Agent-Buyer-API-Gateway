import prisma from "@/lib/prisma";
import LiveLogsTable from "@/components/LiveLogsTable";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const initialLogs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 20,
    include: { session: { select: { agentName: true } } }
  });

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Agent-Buyer API Gateway</h1>
            <p className="text-gray-400 mt-2">Live immutable audit trail of autonomous machine-to-machine transactions.</p>
          </div>
        </div>
        
        <LiveLogsTable initialLogs={initialLogs} />
      </div>
    </div>
  );
}