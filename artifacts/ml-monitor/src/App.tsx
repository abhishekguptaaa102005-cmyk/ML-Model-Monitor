import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import DriftPage from "@/pages/drift";
import LatencyPage from "@/pages/latency";
import AlertsPage from "@/pages/alerts";
import FeaturesPage from "@/pages/features";
import ModelsPage from "@/pages/models";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/drift" component={DriftPage} />
      <Route path="/latency" component={LatencyPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/models" component={ModelsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
