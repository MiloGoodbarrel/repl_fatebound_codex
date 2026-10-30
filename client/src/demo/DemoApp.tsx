import { useLayoutEffect, useState } from "react";
import { Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceRouter } from "@/App";
import { AppearanceProvider } from "@/lib/appearance";
import { CampaignProvider } from "@/lib/campaignContext";
import { NavigationGuardProvider, useGuardedLocation } from "@/lib/navigationGuard";
import { queryClient } from "@/lib/queryClient";
import { WorkspaceAccountContext } from "@/lib/workspaceAccount";
import { Button } from "@/components/ui/button";
import { WorkspaceDemoApi, installDemoTransport } from "./workspaceApi";

function DemoWorkspace({ api, error }: { api: WorkspaceDemoApi; error: string }) {
  const [generation, setGeneration] = useState(0);
  const [resetError, setResetError] = useState("");
  const reset = async () => {
    if (!window.confirm("Reset all fictional demo data and unsaved demo edits in this browser? Real campaigns and other browser data are unchanged.")) return;
    try {
      await api.reset();
      await queryClient.cancelQueries();
      queryClient.clear();
      setResetError(""); setGeneration(g => g + 1);
    } catch { setResetError("Could not reset browser storage. Check this browser's storage permissions."); }
  };
  if (error) return <main className="mx-auto max-w-xl space-y-4 p-8">
    <h1 className="font-display text-2xl">Demo storage needs attention</h1>
    <p role="alert">{error}</p>
    <p>No real campaign data was accessed. Reset only this demo's browser data to recover.</p>
    {resetError && <p role="alert">{resetError}</p>}
    <Button onClick={() => void reset()}>Reset demo</Button>
  </main>;
  return <WorkspaceAccountContext.Provider value={{
    demo: true, email: "Fictional demo visitor — no login",
    signOut: async () => { window.location.assign("/"); },
    deleteLogin: async () => { throw new Error("Real account deletion is unavailable in the demo."); },
  }}>
    <AppearanceProvider key={generation} userId="browser-only-demo">
      <CampaignProvider scope="demo:v3">
        <WorkspaceRouter banner={<aside aria-label="Public demo notice" className="shrink-0 border-b border-primary/30 bg-card px-3 py-2 text-xs text-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p><strong>Public demo · real app screens</strong> — Lost Mine of Phandelver sample, level-one pregens and the full shared stock library. Demo changes save only in this browser. Uploads, account changes and paid AI are blocked.</p>
            <Button size="sm" variant="outline" onClick={() => void reset()}>Reset demo</Button>
          </div>
          <p className="text-muted-foreground">Adventure spoilers and DM prep, not completed play. Advance the party before later encounters. Real campaigns stay private; stock sources are read-only. Sign out exits. Use fictional text only.</p>
          {(error || resetError) && <p role="alert" className="mt-1 text-destructive">{resetError || error} Changes cannot be saved until storage is restored or reset.</p>}
        </aside>} />
      </CampaignProvider>
    </AppearanceProvider>
  </WorkspaceAccountContext.Provider>;
}

/** Real screens + fail-closed local API. No Clerk provider, session, or private network transport. */
export default function DemoApp({ basePath = "" }: { basePath?: string }) {
  const [error, setError] = useState("");
  const [api] = useState(() => new WorkspaceDemoApi({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
  }, setError));
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    queryClient.clear();
    const uninstall = installDemoTransport(api);
    setError(api.error); setReady(true);
    return () => { uninstall(); queryClient.clear(); };
  }, [api]);
  if (!ready) return <div role="status" className="p-8">Opening the fictional workspace…</div>;
  return <QueryClientProvider client={queryClient}>
    <NavigationGuardProvider>
      <Router hook={useGuardedLocation} base={`${basePath.replace(/\/$/, "")}/dev`}>
        <DemoWorkspace api={api} error={error} />
      </Router>
    </NavigationGuardProvider>
  </QueryClientProvider>;
}
