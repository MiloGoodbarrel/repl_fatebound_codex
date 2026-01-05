import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ItemResponse } from "@shared/routes";
import { Crown, Sparkles, Shield, Sword, FlaskConical, Scroll, Gem, Wand2, Crosshair } from "lucide-react";

interface ItemCardProps {
  item: ItemResponse;
  index: number;
}

const RARITY_CONFIG: Record<string, { color: string; border: string; glow: string }> = {
  "Unknown": { color: "text-white", border: "border-slate-400", glow: "rarity-glow-unknown" },
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
  
  // Use bow icon for ranged weapons
  let icon = CATEGORY_ICONS[item.category] || <Sparkles className="w-4 h-4" />;
  if (item.category === "Weapons" && (item as any).weaponType?.includes("Ranged")) {
    icon = <Crosshair className="w-4 h-4" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateY: 180, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.15, 
        type: "spring",
        stiffness: 80,
        damping: 12
      }}
      style={{ perspective: "1000px" }}
      className={cn(
        "relative group tarot-card p-5 flex flex-col overflow-hidden cursor-default",
        "hover:-translate-y-2 hover:shadow-2xl transition-all duration-300",
        rarityStyle.glow
      )}
    >
      {/* Parchment texture overlay */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
      
      {/* Header */}
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="p-2 rounded border border-amber-700/40 bg-amber-900/10">
          <div className="text-amber-800">{icon}</div>
        </div>
        {item.rarity === "Legendary" && (
          <Crown className="w-5 h-5 text-amber-600 animate-pulse" />
        )}
      </div>

      {/* Title */}
      <h3 className={cn("font-display text-lg font-bold mb-1 leading-tight ink-text", rarityStyle.color)}>
        {item.name}
      </h3>
      
      {/* Subtitle */}
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ink-faded mb-3 flex-wrap">
        <span>{item.rarity}</span>
        <span className="text-amber-700">*</span>
        <span>{item.category}</span>
        {(item as any).weaponType && (
          <>
            <span className="text-amber-700">*</span>
            <span>{(item as any).weaponType}</span>
          </>
        )}
        <span className="text-amber-700">*</span>
        <span>{item.version}</span>
      </div>

      {/* Ornamental Divider */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-700/50 to-transparent" />
        <Sparkles className="w-3 h-3 text-amber-700/60" />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-700/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy pr-1 relative z-10">
        <p className="text-xs leading-relaxed ink-faded font-serif">
          {item.description}
        </p>
      </div>

      {/* Footer / Meta */}
      <div className="mt-3 pt-2 border-t border-amber-700/30 space-y-1">
        {item.attunement && (
          <p className="text-[10px] text-amber-800 font-serif text-center bg-amber-900/10 py-1 rounded border border-amber-700/20">
            {item.attunement}
          </p>
        )}
        {item.meta && (
          <div className="text-[10px] text-center">
            {item.meta.includes("SRD") ? (
              <a
                href={`https://5e.tools/items.html#${item.name.replace(/\s+/g, "_").toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-600 font-mono underline decoration-dashed hover:decoration-solid transition-colors"
                data-testid="link-srd-source"
              >
                {item.meta}
              </a>
            ) : (
              <p className="text-amber-700/70 font-mono">
                {item.meta}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
