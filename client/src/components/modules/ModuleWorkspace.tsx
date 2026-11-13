import { lazy, Suspense, useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useCampaign } from "@/lib/campaignContext";
import { useWorkspaceAccount } from "@/lib/workspaceAccount";
import "./modules.css";

const ModuleReader = lazy(() => import("./ModuleReader").then(module => ({ default: module.ModuleReader })));

export default function ModuleWorkspace({ children }: { children: ReactNode }) {
  const { activeCampaign, storageScope } = useCampaign();
  const account = useWorkspaceAccount();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(430);
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobileViewport(query.matches);
    update();
    query.addEventListener("change", update);
    const toggle = () => setOpen(value => !value);
    const show = () => setOpen(true);
    window.addEventListener("fatebound:module-toggle", toggle);
    window.addEventListener("fatebound:module-open", show);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("fatebound:module-toggle", toggle);
      window.removeEventListener("fatebound:module-open", show);
    };
  }, []);

  const resizeStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(max-width: 767px)").matches) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (pointerEvent: PointerEvent) => {
      setWidth(Math.max(320, Math.min(window.innerWidth * 0.7, startWidth + startX - pointerEvent.clientX)));
    };
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
  }, [width]);

  return (
    <div className="module-workspace-shell flex min-h-0 min-w-0 w-full flex-1">
      <div className="module-tool-pane min-h-0 min-w-0 flex-1">{children}</div>
      {open && !account.demo && !mobileViewport && (
        <aside className="module-desktop-pane shrink-0" style={{ width }} aria-label="Adventure reference">
          <button
            type="button"
            className="module-resize-handle"
            onPointerDown={resizeStart}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              if (event.key === "Home") { setWidth(320); return; }
              if (event.key === "End") { setWidth(Math.max(320, window.innerWidth * 0.7)); return; }
              const delta = event.key === "ArrowLeft" ? 24 : -24;
              setWidth(value => Math.max(320, Math.min(window.innerWidth * 0.7, value + delta)));
            }}
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuemax={Math.round(window.innerWidth * 0.7)}
            aria-valuenow={width}
            aria-label="Resize adventure reference pane"
            title="Drag to resize"
          />
          <Suspense fallback={<div role="status" className="p-4">Opening module reader…</div>}><ModuleReader
            key={`${storageScope}:${activeCampaign?.id ?? "none"}`}
            campaignId={activeCampaign?.id == null ? null : String(activeCampaign.id)}
            storageScope={storageScope}
            onClose={() => setOpen(false)}
            mobile={false}
          /></Suspense>
        </aside>
      )}
      {open && !account.demo && mobileViewport && (
        <div className="module-mobile-backdrop" role="presentation">
          <section className="module-mobile-dialog" role="dialog" aria-modal="true" aria-label="Adventure reference">
            <Suspense fallback={<div role="status" className="p-4">Opening module reader…</div>}><ModuleReader
              key={`${storageScope}:${activeCampaign?.id ?? "none"}`}
              campaignId={activeCampaign?.id == null ? null : String(activeCampaign.id)}
              storageScope={storageScope}
              onClose={() => setOpen(false)}
              mobile
            /></Suspense>
          </section>
        </div>
      )}
    </div>
  );
}
