import React, { createContext, useContext, useRef, useState } from "react";
import { createDemoState } from "./fixtures";
import { DEMO_STORAGE_KEY, parseDemoState, type DemoState } from "./model";

type DemoContextValue = {
  state: DemoState;
  update: (mutate: (draft: DemoState) => void) => boolean;
  reset: () => void;
  error: string;
  persistence: "browser" | "memory";
};
const Context = createContext<DemoContextValue | null>(null);
function initial() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return { state: raw ? parseDemoState(raw) : createDemoState(), error: "", persistent: true };
  } catch {
    return { state: createDemoState(), error: "Stored demo data could not be read. Starter data is running in memory only; Reset Demo to replace the unreadable demo snapshot. Real workspace data is unaffected.", persistent: false };
  }
}
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useState(initial);
  const [state, setState] = useState(loaded.state), [error, setError] = useState(loaded.error);
  const [persistent, setPersistent] = useState(loaded.persistent);
  const current = useRef(state), persistence = useRef(loaded.persistent);
  const save = (next: DemoState) => {
    if (persistence.current) {
      try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next)); }
      catch {
        persistence.current = false; setPersistent(false);
        setError("Browser storage is unavailable or full. Demo changes work in memory only and will be lost on reload. Real workspace data is unaffected.");
      }
    }
    current.current = next; setState(next);
  };
  const update = (mutate: (draft: DemoState) => void) => {
    try {
      const next = structuredClone(current.current); mutate(next);
      const valid = parseDemoState(JSON.stringify(next));
      if (persistence.current) setError("");
      save(valid); return true;
    } catch {
      setError("That change exceeds a demo limit or contains invalid values. The previous demo data is unchanged.");
      return false;
    }
  };
  const reset = () => {
    const next = createDemoState();
    persistence.current = true; setPersistent(true); setError("");
    save(next);
  };
  return <Context.Provider value={{ state, update, reset, error, persistence: persistent ? "browser" : "memory" }}>{children}</Context.Provider>;
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("Demo state is only available inside the isolated demo.");
  return value;
}
