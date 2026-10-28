// Recording-only entry. Never imported by the app or served by its workflow.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import { CampaignProvider, useCampaign } from "../../client/src/lib/campaignContext";
import { NavigationGuardProvider } from "../../client/src/lib/navigationGuard";
import { AppearanceProvider } from "../../client/src/lib/appearance";
import { TooltipProvider } from "../../client/src/components/ui/tooltip";
import Landing from "../../client/src/pages/Landing";
import Initiative from "../../client/src/pages/InitiativeTracker";
import Loot from "../../client/src/pages/Home";
import Tables from "../../client/src/pages/RollTables";
import Sessions from "../../client/src/pages/Sessions";
import Appearance from "../../client/src/components/AppearanceSettings";

const pages = { Campaigns: Landing, Initiative, Loot, "Roll Tables": Tables, Sessions, Appearance };
function Reel() {
  const [tab, setTab] = useState<keyof typeof pages>("Campaigns");
  const [caption, setCaption] = useState({ number: "01 / 06", title: "Your next adventure starts here.", detail: "Campaigns, combat, loot and session notes in one DM workspace." });
  const [card, setCard] = useState<"intro" | "outro" | null>("intro");
  const { activeCampaign } = useCampaign();
  useEffect(() => {
    Object.assign(window, {
      reelCaption: (next: typeof caption) => setCaption(next),
      reelCard: (value: typeof card) => setCard(value),
    });
  }, []);
  return <div className="dm-workspace bg-background text-foreground" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <header className="reel-nav">
      <strong className="font-display text-primary" style={{ letterSpacing: ".10em", fontSize: 20 }}>FATEBOUND CODEX</strong>
      <nav>{Object.keys(pages).map(name => <button key={name} data-tab={name} onClick={() => setTab(name as keyof typeof pages)} className={tab === name ? "selected" : ""}>{name}</button>)}</nav>
      <span style={{ fontSize: 12, opacity: .65 }}>{activeCampaign?.name ?? "DM WORKSPACE"}</span>
    </header>
    <main style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
      {(() => { const Component = pages[tab]; return <section key={tab} style={{ height: "100%", overflow: "auto" }}>
        {tab === "Appearance" ? <div style={{ maxWidth: 1080, margin: "0 auto", padding: 28 }}><Component /></div> : <Component />}
      </section>; })()}
    </main>
    <footer className="reel-caption"><div className="reel-number">{caption.number}</div><div><h1>{caption.title}</h1><p>{caption.detail}</p></div><small>DEMO · FICTIONAL DATA</small></footer>
    {card && <div className="reel-title"><div className="reel-mark">✧</div><p className="reel-eyebrow">YOUR TABLE. YOUR STORIES.</p><h1 className="font-display">Fatebound Codex</h1><div className="reel-rule" /><h2>{card === "intro" ? "Less juggling. More adventure." : "Prepare. Play. Remember."}</h2><p>{card === "intro" ? "A workspace built for the Dungeon Master." : "Campaigns · Combat · Loot · Journals · Skins"}</p><small>{card === "intro" ? "FEATURE TOUR" : "DEMO FOOTAGE · FICTIONAL CAMPAIGNS"}</small></div>}
  </div>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><TooltipProvider><NavigationGuardProvider>
    <AppearanceProvider userId="demo-only"><CampaignProvider><Reel /></CampaignProvider></AppearanceProvider>
  </NavigationGuardProvider></TooltipProvider></QueryClientProvider>
);
