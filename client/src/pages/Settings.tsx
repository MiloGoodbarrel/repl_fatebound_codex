import { useState } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { closeWorkspace } from "@/lib/workspaceRequests";
import { useCheckNavigation } from "@/lib/navigationGuard";

export default function Settings() {
  const clerk = useClerk();
  const check = useCheckNavigation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
