import { useState } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { closeWorkspace } from "@/lib/workspaceRequests";
import { useCheckNavigation } from "@/lib/navigationGuard";

export default function Settings() {
  const clerk = useClerk();
  const check = useCheckNavigation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const account = useQuery<{ environment: string; legacyOwnershipStatus: string }>({ queryKey: ["/api/account"] });
  const ownershipMessages: Record<string, string> = {
    setup_completed: "The original campaign ownership setup has completed. This is not a sign-in pairing failure.",
    already_claimed: "The original campaigns have already been claimed. This account has no administrator role; ownership cannot be reassigned automatically.",
    not_configured: "The running server has no owner email configured. Save CREATOR_GOOGLE_EMAIL for production and republish.",
    email_mismatch: "None of this account's email addresses matches the configured owner email. Check the owner setting against the signed-in account shown below, then republish.",
    email_unverified: "The owner email matches, but this account's email has not been verified by the sign-in provider.",
    eligible: "This account passes the owner check. Check again to retry the automatic ownership setup.",
  };
  async function erase(deleteLogin: boolean) {
    if (!await check()) return;
    if (!window.confirm(deleteLogin ?
      "Permanently delete ALL your campaigns, encounters, notes, transcripts, recordings and private homebrew, then delete your login account? This cannot be undone." :
      "Permanently delete ALL your workspace data? Your Google/Clerk login account will remain. This cannot be undone.")) return;
    setBusy(true); setError("");
    try {
      await apiRequest("DELETE", "/api/account/data");
      if (deleteLogin) {
        // User deletion is executed only after server-side workspace erasure succeeds.
        if (!clerk.user) throw new Error("Sign in again before deleting your account.");
        await clerk.user.delete();
        closeWorkspace();
        queryClient.clear();
        window.location.replace("/");
      } else window.location.replace("/campaigns");
    } catch {
      setError("Deletion did not finish. Retry before closing your account.");
      setBusy(false);
    }
  }
  return <main className="mx-auto max-w-2xl p-6 space-y-6">
    <h1 className="font-display text-3xl text-primary">Account & privacy</h1>
    <p>Your campaigns and session journal are private to your account. Google verifies your identity; it does not receive your campaign content through sign-in.</p>
    <Link href="/privacy" className="underline text-primary">Read the privacy notice</Link>
    <section className="space-y-3 rounded-lg border p-5">
      <h2 className="font-display text-xl">Campaign account pairing</h2>
      <p>Signed in as: {clerk.user?.primaryEmailAddress?.emailAddress ?? "Loading account…"}</p>
      {account.data && <p>Environment: {account.data.environment}. Preview and published accounts are separate.</p>}
      <p role="status">{account.isError ? "Could not check pairing. Try again." : account.data ?
        ownershipMessages[account.data.legacyOwnershipStatus] ?? "Pairing status unavailable. Refresh to load the latest version." : "Checking campaign ownership…"}</p>
      {account.data && <p className="text-sm text-muted-foreground">Status: {account.data.legacyOwnershipStatus}</p>}
      <Button variant="outline" disabled={account.isFetching} onClick={() => {
        void account.refetch();
        void queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      }}>Check pairing again</Button>
    </section>
    <section className="space-y-4 rounded-lg border border-destructive/40 p-5">
      <h2 className="font-display text-xl">Delete your data</h2>
      <p>Deletes campaigns, linked-resource selections, encounters, characters, private items, notes, imports, aliases and uploaded recordings. This does not delete Google's account or Google's own data. There is no full-session backup feature.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="destructive" disabled={busy} onClick={() => void erase(false)}>Delete workspace data</Button>
        <Button variant="outline" disabled={busy} onClick={() => void erase(true)}>Delete data and login account</Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
