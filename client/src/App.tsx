import { useEffect, useState } from "react";
import { Switch, Route, Router as BrowserRouter, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CampaignProvider } from "@/lib/campaignContext";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import InitiativeTracker from "@/pages/InitiativeTracker";
import RollTables from "@/pages/RollTables";
import NotFound from "@/pages/not-found";
import Sessions from "@/pages/Sessions";
import { NavigationGuardProvider, useGuardedLocation } from "@/lib/navigationGuard";
import FeatureNavigation from "@/components/FeatureNavigation";

const persistentFeatures = [
  { path: "/loot", Component: Home },
  { path: "/tables", Component: RollTables },
  { path: "/initiative", Component: InitiativeTracker },
];

function Router() {
  const [location] = useLocation();
  const [visited, setVisited] = useState<string[]>([]);
  const persistent = persistentFeatures.some(feature => feature.path === location);
  useEffect(() => {
    if (persistent) setVisited(previous => previous.includes(location) ? previous : [...previous, location]);
  }, [location, persistent]);

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <FeatureNavigation />
      <div className="min-h-0 flex-1 overflow-auto">
        {persistentFeatures.map(({ path, Component }) => (visited.includes(path) || location === path) && (
          <section key={path} aria-label={path.slice(1)} className="h-full overflow-auto" style={{ display: location === path ? "block" : "none" }}>
            <Component />
          </section>
        ))}
        {!persistent && <div className="h-full overflow-auto"><Switch>
          <Route path="/" component={Landing} />
          <Route path="/sessions" component={Sessions} />
          <Route component={NotFound} />
        </Switch></div>}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CampaignProvider>
          <NavigationGuardProvider>
            <BrowserRouter hook={useGuardedLocation}>
              <Router />
            </BrowserRouter>
          </NavigationGuardProvider>
          <Toaster />
        </CampaignProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
