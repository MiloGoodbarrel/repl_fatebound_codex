import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_APPEARANCE, normalizeAppearance, appearanceSchema, skins, themeColors, hexToHsl, type Appearance } from "@shared/appearance";

type AppearanceContextValue = {
  appearance: Appearance; ready: boolean; saving: boolean; error: string; dirty: boolean;
  choose: (appearance: Appearance) => void; retry: () => void;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function applyAppearance(appearance: Appearance) {
  const root=document.documentElement,skin=skins.find(s=>s.id===appearance.skin)!;
  root.dataset.skin=skin.id;
  root.dataset.mode=appearance.mode;
  root.dataset.motif=skin.motif;
  root.classList.toggle("dark",appearance.mode==="dark");
  root.classList.toggle("light",appearance.mode==="light");
  root.style.colorScheme=appearance.mode;
  const colors=themeColors(appearance);
  for(const [key,value] of Object.entries(colors)) {
    // Keep every original Classic Dark token exactly as it was.
    if(skin.id==="classic"&&appearance.mode==="dark") root.style.removeProperty(`--${key}`);
    else root.style.setProperty(`--${key}`,hexToHsl(value));
  }
  root.style.setProperty("--font-body",skin.id==="illuskian"?"'Inter', sans-serif":"'Lato', sans-serif");
}
export function resetAppearance() { applyAppearance({...DEFAULT_APPEARANCE}); }

export function AppearanceProvider({userId,children}:{userId:string;children:React.ReactNode}) {
  const [appearance,setAppearance]=useState<Appearance>({...DEFAULT_APPEARANCE});
  const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[dirty,setDirty]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const alive=useRef(true);
  const busy=useRef(false);
  async function load() {
    const controller=new AbortController(); pending.current?.abort(); pending.current=controller;
    setError("");
    try {
      const res=await fetch("/api/account/appearance",{credentials:"include",signal:controller.signal});
      if(!res.ok) throw new Error("load");
      const data=normalizeAppearance(await res.json());
      if(controller.signal.aborted||!alive.current) return;
      setAppearance(data); setReady(true); setDirty(false);
    } catch {
      if(!controller.signal.aborted&&alive.current) setError("Could not load your appearance. Retry before making changes.");
    }
  }
  useEffect(()=>{
    alive.current=true;
    void load();
    return ()=>{alive.current=false;pending.current?.abort();resetAppearance();};
  },[userId]);
  useLayoutEffect(()=>{applyAppearance(appearance);},[appearance]);
  async function save(next: Appearance) {
    if(!ready||busy.current) return;
    busy.current=true;
    setAppearance(next); setSaving(true); setDirty(true); setError("");
    const controller=new AbortController(); pending.current?.abort(); pending.current=controller;
    try {
      const res=await fetch("/api/account/appearance",{
        method:"PUT",credentials:"include",signal:controller.signal,
        headers:{"Content-Type":"application/json"},body:JSON.stringify(next),
      });
      if(!res.ok) throw new Error("save");
      const confirmed=appearanceSchema.parse(await res.json());
      if(controller.signal.aborted||!alive.current) return;
      setAppearance(confirmed); setDirty(false);
    } catch {
      if(!controller.signal.aborted&&alive.current) setError("Appearance is previewed but was not saved. Retry to keep it across devices.");
    } finally {
      busy.current=false;
      if(alive.current&&!controller.signal.aborted) setSaving(false);
    }
  }
  return <AppearanceContext.Provider value={{
    appearance,ready,saving,error,dirty,
    choose:next=>void save(next),retry:()=>void(ready?save(appearance):load()),
  }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance() {
  const context=useContext(AppearanceContext);
  if(!context) throw new Error("Appearance requires a signed-in workspace.");
  return context;
}
