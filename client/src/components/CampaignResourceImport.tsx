import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign, CampaignItem, CampaignHomebrewMonster } from "@shared/schema";
import { resourceNameKey, type ResourceLinkResult, type LinkedResource } from "@shared/campaignResources";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Libraries = {
  items: CampaignItem[];
  npcs: Pick<CampaignHomebrewMonster, "id" | "name" | "creatureType" | "profileData">[];
  links: LinkedResource[];
};
type Kind = "items" | "npcs";

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Could not load campaign resources");
  return result;
}

export default function CampaignResourceImport({ target, campaigns, onClose }: {
  target: Campaign; campaigns: Campaign[]; onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<Kind, number[]>>({ items: [], npcs: [] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const sources = campaigns.filter(campaign => campaign.id !== target.id);
  const source = useQuery<Libraries>({
    queryKey: ["/api/campaigns", Number(sourceId), "resources"],
    queryFn: () => requestJson(`/api/campaigns/${sourceId}/resources`),
    enabled: !!sourceId,
    refetchInterval: 15_000,
  });
  const destination = useQuery<Libraries>({
    queryKey: ["/api/campaigns", target.id, "resources"],
    queryFn: () => requestJson(`/api/campaigns/${target.id}/resources`),
    refetchInterval: 15_000,
  });
  const count = selected.items.length + selected.npcs.length;
  const mutation = useMutation<ResourceLinkResult, Error>({
    mutationFn: () => requestJson(`/api/campaigns/${target.id}/resources/links`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCampaignId: Number(sourceId), itemIds: selected.items, npcIds: selected.npcs }),
    }),
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", target.id] });
      const existing = result.existingItems + result.existingNpcs;
      toast({
        title: "Resources linked",
        description: `${result.linkedItems} items and ${result.linkedNpcs} NPCs/creatures linked to ${target.name}.${existing ? ` ${existing} were already linked.` : ""}`,
      });
      setSelected({ items: [], npcs: [] });
    },
  });
  const unlink = useMutation({
    mutationFn: (id: number) => requestJson(`/api/campaigns/${target.id}/resources/links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", target.id] });
      toast({ title: "Link removed", description: "The source resource is unchanged." });
    },
  });
  const busy = mutation.isPending || unlink.isPending;
  const toggle = (kind: Kind, id: number, checked: boolean) => {
    setSelected(current => ({ ...current, [kind]: checked
      ? Array.from(new Set([...current[kind], id])) : current[kind].filter(value => value !== id) }));
  };
  const failed = source.isError || destination.isError;

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto" data-testid="dialog-link-resources">
        <DialogHeader>
          <DialogTitle>Linked resources for {target.name}</DialogTitle>
          <DialogDescription>
            Use source items and NPCs/creatures without copying them. Source edits update the linked library;
            existing encounter runs keep their combat state. Encounters, parties, combat saves, and loot/roll tables are not linked.
          </DialogDescription>
        </DialogHeader>
        {destination.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading existing links…</p>}
        {destination.isError && <p role="alert" className="text-sm text-destructive">{destination.error.message}</p>}
        {destination.data && (
          <section className="rounded-lg border p-3 space-y-2">
            <h3 className="text-sm font-semibold">Currently linked ({destination.data.links.length})</h3>
            <p className="text-xs text-muted-foreground">Edit resources in their source campaign. Removing a link never deletes the original. Deleting a source resource removes its links.</p>
            {!destination.data.links.length && <p className="text-sm text-muted-foreground">No linked resources yet.</p>}
            <div className="max-h-44 overflow-y-auto space-y-2">
              {destination.data.links.map(link => (
                <div key={link.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium break-words">{link.name}</p>
                    <p className="text-xs text-muted-foreground">{link.kind === "items" ? "Item" : "NPC/creature"} · Linked from {link.sourceCampaignName}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} aria-label={`Unlink ${link.name}`}
                    onClick={() => unlink.mutate(link.id)}>Unlink</Button>
                </div>
              ))}
            </div>
            {unlink.isError && <p role="alert" className="text-sm text-destructive">{unlink.error.message}</p>}
          </section>
        )}
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create another campaign first to link its resources.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resource-source">Link from campaign</Label>
              <Select value={sourceId} disabled={busy} onValueChange={value => {
                setSourceId(value); setSelected({ items: [], npcs: [] }); setSearch(""); mutation.reset();
              }}>
                <SelectTrigger id="resource-source" data-testid="select-resource-source">
                  <SelectValue placeholder="Choose a source campaign" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(campaign => <SelectItem key={campaign.id} value={String(campaign.id)}>{campaign.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {sourceId && (
              <>
                {(source.isLoading || destination.isLoading) && <p role="status" className="text-sm text-muted-foreground">Loading resources…</p>}
                {failed && (
                  <div role="alert" className="text-sm text-destructive space-y-2">
                    <p>{source.error?.message || destination.error?.message}</p>
                    <Button variant="outline" size="sm" onClick={() => { source.refetch(); destination.refetch(); }}>Retry</Button>
                  </div>
                )}
                {source.data && destination.data && !failed && (
                  <>
                    <Input aria-label="Search resources" placeholder="Search items and NPCs…" value={search}
                      disabled={busy} onChange={event => setSearch(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Choose source-owned originals. Already-linked resources are unavailable. No records are copied or overwritten.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(["items", "npcs"] as const).map(kind => {
                        const existingIds = new Set(destination.data!.links.filter(link => link.kind === kind).map(link => link.resourceId));
                        const visible = source.data![kind].filter(row => resourceNameKey(row.name).includes(resourceNameKey(search)));
                        const available = visible.filter(row => !existingIds.has(row.id));
                        const allSelected = available.length > 0 && available.every(row => selected[kind].includes(row.id));
                        return (
                          <section key={kind} className="rounded-lg border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm">{kind === "items" ? "Items" : "NPCs & creatures"} ({selected[kind].length})</h3>
                              <Button size="sm" variant="ghost" disabled={!available.length || busy}
                                onClick={() => setSelected(current => ({ ...current, [kind]: allSelected
                                  ? current[kind].filter(id => !available.some(row => row.id === id))
                                  : Array.from(new Set([...current[kind], ...available.map(row => row.id)])) }))}>
                                {allSelected ? "Clear visible" : "Select visible"}
                              </Button>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {!visible.length && <p className="text-sm text-muted-foreground">{source.data![kind].length ? "No matches." : "No resources in this library."}</p>}
                              {visible.map(row => {
                                const exists = existingIds.has(row.id);
                                const labelId = `link-${kind}-${row.id}`;
                                return (
                                  <label key={row.id} htmlFor={labelId} className={`flex items-start gap-2 rounded p-2 hover:bg-muted/40 ${exists ? "opacity-60" : "cursor-pointer"}`}>
                                    <Checkbox id={labelId} disabled={exists || busy}
                                      checked={selected[kind].includes(row.id)}
                                      onCheckedChange={checked => toggle(kind, row.id, checked === true)} />
                                    <span className="text-sm leading-tight">
                                      {row.name}
                                      <span className="block text-xs text-muted-foreground mt-1">
                                        {exists ? "Already linked" : "rarity" in row
                                          ? `${row.rarity} · ${row.category}`
                                          : `${row.profileData?.disposition?.stance ?? "NPC/creature"}${row.creatureType ? ` · ${row.creatureType}` : ""}`}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
          <Button disabled={!count || failed || destination.isLoading || source.isLoading || busy}
            onClick={() => mutation.mutate()} data-testid="button-confirm-link-resources">
            {mutation.isPending ? "Linking…" : `Link selected (${count})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
