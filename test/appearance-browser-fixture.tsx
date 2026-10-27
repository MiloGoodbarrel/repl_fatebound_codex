// Isolated test harness; never imported into the application.
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {AppearanceProvider} from "../client/src/lib/appearance";
import AppearanceSettings from "../client/src/components/AppearanceSettings";
function StateProbe() {
  const [turn,setTurn]=useState(1),[draft,setDraft]=useState("");
  return <div><button onClick={()=>setTurn(x=>x+1)}>Advance sample turn {turn}</button>
    <label>Sample journal draft<input value={draft} onChange={e=>setDraft(e.target.value)}/></label></div>;
}
const root=createRoot(document.getElementById("root")!);
(window as any).renderAccount=(userId:string)=>root.render(<AppearanceProvider key={userId} userId={userId}>
  <main className="dm-workspace mx-auto min-h-screen max-w-2xl bg-background p-4 text-foreground">
    <StateProbe/><AppearanceSettings/>
  </main>
</AppearanceProvider>);
(window as any).renderAccount("alice");
