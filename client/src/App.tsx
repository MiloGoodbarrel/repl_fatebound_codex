import { useEffect, useState, useRef } from "react";
import { Switch, Route, Redirect, Router as BrowserRouter, useLocation } from "wouter";
import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { AppearanceProvider } from "@/lib/appearance";
import { publishableKeyFromHost } from "@clerk/react/internal";
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
import { AuthPage, PrivacyPage, PublicLanding, clerkAppearance, clerkLocalization } from "@/components/AuthPages";
import Settings from "@/pages/Settings";
import { activateWorkspace, closeWorkspace } from "@/lib/workspaceRequests";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

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
    <div className="dm-workspace h-dvh flex flex-col overflow-hidden bg-background">
      <FeatureNavigation />
      <div className="min-h-0 flex-1 overflow-auto">
        {persistentFeatures.map(({ path, Component }) => (visited.includes(path) || location === path) && (
          <section key={path} aria-label={path.slice(1)} className="h-full overflow-auto" style={{ display: location === path ? "block" : "none" }}>
            <Component />
          </section>
        ))}
        {!persistent && <div className="h-full overflow-auto"><Switch>
          <Route path="/" ><Redirect to="/campaigns" /></Route>
          <Route path="/campaigns" component={Landing} />
          <Route path="/sessions" component={Sessions} />
          <Route path="/settings" component={Settings} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route component={NotFound} />
        </Switch></div>}
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { isLoaded, userId } = useAuth();
  const clerk = useClerk();
  const identity = useRef<string | null | undefined>(undefined);
  // All legacy fetch callers share the same guarded, cookie-based request transport.
  if (isLoaded && identity.current === undefined) {
    identity.current = userId ?? null;
    localStorage.removeItem("activeCampaign");
    queryClient.clear();
    activateWorkspace(userId ?? null);
  }
  useEffect(() => clerk.addListener(({ user }) => {
    if (identity.current !== undefined && (user?.id ?? null) !== identity.current) {
      closeWorkspace();
      void queryClient.cancelQueries();
      queryClient.clear();
      // Destroy old closures/autosave queues, not just their visible components.
      window.location.replace(basePath || "/");
    }
  }), [clerk]);
  if (!isLoaded) return <div className="p-8 text-center" role="status">Opening your codex…</div>;
  if (identity.current !== (userId ?? null)) {
    closeWorkspace();
    queryClient.clear();
    return <div className="p-8" role="status">Account changed. Reopening your workspace…</div>;
  }
  return <Switch>
    <Route path="/sign-in/*?"><AuthPage mode="sign-in" /></Route>
    <Route path="/sign-up/*?"><AuthPage mode="sign-up" /></Route>
    <Route path="/privacy"><PrivacyPage /></Route>
    <Route>
      {userId ? <AppearanceProvider key={userId} userId={userId}><CampaignProvider><Router /></CampaignProvider></AppearanceProvider> : <PublicLanding />}
    </Route>
  </Switch>;
}

function ClerkApp() {
  const [, navigate] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    routerPush={path => navigate(stripBase(path))}
    routerReplace={path => navigate(stripBase(path), { replace: true })}
    signInFallbackRedirectUrl={`${basePath}/campaigns`}
    signUpFallbackRedirectUrl={`${basePath}/campaigns`}
    appearance={clerkAppearance}
    localization={clerkLocalization}
  ><AuthenticatedApp /></ClerkProvider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <NavigationGuardProvider>
            <BrowserRouter hook={useGuardedLocation} base={basePath}>
              <ClerkApp />
            </BrowserRouter>
          </NavigationGuardProvider>
          <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
