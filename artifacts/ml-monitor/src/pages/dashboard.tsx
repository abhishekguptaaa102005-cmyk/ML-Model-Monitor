import { Layout } from "@/components/layout";
import { useGetDashboardSummary, useGetCurrentLatency, useListAlerts, useGetPredictionDistribution } from "@workspace/api-client-react";
import { SeverityBadge } from "@/components/severity-badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: currentLatency } = useGetCurrentLatency();
  const { data: recentAlerts } = useListAlerts({ status: 'active' });
  const { data: predictionDist } = useGetPredictionDistribution({});

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">System overview and critical metrics.</p>
        </div>
        
        {isSummaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card border border-border rounded-lg" />)}
          </div>
        ) : summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">Overall Health</div>
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-bold ${summary.overallHealth === 'healthy' ? 'text-green-500' : summary.overallHealth === 'degraded' ? 'text-yellow-500' : 'text-red-500'}`}>
                  {summary.overallHealth.toUpperCase()}
                </div>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">Active Alerts</div>
              <div className="text-3xl font-bold">{summary.activeAlerts} <span className="text-sm text-red-500">({summary.criticalAlerts} CRIT)</span></div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">MTTD</div>
              <div className="text-3xl font-bold">{summary.mttdMinutes}m</div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">Users Protected</div>
              <div className="text-3xl font-bold">{(summary.totalDailyUsers / 1000).toFixed(1)}k</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">Prediction Distribution</h3>
            <div className="h-[300px] w-full flex-1">
              {predictionDist && predictionDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictionDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar dataKey="currentCount" name="Current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="baselineCount" name="Baseline" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded">
                  No prediction data available
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">Current Latency Percentiles</h3>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-normal">Model</th>
                    <th className="pb-2 font-normal text-right">P50</th>
                    <th className="pb-2 font-normal text-right">P95</th>
                    <th className="pb-2 font-normal text-right">P99</th>
                    <th className="pb-2 font-normal text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLatency?.map((latency) => (
                    <tr key={latency.modelId} className="border-b border-border/50 last:border-0">
                      <td className="py-3">{latency.modelName}</td>
                      <td className="py-3 text-right">{latency.p50Ms}ms</td>
                      <td className="py-3 text-right">{latency.p95Ms}ms</td>
                      <td className="py-3 text-right text-primary">{latency.p99Ms}ms</td>
                      <td className="py-3 text-right">
                        <SeverityBadge severity={latency.status} />
                      </td>
                    </tr>
                  ))}
                  {(!currentLatency || currentLatency.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No latency data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground font-mono">Recent Active Alerts</h3>
          </div>
          <div className="space-y-2">
            {recentAlerts?.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background/50 rounded border border-border gap-2 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div>
                    <div className="font-mono text-sm text-foreground">{alert.message}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">Model: {alert.modelName} | Type: {alert.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-muted-foreground font-mono whitespace-nowrap">{format(new Date(alert.triggeredAt), 'HH:mm:ss')}</span>
                </div>
              </div>
            ))}
            {(!recentAlerts || recentAlerts.length === 0) && (
              <div className="text-center p-8 text-muted-foreground font-mono border border-dashed border-border rounded">
                No active alerts. System nominal.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
