import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PreparedEncounterNameDialog({ mode, initialName, onConfirm, onClose }: {
  mode: "rename" | "duplicate"; initialName: string;
  onConfirm: (name: string) => Promise<boolean>; onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{mode === "duplicate" ? "Duplicate prepared encounter" : "Rename prepared encounter"}</DialogTitle>
        <DialogDescription>{mode === "duplicate" ? "Create an independent saved roster. The original stays unchanged." : "Change the saved roster's name without changing its creatures."}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        try { if (await onConfirm(name.trim())) onClose(); }
        finally { setBusy(false); }
      }}>
        <Label htmlFor="prepared-encounter-dialog-name">Encounter name</Label>
        <Input id="prepared-encounter-dialog-name" autoFocus maxLength={150} value={name} onChange={e => setName(e.target.value)} disabled={busy} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : mode === "duplicate" ? "Create duplicate" : "Save name"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
