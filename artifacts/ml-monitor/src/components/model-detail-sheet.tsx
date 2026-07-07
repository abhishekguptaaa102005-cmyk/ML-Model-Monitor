import { useGetModelReport } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/severity-badge";
import { format } from "date-fns";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Cpu, Database,
  TrendingUp, Users, Zap, ChevronRight, Lightbulb, BarChart2
} from "lucide-react";

interface Props {
  modelId: number | null;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  rolled_back: "bg-red-500/10 text-red-400 border-red-500/20",
  shadow: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const PRIORITY_COLOR = {
  critical: "border-l-red-500 bg-red-500/5",
  warning: "border-l-yellow-500 bg-yellow-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
};

const PRIORITY_ICON = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Lightbulb,
};

const PRIORITY_TEXT = {
  critical: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

function HealthRing({ score, health }: { score: number; health: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = health === "critical" ? "#ef4444" : health === "degraded" ? "#eab308" : "#22c55e";
  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1f2937" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; highlight?: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className={`text-base font-bold font-mono ${highlight ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function ModelDetailSheet({ modelId, onClose }: Props) {
  const { data: report, isLoading } = useGetModelReport(
    modelId!,
    { query: { enabled: modelId !== null } }
  );

  return (
    <Sheet open={modelId !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-card border-border p-0" side="right">
        {isLoading || !report ? (
          <div className="flex items-center justify-center h-full">
            <div className="space-y-3 w-full px-6 pt-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <SheetHeader>
                <SheetTitle className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold truncate">{report.model.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{report.model.version}</div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-1 rounded-full border uppercase tracking-wide shrink-0 ${STATUS_COLOR[report.model.status] ?? ""}`}>
                    {report.model.status.replace("_", " ")}
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-4 mt-4">
                <HealthRing score={report.healthScore} health={report.overallHealth} />
                <div className="space-y-1 flex-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Health Score</div>
                  <div className={`text-sm font-semibold ${
                    report.overallHealth === "critical" ? "text-red-400"
                    : report.overallHealth === "degraded" ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {report.overallHealth === "critical" ? "Critical — Immediate action needed"
                    : report.overallHealth === "degraded" ? "Degraded — Investigation required"
                    : "Healthy — All signals nominal"}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{report.model.dailyUsers.toLocaleString()} / day</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(report.model.deployedAt), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="px-6 py-4 border-b border-border">
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="PSI Score"
                  value={report.drift.psiScore.toFixed(3)}
                  sub={`Drift: ${report.drift.overallSeverity}`}
                  icon={TrendingUp}
                  highlight={
                    report.drift.overallSeverity === "critical" ? "text-red-400"
                    : report.drift.overallSeverity === "warning" ? "text-yellow-400" : "text-green-400"
                  }
                />
                <StatCard
                  label="P99 Latency"
                  value={`${report.latency.p99Ms.toFixed(0)}ms`}
                  sub={report.latency.slaBreached ? "SLA breached (>500ms)" : "Within SLA"}
                  icon={Zap}
                  highlight={report.latency.slaBreached ? "text-red-400" : report.latency.status === "warning" ? "text-yellow-400" : "text-foreground"}
                />
                <StatCard
                  label="Active Alerts"
                  value={String(report.alerts.activeCount)}
                  sub={`${report.alerts.criticalCount} critical`}
                  icon={AlertTriangle}
                  highlight={report.alerts.criticalCount > 0 ? "text-red-400" : report.alerts.activeCount > 0 ? "text-yellow-400" : "text-foreground"}
                />
                <StatCard
                  label="Drifted Features"
                  value={`${report.drift.driftedFeatures} / ${report.drift.totalFeatures}`}
                  sub={`KS stat: ${report.drift.ksStatistic.toFixed(3)}`}
                  icon={Database}
                />
              </div>
            </div>

            {/* AI Suggestions */}
            {report.suggestions.length > 0 && (
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendations</span>
                </div>
                <div className="space-y-2">
                  {report.suggestions.map((s, i) => {
                    const Icon = PRIORITY_ICON[s.priority];
                    return (
                      <div key={i} className={`border-l-2 pl-3 py-2 rounded-r-lg text-xs ${PRIORITY_COLOR[s.priority]}`}>
                        <div className={`flex items-center gap-1.5 font-semibold mb-0.5 ${PRIORITY_TEXT[s.priority]}`}>
                          <Icon className="h-3 w-3" />{s.category}
                        </div>
                        <div className="text-muted-foreground leading-relaxed">{s.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top drifted features */}
            {report.drift.topDriftedFeatures.length > 0 && (
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Drifted Features</span>
                </div>
                <div className="space-y-1.5">
                  {report.drift.topDriftedFeatures.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-border/40 last:border-0">
                      <span className="font-mono text-foreground">{f.featureName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">PSI {f.psiScore.toFixed(3)}</span>
                        <SeverityBadge severity={f.severity as any} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feature health table */}
            {report.features.length > 0 && (
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature Health</span>
                </div>
                <div className="space-y-0">
                  <div className="grid grid-cols-4 text-[10px] text-muted-foreground uppercase tracking-wide pb-1.5 border-b border-border/50">
                    <span>Feature</span>
                    <span className="text-right">Null Rate</span>
                    <span className="text-right">Baseline</span>
                    <span className="text-right">Schema</span>
                  </div>
                  {report.features.map((f) => {
                    const elevated = f.baselineNullRate > 0 && f.nullRate > f.baselineNullRate * 2;
                    return (
                      <div key={f.id} className="grid grid-cols-4 text-xs py-1.5 border-b border-border/20 last:border-0">
                        <span className="font-mono text-foreground truncate pr-2">{f.featureName}</span>
                        <span className={`text-right font-mono ${elevated ? "text-yellow-400" : "text-muted-foreground"}`}>
                          {(f.nullRate * 100).toFixed(1)}%
                        </span>
                        <span className="text-right font-mono text-muted-foreground">{(f.baselineNullRate * 100).toFixed(1)}%</span>
                        <span className={`text-right ${f.schemaMismatch ? "text-red-400" : "text-green-400"}`}>
                          {f.schemaMismatch ? "⚠ mismatch" : "✓"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent alerts */}
            {report.alerts.recent.length > 0 && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Alerts</span>
                </div>
                <div className="space-y-2">
                  {report.alerts.recent.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                        a.status === "resolved" ? "bg-green-500"
                        : a.severity === "critical" ? "bg-red-500 animate-pulse" : "bg-yellow-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={a.status === "resolved" ? "stable" : a.severity as any} />
                          <span className="text-muted-foreground font-mono">{a.type.replace("_", " ")}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{a.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {format(new Date(a.triggeredAt), "MM/dd HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
