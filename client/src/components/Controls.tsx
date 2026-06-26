import { useState, useRef } from "react";
import { type DrawOptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Dices, Layers, Upload, Search, X, BookOpen, Scroll } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  "Weapons", "Armor", "Potions", "Rings", "Wands",
  "Staves", "Scrolls", "Rods", "Wondrous Items", "Magical",
];

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

interface ControlsProps {
  onDraw: (options: DrawOptions) => void;
  isDrawing: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Controls({ onDraw, isDrawing, searchTerm = "", onSearchChange }: ControlsProps) {
  const [source, setSource] = useState<"5e" | "custom">("5e");
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [rarities, setRarities] = useState<string[]>(RARITIES);
  const [count, setCount] = useState([5]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const toggleCategory = (cat: string) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const toggleAllCategories = () =>
    setCategories(categories.length === CATEGORIES.length ? [] : CATEGORIES);

  const toggleRarity = (rar: string) =>
    setRarities(prev => prev.includes(rar) ? prev.filter(r => r !== rar) : [...prev, rar]);

  const toggleAllRarities = () =>
    setRarities(rarities.length === RARITIES.length ? [] : RARITIES);

  const handleDraw = () => {
    onDraw({ source, categories, rarities, count: count[0] });
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const text = await file.text();
      const endpoint = source === "custom" ? "/api/import/custom" : "/api/import/5e";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Import Successful",
          description: data.message,
        });
      } else {
        toast({
          title: "Import Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to read or upload the CSV file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-card border-r border-border scrollbar-fantasy">
      <div className="space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Deck of Loot
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure your draw parameters below.
          </p>
        </div>

        {/* Source Toggle */}
        <div className="space-y-3">
          <Label className="font-display text-lg">Source</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSource("5e")}
              data-testid="button-source-5e"
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-all",
                source === "5e"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/30 text-muted-foreground hover:border-primary/50"
              )}
            >
              <BookOpen className="w-4 h-4" />
              5e Compendium
            </button>
            <button
              onClick={() => setSource("custom")}
              data-testid="button-source-custom"
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-all",
                source === "custom"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/30 text-muted-foreground hover:border-primary/50"
              )}
            >
              <Scroll className="w-4 h-4" />
              Custom Session
            </button>
          </div>
          {source === "custom" && (
            <p className="text-xs text-muted-foreground italic">
              Uploading a new CSV will replace all current session items.
            </p>
          )}
        </div>

        {/* Search Input */}
        <div className="space-y-2">
          <Label className="font-display text-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Search Drawn Items
          </Label>
          <div className="relative">
            <input
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Filter by name..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-background/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-search"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onSearchChange?.("")}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Count Slider */}
        <div className="space-y-4 bg-background/30 p-4 rounded-lg border border-border/50">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg">Card Count</Label>
            <span className="font-mono text-xl text-primary font-bold">{count[0]}</span>
          </div>
          <Slider
            value={count}
            onValueChange={setCount}
            max={100}
            min={1}
            step={1}
            className="cursor-pointer"
            data-testid="slider-count"
          />
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg flex items-center gap-2">
              <Layers className="w-4 h-4" /> Categories
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllCategories}
              className="h-6 text-xs text-muted-foreground hover:text-primary"
            >
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
                  className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  data-testid={`checkbox-category-${cat}`}
                />
                <label
                  htmlFor={`cat-${cat}`}
                  className="text-sm font-medium leading-none cursor-pointer text-muted-foreground transition-colors"
                >
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
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllRarities}
              className="h-6 text-xs text-muted-foreground hover:text-primary"
            >
              {rarities.length === RARITIES.length ? "Clear All" : "Select All"}
            </Button>
          </div>
          <div className="space-y-2 bg-background/30 p-4 rounded-lg border border-border/50">
            {RARITIES.map(rar => (
              <div key={rar} className="flex items-center space-x-2">
                <Checkbox
                  id={`rar-${rar}`}
                  checked={rarities.includes(rar)}
                  onCheckedChange={() => toggleRarity(rar)}
                  data-testid={`checkbox-rarity-${rar}`}
                  className={cn(
                    "border-muted-foreground",
                    rar === "Legendary" && "data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500",
                    rar === "Artifact" && "data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600",
                    rar === "Very Rare" && "data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500",
                    rar === "Rare" && "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
                    rar === "Uncommon" && "data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500",
                    rar === "Common" && "data-[state=checked]:bg-zinc-500 data-[state=checked]:border-zinc-500"
                  )}
                />
                <label
                  htmlFor={`rar-${rar}`}
                  className={cn(
                    "text-sm font-medium leading-none cursor-pointer transition-colors",
                    rar === "Legendary" ? "text-amber-500/80 hover:text-amber-400" :
                    rar === "Artifact" ? "text-red-400/80 hover:text-red-300" :
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {rar}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* CSV Import */}
        <div className="space-y-2 bg-background/30 p-4 rounded-lg border border-dashed border-border/50">
          <Label className="font-display text-sm">
            {source === "custom" ? "Upload Session Items (CSV)" : "Load 5e Compendium (CSV)"}
          </Label>
          <p className="text-xs text-muted-foreground">
            Required columns: <span className="font-mono">name, category, rarity</span>
            <br />
            Optional: <span className="font-mono">description, item_type, damage, weight, cost, properties, attunement</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
            disabled={uploading}
            data-testid="input-csv-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="button-upload-csv"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Importing..." : "Choose CSV File"}
          </Button>
        </div>

        {/* Draw Button */}
        <Button
          onClick={handleDraw}
          disabled={isDrawing || categories.length === 0 || rarities.length === 0}
          className="w-full h-14 text-lg font-display font-bold uppercase tracking-widest relative overflow-hidden group shadow-lg hover:shadow-primary/20 transition-all"
          data-testid="button-draw-cards"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          {isDrawing ? (
            <span className="flex items-center gap-2 animate-pulse">
              <Dices className="animate-spin" /> Drawing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Dices /> Draw Cards
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground italic font-serif">
          "Fate is not drawn, it is forged."
        </p>
      </div>
    </div>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}
