// Isolated browser fixture. This file is never imported by production code.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import SessionSummary from "../client/src/components/journal/SessionSummary";

function Fixture() {
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [revisionKey, setRevisionKey] = useState("initial");
  (window as any).refreshSources = () => setRevisionKey(String(Date.now()));
  return <main className="dm-workspace mx-auto min-h-screen max-w-6xl bg-background p-4 text-foreground">
    <header className="mb-4 flex justify-between border-b border-border pb-3">
      <strong className="font-display text-primary">The Lantern Coast · Journal</strong>
      <span role="status">{dirty ? "Unsaved summary draft" : busy ? "Saving summary" : "No unsaved summary changes"}</span>
    </header>
    <SessionSummary campaignId={1} sessionId="demo-session" sourceRevisionKey={revisionKey} onUnsavedChange={(a, b) => { setDirty(a); setBusy(b); }} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
