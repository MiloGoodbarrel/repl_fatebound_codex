import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DrawOptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Dices, Layers, Upload, Search, X, Scroll, RefreshCw, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCampaign } from "@/lib/campaignContext";

const EDITIONS = [
  { value: "odnd",   label: "OD&D" },
  { value: "adnd",   label: "AD&D" },
  { value: "3e",     label: "3rd Edition" },
  { value: "3.5e",   label: "3.5 Edition" },
  { value: "4e",     label: "4th Edition" },
  { value: "5e",     label: "5e (2014)" },
  { value: "onednd", label: "One D&D" },
];

const CATEGORIES = [
  "Adventuring Gear",
  "Armor",
  "Magic Tattoos",
  "Miscellaneous",
  "Mounts & Vehicles",
  "Potions",
  "Relics",
  "Rings",
  "Rods",
  "Scrolls",
  "Staves",
  "Tools",
  "Wands",
  "Weapons",
  "Wondrous Items",
];

const RARITIES = [
  { value: "Mundane",   label: "Mundane",   color: "bg-zinc-400 border-zinc-400" },
  { value: "Common",    label: "Common",    color: "bg-zinc-500 border-zinc-500" },
  { value: "Uncommon",  label: "Uncommon",  color: "bg-emerald-500 border-emerald-500" },
  { value: "Rare",      label: "Rare",      color: "bg-blue-500 border-blue-500" },
  { value: "Very Rare", label: "Very Rare", color: "bg-purple-500 border-purple-500" },
  { value: "Legendary", label: "Legendary", color: "bg-amber-500 border-amber-500" },
  { value: "Artifact",  label: "Artifact",  color: "bg-red-600 border-red-600" },
  { value: "Special",   label: "Special",   color: "bg-pink-500 border-pink-500" },
  { value: "Unique",    label: "Unique",    color: "bg-orange-500 border-orange-500" },
];

interface ControlsProps {
  onDraw: (options: DrawOptions) => void;
  isDrawing: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Controls({ onDraw, isDrawing, searchTerm = "", onSearchChange }: ControlsProps) {
  const { activeCampaign } = useCampaign();
  const [editions, setEditions] = useState<string[]>(["5e"]);
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [rarities, setRarities] = useState<string[]>(RARITIES.map(r => r.value));
  const [sources, setSources] = useState<string[]>([]); // empty = all sources
  const [sourceSearch, setSourceSearch] = useState("");
  const [count, setCount] = useState([5]);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: allSources = [] } = useQuery<string[]>({
    queryKey: ["/api/items/5e/sources"],
    enabled: !activeCampaign,
  });

  const drawSource: DrawOptions["source"] = activeCampaign ? "campaign" : "5e";

  const filteredSources = allSources.filter(s =>
    s.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  // sources state: empty array = "all sources" (no filter applied)
  const selectedSources = sources.length === 0 ? allSources : sources;

  const toggleEdition = (val: string) =>
    setEditions(prev => prev.includes(val) ? prev.filter(e => e !== val) : [...prev, val]);
  const toggleAllEditions = () =>
    setEditions(editions.length === EDITIONS.length ? [] : EDITIONS.map(e => e.value));

  const toggleCategory = (cat: string) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  const toggleAllCategories = () =>
    setCategories(categories.length === CATEGORIES.length ? [] : [...CATEGORIES]);

  const toggleRarity = (val: string) =>
    setRarities(prev => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  const toggleAllRarities = () =>
    setRarities(rarities.length === RARITIES.length ? [] : RARITIES.map(r => r.value));

  const toggleSource = (val: string) => {
    setSources(prev => {
      // If currently "all", clicking one source means "deselect all except this one"... 
      // Actually simpler: maintain a selected set. Empty = all.
      if (prev.length === 0) {
        // Was "all selected", now deselect just this one
        return allSources.filter(s => s !== val);
      }
      return prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val];
    });
  };
  const toggleAllSources = () => setSources([]);
  const clearAllSources = () => setSources(allSources.length > 0 ? allSources.filter(() => false) : []);

  const isSourceSelected = (val: string) =>
    sources.length === 0 || sources.includes(val);

  const allSourcesSelected = sources.length === 0;
  const someSourcesSelected = sources.length > 0 && sources.length < allSources.length;

  const handleDraw = () => {
    onDraw({
      source: drawSource,
      campaignId: activeCampaign?.id,
      editions: drawSource === "5e" ? editions : undefined,
      categories,
      rarities,
      sources: sources.length > 0 ? sources : undefined,
      count: count[0],
    });
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const text = await file.text();
      const endpoint = activeCampaign
        ? `/api/campaigns/${activeCampaign.id}/import`
        : "/api/import/5e";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Import Successful", description: data.message });
      } else {
        toast({ title: "Import Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to upload CSV.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReloadLootTable = async () => {
    setReloading(true);
    try {
      const res = await fetch("/api/admin/seed-loot/5e", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Loot Table Reloaded", description: data.message });
      } else {
        toast({ title: "Reload Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to reload loot table.", variant: "destructive" });
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-card border-r border-border scrollbar-fantasy">
      <div className="space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Deck of Loot
          </h2>
          {activeCampaign ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5 text-primary/70" />
              Drawing from <span className="text-primary font-medium">{activeCampaign.name}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Drawing from the compendium.</p>
          )}
        </div>

        {/* Edition Filter — only when drawing from compendium */}
        {!activeCampaign && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="font-display text-lg">Edition</Label>
              <Button variant="ghost" size="sm" onClick={toggleAllEditions} className="h-6 text-xs text-muted-foreground hover:text-primary">
                {editions.length === EDITIONS.length ? "Clear All" : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EDITIONS.map(ed => (
                <div key={ed.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`ed-${ed.value}`}
                    checked={editions.includes(ed.value)}
                    onCheckedChange={() => toggleEdition(ed.value)}
                    data-testid={`checkbox-edition-${ed.value}`}
                    className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <label htmlFor={`ed-${ed.value}`} className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                    {ed.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="space-y-2">
          <Label className="font-display text-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Search Drawn Items
          </Label>
          <div className="relative">
            <input
              value={searchTerm}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder="Filter by name..."
              data-testid="input-search"
              className="w-full pl-9 pr-8 py-2 text-sm bg-background/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchTerm && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => onSearchChange?.("")}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Count */}
        <div className="space-y-4 bg-background/30 p-4 rounded-lg border border-border/50">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg">Card Count</Label>
            <span className="font-mono text-xl text-primary font-bold">{count[0]}</span>
          </div>
          <Slider value={count} onValueChange={setCount} max={100} min={1} step={1} className="cursor-pointer" />
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg flex items-center gap-2">
              <Layers className="w-4 h-4" /> Categories
            </Label>
            <Button variant="ghost" size="sm" onClick={toggleAllCategories} className="h-6 text-xs text-muted-foreground hover:text-primary">
              {categories.length === CATEGORIES.length ? "Clear All" : "Select All"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <div key={cat} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${cat}`}
                  checked={categories.includes(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                  data-testid={`checkbox-category-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <label htmlFor={`cat-${cat}`} className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                  {cat}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Rarities */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg flex items-center gap-2">
              <CrownIcon className="w-4 h-4" /> Rarities
            </Label>
            <Button variant="ghost" size="sm" onClick={toggleAllRarities} className="h-6 text-xs text-muted-foreground hover:text-primary">
              {rarities.length === RARITIES.length ? "Clear All" : "Select All"}
            </Button>
          </div>
          <div className="space-y-2 bg-background/30 p-4 rounded-lg border border-border/50">
            {RARITIES.map(r => (
              <div key={r.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`rar-${r.value}`}
                  checked={rarities.includes(r.value)}
                  onCheckedChange={() => toggleRarity(r.value)}
                  data-testid={`checkbox-rarity-${r.value.replace(' ', '-')}`}
                  className={cn("border-muted-foreground", `data-[state=checked]:${r.color}`)}
                />
                <label htmlFor={`rar-${r.value}`} className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                  {r.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Source / Sourcebook Filter */}
        {!activeCampaign && allSources.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="font-display text-lg flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Sourcebooks
              </Label>
              <div className="flex items-center gap-2">
                {!allSourcesSelected && (
                  <span className="text-xs text-primary font-mono">
                    {sources.length}/{allSources.length}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={allSourcesSelected ? () => setSources([...allSources]) : toggleAllSources}
                  className="h-6 text-xs text-muted-foreground hover:text-primary"
                  data-testid="button-toggle-all-sources"
                >
                  {allSourcesSelected ? "Clear All" : "Select All"}
                </Button>
              </div>
            </div>

            {/* Search sources */}
            <div className="relative">
              <input
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                placeholder="Search sourcebooks..."
                data-testid="input-source-search"
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-background/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              {sourceSearch && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSourceSearch("")}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Source list */}
            <div className="max-h-48 overflow-y-auto scrollbar-fantasy bg-background/30 rounded-lg border border-border/50 p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {filteredSources.map(src => (
                  <div key={src} className="flex items-center space-x-1.5">
                    <Checkbox
                      id={`src-${src}`}
                      checked={isSourceSelected(src)}
                      onCheckedChange={() => toggleSource(src)}
                      data-testid={`checkbox-source-${src}`}
                      className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-3.5 w-3.5"
                    />
                    <label
                      htmlFor={`src-${src}`}
                      className="text-xs font-mono font-medium leading-none cursor-pointer text-muted-foreground hover:text-foreground"
                      title={src}
                    >
                      {src}
                    </label>
                  </div>
                ))}
              </div>
              {filteredSources.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2 italic">No sourcebooks match.</p>
              )}
            </div>
          </div>
        )}

        {/* CSV Import */}
        <div className="space-y-2 bg-background/30 p-4 rounded-lg border border-dashed border-border/50">
          <Label className="font-display text-sm">
            {activeCampaign ? `Import into "${activeCampaign.name}" (CSV)` : "Import Items (CSV)"}
          </Label>
          <p className="text-xs text-muted-foreground">
            Required: <span className="font-mono">name, category, rarity</span><br />
            Optional: <span className="font-mono">description, item_type, damage, weight, cost, properties, attunement</span>
          </p>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" disabled={uploading} data-testid="input-csv-upload" />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="outline" size="sm" className="w-full" data-testid="button-upload-csv">
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Importing..." : "Choose CSV File"}
          </Button>
          {!activeCampaign && (
            <Button
              onClick={handleReloadLootTable}
              disabled={reloading}
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-primary"
              data-testid="button-reload-loot"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-2", reloading && "animate-spin")} />
              {reloading ? "Reloading..." : "Reload 5e Loot Table"}
            </Button>
          )}
        </div>

        {/* Draw Button */}
        <Button
          onClick={handleDraw}
          disabled={isDrawing || categories.length === 0 || rarities.length === 0 || (!activeCampaign && editions.length === 0)}
          className="w-full h-14 text-lg font-display font-bold uppercase tracking-widest relative overflow-hidden group shadow-lg hover:shadow-primary/20 transition-all"
          data-testid="button-draw-cards"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          {isDrawing ? (
            <span className="flex items-center gap-2 animate-pulse"><Dices className="animate-spin" /> Drawing...</span>
          ) : (
            <span className="flex items-center gap-2"><Dices /> Draw Cards</span>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground italic font-serif">"Fate is not drawn, it is forged."</p>
      </div>
    </div>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}
