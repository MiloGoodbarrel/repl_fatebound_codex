import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useBrowserLocation, type BrowserLocationHook } from "wouter/use-browser-location";

type Blocker = () => Promise<boolean>;
type Location = ReturnType<BrowserLocationHook>;
interface GuardContext {
  location: Location;
  blocker: MutableRefObject<Blocker | null>;
}
const Context = createContext<GuardContext | null>(null);

/**
 * Keep the committed route mounted while any transition is being checked.
 * Unlike anchor-only handlers this also covers Back/Forward, pushState,
 * replaceState, and programmatic wouter navigation.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [browserPath, navigate] = useBrowserLocation();
  const [committedPath, setCommittedPath] = useState(browserPath);
  const committedUrl = useRef(window.location.pathname + window.location.search + window.location.hash);
  const blocker = useRef<Blocker | null>(null);
  const transition = useRef(0);
  useLayoutEffect(() => {
    const request = ++transition.current;
    if (browserPath === committedPath) return;
    const destination = window.location.pathname + window.location.search + window.location.hash;
    const check = blocker.current;
    if (!check) {
      committedUrl.current = destination;
      setCommittedPath(browserPath);
      return;
    }
    let active = true;
    Promise.resolve().then(check).catch(() => false).then(allowed => {
      if (!active || request !== transition.current) return;
      if (allowed) {
        committedUrl.current = destination;
        setCommittedPath(browserPath);
      } else {
        // popstate cannot be cancelled. Restore the URL while retaining the old
        // workspace and its recoverable in-memory draft; never unmount it first.
        navigate(committedUrl.current, { replace: true });
      }
    });
    return () => { active = false; };
  }, [browserPath, committedPath, navigate]);
  const value = useMemo<GuardContext>(() => ({ location: [committedPath, navigate], blocker }), [committedPath, navigate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Router hook: all wouter consumers observe the same committed route. */
export const useGuardedLocation: BrowserLocationHook = () => {
  const context = useContext(Context);
  if (!context) throw new Error("Guarded routes require NavigationGuardProvider.");
  return context.location;
};

export function useNavigationBlocker(check: Blocker) {
  const context = useContext(Context);
  if (!context) throw new Error("Journal navigation requires NavigationGuardProvider.");
  const latest = useRef(check);
  latest.current = check;
  const blocker = context.blocker;
  useLayoutEffect(() => {
    const current = () => latest.current();
    blocker.current = current;
    return () => { if (blocker.current === current) blocker.current = null; };
  }, [blocker]);
}
