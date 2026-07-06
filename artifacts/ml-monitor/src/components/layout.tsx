import { FC, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, AlertTriangle, Box, GitMerge, LayoutDashboard, Database } from "lucide-react";

export const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/drift", label: "Drift Analysis", icon: GitMerge },
    { href: "/latency", label: "Latency", icon: Activity },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    { href: "/features", label: "Features", icon: Database },
    { href: "/models", label: "Models", icon: Box },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 font-mono font-bold tracking-tight text-primary">
            <Activity className="h-5 w-5" />
            <span>ML_MONITOR</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground font-mono">System: Nominal</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};
