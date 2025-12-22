import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ItemResponse } from "@shared/routes";
import { Crown, Sparkles, Shield, Sword, FlaskConical, Scroll, Gem, Wand2 } from "lucide-react";

interface ItemCardProps {
  item: ItemResponse;
  index: number;
}

const RARITY_CONFIG: Record<string, { color: string; border: string; glow: string }> = {
  "Common": { color: "text-zinc-400", border: "border-zinc-600", glow: "rarity-glow-common" },
  "Uncommon": { color: "text-emerald-400", border: "border-emerald-600", glow: "rarity-glow-uncommon" },
  "Rare": { color: "text-blue-400", border: "border-blue-600", glow: "rarity-glow-rare" },
  "Very Rare": { color: "text-purple-400", border: "border-purple-600", glow: "rarity-glow-very-rare" },
  "Legendary": { color: "text-amber-400", border: "border-amber-600", glow: "rarity-glow-legendary" },
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
  const icon = CATEGORY_ICONS[item.category] || <Sparkles className="w-4 h-4" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1, 
        type: "spring",
        stiffness: 100 
      }}
      className={cn(
        "relative group h-[400px] w-full bg-card rounded-xl p-6 flex flex-col border-2 overflow-hidden",
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
        {item.rarity === "Legendary" && (
          <Crown className="w-6 h-6 text-amber-500 animate-pulse" />
        )}
      </div>

      {/* Title */}
      <h3 className={cn("font-display text-xl font-bold mb-1 leading-tight", rarityStyle.color)}>
        {item.name}
      </h3>
      
      {/* Subtitle */}
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
        <span>{item.rarity}</span>
        <span>•</span>
        <span>{item.category}</span>
        <span>•</span>
        <span>{item.version}</span>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mb-4" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy pr-2 relative z-10">
        <p className="text-sm leading-relaxed text-muted-foreground font-serif">
          {item.description}
        </p>
      </div>

      {/* Footer / Meta */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
        {item.attunement && (
          <p className="text-xs text-amber-400/90 font-serif text-center bg-amber-900/20 py-1 rounded">
            {item.attunement}
          </p>
        )}
        {item.meta && (
          <p className="text-xs text-primary/80 font-mono text-center bg-primary/5 py-1 rounded">
            {item.meta}
          </p>
        )}
      </div>
    </motion.div>
  );
}
