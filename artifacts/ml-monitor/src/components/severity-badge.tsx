import { Badge } from "@/components/ui/badge";

type Severity = "stable" | "warning" | "critical" | "healthy" | "degraded" | "normal" | "active" | "resolved" | "rolled_back" | "shadow";

export function SeverityBadge({ severity, className }: { severity: Severity | string, className?: string }) {
  let colorClass = "bg-muted text-muted-foreground";
  
  switch (severity) {
    case "stable":
    case "healthy":
    case "normal":
    case "active":
    case "resolved":
      colorClass = "bg-green-500/10 text-green-500 border-green-500/20";
      break;
    case "warning":
    case "degraded":
    case "shadow":
      colorClass = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      break;
    case "critical":
    case "rolled_back":
      colorClass = "bg-red-500/10 text-red-500 border-red-500/20";
      break;
  }

  return (
    <Badge variant="outline" className={`${colorClass} ${className} font-mono tracking-wider uppercase text-[10px]`}>
      {severity.replace("_", " ")}
    </Badge>
  );
}
