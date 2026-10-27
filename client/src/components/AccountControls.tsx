import { Link } from "wouter";
import { LogOut, Settings2, ShieldCheck } from "lucide-react";
import { useState } from "react";

type AccountControlsProps = {
  onSignOut: () => Promise<void>;
  busy?: boolean;
};

export function AccountControls({ onSignOut, busy = false }: AccountControlsProps) {
  const [signOutError, setSignOutError] = useState("");
  const [pending, setPending] = useState(false);
  const isBusy = busy || pending;

  async function handleSignOut() {
    if (isBusy) return;
    setSignOutError("");
    setPending(true);
    try {
      await onSignOut();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card/50 p-1">
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Settings2 aria-hidden="true" className="size-4" />
        </Link>
        <Link
          href="/privacy"
          aria-label="Privacy information"
          title="Privacy"
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ShieldCheck aria-hidden="true" className="size-4" />
        </Link>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isBusy}
        aria-label={isBusy ? "Signing out" : "Sign out"}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/80 px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-card/70 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{isBusy ? "Signing out" : "Sign out"}</span>
      </button>
      {signOutError && <span role="alert" className="sr-only">{signOutError}</span>}
    </div>
  );
}
