"use client";

import { useEffect, useState } from "react";
import { AuditLogWithSession } from "@/types/admin";

export default function LiveLogsTable({ 
  initialLogs 
}: { 
  initialLogs: AuditLogWithSession[] 
}) {
  const [logs, setLogs] = useState<AuditLogWithSession[]>(initialLogs);

  useEffect(() => {
    const eventSource = new EventSource("/api/v1/admin/logs/stream");

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      
      if (parsed.type === "logs") {
        setLogs((prev) => {
          const combined = [...parsed.data, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20);
        });
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection lost. Reconnecting...");
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="p-4 font-medium">Timestamp</th>
            <th className="p-4 font-medium">Agent Session</th>
            <th className="p-4 font-medium">Action Type</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Payload Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-800/50 transition-colors animate-in fade-in duration-500">
              <td className="p-4 whitespace-nowrap">
                <div className="font-medium text-gray-300">
                {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                {new Date(log.timestamp).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })}
                </div>
              </td>
              <td className="p-4 font-mono text-xs text-gray-300">
                {log.session.agentName}
              </td>
              <td className="p-4">
                <span className="font-semibold text-gray-200">{log.actionType}</span>
              </td>
              <td className="p-4">
                {log.isSuccess ? (
                  <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs border border-green-800 font-medium">
                    SUCCESS
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs border border-red-800 font-medium">
                    GATED / BLOCKED
                  </span>
                )}
              </td>
              <td className="p-4 font-mono text-xs text-gray-400 truncate max-w-md">
                {JSON.stringify(log.payload)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}