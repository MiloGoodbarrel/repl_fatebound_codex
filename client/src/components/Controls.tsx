import { useState, useRef } from "react";
import { type DrawOptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Sparkles, Dices, Layers, Upload, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  "Weapons", "Armor", "Potions", "Rings", "Wands", 
  "Staves", "Scrolls", "Rods", "Wondrous Items", "Magical"
];

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Unknown"];
const VERSIONS = ["OD&D", "AD&D", "3rd Edition", "4th Edition", "5e", "One D&D"];

interface ControlsProps {
  onDraw: (options: DrawOptions) => void;
  isDrawing: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Controls({ onDraw, isDrawing, searchTerm = "", onSearchChange }: ControlsProps) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [rarities, setRarities] = useState<string[]>(RARITIES);
  const [versions, setVersions] = useState<string[]>(VERSIONS);
  const [count, setCount] = useState([5]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const toggleCategory = (cat: string) => {
    setCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleAllCategories = () => {
    if (categories.length === CATEGORIES.length) {
      setCategories([]);
    } else {
      setCategories(CATEGORIES);
    }
  };

  const toggleRarity = (rar: string) => {
    setRarities(prev => 
      prev.includes(rar) ? prev.filter(r => r !== rar) : [...prev, rar]
    );
  };

  const toggleAllRarities = () => {
    if (rarities.length === RARITIES.length) {
      setRarities([]);
    } else {
      setRarities(RARITIES);
    }
  };

  const toggleVersion = (ver: string) => {
    setVersions(prev => 
      prev.includes(ver) ? prev.filter(v => v !== ver) : [...prev, ver]
    );
  };

  const toggleAllVersions = () => {
    if (versions.length === VERSIONS.length) {
      setVersions([]);
    } else {
      setVersions(VERSIONS);
    }
  };

  const handleDraw = () => {
    onDraw({
      categories,
      rarities,
      versions,
      count: count[0]
    });
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const text = await file.text();
      const response = await fetch("/api/import-homebrew", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Success",
          description: `Imported ${data.count} homebrew items`,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 parchment tome-edge scrollbar-fantasy">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-bold text-amber-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Deck of Loot
          </h2>
          <p className="text-sm ink-faded font-serif">
            Configure your mystical draw parameters below.
          </p>
        </div>

        {/* Search Input */}
        <div className="space-y-2">
          <Label className="font-display text-sm flex items-center gap-2 ink-text">
            <Search className="w-4 h-4" /> Search Drawn Items
          </Label>
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Filter by name..."
              className="pl-9 bg-amber-50/50 border-amber-700/30 text-amber-900 placeholder:text-amber-700/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => onSearchChange?.("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Count Slider */}
        <div className="space-y-4 bg-amber-900/5 p-4 rounded-lg border border-amber-700/20">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg ink-text">Card Count</Label>
            <span className="font-mono text-xl text-amber-700 font-bold">{count[0]}</span>
          </div>
          <Slider 
            value={count} 
            onValueChange={setCount} 
            max={100} 
            min={1} 
            step={1}
            className="cursor-pointer"
          />
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg flex items-center gap-2 ink-text">
              <Layers className="w-4 h-4" /> Categories
            </Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllCategories}
              className="h-6 text-xs text-amber-700 hover:text-amber-600"
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
                  className="border-amber-700/40 data-[state=checked]:bg-amber-700 data-[state=checked]:text-amber-50"
                />
                <label 
                  htmlFor={`cat-${cat}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ink-faded peer-data-[state=checked]:text-amber-900 transition-colors"
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
            <Label className="font-display text-lg flex items-center gap-2 ink-text">
              <CrownIcon className="w-4 h-4" /> Rarities
            </Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllRarities}
              className="h-6 text-xs text-amber-700 hover:text-amber-600"
            >
              {rarities.length === RARITIES.length ? "Clear All" : "Select All"}
            </Button>
          </div>
          <div className="space-y-2 bg-amber-900/5 p-4 rounded-lg border border-amber-700/20">
            {RARITIES.map(rar => (
              <div key={rar} className="flex items-center space-x-2">
                <Checkbox 
                  id={`rar-${rar}`}
                  checked={rarities.includes(rar)}
                  onCheckedChange={() => toggleRarity(rar)}
                  className={cn(
                    "border-amber-700/40",
                    rar === "Legendary" && "data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600",
                    rar === "Very Rare" && "data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600",
                    rar === "Rare" && "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600",
                    rar === "Uncommon" && "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600",
                    rar === "Common" && "data-[state=checked]:bg-zinc-500 data-[state=checked]:border-zinc-500"
                  )}
                />
                <label 
                  htmlFor={`rar-${rar}`}
                  className={cn(
                    "text-sm font-medium leading-none cursor-pointer transition-colors",
                    rar === "Legendary" ? "text-amber-700 hover:text-amber-600" : "ink-faded hover:text-amber-900"
                  )}
                >
                  {rar}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Versions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-display text-lg ink-text">D&D Versions</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllVersions}
              className="h-6 text-xs text-amber-700 hover:text-amber-600"
            >
              {versions.length === VERSIONS.length ? "Clear All" : "Select All"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-amber-900/5 p-4 rounded-lg border border-amber-700/20">
            {VERSIONS.map(ver => (
              <div key={ver} className="flex items-center space-x-2">
                <Checkbox 
                  id={`ver-${ver}`}
                  checked={versions.includes(ver)}
                  onCheckedChange={() => toggleVersion(ver)}
                  className="border-amber-700/40 data-[state=checked]:bg-amber-700 data-[state=checked]:text-amber-50"
                />
                <label 
                  htmlFor={`ver-${ver}`}
                  className="text-sm font-medium leading-none cursor-pointer ink-faded peer-data-[state=checked]:text-amber-900 transition-colors"
                >
                  {ver}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* CSV Import */}
        <div className="space-y-2 bg-amber-900/5 p-4 rounded-lg border border-dashed border-amber-700/30">
          <Label className="font-display text-sm ink-text">Import Homebrew (CSV)</Label>
          <p className="text-xs ink-faded">Headers: Item Name, Item Description, Category, Rarity, Version, Attunement</p>
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
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Importing..." : "Choose CSV File"}
          </Button>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleDraw}
          disabled={isDrawing || categories.length === 0 || rarities.length === 0 || versions.length === 0}
          className="w-full h-14 text-lg font-display font-bold uppercase tracking-widest relative overflow-hidden group shadow-lg bg-amber-800 hover:bg-amber-700 text-amber-50 border-2 border-amber-900"
          data-testid="button-draw-cards"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
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

        {/* Disclaimer */}
        <p className="text-xs text-center ink-faded italic font-serif">
          "Fate is not drawn, it is forged."
        </p>
      </div>
    </div>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}
