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
    what: "The input data has shifted from what the model was trained on — patterns in the real world changed.",
    why: "Models are only as good as their training data. If the data feeding in no longer matches, predictions start to miss the mark.",
    fix: "Compare recent feature distributions against training data. If drift persists, retrain on fresh data.",
  },
  latency: {
    icon: Zap,
    what: "Prediction requests are taking too long — over the 500ms target.",
    why: "Users feel the lag, requests may time out, and slow responses can cascade into bigger issues at scale.",
    fix: "Check server CPU and memory. Look for cold-start issues or resource contention. Adjust batch sizes or scale out.",
  },
  null_rate: {
    icon: Database,
    what: "A feature has way more missing values than usual.",
    why: "Models don't handle nulls well. This usually points to an upstream data pipeline problem.",
    fix: "Trace the feature back to its source. Check if a recent deploy changed how nulls are handled, or if a source is down.",
  },
  schema_mismatch: {
    icon: AlertCircle,
    what: "A feature arrived in an unexpected format — different from what the model expects.",
    why: "Schema mismatches can silently produce wrong predictions or cause the model to throw errors.",
    fix: "Find which upstream system changed the schema. Roll back the change or update your preprocessing pipeline.",
  },
  prediction_skew: {
    icon: BarChart2,
    what: "Model outputs are shifting toward different values than expected.",
    why: "Users may get systematically wrong answers. This is often a downstream symptom of upstream data drift.",
    fix: "Check which features are driving the shift. If PSI is above 0.25, roll back to the previous model version while investigating.",
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
