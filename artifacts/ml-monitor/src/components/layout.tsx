import { FC, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, AlertTriangle, Box, GitMerge,
  LayoutDashboard, Database, ShieldCheck, Radio
} from "lucide-react";

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
      <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Radio className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ML Monitor</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-0.5">
          <Link href="/admin">
            <div className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
              location === "/admin"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}>
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Admin
            </div>
          </Link>
          <div className="px-3 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-muted-foreground">System nominal</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
