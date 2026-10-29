// Isolated test entry, never imported or served by the application.
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../client/src/lib/queryClient";
import { CampaignProvider, useCampaign } from "../client/src/lib/campaignContext";
import { NavigationGuardProvider } from "../client/src/lib/navigationGuard";
import { TooltipProvider } from "../client/src/components/ui/tooltip";
import Sessions from "../client/src/pages/Sessions";

function Shell() {
  const { activeCampaign, setActiveCampaign } = useCampaign();
  React.useEffect(() => {
    if (!activeCampaign) setActiveCampaign({ id: 1, name: "The Lantern Coast", edition: "5e" } as any);
  }, []);
  return <>
    <div className="flex items-center gap-3 bg-card p-2 text-sm">
      <span aria-label="Selected test campaign">Selected: {activeCampaign?.name ?? "None"}</span>
      <button onClick={() => setActiveCampaign({ id: 2, name: "The Glass March", edition: "5e" } as any)}>Select another campaign</button>
    </div>
    <Sessions />
  </>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><TooltipProvider>
    <CampaignProvider><NavigationGuardProvider><Shell /></NavigationGuardProvider></CampaignProvider>
  </TooltipProvider></QueryClientProvider>,
);
