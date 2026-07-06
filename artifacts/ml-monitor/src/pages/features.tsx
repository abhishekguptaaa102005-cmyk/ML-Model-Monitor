import { useState } from "react";
import { Layout } from "@/components/layout";
import { ModelSelector } from "@/components/model-selector";
import { SeverityBadge } from "@/components/severity-badge";
import { useListFeatures } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function FeaturesPage() {
  const [modelId, setModelId] = useState<string>("all");
  const parsedModelId = modelId === "all" ? undefined : parseInt(modelId);
  
  const { data: features } = useListFeatures({ modelId: parsedModelId });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feature Health</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Input data quality and schema validation.</p>
          </div>
          <ModelSelector value={modelId} onValueChange={setModelId} />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground uppercase text-xs tracking-wider">
                  <th className="p-4 font-normal">Feature Name</th>
                  <th className="p-4 font-normal">Type</th>
                  <th className="p-4 font-normal text-right">Null Rate</th>
                  <th className="p-4 font-normal text-right">Baseline Null</th>
                  <th className="p-4 font-normal">Schema Match</th>
                  <th className="p-4 font-normal text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {features?.map((feature) => {
                  const nullDiff = feature.nullRate - feature.baselineNullRate;
                  const isNullDrift = Math.abs(nullDiff) > 0.05; // 5% absolute difference
                  
                  return (
                    <tr key={feature.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium">{feature.featureName}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {feature.featureType}
                        </Badge>
                      </td>
                      <td className={`p-4 text-right ${isNullDrift ? 'text-yellow-500 font-bold' : ''}`}>
                        {(feature.nullRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-4 text-right text-muted-foreground">
                        {(feature.baselineNullRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-4">
                        {feature.schemaMismatch ? (
                          <SeverityBadge severity="critical" className="inline-flex" />
                        ) : (
                          <SeverityBadge severity="stable" className="inline-flex" />
                        )}
                      </td>
                      <td className="p-4 text-right text-muted-foreground">
                        {format(new Date(feature.lastUpdated), 'MM/dd HH:mm')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(!features || features.length === 0) && (
            <div className="p-12 text-center text-muted-foreground font-mono border border-dashed border-border m-4 rounded">
              No features found for the selected model.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
