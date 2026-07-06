import { useState } from "react";
import { Layout } from "@/components/layout";
import { ModelSelector } from "@/components/model-selector";
import { SeverityBadge } from "@/components/severity-badge";
import { useGetDriftSummary, useListDriftMetrics, useGetFeatureHeatmap } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { format } from "date-fns";

export default function DriftPage() {
  const [modelId, setModelId] = useState<string>("all");
  
  const parsedModelId = modelId === "all" ? undefined : parseInt(modelId);
  
  const { data: summary } = useGetDriftSummary({ modelId: parsedModelId });
  const { data: metrics } = useListDriftMetrics({ modelId: parsedModelId });
  const { data: heatmap } = useGetFeatureHeatmap({ modelId: parsedModelId });

  // Format data for charts
  const chartData = metrics?.map(m => ({
    ...m,
    timeLabel: format(new Date(m.timestamp), 'HH:mm')
  })) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Drift Analysis</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Monitor statistical data drift across features and predictions.</p>
          </div>
          <ModelSelector value={modelId} onValueChange={setModelId} />
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">Overall Status</div>
              <div className="flex items-center mt-1">
                <SeverityBadge severity={summary.overallSeverity} className="text-lg py-1 px-3" />
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">PSI Score</div>
              <div className={`text-3xl font-bold ${summary.psiScore > 0.25 ? 'text-red-500' : summary.psiScore > 0.1 ? 'text-yellow-500' : 'text-green-500'}`}>
                {summary.psiScore.toFixed(3)}
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">KS Statistic</div>
              <div className="text-3xl font-bold text-foreground">
                {summary.ksStatistic.toFixed(3)}
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-mono">Drifted Features</div>
              <div className="text-3xl font-bold">
                <span className={summary.driftedFeatures > 0 ? "text-yellow-500" : ""}>{summary.driftedFeatures}</span>
                <span className="text-muted-foreground text-xl"> / {summary.totalFeatures}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">PSI Trend</h3>
            <div className="h-[300px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="timeLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <ReferenceLine y={0.1} stroke="hsl(var(--yellow-500))" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Warning', fill: 'hsl(var(--yellow-500))', fontSize: 10 }} />
                    <ReferenceLine y={0.25} stroke="hsl(var(--red-500))" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Critical', fill: 'hsl(var(--red-500))', fontSize: 10 }} />
                    <Line type="monotone" dataKey="psiScore" name="PSI Score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-border rounded text-muted-foreground font-mono text-sm">
                  No PSI data available
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 flex flex-col">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">KS Statistic Trend</h3>
            <div className="h-[300px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="timeLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ksStatistic" name="KS Stat" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-border rounded text-muted-foreground font-mono text-sm">
                  No KS data available
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground font-mono">Feature Drift Heatmap</h3>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 gap-2 min-w-[600px]">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2 px-2">
                <div className="col-span-4">Feature</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2 text-right">PSI</div>
                <div className="col-span-2 text-right">KS</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              
              {heatmap?.map((feature, i) => {
                let bgClass = "bg-background/50";
                if (feature.severity === "critical") bgClass = "bg-red-500/10 border-red-500/20";
                else if (feature.severity === "warning") bgClass = "bg-yellow-500/10 border-yellow-500/20";
                
                return (
                  <div key={i} className={`grid grid-cols-12 gap-2 items-center text-sm font-mono p-2 rounded border border-transparent ${bgClass}`}>
                    <div className="col-span-4 font-medium truncate" title={feature.featureName}>{feature.featureName}</div>
                    <div className="col-span-2 text-muted-foreground text-xs">{feature.featureType}</div>
                    <div className={`col-span-2 text-right ${feature.psiScore > 0.25 ? 'text-red-500' : feature.psiScore > 0.1 ? 'text-yellow-500' : ''}`}>
                      {feature.psiScore.toFixed(3)}
                    </div>
                    <div className="col-span-2 text-right">{feature.ksStatistic.toFixed(3)}</div>
                    <div className="col-span-2 text-right">
                      <SeverityBadge severity={feature.severity} />
                    </div>
                  </div>
                );
              })}
              
              {(!heatmap || heatmap.length === 0) && (
                <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded font-mono text-sm">
                  No feature drift data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
