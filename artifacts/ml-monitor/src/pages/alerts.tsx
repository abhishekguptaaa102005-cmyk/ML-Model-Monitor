import { useState } from "react";
import { Layout } from "@/components/layout";
import { ModelSelector } from "@/components/model-selector";
import { SeverityBadge } from "@/components/severity-badge";
import { useListAlerts, useResolveAlert } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getListAlertsQueryKey } from "@workspace/api-client-react";
import { ExternalLink, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AlertsPage() {
  const [modelId, setModelId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "active" | "resolved">("active");
  const { toast } = useToast();
  
  const parsedModelId = modelId === "all" ? undefined : parseInt(modelId);
  const { data: alerts, isLoading } = useListAlerts({ modelId: parsedModelId, status });
  const queryClient = useQueryClient();

  const resolveAlertMutation = useResolveAlert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        toast({
          title: "Alert Resolved",
          description: "The alert has been successfully resolved.",
        });
      }
    }
  });

  const handleResolve = (id: number) => {
    resolveAlertMutation.mutate({ alertId: id });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alert Center</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">System anomalies and incident tracking.</p>
          </div>
          <div className="flex gap-4">
            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
              <SelectTrigger className="w-[150px] font-mono">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>
            <ModelSelector value={modelId} onValueChange={setModelId} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground uppercase text-xs tracking-wider">
                  <th className="p-4 font-normal">Severity</th>
                  <th className="p-4 font-normal">Model</th>
                  <th className="p-4 font-normal">Message</th>
                  <th className="p-4 font-normal">Type</th>
                  <th className="p-4 font-normal">Triggered</th>
                  <th className="p-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {alerts?.map((alert) => (
                  <tr key={alert.id} className={`hover:bg-muted/20 transition-colors ${alert.status === 'active' && alert.severity === 'critical' ? 'bg-red-500/5' : ''}`}>
                    <td className="p-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="p-4 font-medium">{alert.modelName}</td>
                    <td className="p-4 max-w-xs truncate" title={alert.message}>{alert.message}</td>
                    <td className="p-4 text-muted-foreground">{alert.type}</td>
                    <td className="p-4 text-muted-foreground">
                      {format(new Date(alert.triggeredAt), 'MM/dd HH:mm:ss')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {alert.runbookUrl && (
                          <Button variant="outline" size="sm" className="h-8 text-xs font-mono" asChild>
                            <a href={alert.runbookUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1.5 h-3 w-3" /> Runbook
                            </a>
                          </Button>
                        )}
                        {alert.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            className="h-8 text-xs font-mono hover:bg-green-500 hover:text-white border border-border"
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolveAlertMutation.isPending}
                          >
                            <CheckCircle className="mr-1.5 h-3 w-3" /> Resolve
                          </Button>
                        )}
                        {alert.status === 'resolved' && (
                          <Badge variant="outline" className="h-8 text-[10px] uppercase font-mono bg-transparent border-dashed text-muted-foreground">
                            Resolved
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!alerts || alerts.length === 0) && (
            <div className="p-12 text-center text-muted-foreground font-mono">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <p>No {status === 'active' ? 'active ' : ''}alerts found.</p>
              <p className="text-xs mt-1">System is operating within normal parameters.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { Badge } from "@/components/ui/badge";
