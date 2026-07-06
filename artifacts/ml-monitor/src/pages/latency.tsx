import { useState } from "react";
import { Layout } from "@/components/layout";
import { ModelSelector } from "@/components/model-selector";
import { SeverityBadge } from "@/components/severity-badge";
import { useListLatencyMetrics, useGetCurrentLatency } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { format } from "date-fns";

export default function LatencyPage() {
  const [modelId, setModelId] = useState<string>("all");
  const parsedModelId = modelId === "all" ? undefined : parseInt(modelId);
  
  const { data: metrics } = useListLatencyMetrics({ modelId: parsedModelId, hours: 24 });
  const { data: currentLatency } = useGetCurrentLatency();

  const chartData = metrics?.map(m => ({
    ...m,
    timeLabel: format(new Date(m.timestamp), 'HH:mm')
  })) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Latency Tracking</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Real-time inference performance and percentiles.</p>
          </div>
          <ModelSelector value={modelId} onValueChange={setModelId} />
        </div>

        <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">Latency Trend (Last 24h)</h3>
          <div className="h-[400px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="timeLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}ms`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value}ms`]}
                  />
                  <Legend />
                  <ReferenceLine y={500} stroke="hsl(var(--red-500))" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'P99 SLA (500ms)', fill: 'hsl(var(--red-500))', fontSize: 10 }} />
                  <Line type="monotone" dataKey="p99Ms" name="P99" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="p95Ms" name="P95" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="p50Ms" name="P50" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-border rounded text-muted-foreground font-mono text-sm">
                No latency metrics available
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">Current Status by Model</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground uppercase text-xs tracking-wider">
                  <th className="pb-3 font-normal px-2">Model</th>
                  <th className="pb-3 font-normal text-right px-2">P50</th>
                  <th className="pb-3 font-normal text-right px-2">P95</th>
                  <th className="pb-3 font-normal text-right px-2">P99</th>
                  <th className="pb-3 font-normal text-right px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {currentLatency?.filter(l => !parsedModelId || l.modelId === parsedModelId).map((latency) => (
                  <tr key={latency.modelId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2 font-medium">{latency.modelName}</td>
                    <td className="py-3 px-2 text-right">{latency.p50Ms}ms</td>
                    <td className="py-3 px-2 text-right">{latency.p95Ms}ms</td>
                    <td className={`py-3 px-2 text-right ${latency.p99Ms > 500 ? 'text-red-500 font-bold' : latency.p99Ms > 300 ? 'text-yellow-500' : ''}`}>
                      {latency.p99Ms}ms
                    </td>
                    <td className="py-3 px-2 text-right">
                      <SeverityBadge severity={latency.status} />
                    </td>
                  </tr>
                ))}
                {(!currentLatency || currentLatency.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground border border-dashed border-border rounded mt-4">
                      No current latency data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
