import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Sparkles, Swords, Plus, Trash2, ChevronRight, Dices,
  Scroll, Shield, BookOpen, ChevronDown, ChevronUp, CircleDot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaign } from "@/lib/campaignContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CampaignResourceImport from "@/components/CampaignResourceImport";

const EDITIONS = [
  { value: "5e",     label: "D&D 5e (2014)" },
  { value: "onednd", label: "One D&D (2024)" },
  { value: "4e",     label: "D&D 4th Edition" },
  { value: "3.5e",   label: "D&D 3.5 Edition" },
  { value: "3e",     label: "D&D 3rd Edition" },
  { value: "adnd",   label: "AD&D 2nd Edition" },
];

export default function Landing() {
  const { activeCampaign, setActiveCampaign } = useCampaign();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [campaignOpen, setCampaignOpen] = useState(!!activeCampaign);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEdition, setNewEdition] = useState("5e");
  const [newDescription, setNewDescription] = useState("");
  const [importTarget, setImportTarget] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; edition: string; description?: string }) =>
      fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (campaign: Campaign) => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setActiveCampaign(campaign);
      setShowCreate(false);
      setNewName("");
      setNewEdition("5e");
      setNewDescription("");
      toast({ title: "Campaign created!", description: `"${campaign.name}" is now active.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to create campaign.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/campaigns/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      if (activeCampaign?.id === id) setActiveCampaign(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete campaign.", variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), edition: newEdition, description: newDescription.trim() || undefined });
  };

  return (
    <div className="min-h-full bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="max-w-4xl w-full relative z-10 space-y-10">

        {/* Title */}
        <div className="text-center space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-display font-bold text-primary tracking-tight"
          >
            D&D DM Toolkit
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground font-serif italic"
          >
            "Tools for the Master of Dungeons"
          </motion.p>
        </div>

        {/* Tool Cards — always the primary action */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Link href="/loot">
              <Card className="group cursor-pointer hover-elevate transition-all duration-300 border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-display font-bold">Deck of Loot</h2>
                    <p className="text-muted-foreground font-serif text-sm">
                      Draw magical artifacts, weapons, and wondrous items.
                    </p>
                  </div>
                  {activeCampaign ? (
                    <p className="text-xs text-primary/80 font-mono flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-full">
                      <BookOpen className="w-3 h-3" /> {activeCampaign.name} homebrew active
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 font-mono">Drawing from 5e compendium</p>
                  )}
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground gap-2" data-testid="link-deck-of-loot">
                    Enter the Archives <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Link href="/tables">
              <Card className="group cursor-pointer hover-elevate transition-all duration-300 border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Dices className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-display font-bold">Roll Tables</h2>
                    <p className="text-muted-foreground font-serif text-sm">
                      Summon NPCs, places, events, and story sparks.
                    </p>
                  </div>
                  {activeCampaign ? (
                    <p className="text-xs text-primary/80 font-mono flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-full">
                      <BookOpen className="w-3 h-3" /> {activeCampaign.name} tables active
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 font-mono">Stock tables ready to draw</p>
                  )}
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground gap-2" data-testid="link-roll-tables">
                    Open the Tables <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <Link href="/initiative">
              <Card className="group cursor-pointer hover-elevate transition-all duration-300 border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Swords className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-display font-bold">Initiative Tracker</h2>
                    <p className="text-muted-foreground font-serif text-sm">
                      Manage combat order, track HP, and keep the battle flowing.
                    </p>
                  </div>
                  {activeCampaign ? (
                    <p className="text-xs text-primary/80 font-mono flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-full">
                      <Shield className="w-3 h-3" /> {activeCampaign.name} party loaded
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 font-mono">No campaign — one-off session</p>
                  )}
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground gap-2" data-testid="link-initiative-tracker">
                    Start Combat <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* Campaign Section — optional, collapsible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {/* Collapsible header */}
          <button
            onClick={() => setCampaignOpen(v => !v)}
            data-testid="button-toggle-campaigns"
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Scroll className="w-4 h-4 text-primary/70 group-hover:text-primary transition-colors" />
              <span className="font-display font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                Campaigns
                <span className="ml-2 text-xs font-normal font-sans text-muted-foreground">— optional, for persistent play</span>
              </span>
              {activeCampaign && (
                <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-mono">
                  <CircleDot className="w-2.5 h-2.5" /> {activeCampaign.name}
                </span>
              )}
            </div>
            {campaignOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {campaignOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">

                  {/* Explainer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                    <p className="text-sm text-muted-foreground">
                      Create a campaign to persist your <strong className="text-foreground/80">party roster</strong> and <strong className="text-foreground/80">homebrew items</strong> across sessions. Without one, the tools still work — you just start fresh each time.
                    </p>
                    {activeCampaign && <Link href="/sessions" className="inline-flex shrink-0 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20">
                      <BookOpen className="h-4 w-4" /> Campaign journal <ChevronRight className="h-4 w-4" />
                    </Link>}
                  </div>

                  {/* Create button row */}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreate(v => !v)}
                      data-testid="button-new-campaign"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      New Campaign
                    </Button>
                  </div>

                  {/* Create Form */}
                  <AnimatePresence>
                    {showCreate && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-lg border border-primary/30 bg-card/60 space-y-4">
                          <h3 className="font-display font-semibold text-primary">New Campaign</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label>Campaign Name</Label>
                              <Input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Curse of Strahd"
                                onKeyDown={e => e.key === "Enter" && handleCreate()}
                                data-testid="input-campaign-name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Edition</Label>
                              <Select value={newEdition} onValueChange={setNewEdition}>
                                <SelectTrigger data-testid="select-campaign-edition">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EDITIONS.map(e => (
                                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                              value={newDescription}
                              onChange={e => setNewDescription(e.target.value)}
                              placeholder="A short description of this campaign..."
                              data-testid="input-campaign-description"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button
                              size="sm"
                              onClick={handleCreate}
                              disabled={!newName.trim() || createMutation.isPending}
                              data-testid="button-create-campaign"
                            >
                              {createMutation.isPending ? "Creating..." : "Create Campaign"}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Campaign List */}
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">Loading campaigns...</p>
                  ) : campaigns.length === 0 && !showCreate ? (
                    <div className="text-center py-6 border border-dashed border-border/40 rounded-lg">
                      <p className="text-sm text-muted-foreground italic">No campaigns yet.</p>
                    </div>
                  ) : campaigns.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {campaigns.map(campaign => {
                        const isActive = activeCampaign?.id === campaign.id;
                        return (
                          <div
                            key={campaign.id}
                            data-testid={`card-campaign-${campaign.id}`}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                              isActive
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card/50 hover:border-primary/40"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-display font-semibold truncate">{campaign.name}</p>
                                {isActive && (
                                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono shrink-0">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {EDITIONS.find(e => e.value === campaign.edition)?.label ?? campaign.edition}
                              </p>
                              {campaign.description && (
                                <p className="text-xs text-muted-foreground italic truncate mt-1">{campaign.description}</p>
                              )}
                              <Button size="sm" variant="ghost" className="h-auto p-0 mt-2 text-xs text-primary"
                                onClick={() => setImportTarget(campaign)}
                                data-testid={`button-link-resources-${campaign.id}`}>
                                Link items & NPCs
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 ml-3 shrink-0">
                              <Button
                                size="sm"
                                variant={isActive ? "default" : "outline"}
                                onClick={() => setActiveCampaign(isActive ? null : campaign)}
                                data-testid={`button-select-campaign-${campaign.id}`}
                              >
                                {isActive ? "Deselect" : "Select"}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMutation.mutate(campaign.id)}
                                data-testid={`button-delete-campaign-${campaign.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
      {importTarget && <CampaignResourceImport key={importTarget.id} target={importTarget}
        campaigns={campaigns} onClose={() => setImportTarget(null)} />}
    </div>
  );
}
