import { useState } from "react";
import { type DrawOptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Dices, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Weapons", "Armor", "Potions", "Rings", "Wands", 
  "Staves", "Scrolls", "Rods", "Wondrous Items", "Magical"
];

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];

interface ControlsProps {
  onDraw: (options: DrawOptions) => void;
  isDrawing: boolean;
}

export function Controls({ onDraw, isDrawing }: ControlsProps) {
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [rarities, setRarities] = useState<string[]>(RARITIES);
  const [count, setCount] = useState([5]);

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

  const handleDraw = () => {
    onDraw({
      categories,
      rarities,
      count: count[0]
    });
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
            Configure your mystical draw parameters below.
          </p>
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
            max={50} 
            min={1} 
            step={1}
            className="cursor-pointer"
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
                />
                <label 
                  htmlFor={`cat-${cat}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground peer-data-[state=checked]:text-foreground transition-colors"
                >
                  {cat}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Rarities */}
        <div className="space-y-4">
          <Label className="font-display text-lg flex items-center gap-2">
            <CrownIcon className="w-4 h-4" /> Rarities
          </Label>
          <div className="space-y-2 bg-background/30 p-4 rounded-lg border border-border/50">
            {RARITIES.map(rar => (
              <div key={rar} className="flex items-center space-x-2">
                <Checkbox 
                  id={`rar-${rar}`}
                  checked={rarities.includes(rar)}
                  onCheckedChange={() => toggleRarity(rar)}
                  className={cn(
                    "border-muted-foreground",
                    rar === "Legendary" && "data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500",
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
                    rar === "Legendary" ? "text-amber-500/80 hover:text-amber-400" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {rar}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleDraw}
          disabled={isDrawing || categories.length === 0 || rarities.length === 0}
          className="w-full h-14 text-lg font-display font-bold uppercase tracking-widest relative overflow-hidden group shadow-lg hover:shadow-primary/20 transition-all"
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

        {/* Disclaimer */}
        <p className="text-xs text-center text-muted-foreground italic font-serif">
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
