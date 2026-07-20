import { useState } from "react";
import { Layout } from "@/components/layout";
import { ModelSelector } from "@/components/model-selector";
import { SeverityBadge } from "@/components/severity-badge";
import { AlertExplainer } from "@/components/alert-explainer";
import { useListAlerts, useResolveAlert } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getListAlertsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { CheckCircle, ChevronDown, ChevronRight, BookOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RUNBOOK_STEPS: Record<string, { title: string; steps: string[] }> = {
  drift: {
    title: "Data Drift Runbook",
    steps: [
      "Check for recent upstream pipeline changes or schema updates.",
      "Compare current feature distributions vs baseline — PSI > 0.25 is critical.",
      "Use the Feature Drift Heatmap to find which features are drifting.",
      "If PSI > 0.10 for over 48h, retrain on recent data.",
      "Deploy the retrained model to shadow mode first and compare outputs.",
      "Monitor PSI for 24h before promoting to active.",
    ],
  },
  latency: {
    title: "Latency SLA Runbook",
    steps: [
      "Check model server CPU and memory — look for resource saturation.",
      "Review if a recent deploy changed model architecture or batch size.",
      "Warm up the endpoint if the server recently restarted (cold starts).",
      "Check downstream dependencies like feature store or database calls.",
      "If P99 > 500ms for over 15 min, scale out inference replicas.",
      "Roll back to the previous version if latency doesn't improve within 30 min.",
    ],
  },
  null_rate: {
    title: "Null Rate Spike Runbook",
    steps: [
      "Find which features have elevated null rates in Feature Health.",
      "Trace those features back to their upstream source or ETL job.",
      "Check if a recent deploy changed how nulls are handled.",
      "Verify the data source isn't down or undergoing schema migration.",
      "Enable imputation fallback if null rate is 5× above baseline.",
      "File an incident with the data engineering team including the feature name and time.",
    ],
  },
  schema_mismatch: {
    title: "Schema Mismatch Runbook",
    steps: [
      "Identify the mismatched feature from Feature Health.",
      "Find which upstream service or ETL changed the schema.",
      "Check if the change was intentional (co-ordinated deploy) or accidental.",
      "Update the preprocessing pipeline to handle the new format.",
      "If not co-ordinated, roll back the upstream change and notify the owner.",
      "Run a validation job across recent data to estimate prediction impact.",
    ],
  },
  prediction_skew: {
    title: "Prediction Skew Runbook",
    steps: [
      "Check the Prediction Distribution chart on the Dashboard for the shift size.",
      "Cross-reference PSI drift — prediction skew usually follows data drift.",
      "If PSI is stable but predictions are skewed, investigate concept drift.",
      "Compare current and previous model version prediction distributions.",
      "If any bin shifted by more than 10%, consider rolling back.",
      "Schedule retraining with both feature and label drift corrections.",
    ],
  },
};

export default function AlertsPage() {
  const [modelId, setModelId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "active" | "resolved">("active");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [runbookAlert, setRunbookAlert] = useState<{ type: string; severity: string } | null>(null);
  const { toast } = useToast();

  const parsedModelId = modelId === "all" ? undefined : parseInt(modelId);
  const { data: alerts, isLoading } = useListAlerts({ modelId: parsedModelId, status });
  const queryClient = useQueryClient();

  const resolveAlertMutation = useResolveAlert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Alert resolved", description: "The alert has been marked as resolved." });
      },
    },
  });

  const handleResolve = (id: number) => resolveAlertMutation.mutate({ alertId: id });

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Alert Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Production anomalies and incident tracking.</p>
          </div>
          <div className="flex gap-3">
            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <ModelSelector value={modelId} onValueChange={setModelId} />
          </div>
        </div>

        {/* Inline Runbook Panel */}
        {runbookAlert && (() => {
          const rb = RUNBOOK_STEPS[runbookAlert.type] ?? RUNBOOK_STEPS.drift;
          return (
            <div className={`rounded-xl border p-4 space-y-3 ${
              runbookAlert.severity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{rb.title}</span>
                </div>
                <button onClick={() => setRunbookAlert(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="space-y-2">
                {rb.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      runbookAlert.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}>{i + 1}</span>
                    <span className="text-muted-foreground leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })()}

        <div className="space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          )}

          {alerts?.map((alert) => (
            <div
              key={alert.id}
              className={`bg-card border rounded-xl overflow-hidden transition-all ${
                alert.status === "active" && alert.severity === "critical"
                  ? "border-red-500/30"
                  : alert.status === "active"
                  ? "border-yellow-500/30"
                  : "border-border"
              }`}
            >
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  alert.status === "resolved" ? "bg-green-500" :
                  alert.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-yellow-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={alert.status === "resolved" ? "stable" : alert.severity} />
                    <span className="text-xs text-muted-foreground font-mono">{alert.modelName}</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{alert.type.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-foreground mt-1 truncate">{alert.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                    {format(new Date(alert.triggeredAt), "MM/dd HH:mm")}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setRunbookAlert(prev =>
                          prev?.type === alert.type ? null : { type: alert.type, severity: alert.severity }
                        );
                      }}
                      className="h-7 px-2 text-xs rounded-md border border-border flex items-center gap-1 hover:bg-muted transition-colors text-muted-foreground"
                    >
                      <BookOpen className="h-3 w-3" /> Runbook
                    </button>
                    {alert.status === "active" && (
                      <button
                        onClick={e => { e.stopPropagation(); handleResolve(alert.id); }}
                        disabled={resolveAlertMutation.isPending}
                        className="h-7 px-2 text-xs rounded-md border border-border flex items-center gap-1 hover:bg-green-500 hover:text-white hover:border-green-500 transition-colors text-muted-foreground"
                      >
                        <CheckCircle className="h-3 w-3" /> Resolve
                      </button>
                    )}
                    {alert.status === "resolved" && (
                      <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Resolved
                      </span>
                    )}
                  </div>
                  {expanded === alert.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded explainer */}
              {expanded === alert.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                  <AlertExplainer
                    type={alert.type as any}
                    severity={alert.severity as any}
                    message={alert.message}
                  />
                </div>
              )}
            </div>
          ))}

          {!isLoading && (!alerts || alerts.length === 0) && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">No {status === "active" ? "active " : ""}alerts</p>
              <p className="text-xs text-muted-foreground mt-1">All systems operating within normal parameters.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
