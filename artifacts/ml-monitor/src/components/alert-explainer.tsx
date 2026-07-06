import { AlertTriangle, CheckCircle, Clock, TrendingUp, Zap, Database, AlertCircle, BarChart2 } from "lucide-react";

type AlertType = "drift" | "latency" | "null_rate" | "schema_mismatch" | "prediction_skew";
type AlertSeverity = "warning" | "critical";

interface Props {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
}

const TYPE_META: Record<AlertType, { icon: React.ComponentType<{ className?: string }>; what: string; why: string; fix: string }> = {
  drift: {
    icon: TrendingUp,
    what: "The statistical patterns in your input data have shifted away from what the model was trained on.",
    why: "When data drifts, predictions become unreliable — the model answers questions using knowledge that no longer matches reality.",
    fix: "Check your data pipeline for upstream changes. Compare recent feature distributions against training data. Consider retraining if drift persists.",
  },
  latency: {
    icon: Zap,
    what: "Prediction requests are taking too long to complete — longer than the 500ms target.",
    why: "Slow predictions mean users wait longer, or requests time out entirely. At scale this can cascade into outages.",
    fix: "Check model server resource usage (CPU/memory). Look for cold-start issues or resource contention. Review batch size or concurrency settings.",
  },
  null_rate: {
    icon: Database,
    what: "A feature is arriving with significantly more missing values than usual.",
    why: "Models handle missing values poorly. High null rates usually indicate an upstream data pipeline problem.",
    fix: "Trace the feature back to its source system. Check if a recent pipeline deploy changed how nulls are handled or if a data source is down.",
  },
  schema_mismatch: {
    icon: AlertCircle,
    what: "A feature is arriving in an unexpected format or type — different from what the model expects.",
    why: "Schema mismatches cause silent errors or wrong predictions. The model may silently default to zero or throw an exception.",
    fix: "Find which upstream system changed the feature schema. Roll back or update the preprocessing pipeline to handle the new format.",
  },
  prediction_skew: {
    icon: BarChart2,
    what: "The distribution of model outputs has shifted — predictions are skewing toward different values than expected.",
    why: "Skewed predictions mean users may be getting systematically wrong answers. This is often the final symptom of upstream data drift.",
    fix: "Check drift metrics for which features are causing the shift. If PSI is above 0.25, consider rolling back to the previous model version while investigating.",
  },
};

export function AlertExplainer({ type, severity, message }: Props) {
  const meta = TYPE_META[type] ?? TYPE_META.drift;
  const Icon = meta.icon;

  return (
    <div className={`rounded-lg border p-4 text-xs space-y-3 ${severity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${severity === "critical" ? "text-red-400" : "text-yellow-400"}`} />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">What happened</div>
          <div className="text-muted-foreground leading-relaxed">{meta.what}</div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">Why it matters</div>
          <div className="text-muted-foreground leading-relaxed">{meta.why}</div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">What to do</div>
          <div className="text-muted-foreground leading-relaxed">{meta.fix}</div>
        </div>
      </div>
    </div>
  );
}
