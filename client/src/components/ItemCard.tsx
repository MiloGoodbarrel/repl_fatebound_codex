import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ItemResponse } from "@shared/routes";
import { Crown, Sparkles, Shield, Sword, FlaskConical, Scroll, Gem, Wand2, Crosshair, Weight, Coins, Zap } from "lucide-react";

interface ItemCardProps {
  item: ItemResponse & { linkedSource?: { campaignId: number; campaignName: string } };
  index: number;
}

const RARITY_CONFIG: Record<string, { color: string; border: string; glow: string }> = {
  "Common": { color: "text-zinc-400", border: "border-zinc-600", glow: "rarity-glow-common" },
  "Uncommon": { color: "text-emerald-400", border: "border-emerald-600", glow: "rarity-glow-uncommon" },
  "Rare": { color: "text-blue-400", border: "border-blue-600", glow: "rarity-glow-rare" },
  "Very Rare": { color: "text-purple-400", border: "border-purple-600", glow: "rarity-glow-very-rare" },
  "Legendary": { color: "text-amber-400", border: "border-amber-600", glow: "rarity-glow-legendary" },
  "Artifact": { color: "text-red-500", border: "border-red-700", glow: "rarity-glow-artifact" },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Weapons": <Sword className="w-4 h-4" />,
  "Armor": <Shield className="w-4 h-4" />,
  "Potions": <FlaskConical className="w-4 h-4" />,
  "Rings": <Gem className="w-4 h-4" />,
  "Wands": <Wand2 className="w-4 h-4" />,
  "Staves": <Wand2 className="w-4 h-4 rotate-45" />,
  "Scrolls": <Scroll className="w-4 h-4" />,
  "Rods": <Wand2 className="w-4 h-4 -rotate-45" />,
  "Wondrous Items": <Sparkles className="w-4 h-4" />,
  "Magical": <Sparkles className="w-4 h-4" />,
};

export function ItemCard({ item, index }: ItemCardProps) {
  const rarityStyle = RARITY_CONFIG[item.rarity] || RARITY_CONFIG["Common"];

  let icon = CATEGORY_ICONS[item.category] || <Sparkles className="w-4 h-4" />;
  if (item.category === "Weapons" && item.itemType?.toLowerCase().includes("ranged")) {
    icon = <Crosshair className="w-4 h-4" />;
  }

  const propertiesList = item.properties
    ? item.properties.split(",").map(p => p.trim()).filter(Boolean)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, type: "spring", stiffness: 100 }}
      data-testid={`card-item-${item.id}`}
      className={cn(
        "relative group min-h-[360px] w-full bg-card rounded-xl p-6 flex flex-col border-2 overflow-hidden",
        "hover:-translate-y-2 transition-transform duration-300",
        rarityStyle.border,
        rarityStyle.glow
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="bg-background/80 backdrop-blur-sm p-2 rounded-lg border border-border">
          {icon}
        </div>
        {item.rarity === "Legendary" && <Crown className="w-6 h-6 text-amber-500 animate-pulse" />}
        {item.rarity === "Artifact" && <Crown className="w-6 h-6 text-red-500 animate-pulse" />}
      </div>

      {/* Title */}
      <h3 className={cn("font-display text-xl font-bold mb-1 leading-tight", rarityStyle.color)}
        data-testid={`text-item-name-${item.id}`}>
        {item.name}
      </h3>

      {/* Subtitle */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
        <span data-testid={`text-item-rarity-${item.id}`}>{item.rarity}</span>
        <span>•</span>
        <span>{item.category}</span>
        {item.itemType && (
          <>
            <span>•</span>
            <span>{item.itemType}</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mb-3" />

      {/* Description */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy pr-1 relative z-10">
        <p className="text-sm leading-relaxed text-muted-foreground font-serif">
          {item.description || <span className="italic opacity-50">No description.</span>}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-2 relative z-10">

        {/* Stats row: damage / weight / cost */}
        {(item.damage || item.weight || item.cost) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
            {item.damage && (
              <span className="flex items-center gap-1">
                <Sword className="w-3 h-3 text-red-400" />
                {item.damage}
              </span>
            )}
            {item.weight && (
              <span className="flex items-center gap-1">
                <Weight className="w-3 h-3" />
                {item.weight}
              </span>
            )}
            {item.cost && (
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-yellow-400" />
                {item.cost}
              </span>
            )}
          </div>
        )}

        {/* Properties */}
        {propertiesList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {propertiesList.map(prop => (
              <span key={prop}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-background/60 border border-border/60 rounded text-xs text-muted-foreground font-mono">
                <Zap className="w-2.5 h-2.5" />
                {prop}
              </span>
            ))}
          </div>
        )}

        {/* Attunement */}
        {item.attunement && (
          <p className="text-xs text-amber-400/90 font-serif text-center bg-amber-900/20 py-1 rounded"
            data-testid={`text-item-attunement-${item.id}`}>
            {item.attunement}
          </p>
        )}

        {/* Source */}
        {item.linkedSource && <p className="text-xs text-primary/80">Linked from {item.linkedSource.campaignName}</p>}
        {item.source && (
          <p className="text-xs text-muted-foreground/60 font-mono text-right tracking-wide pt-1">
            {item.source}
          </p>
        )}
      </div>
    </motion.div>
  );
}
