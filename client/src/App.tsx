import { Switch, Route, Router as BrowserRouter } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/loot" component={Home} />
      <Route path="/initiative" component={InitiativeTracker} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/tables" component={RollTables} />
      <Route component={NotFound} />
    </Switch>
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
