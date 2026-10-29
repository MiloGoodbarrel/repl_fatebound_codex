import React from "react";
import { Route, Router, Switch } from "wouter";
import { themeColors, hexToHsl } from "../../../shared/appearance";
import { DemoProvider, useDemo } from "./store";
import { DemoLayout } from "./DemoUi";
import { CampaignsPage, InitiativePage, LootPage, SessionsPage, SettingsPage, TablesPage } from "./DemoPages";
import "./demo.css";

function ThemedDemo({basePath=""}:{basePath?:string}) {
  const {state}=useDemo();
  const theme=themeColors(state.appearance);
  const style={
    "--demo-theme-bg":theme.background,
    "--demo-theme-fg":theme.foreground,
    "--demo-theme-card":theme.card,
    "--demo-theme-muted":theme.muted,
    "--demo-theme-primary":theme.primary,
    "--demo-theme-border":theme.border,
    "--demo-hsl-bg":hexToHsl(theme.background),
    "--demo-hsl-fg":hexToHsl(theme.foreground),
  } as React.CSSProperties & Record<string,string>;
  const base=`${basePath.replace(/\/$/,"")}/dev` || "/dev";
  return <div style={style}>
    <Router base={base}>
      <Switch>
        <Route path="/"><DemoLayout basePath={basePath} title="Campaigns"><CampaignsPage/></DemoLayout></Route>
        <Route path="/loot"><DemoLayout basePath={basePath} title="Loot"><LootPage/></DemoLayout></Route>
        <Route path="/tables"><DemoLayout basePath={basePath} title="Roll tables"><TablesPage/></DemoLayout></Route>
        <Route path="/initiative"><DemoLayout basePath={basePath} title="Initiative"><InitiativePage/></DemoLayout></Route>
        <Route path="/sessions"><DemoLayout basePath={basePath} title="Sessions"><SessionsPage/></DemoLayout></Route>
        <Route path="/settings"><DemoLayout basePath={basePath} title="Settings"><SettingsPage/></DemoLayout></Route>
        <Route><DemoLayout basePath={basePath} title="Not found"><div className="demo-empty"><h1>That demo page is not in the codex.</h1><p>Choose one of the demo tools above.</p></div></DemoLayout></Route>
      </Switch>
    </Router>
  </div>;
}

export default function DemoApp({basePath=""}:{basePath?:string}) {
  return <DemoProvider><ThemedDemo basePath={basePath}/></DemoProvider>;
}
