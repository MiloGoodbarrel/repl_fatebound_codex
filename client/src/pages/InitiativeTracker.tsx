import { useState, useEffect, useRef, useMemo } from "react";
import { DiceRoller, DiceText, useDiceRoller } from "@/components/DiceRoller";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Swords, Plus, Minus, Trash2, User, Heart, Shield, 
  RotateCcw, Home, Search, Play, SkipForward, Square, Skull, AlertCircle,
  Loader2, Zap, Dices, CircleCheck, CircleX, HeartPulse, BookUser, Save,
  Upload, FileDown, BookOpen, ChevronRight, ChevronDown, Pencil
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCampaign } from "@/lib/campaignContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CampaignCharacter } from "@shared/schema";
import {
  applyGroupDamage as calculateGroupDamage,
  completeEncounterQuery,
  completeEncounterReset,
  createEncounterRestoreState,
  isCurrentEncounterCampaign,
  sortCombatantsPreservingActiveTurn,
} from "@shared/encounterRecovery";
import { useToast } from "@/hooks/use-toast";

const VERSION_OPTIONS = [
  { id: "3.5", label: "D&D 3.5 Edition" },
  { id: "4th", label: "D&D 4th Edition" },
  { id: "5e", label: "D&D 5e (2014)" },
  { id: "onednd", label: "One D&D" },
];

// Version priority for death rules (higher = more priority)
const VERSION_PRIORITY: Record<string, number> = {
  "OD&D": 1,
  "AD&D": 2,
  "3e": 3,
  "3.5": 4,
  "4th": 5,
  "5e": 6,
  "onednd": 7,
};

// Determine effective ruleset from selected versions
type DeathRuleset = "3.5e" | "4e" | "5e";
function getEffectiveRuleset(versions: string[]): DeathRuleset {
  if (versions.length === 0) return "5e";
  
  // Find highest priority version
  let maxPriority = 0;
  let effectiveVersion = "5e";
  
  for (const v of versions) {
    const priority = VERSION_PRIORITY[v] || 0;
    if (priority > maxPriority) {
      maxPriority = priority;
      effectiveVersion = v;
    }
  }
  
  // Map to ruleset
  if (effectiveVersion === "3.5" || effectiveVersion === "3e") return "3.5e";
  if (effectiveVersion === "4th") return "4e";
  return "5e"; // 5e, onednd, and others use 5e rules
}

const CONDITION_COLORS: Record<string, string> = {
  "Blinded": "#6B7280",      // Gray
  "Charmed": "#EC4899",      // Pink
  "Deafened": "#8B5CF6",     // Purple
  "Frightened": "#FBBF24",   // Yellow/Gold
  "Grappled": "#F97316",     // Orange
  "Incapacitated": "#1F2937", // Dark Gray
  "Invisible": "#06B6D4",    // Cyan
  "Paralyzed": "#3B82F6",    // Blue
  "Petrified": "#78716C",    // Stone Gray
  "Poisoned": "#22C55E",     // Green
  "Prone": "#A16207",        // Brown
  "Restrained": "#DC2626",   // Red
  "Stunned": "#FACC15",      // Bright Yellow
  "Unconscious": "#0F172A",  // Near Black
  "Exhaustion 1": "#FED7AA", // Light Orange
  "Exhaustion 2": "#FDBA74", // Orange 1
  "Exhaustion 3": "#FB923C", // Orange 2
  "Exhaustion 4": "#F97316", // Orange 3
  "Exhaustion 5": "#EA580C", // Orange 4
  "Exhaustion 6": "#9A3412", // Dark Orange/Red
};

const CONDITIONS = Object.keys(CONDITION_COLORS);

interface MonsterAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage?: Array<{ damage_dice: string; damage_type: string }>;
}

interface BestiaryTrait {
  name: string;
  description: string;
  type: string;
}

interface BestiaryDetailedAction {
  name: string;
  description: string;
  category: string;
  attackBonus?: number;
  reachFt?: number;
  saveAbility?: string;
  saveDc?: number;
  damageDice?: string;
  damageType?: string;
}

interface Monster {
  index: string;
  name: string;
  hp: number;
  hit_dice?: string;
  hitDiceCount?: number;
  hitDieSize?: number;
  ac: number;
  cr: string;
  type: string;
  size: string;
  speed?: Record<string, string>;
  str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number;
  strMod?: number; dexMod?: number; conMod?: number; intMod?: number; wisMod?: number; chaMod?: number;
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  actions?: MonsterAction[];
  special_abilities?: Array<{ name: string; desc: string }>;
  traits?: BestiaryTrait[];
  detailedActions?: BestiaryDetailedAction[];
  source?: string;
  alignment?: string;
  creatureTags?: string;
}

interface HomebrewAction {
  id: number;
  monsterRefId: number;
  actionOrder: number;
  actionName: string | null;
  actionDescription: string | null;
  attackBonus: number | null;
}

interface HomebrewMonster {
  id: number;
  campaignId: number;
  name: string;
  creatureType: string | null;
  size: string | null;
  alignment: string | null;
  armorClass: number | null;
  printedAverageHp: number | null;
  hitDice: string | null;
  dexScore: number | null;
  challengeRating: string | null;
  actions: HomebrewAction[];
}

interface HomebrewPreviewRow {
  name: string;
  type: string;
  size: string;
  cr: string;
  ac: string;
  hp: string;
  hit_dice: string;
  actionCount: number;
  error?: string;
}

function homebrewToMonster(m: HomebrewMonster): Monster {
  const dexMod = m.dexScore != null ? Math.floor((m.dexScore - 10) / 2) : undefined;
  return {
    index: `homebrew-${m.id}`,
    name: m.name,
    hp: m.printedAverageHp ?? 10,
    hit_dice: m.hitDice ?? undefined,
    ac: m.armorClass ?? 10,
    cr: m.challengeRating ?? "—",
    type: m.creatureType ?? "",
    size: m.size ?? "",
    alignment: m.alignment ?? undefined,
    dex: m.dexScore ?? undefined,
    dexMod,
    source: "Homebrew",
    actions: m.actions.map(a => ({
      name: a.actionName ?? "",
      desc: a.actionDescription ?? "",
      attack_bonus: a.attackBonus ?? undefined,
    })),
  };
}

function parseCSVClientSide(csvText: string): HomebrewPreviewRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseFields = (line: string): string[] => {
    const out: string[] = [];
    let inQ = false, cur = "";
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseFields(lines[0]).map(h => h.toLowerCase());
  const get = (vals: string[], col: string) => vals[headers.indexOf(col)]?.trim() ?? "";
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const v = parseFields(line);
    const name = get(v, "name");
    let actionCount = 0;
    for (let j = 1; j <= 5; j++) if (get(v, `action${j}_name`)) actionCount++;
    return {
      name,
      type: get(v, "type"),
      size: get(v, "size"),
      cr: get(v, "cr"),
      ac: get(v, "ac"),
      hp: get(v, "hp"),
      hit_dice: get(v, "hit_dice"),
      actionCount,
      error: !name ? "Missing name" : undefined,
    };
  });
}

function rollMonsterHp(hitDice: string, avgHp: number): number {
  try {
    const match = hitDice.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
    if (match) {
      const numDice = parseInt(match[1]);
      const dieSides = parseInt(match[2]);
      const sign = match[3] || "+";
      const modifier = match[4] ? parseInt(match[4]) : 0;
      
      let total = 0;
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * dieSides) + 1;
      }
      return sign === "-" ? total - modifier : total + modifier;
    }
  } catch {
    // Fall through to variance calculation
  }
  
  const variance = Math.floor(avgHp * 0.15);
  return Math.floor(Math.random() * (variance * 2 + 1)) + (avgHp - variance);
}

function getAbilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

type NPCStance = "ally" | "neutral" | "enemy";

const STANCE_COLORS: Record<NPCStance, string> = {
  ally: "#22C55E",     // Green
  neutral: "#6B7280",  // Grey
  enemy: "#EF4444",    // Red
};

type CombatantType = "pc" | "npc" | "monster";
type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
type AbilityModifierOverrides = Partial<Record<AbilityKey, number>>;
interface CorrectionDraft {
  id: string;
  hp: string;
  maxHp: string;
  initiative: string;
  ac: string;
  modifiers: Record<AbilityKey, string>;
}

const ABILITIES: Array<{ key: AbilityKey; label: string }> = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  isMonster: boolean;
  combatantType: CombatantType;
  conditions: string[];
  // Optional remaining rounds for timed conditions; absent entries are untimed.
  conditionDurations?: Record<string, number>;
  abilityModifierOverrides?: AbilityModifierOverrides;
  isDown: boolean;
  monsterData?: Monster;
  stance?: NPCStance;
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  isStable: boolean;
  isDead: boolean;
  // 4e-specific: healing surges and lingering failures
  healingSurges?: number;
  maxHealingSurges?: number;
  // 3.5e-specific: disabled state (at exactly 0 HP)
  isDisabled?: boolean;
  // Mid-combat reinforcement: skip this turn until the next round begins
  joiningNextRound?: boolean;
  // Group combatant (e.g. goblin horde)
  isGroup?: boolean;
  memberHp?: number[];  // current HP for each member; maxHp is shared across all
  // PC-specific
  level?: number;       // character level (1-20)
}

type CombatState = "setup" | "active" | "ended";

function MonsterStatblock({ monster, onRoll }: { monster: Monster; onRoll: (notation: string, label?: string) => void }) {
  const [showAllActions, setShowAllActions] = useState(false);

  const abilityScores = [
    { label: "STR", score: monster.str, mod: monster.strMod },
    { label: "DEX", score: monster.dex, mod: monster.dexMod },
    { label: "CON", score: monster.con, mod: monster.conMod },
    { label: "INT", score: monster.int, mod: monster.intMod },
    { label: "WIS", score: monster.wis, mod: monster.wisMod },
    { label: "CHA", score: monster.cha, mod: monster.chaMod },
  ];

  const formatMod = (mod?: number | null, score?: number | null): string => {
    if (mod != null) return mod >= 0 ? `+${mod}` : `${mod}`;
    if (score != null) {
      const m = Math.floor((score - 10) / 2);
      return m >= 0 ? `+${m}` : `${m}`;
    }
    return "—";
  };

  const traits = monster.traits ?? (monster.special_abilities?.map(a => ({ name: a.name, description: a.desc, type: "passive" })) ?? []);
  const allActions = monster.detailedActions ?? (monster.actions?.map(a => ({ name: a.name, description: a.desc, category: "action", attackBonus: a.attack_bonus })) ?? []);
  const mainActions = allActions.filter(a => a.category === "action" || a.category === "standard" || a.category === "");
  const otherActions = allActions.filter(a => a.category !== "action" && a.category !== "standard" && a.category !== "" && a.category !== "action");
  const ACTIONS_PREVIEW = 3;
  const visibleActions = showAllActions ? mainActions : mainActions.slice(0, ACTIONS_PREVIEW);
  const hiddenCount = mainActions.length - ACTIONS_PREVIEW;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 text-xs space-y-3">
      {/* Subtitle row */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-muted-foreground">
          {[monster.size, monster.type, monster.alignment].filter(Boolean).join(" · ")}
        </span>
        {monster.source && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{monster.source}</Badge>
        )}
      </div>

      {/* Stats: AC, HP */}
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-muted-foreground" />
          <span className="font-semibold">AC</span> {monster.ac}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3 text-muted-foreground" />
          <span className="font-semibold">HP</span> avg {monster.hp}
          {monster.hit_dice && <span className="text-muted-foreground ml-1">({monster.hit_dice})</span>}
        </span>
      </div>

      {/* Ability scores */}
      {abilityScores.some(s => s.score != null) && (
        <div className="grid grid-cols-6 gap-1 text-center bg-muted/30 rounded p-2">
          {abilityScores.map(({ label, score, mod }) => (
            <div key={label} className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
              <div className="font-mono font-bold text-sm">{score ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">{formatMod(mod, score)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Immunities / Resistances */}
      {monster.immunities && monster.immunities.length > 0 && (
        <div><span className="font-semibold text-muted-foreground">Immunities: </span>{monster.immunities.join(", ")}</div>
      )}
      {monster.resistances && monster.resistances.length > 0 && (
        <div><span className="font-semibold text-muted-foreground">Resistances: </span>{monster.resistances.join(", ")}</div>
      )}
      {monster.vulnerabilities && monster.vulnerabilities.length > 0 && (
        <div><span className="font-semibold text-muted-foreground">Vulnerabilities: </span>{monster.vulnerabilities.join(", ")}</div>
      )}

      {/* Special Abilities / Traits */}
      {traits.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-bold text-foreground/80 uppercase tracking-wide text-[10px]">Special Abilities</div>
          {traits.map((trait, i) => (
            <p key={i} className="text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground/90 italic">{trait.name}. </span>
              <DiceText text={trait.description ?? ""} onRoll={onRoll} />
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      {mainActions.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-bold text-foreground/80 uppercase tracking-wide text-[10px]">Actions</div>
          {visibleActions.map((action, i) => (
            <p key={i} className="text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground/90 italic">{action.name}. </span>
              <DiceText text={action.description ?? ""} onRoll={(n) => onRoll(n, action.name ?? undefined)} />
              {action.attackBonus != null && (
                <span className="text-primary/80 ml-1">(+{action.attackBonus} to hit)</span>
              )}
            </p>
          ))}
          {!showAllActions && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllActions(true)}
              className="text-primary/80 hover:text-primary transition-colors text-[11px] font-medium"
            >
              +{hiddenCount} more action{hiddenCount !== 1 ? "s" : ""}
            </button>
          )}
          {showAllActions && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllActions(false)}
              className="text-muted-foreground hover:text-foreground transition-colors text-[11px]"
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* Bonus/Legendary/Lair actions summary */}
      {otherActions.length > 0 && (
        <div className="text-muted-foreground italic text-[11px]">
          + {otherActions.length} bonus/legendary action{otherActions.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ── CR → XP lookup (DMG "Monster Statistics by Challenge Rating") ───────────
const CR_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};
function crToXp(cr: string | undefined): number {
  if (!cr) return 0;
  return CR_XP[cr.trim()] ?? 0;
}

// ── Cinematic death descriptions ─────────────────────────────────────────────
// {name} = creature name  |  ___ = weapon blank (DM fills in aloud)
const DEATH_DESCRIPTIONS: Record<string, string[]> = {
  humanoid: [
    "{name} catches the ___ full in the face. Bone and grey matter spray across the ground as the body crumples, legs still running on reflex even as what's left of their skull empties onto the stone.",
    "The ___ finds the gap between gorget and helm. {name}'s scream cuts off the instant the blade exits the other side, trailing ropes of viscera. They drop in a heap, twitching once, then nothing.",
    "The ___ opens {name}'s throat in a single clean arc. They clutch at it, dark blood sheeting between their fingers in rhythmic pulses, mouth working silently as they fold to the earth and go still.",
    "{name}'s chest caves inward under the ___. They stagger backward coughing red foam, hit the wall, and slide slowly down it — leaving a long dark smear — until they're sitting in a spreading pool of themselves.",
    "The ___ buries itself to the hilt in {name}'s gut. They double over, making a sound like wet paper tearing, then sink to their knees and pitch forward into the dirt. Their fingers are still moving when the rest of them stops.",
    "{name} looks down at what the ___ has done to their midsection with a kind of tired confusion, then sits down heavily and does not get back up. The light leaves their eyes before they hit the ground.",
    "The ___ shears through {name}'s sword arm at the elbow. They have just enough time to watch it fall before the blood loss takes them — first to their knees, then flat, face down in the spreading red.",
    "{name} blocks too late. The ___ punches through the raised forearm and keeps going, through jaw, through skull. They stand upright for a long, impossible moment before the body understands it's dead and falls.",
  ],
  beast: [
    "The ___ connects with a wet crunch and {name} lets out a sound — half screech, half death rattle — that has no business coming from an animal. Its legs fail one by one, and it crashes down, ribs heaving with fewer and fewer breaths until they stop entirely.",
    "{name}'s massive body shudders under the ___. It snaps at the air once, twice — pure reflex — then the jaw goes slack, tongue lolling between yellowed teeth, and it collapses with a finality that shakes the ground.",
    "The ___ splits hide and bone. {name} lets out a sound not unlike a scream, then thrashes wildly — claws raking the dirt — before going limp all at once, legs curling inward like a dying spider.",
    "Blood sprays from {name}'s flank as the ___ buries home. It stumbles, wild eyes going glassy and wrong, and hits the ground hard enough to bounce — all that muscle and heat, now just weight.",
    "{name} turns to flee and the ___ finds it between the shoulder blades. It covers another few feet on pure animal desperation before the body gives out and it skids across the ground, finally still.",
  ],
  undead: [
    "The ___ shatters {name} mid-lurch. Bones scatter — a femur cracks against the far wall, a skull bounces twice and rolls to rest, jaw hanging open in an expression of permanent outrage. Whatever animated this thing is gone.",
    "{name} continues reaching even as the ___ caves its chest inward. Only when the last threads of dark necromantic will finally unravel does the body collapse — a heap of rot and rags that smells of old graves and old sins.",
    "Ancient flesh tears like wet parchment under the ___. {name} claws at the air as its body comes apart, grave-mold and black ichor pattering against the floor, until nothing remains but a stain, a smell, and silence.",
    "The ___ takes {name} apart piece by piece until there are no more pieces capable of malice. The scattered fragments twitch for a moment with residual spite, then go still. It doesn't look like death. It looks like erasure.",
    "The necrotic light in {name}'s eyes gutters — flickers — dies. The ___ has done what the grave failed to do. The body unravels from the wound outward, collapsing into a heap of cold meat and yellowed bone that smells like an old wound finally closed.",
  ],
  fiend: [
    "{name}'s final shriek rattles the air like a struck bell. The ___ drives through its chest and the fiend's form collapses inward — a vortex of shadow and ichor — until with a thunderclap of displaced air, it is simply gone. Only the blood remains to prove it was ever here.",
    "The ___ tears through {name}'s infernal hide and the demon screams — not in pain, but in fury at the indignity. It claws at the wound as if confused by its own mortality, before the hellfire within it consumes the shell from the inside. A scorch mark. Brimstone. Silence.",
    "The ___ strikes and {name} writhes, its true form bleeding through the rupture — glimpses of something vast and wrong beneath the flesh, too many angles, too many mouths. Then it folds, black ichor running and smoking, making a sound no human throat could produce.",
    "{name} tries to speak its last curse and finds the ___ has left it no breath to curse with. Its form destabilizes from the wound outward, the carefully maintained illusion of a body losing coherence, until what falls to the ground is barely recognizable as having once been something.",
  ],
  dragon: [
    "The ___ finds the soft scales behind the jaw. {name} rears back, wings slamming the air in agony, a gout of uncontrolled breath weapon spraying wild — then the neck bends, the great head crashes down, and the silence that follows is profound enough to feel like pressure.",
    "{name}'s death is not quiet. The ___ drives home and the dragon roars until the roar becomes a gurgle. It thrashes for a terrible moment — claws raking stone, tail sweeping the ground — before the body finally settles, breath coming out in one long, dying plume of smoke.",
    "The ___ has found the gap in the scaled armor beneath the foreleg. Ancient blood pours free — dark as oil, steaming where it hits the cold air. {name} sways, the great eyes losing focus one by one, and falls like a collapsing tower. The impact cracks the floor.",
    "{name} sees the end coming and tries to take one of you with it. The ___ reaches the brain stem before it can. The dying snap misses by inches as the body crashes down, wings pinning and enormous, heat radiating off scales that are already cooling.",
  ],
  giant: [
    "The ___ connects with a sound like a tree being felled. {name} stands for one long, confused moment — blood running freely — then topples backward, arms windmilling, the impact of their fall sending a shockwave through the floor.",
    "{name}'s knees buckle under the ___. The giant tries to catch itself, hands pawing at the air, and then all that mass comes down in a crash of flesh and stone that raises dust from the ceiling. It does not get back up.",
    "The ___ opens a wound across {name}'s torso that a man could step into. The giant prods at it with one confused finger, the mind not yet communicating what the body already knows, then sits down heavily — and slowly falls sideways, and is still.",
    "{name} swings its last blow wide as the ___ finds the throat. The giant makes a sound like a waterfall shutting off, staggers two enormous steps, and then comes down. The crash is felt in the chest.",
  ],
  aberration: [
    "{name}'s alien body shudders around the ___. Something leaks from the wound that isn't quite blood — thick, bioluminescent, wrong. The creature's eyes — all of them — lose their terrible focus one by one, and it sags to the floor, still moving in ways no natural creature should.",
    "The ___ punches through {name}'s carapace with a sound like snapping obsidian. Milky fluid seeps from the rupture. The thing broadcasts one final telepathic shriek — felt rather than heard, pressure behind the eyes — before its body goes mercifully, permanently still.",
    "{name}'s tendrils go rigid, then limp. The ___ has done what the eye cannot: silenced the low-frequency wrongness the thing exuded. The body collapses, folding at joints that shouldn't exist, leaking something that smells of copper and ozone and forgotten places.",
    "The ___ tears through {name} and the creature's dying thought hits the nearest minds like a fist — a flash of something vast and cold and hungry. Then nothing. The body deflates where it falls, emptying of whatever was using it.",
  ],
  elemental: [
    "The ___ disrupts {name}'s core and the elemental comes apart in a violence of its own nature — fire spinning uncontrolled, stone fragmenting, water churning into mist. Then the animating essence fails, and the energy disperses with a crack, leaving only a mark on the ground and the smell of something spent.",
    "{name} rages as the ___ strikes — one last thrash of pure elemental fury — then the form collapses inward and is gone. The silence after is total. Elemental death doesn't leave a body. It leaves an absence.",
  ],
  fey: [
    "{name}'s laughter cuts off mid-note as the ___ strikes. The fey dissolves from the wound outward — flesh becoming light, becoming motes, becoming nothing — until only a scatter of flower petals and the fading scent of something beautiful and deeply wrong remain on the still air.",
    "The ___ finds {name} and the fey's expression shifts — not to pain, but to genuine, unfeigned surprise. They look at the wound with something like wonder. Then they unravel gracefully, a glamour dying alongside the creature that wore it. The petals that fall are the wrong color for this season.",
    "{name} tries one last charm as the ___ comes down. For a heartbeat you almost feel it catch. Then it doesn't, and the fey collapses in a cascade of dissolving illusions — each face it ever wore flickering past on the way out.",
  ],
  celestial: [
    "{name} takes the ___ and the holy light within them flickers. A celestial death is never quiet — radiant energy bleeds from the wound, and for a terrible moment the creature blazes, blinding, beautiful, and wrong. Then the flame gutters and goes out. A single white feather settles to the floor. The air smells of ozone.",
    "The ___ should not be able to kill something like {name}. It does anyway. The celestial's form burns bright in its last moment — every scar, every answered prayer, every act of mercy written in light — and then goes dark. Whatever comes next for something like this, it begins now.",
  ],
  construct: [
    "The ___ jams into {name}'s mechanism and the construct stutters — repeating its last motion over and over, slower with each cycle — until the gears grind to a stop and the animating magic bleeds out of the joints in pale sparks. The eyes go dark. Steam vents. Then nothing.",
    "{name}'s armored body crumples under the ___. It hits the ground in a crash of displaced metal and shattering crystal, parts skittering across the floor. The animating force fades from the chassis in slow pulses, like a heart winding down, until it is merely expensive rubble.",
    "The ___ finds the core housing. {name} freezes mid-motion — arm raised, mouth open — as the magic is severed from the mechanism. Then it falls, all at once, all of it, hitting the ground in a heap that will never move again under its own power.",
  ],
  ooze: [
    "The ___ cleaves through {name}'s mass, sending globules of acidic flesh spattering in every direction. The ooze strains to recohere — pseudopods reaching, matter straining back toward matter — before the animating will fails and it goes inert, spreading slowly into a faintly smoking puddle that smells of dissolution and regret.",
    "{name} can't die the way things die. It disperses. The ___ disrupts the unity that made it lethal and the mass comes apart — individual droplets losing purpose, losing motion — until what's left is just a spreading stain on the floor that will strip the varnish by morning.",
  ],
  plant: [
    "Sap sprays from the wound as the ___ finds {name}'s heartwood. The creature shudders, vines coiling inward, leaves wilting in real time as if a season is passing in seconds. Then the central stalk crashes down, branches splaying wide, and the great vegetative mass goes still and begins to smell of green rot.",
    "The ___ severs something vital and {name} — which has probably been alive for longer than the oldest person you know — comes down like a felled tree. The impact scatters seeds. Something in that is probably poetic. Right now it mostly smells like mulch.",
  ],
  swarm: [
    "The ___ disrupts the unity of {name} and the swarm shatters — each individual creature suddenly alone and confused and dying. They scatter to the edges of the room in a rustling, clicking tide that diminishes and diminishes until the last one stops moving and what was a terrible collective mind is just a carpet of small, inert bodies.",
    "{name} breaks apart under the ___. The hive-thought that bound them fails all at once and the swarm disperses into chaos — a last chaotic surge that fades in seconds as the individual minds, never large enough to sustain themselves alone, go out like candles in a wind.",
  ],
  monstrosity: [
    "The ___ buries itself in {name}'s torso. The creature makes a sound unlike anything heard before — part screech, part wet click, part something with no name — and its body seizes hard before going limp. Strange ichor pools beneath it. Whatever it was, it's less now.",
    "Whatever passes for blood in {name} floods the ground as the ___ strikes home. The creature convulses, each spasm smaller than the last, until finally the only movement is the slow cooling of its flesh and the last few twitches of its extremities, unwilling to admit what the center already knows.",
    "{name} collapses mid-lunge. The ___ has severed something vital and the creature's momentum carries it forward even as it dies — a last involuntary reach that falls short of everything it was trying to kill.",
    "The ___ hits and {name} shrieks, the sound shredding the air and leaving a ringing in the ears. Ichor sprays. The monstrosity thrashes wildly — all of it, every limb, every appendage — then stops all at once, as if a switch was thrown. It never does anything halfway, even dying.",
  ],
};

const DEATH_DESCRIPTIONS_DEFAULT = [
  "The ___ strikes the killing blow. {name} falls — hard, without grace, the way all things fall — and is still. In the sudden quiet, the violence of a moment ago feels almost impossible.",
  "{name} goes down under the ___. Not slowly, not dramatically — just suddenly absent from the fight, folded on the ground, taking up less space than expected.",
  "The ___ ends it. {name} collapses, and the sounds of battle continue around the space where they stood. The ground is wet where they hit it.",
  "{name}'s body gives out under the final strike of the ___. They had a last moment — it was brief — and now it's over, and the rest of the fight moves on without them.",
];

function pickDeathDescription(monsterType: string | undefined, name: string): string {
  const key = (monsterType ?? "").toLowerCase().split(/[\s(]/)[0];
  const pool = DEATH_DESCRIPTIONS[key] ?? DEATH_DESCRIPTIONS_DEFAULT;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace(/\{name\}/g, name);
}

function formatConditionDuration(rounds: number): string {
  if (rounds >= 10 && rounds % 10 === 0) {
    const minutes = rounds / 10;
    return `${minutes} min (${rounds} rounds)`;
  }
  return `${rounds} round${rounds === 1 ? "" : "s"}`;
}

function getCombatantAbilityModifier(combatant: Combatant, ability: AbilityKey): number {
  const override = combatant.abilityModifierOverrides?.[ability];
  if (override != null) return override;
  const monster = combatant.monsterData;
  if (!monster) return 0;
  const modifier = monster[`${ability}Mod` as keyof Monster];
  if (typeof modifier === "number") return modifier;
  const score = monster[ability];
  return typeof score === "number" ? Math.floor((score - 10) / 2) : 0;
}

function formatSignedModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function monsterWithOverrides(combatant: Combatant): Monster | undefined {
  if (!combatant.monsterData) return undefined;
  const overrides = combatant.abilityModifierOverrides;
  return {
    ...combatant.monsterData,
    hp: combatant.maxHp,
    ac: combatant.ac,
    strMod: overrides?.str ?? combatant.monsterData.strMod,
    dexMod: overrides?.dex ?? combatant.monsterData.dexMod,
    conMod: overrides?.con ?? combatant.monsterData.conMod,
    intMod: overrides?.int ?? combatant.monsterData.intMod,
    wisMod: overrides?.wis ?? combatant.monsterData.wisMod,
    chaMod: overrides?.cha ?? combatant.monsterData.chaMod,
  };
}

export default function InitiativeTracker() {
  const { open: diceOpen, setOpen: setDiceOpen, requestRoll } = useDiceRoller();
  const [showVersionDialog, setShowVersionDialog] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [combatState, setCombatState] = useState<CombatState>("setup");
  const [activeIndex, setActiveIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [mobileTab, setMobileTab] = useState<"controls" | "combat">("controls");

  // Inline stat editing (HP current, HP max, AC)
  const [editingStat, setEditingStat] = useState<{ id: string; field: "hp" | "maxHp" | "ac" | "level"; value: string } | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft | null>(null);

  // Encounter save/restore
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);
  const [autoSaveReady, setAutoSaveReady] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [encounterOwnerCampaignId, setEncounterOwnerCampaignId] = useState<number | null>(null);
  const latestEncounterRef = useRef<{ campaignId: number; payload: object } | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const previousCampaignIdRef = useRef<number | null>(null);
  const saveRevisionRef = useRef(Date.now());

  // ── Cinematic death overlay ───────────────────────────────────────────────
  const [deathScene, setDeathScene] = useState<{ name: string; text: string } | null>(null);
  useEffect(() => {
    if (!deathScene) return;
    const t = setTimeout(() => setDeathScene(null), 9000);
    return () => clearTimeout(t);
  }, [deathScene]);

  const triggerDeathScene = (combatant: Combatant) => {
    if (combatant.combatantType === "pc") return;
    if (combatant.stance === "ally") return;
    const monsterType = combatant.monsterData?.type;
    const text = pickDeathDescription(monsterType, combatant.name);
    setDeathScene({ name: combatant.name, text });
  };

  // ── XP tally: sum XP from defeated enemy monsters/NPCs ──────────────────
  const encounterXP = useMemo(() => {
    return combatants
      .filter(c => c.combatantType !== "pc" && (c.stance === "enemy" || !c.stance))
      .reduce((sum, c) => {
        const xpEach = crToXp(c.monsterData?.cr);
        if (c.isGroup && c.memberHp) {
          const deadCount = c.memberHp.filter(hp => hp <= 0).length;
          return sum + xpEach * deadCount;
        }
        return sum + ((c.isDown || c.isDead) ? xpEach : 0);
      }, 0);
  }, [combatants]);

  // Monster search
  const [monsterSearch, setMonsterSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [showTypeFilters, setShowTypeFilters] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [useCrFilter, setUseCrFilter] = useState(false);
  const [crFilter, setCrFilter] = useState<string>("");
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [showSourceFilters, setShowSourceFilters] = useState(false);
  const [encounterGroup, setEncounterGroup] = useState<Monster[]>([]);
  const [encounterGroupInitiatives, setEncounterGroupInitiatives] = useState<number[]>([]);
  const [midCombatInitiative, setMidCombatInitiative] = useState<number>(10);
  // Group counts for add-monster UI
  const [monsterGroupCount, setMonsterGroupCount] = useState(1);
  const [homebrewGroupCount, setHomebrewGroupCount] = useState(1);
  // Which member is focused for damage/heal per group combatant
  const [groupFocused, setGroupFocused] = useState<Record<string, number>>({});
  
  // Homebrew bestiary
  const [homebrewSearch, setHomebrewSearch] = useState("");
  const [debouncedHomebrewSearch, setDebouncedHomebrewSearch] = useState("");
  const [showHomebrewSection, setShowHomebrewSection] = useState(false);
  const [selectedHomebrewId, setSelectedHomebrewId] = useState<number | null>(null);
  const [homebrewImportPreview, setHomebrewImportPreview] = useState<HomebrewPreviewRow[] | null>(null);
  const [homebrewImportRaw, setHomebrewImportRaw] = useState("");
  const [homebrewImportLoading, setHomebrewImportLoading] = useState(false);
  const [homebrewMidCombatInit, setHomebrewMidCombatInit] = useState(10);
  const homebrewFileRef = useRef<HTMLInputElement>(null);

  // PC entry
  const [pcName, setPcName] = useState("");
  const [pcInitiative, setPcInitiative] = useState("");
  const [pcHp, setPcHp] = useState("");
  const [pcAc, setPcAc] = useState("");
  const [pcLevel, setPcLevel] = useState("");
  
  // NPC entry (DM-created)
  const [npcName, setNpcName] = useState("");
  const [npcHp, setNpcHp] = useState("");
  const [npcAc, setNpcAc] = useState("");
  const [npcStance, setNpcStance] = useState<NPCStance>("enemy");
  
  // HP modification inputs per combatant
  const [hpInputs, setHpInputs] = useState<Record<string, string>>({});
  const [conditionDurationInputs, setConditionDurationInputs] = useState<Record<string, string>>({});

  // Campaign party
  const { activeCampaign } = useCampaign();
  const activeCampaignIdRef = useRef<number | null>(activeCampaign?.id ?? null);
  activeCampaignIdRef.current = activeCampaign?.id ?? null;
  const { toast } = useToast();
  const qc = useQueryClient();

  // Homebrew bestiary is always scoped to the "Aetherfall" campaign regardless of active campaign
  const { data: allCampaigns = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => fetch("/api/campaigns").then(r => r.json()),
    staleTime: 300_000,
  });
  const homebrewCampaign = allCampaigns.find(c => c.name === "Aetherfall") ?? null;

  // Saved encounter for active campaign
  const {
    data: savedEncounterResult,
    refetch: refetchSavedEncounter,
    isFetching: isFetchingSavedEncounter,
  } = useQuery<{ data: any; savedAt: string } | null>({
    queryKey: ["/api/campaigns", activeCampaign?.id, "encounter"],
    queryFn: async ({ queryKey }) => {
      const campaignId = Number(queryKey[1]);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/encounter`);
        const result = response.ok ? await response.json() : null;
        return completeEncounterQuery(campaignId, activeCampaignIdRef.current, result);
      } catch {
        return null;
      }
    },
    enabled: !!activeCampaign,
    staleTime: Infinity,
    retry: false,
  });

  const enqueueEncounterRequest = (
    campaignId: number,
    method: "PUT" | "DELETE",
    payload?: object,
  ): Promise<Response> => {
    const request = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => fetch(`/api/campaigns/${campaignId}/encounter`, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      }));
    persistenceQueueRef.current = request.then(() => undefined, () => undefined);
    return request;
  };

  useEffect(() => {
    const campaignId = activeCampaign?.id ?? null;
    if (previousCampaignIdRef.current !== campaignId) {
      previousCampaignIdRef.current = campaignId;
      latestEncounterRef.current = null;
      setAutoSaveReady(false);
      setAutoSaveStatus("idle");
      setEncounterOwnerCampaignId(campaignId);
      setShowRestoreBanner(false);
      setCombatants([]);
      setCombatState("setup");
      setActiveIndex(0);
      setRound(1);
      setShowVersionDialog(true);
      setSelectedVersions([]);
    }
  }, [activeCampaign?.id]);

  // Show restore banner when a saved encounter exists and nothing is loaded yet
  useEffect(() => {
    const campaignId = activeCampaign?.id ?? null;
    if (
      campaignId == null
      || !isCurrentEncounterCampaign(campaignId, encounterOwnerCampaignId)
      || isFetchingSavedEncounter
    ) {
      setAutoSaveReady(false);
      return;
    }
    if (savedEncounterResult?.data && combatants.length === 0 && combatState === "setup") {
      setShowRestoreBanner(true);
      setAutoSaveReady(false);
    } else {
      setAutoSaveReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id, encounterOwnerCampaignId, savedEncounterResult, isFetchingSavedEncounter]);

  const encounterPayload = useMemo(() => {
    saveRevisionRef.current = Math.max(Date.now(), saveRevisionRef.current + 1);
    return {
      combatants,
      round,
      activeIndex,
      combatState,
      selectedVersions,
      saveRevision: saveRevisionRef.current,
    };
  }, [combatants, round, activeIndex, combatState, selectedVersions]);

  if (
    activeCampaign
    && previousCampaignIdRef.current === activeCampaign.id
    && encounterOwnerCampaignId === activeCampaign.id
    && autoSaveReady
    && combatants.length > 0
  ) {
    latestEncounterRef.current = { campaignId: activeCampaign.id, payload: encounterPayload };
  } else {
    latestEncounterRef.current = null;
  }

  useEffect(() => {
    if (
      !activeCampaign
      || encounterOwnerCampaignId !== activeCampaign.id
      || !autoSaveReady
      || combatants.length === 0
    ) return;
    setAutoSaveStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        const res = await enqueueEncounterRequest(activeCampaign.id, "PUT", encounterPayload);
        if (!res.ok) throw new Error("Autosave failed");
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("error");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeCampaign, encounterOwnerCampaignId, autoSaveReady, combatants.length, encounterPayload]);

  useEffect(() => {
    const flushLatestEncounter = () => {
      const latest = latestEncounterRef.current;
      if (!latest) return;
      void fetch(`/api/campaigns/${latest.campaignId}/encounter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest.payload),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flushLatestEncounter);
    return () => {
      window.removeEventListener("pagehide", flushLatestEncounter);
      flushLatestEncounter();
    };
  }, []);

  const [saveToParty, setSaveToParty] = useState(false);

  const { data: campaignParty = [] } = useQuery<CampaignCharacter[]>({
    queryKey: ["/api/campaigns", activeCampaign?.id, "characters"],
    queryFn: () => fetch(`/api/campaigns/${activeCampaign!.id}/characters`).then(r => r.json()),
    enabled: !!activeCampaign,
  });

  const saveCharacterMutation = useMutation({
    mutationFn: (char: { name: string; maxHp: number; ac: number; healingSurgesMax?: number }) =>
      fetch(`/api/campaigns/${activeCampaign!.id}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(char),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", activeCampaign?.id, "characters"] });
      toast({ title: "Saved to Campaign", description: "PC added to the party roster." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save PC to campaign.", variant: "destructive" }),
  });

  const removePartyMemberMutation = useMutation({
    mutationFn: (charId: number) =>
      fetch(`/api/campaigns/characters/${charId}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/campaigns", activeCampaign?.id, "characters"] }),
  });

  const addPartyMemberToEncounter = (char: CampaignCharacter) => {
    const defaultSurges = effectiveRuleset === "4e" ? (char.healingSurgesMax ?? 7) : 0;
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: char.name,
      initiative: 0,
      hp: char.maxHp,
      maxHp: char.maxHp,
      tempHp: 0,
      ac: char.ac,
      isMonster: false,
      combatantType: "pc",
      conditions: [],
      isDown: false,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
      healingSurges: defaultSurges,
      maxHealingSurges: defaultSurges,
      isDisabled: false,
    };
    setCombatants(prev => [...prev, newCombatant]);
  };

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(monsterSearch), 300);
    return () => clearTimeout(t);
  }, [monsterSearch]);


  // Bestiary creature types
  const { data: creatureTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/bestiary/types"],
    queryFn: () => fetch("/api/bestiary/types").then(r => r.json()),
    staleTime: Infinity,
  });

  // Bestiary CR values
  const { data: crValues = [] } = useQuery<string[]>({
    queryKey: ["/api/bestiary/cr-values"],
    queryFn: () => fetch("/api/bestiary/cr-values").then(r => r.json()),
    staleTime: Infinity,
  });

  // Bestiary source books
  const { data: bestiarySources = [] } = useQuery<string[]>({
    queryKey: ["/api/bestiary/sources"],
    queryFn: () => fetch("/api/bestiary/sources").then(r => r.json()),
    staleTime: Infinity,
  });

  // Live monster search results
  const activeCr = useCrFilter && crFilter ? crFilter : undefined;
  const activeSearch = debouncedSearch.trim().length > 0 || typeFilters.length > 0 || !!activeCr || sourceFilters.length > 0;
  const { data: monsterResults = [], isFetching: loadingMonsters } = useQuery<Monster[]>({
    queryKey: ["/api/bestiary/monsters", debouncedSearch, typeFilters.join(","), activeCr, sourceFilters.join("|")],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (typeFilters.length) params.set("types", typeFilters.join(","));
      if (sourceFilters.length) params.set("sources", sourceFilters.join("|"));
      if (activeCr) params.set("cr", activeCr);
      params.set("limit", "20");
      return fetch(`/api/bestiary/monsters?${params}`).then(r => r.json());
    },
    enabled: activeSearch,
    staleTime: 30_000,
  });

  // Fetch full detail when a monster is selected
  const { data: selectedMonster, isLoading: loadingDetail } = useQuery<Monster>({
    queryKey: ["/api/bestiary/monsters", selectedMonsterId],
    queryFn: () => fetch(`/api/bestiary/monsters/${selectedMonsterId}`).then(r => r.json()),
    enabled: !!selectedMonsterId,
    staleTime: Infinity,
  });

  // Auto-roll initiative when a monster is selected during active combat
  useEffect(() => {
    if (combatState === "active" && selectedMonster) {
      setMidCombatInitiative(rollInitiative(selectedMonster.dexMod));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonster?.index, combatState]);

  // Homebrew search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHomebrewSearch(homebrewSearch), 300);
    return () => clearTimeout(t);
  }, [homebrewSearch]);

  // Homebrew monsters — always scoped to the Aetherfall campaign
  const { data: homebrewMonsters = [], refetch: refetchHomebrew } = useQuery<HomebrewMonster[]>({
    queryKey: ["/api/campaigns", homebrewCampaign?.id, "homebrew-bestiary"],
    queryFn: () => fetch(`/api/campaigns/${homebrewCampaign!.id}/homebrew-bestiary`).then(r => r.json()),
    enabled: !!homebrewCampaign,
    staleTime: 60_000,
  });

  // Auto-roll homebrew initiative when active combat + selection changes
  useEffect(() => {
    if (combatState === "active" && selectedHomebrewId != null) {
      const m = homebrewMonsters.find(hm => hm.id === selectedHomebrewId);
      if (m) setHomebrewMidCombatInit(rollInitiative(m.dexScore != null ? Math.floor((m.dexScore - 10) / 2) : 0));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHomebrewId, combatState]);

  const filteredHomebrew = debouncedHomebrewSearch.trim()
    ? homebrewMonsters.filter(m => m.name.toLowerCase().includes(debouncedHomebrewSearch.toLowerCase()))
    : homebrewMonsters;

  const handleHomebrewFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target?.result as string;
      setHomebrewImportRaw(raw);
      setHomebrewImportPreview(parseCSVClientSide(raw));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmHomebrewImport = async () => {
    if (!homebrewCampaign || !homebrewImportRaw) return;
    setHomebrewImportLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${homebrewCampaign.id}/homebrew-bestiary/import`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: homebrewImportRaw,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
       toast({ title: `Added ${data.count} monsters`, description: `Appended to the Aetherfall homebrew bestiary.` });
      setHomebrewImportPreview(null);
      setHomebrewImportRaw("");
      refetchHomebrew();
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setHomebrewImportLoading(false);
    }
  };

  const clearHomebrewBestiary = async () => {
    if (!homebrewCampaign) return;
    if (!confirm(`Clear all homebrew monsters from the Aetherfall bestiary? This cannot be undone.`)) return;
    await fetch(`/api/campaigns/${homebrewCampaign.id}/homebrew-bestiary`, { method: "DELETE" });
    setSelectedHomebrewId(null);
    refetchHomebrew();
    toast({ title: "Homebrew bestiary cleared" });
  };

  const addHomebrewMonster = (m: HomebrewMonster, count = 1) => {
    const monster = homebrewToMonster(m);
    const init = combatState === "active" ? homebrewMidCombatInit : 0;
    if (count > 1) {
      addGroupToEncounter(monster, count, init);
    } else {
      addSingleMonsterToEncounter(monster, init);
    }
    setSelectedHomebrewId(null);
  };

  const handleVersionConfirm = () => {
    if (selectedVersions.length === 0) return;
    setShowVersionDialog(false);
  };

  const toggleVersion = (version: string) => {
    setSelectedVersions(prev => 
      prev.includes(version) ? prev.filter(v => v !== version) : [...prev, version]
    );
  };

  const rollInitiative = (dexMod?: number) => {
    const mod = dexMod ?? 0;
    return Math.floor(Math.random() * 20) + 1 + mod;
  };

  const toggleTypeFilter = (type: string) => {
    setTypeFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    setSelectedMonsterId(null);
    setEncounterGroup([]);
    setEncounterGroupInitiatives([]);
  };

  const toggleSourceFilter = (source: string) => {
    setSourceFilters(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]);
    setSelectedMonsterId(null);
    setEncounterGroup([]);
    setEncounterGroupInitiatives([]);
  };

  const buildEncounter = async () => {
    setIsRandomizing(true);
    setEncounterGroup([]);
    setEncounterGroupInitiatives([]);
    try {
      let group: Monster[] = [];
      if (useCrFilter && crFilter) {
        const params = new URLSearchParams();
        params.set("cr", crFilter);
        if (typeFilters.length) params.set("types", typeFilters.join(","));
        if (sourceFilters.length) params.set("sources", sourceFilters.join("|"));
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        const res = await fetch(`/api/bestiary/encounter?${params}`);
        if (!res.ok) {
          toast({ title: "No monsters found", description: "Try different filters.", variant: "destructive" });
          return;
        }
        group = await res.json();
      } else {
        const params = new URLSearchParams();
        if (typeFilters.length) params.set("types", typeFilters.join(","));
        if (sourceFilters.length) params.set("sources", sourceFilters.join("|"));
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        const res = await fetch(`/api/bestiary/monsters/random?${params}`);
        if (!res.ok) {
          toast({ title: "No monsters found", description: "Try different filters.", variant: "destructive" });
          return;
        }
        const monster: Monster = await res.json();
        group = [monster];
      }
      setEncounterGroup(group);
      setEncounterGroupInitiatives(group.map(m => rollInitiative(m.dexMod)));
      setSelectedMonsterId(null);
      // Auto-roll midCombatInitiative for single-monster result
      if (group.length === 1) setMidCombatInitiative(rollInitiative(group[0].dexMod));
    } catch {
      toast({ title: "Error", description: "Failed to build encounter.", variant: "destructive" });
    } finally {
      setIsRandomizing(false);
    }
  };

  const addGroupToEncounter = (monster: Monster, count: number, initiative?: number) => {
    const memberHps = Array.from({ length: count }, () => {
      const hp = monster.hit_dice
        ? rollMonsterHp(monster.hit_dice, monster.hp)
        : rollMonsterHp("", monster.hp);
      return Math.max(1, hp);
    });
    const sharedMaxHp = monster.hp > 0 ? monster.hp : memberHps[0];
    const initValue = initiative !== undefined
      ? initiative
      : (combatState === "active" ? rollInitiative(monster.dexMod) : 0);
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: monster.name,
      initiative: initValue,
      hp: memberHps[0],
      maxHp: sharedMaxHp,
      tempHp: 0,
      ac: monster.ac,
      isMonster: true,
      combatantType: "monster",
      conditions: [],
      isDown: false,
      monsterData: monster,
      stance: "enemy",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
      joiningNextRound: combatState === "active",
      isGroup: true,
      memberHp: memberHps,
    };
    setCombatants(prev => [...prev, newCombatant]);
  };

  const addSingleMonsterToEncounter = (monster: Monster, initiative?: number) => {
    const baseName = monster.name;
    const existingCount = combatants.filter(c =>
      c.name === baseName || c.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} #\\d+$`))
    ).length;
    const displayName = existingCount === 0 ? baseName : `${baseName} #${existingCount + 1}`;
    if (existingCount === 1) {
      setCombatants(prev => prev.map(c => c.name === baseName ? { ...c, name: `${baseName} #1` } : c));
    }
    const rolledHp = monster.hit_dice
      ? rollMonsterHp(monster.hit_dice, monster.hp)
      : rollMonsterHp("", monster.hp);
    const initValue = initiative !== undefined
      ? initiative
      : (combatState === "active" ? rollInitiative(monster.dexMod) : 0);
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: displayName,
      initiative: initValue,
      hp: Math.max(1, rolledHp),
      maxHp: Math.max(1, rolledHp),
      tempHp: 0,
      ac: monster.ac,
      isMonster: true,
      combatantType: "monster",
      conditions: [],
      isDown: false,
      monsterData: monster,
      stance: "enemy",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
      joiningNextRound: combatState === "active",
    };
    setCombatants(prev => [...prev, newCombatant]);
  };

  const rerollGroupInitiative = (index: number) => {
    setEncounterGroupInitiatives(prev => {
      const next = [...prev];
      next[index] = rollInitiative(encounterGroup[index]?.dexMod);
      return next;
    });
  };

  const addAllEncounterMonsters = () => {
    encounterGroup.forEach((m, i) => addSingleMonsterToEncounter(m, encounterGroupInitiatives[i]));
    setEncounterGroup([]);
    setEncounterGroupInitiatives([]);
  };

  const addMonster = () => {
    if (!selectedMonster) return;
    const init = combatState === "active" ? midCombatInitiative : 0;
    if (monsterGroupCount > 1) {
      addGroupToEncounter(selectedMonster, monsterGroupCount, init);
    } else {
      addSingleMonsterToEncounter(selectedMonster, init);
    }
    setSelectedMonsterId(null);
    setMonsterSearch("");
    setMonsterGroupCount(1);
  };

  const applyGroupDamage = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant?.isGroup || !combatant.memberHp) return;
    const damage = getHpInput(id);
    if (damage <= 0) return;
    const focIdx = groupFocused[id] ?? 0;
    const wasAlive = combatant.memberHp[focIdx] > 0;
    const groupDamage = calculateGroupDamage(combatant.memberHp, focIdx, damage);
    const newMemberHp = groupDamage.memberHp;
    const memberJustDied = wasAlive && newMemberHp[focIdx] <= 0;
    updateCombatant(id, {
      memberHp: newMemberHp,
      isDown: groupDamage.isDown,
      isDead: groupDamage.isDead,
    });
    clearHpInput(id);
    if (memberJustDied) {
      // Use a member-specific name for the death scene
      const memberName = `${combatant.name} #${focIdx + 1}`;
      const monsterType = combatant.monsterData?.type;
      const text = pickDeathDescription(monsterType, memberName);
      setDeathScene({ name: memberName, text });
    }
    // Auto-focus next alive member
    if (newMemberHp[focIdx] <= 0) {
      const next = newMemberHp.findIndex((h, i) => i !== focIdx && h > 0);
      if (next >= 0) setGroupFocused(prev => ({ ...prev, [id]: next }));
    }
  };

  const applyGroupHeal = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant?.isGroup || !combatant.memberHp) return;
    const heal = getHpInput(id);
    if (heal <= 0) return;
    const focIdx = groupFocused[id] ?? 0;
    const newMemberHp = [...combatant.memberHp];
    newMemberHp[focIdx] = Math.min(combatant.maxHp, newMemberHp[focIdx] + heal);
    const allDead = newMemberHp.every(h => h <= 0);
    updateCombatant(id, { memberHp: newMemberHp, isDown: allDead, isDead: allDead });
    clearHpInput(id);
  };

  const addGroupMember = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant?.isGroup || !combatant.memberHp) return;
    const hp = combatant.maxHp;
    updateCombatant(id, { memberHp: [...combatant.memberHp, hp], isDown: false, isDead: false });
  };

  const removeGroupMember = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant?.isGroup || !combatant.memberHp || combatant.memberHp.length <= 1) return;
    const newMemberHp = combatant.memberHp.slice(0, -1);
    const allDead = newMemberHp.every(h => h <= 0);
    const focused = groupFocused[id] ?? 0;
    if (focused >= newMemberHp.length) {
      setGroupFocused(prev => ({ ...prev, [id]: newMemberHp.length - 1 }));
    }
    updateCombatant(id, { memberHp: newMemberHp, isDown: allDead, isDead: allDead });
  };

  const addPC = () => {
    if (!pcName) return;
    const maxHp = pcHp ? parseInt(pcHp) : 0;
    // 4e: Calculate healing surges (typically Con mod + 2-3, we'll default to Con-based formula: quarter max HP heal value, ~7 surges)
    const defaultSurges = effectiveRuleset === "4e" ? 7 : 0;
    
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: pcName,
      initiative: pcInitiative ? parseInt(pcInitiative) : 0,
      hp: maxHp,
      maxHp: maxHp,
      tempHp: 0,
      ac: pcAc ? parseInt(pcAc) : 0,
      isMonster: false,
      combatantType: "pc",
      conditions: [],
      isDown: false,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
      healingSurges: defaultSurges,
      maxHealingSurges: defaultSurges,
      isDisabled: false,
      level: pcLevel ? Math.min(20, Math.max(1, parseInt(pcLevel))) : undefined,
    };
    setCombatants(prev => [...prev, newCombatant]);
    setPcName("");
    setPcInitiative("");
    setPcHp("");
    setPcAc("");
    setPcLevel("");
  };

  const addNPC = () => {
    if (!npcName) return;
    
    // Auto-number NPCs like monsters
    const baseName = npcName;
    const existingCount = combatants.filter(c => 
      c.name === baseName || c.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} #\\d+$`))
    ).length;
    
    const displayName = existingCount === 0 ? baseName : `${baseName} #${existingCount + 1}`;
    
    if (existingCount === 1) {
      setCombatants(prev => prev.map(c => 
        c.name === baseName ? { ...c, name: `${baseName} #1` } : c
      ));
    }
    
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: displayName,
      initiative: 0,
      hp: npcHp ? parseInt(npcHp) : 10,
      maxHp: npcHp ? parseInt(npcHp) : 10,
      tempHp: 0,
      ac: npcAc ? parseInt(npcAc) : 10,
      isMonster: true,
      combatantType: "npc",
      conditions: [],
      isDown: false,
      stance: npcStance,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
    };
    setCombatants(prev => [...prev, newCombatant]);
    setNpcName("");
    setNpcHp("");
    setNpcAc("");
  };

  const removeCombatant = (id: string) => {
    setCombatants(combatants.filter(c => c.id !== id));
  };

  const updateCombatant = (id: string, updates: Partial<Combatant>) => {
    setCombatants(combatants.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const openCorrectionEditor = (combatant: Combatant) => {
    const focusedMember = groupFocused[combatant.id] ?? 0;
    const currentHp = combatant.isGroup && combatant.memberHp
      ? (combatant.memberHp[focusedMember] ?? combatant.hp)
      : combatant.hp;
    setCorrectionDraft({
      id: combatant.id,
      hp: String(currentHp),
      maxHp: String(combatant.maxHp),
      initiative: String(combatant.initiative),
      ac: String(combatant.ac),
      modifiers: {
        str: String(getCombatantAbilityModifier(combatant, "str")),
        dex: String(getCombatantAbilityModifier(combatant, "dex")),
        con: String(getCombatantAbilityModifier(combatant, "con")),
        int: String(getCombatantAbilityModifier(combatant, "int")),
        wis: String(getCombatantAbilityModifier(combatant, "wis")),
        cha: String(getCombatantAbilityModifier(combatant, "cha")),
      },
    });
  };

  const saveCorrections = () => {
    if (!correctionDraft) return;
    const combatant = combatants.find(c => c.id === correctionDraft.id);
    if (!combatant) return;

    const hp = Number(correctionDraft.hp);
    const maxHp = Number(correctionDraft.maxHp);
    const initiative = Number(correctionDraft.initiative);
    const ac = Number(correctionDraft.ac);
    const modifiers = Object.fromEntries(
      ABILITIES.map(({ key }) => [key, Number(correctionDraft.modifiers[key])]),
    ) as Record<AbilityKey, number>;
    const allValues = [hp, maxHp, initiative, ac, ...Object.values(modifiers)];
    if (!allValues.every(Number.isInteger) || maxHp < 1 || ac < 0) {
      toast({
        title: "Check corrected stats",
        description: "Use whole numbers, with base HP at least 1 and AC at least 0.",
        variant: "destructive",
      });
      return;
    }

    const activeId = getSortedCombatants()[activeIndex]?.id;
    const focusedMember = groupFocused[combatant.id] ?? 0;
    const isIncapacitated = ["Unconscious", "Paralyzed", "Petrified", "Incapacitated", "Stunned"].some(
      condition => combatant.conditions.includes(condition),
    );
    let corrected: Combatant;

    if (combatant.isGroup && combatant.memberHp) {
      const memberHp = combatant.memberHp.map(value => Math.min(value, maxHp));
      memberHp[focusedMember] = Math.min(hp, maxHp);
      const allDead = memberHp.every(value => value <= 0);
      corrected = {
        ...combatant,
        initiative,
        ac,
        maxHp,
        hp: allDead ? 0 : Math.max(...memberHp),
        memberHp,
        isDown: allDead || isIncapacitated,
        isDead: allDead,
        abilityModifierOverrides: modifiers,
      };
    } else {
      const correctedHp = Math.min(hp, maxHp);
      corrected = {
        ...combatant,
        initiative,
        ac,
        maxHp,
        hp: correctedHp,
        isDown: correctedHp <= 0 || isIncapacitated,
        isDead: correctedHp > 0 ? false : combatant.isDead,
        isStable: correctedHp > 0 ? false : combatant.isStable,
        isDisabled: effectiveRuleset === "3.5e" && correctedHp === 0,
        abilityModifierOverrides: modifiers,
      };
    }

    const correctedResult = sortCombatantsPreservingActiveTurn(combatants, corrected, activeId);
    setCombatants(correctedResult.combatants);
    if (correctedResult.activeIndex !== null) setActiveIndex(correctedResult.activeIndex);
    setCorrectionDraft(null);
    toast({ title: "Combatant corrected", description: `${combatant.name}'s encounter stats were updated.` });
  };

  const commitStatEdit = () => {
    if (!editingStat) return;
    const { id, field, value } = editingStat;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      const combatant = combatants.find(c => c.id === id);
      if (!combatant) return;
      if (field === "hp") {
        updateCombatant(id, { hp: parsed });
      } else if (field === "maxHp") {
        const newMax = Math.max(1, parsed);
        updateCombatant(id, { maxHp: newMax, hp: Math.min(combatant.hp, newMax) });
      } else if (field === "ac") {
        updateCombatant(id, { ac: Math.max(0, parsed) });
      } else if (field === "level") {
        updateCombatant(id, { level: Math.min(20, Math.max(1, parsed)) });
      }
    }
    setEditingStat(null);
  };

  const updateInitiative = (id: string, value: string) => {
    updateCombatant(id, { initiative: parseInt(value) || 0 });
  };

  const getHpInput = (id: string): number => {
    const value = parseInt(hpInputs[id] || "0");
    return isNaN(value) ? 0 : Math.abs(value);
  };

  const clearHpInput = (id: string) => {
    setHpInputs(prev => ({ ...prev, [id]: "" }));
  };

  // Get effective death ruleset
  const effectiveRuleset = getEffectiveRuleset(selectedVersions);

  const applyDamage = (id: string, isCrit: boolean = false) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    
    let damage = getHpInput(id);
    if (damage <= 0) return;
    
    // Handle temp HP first (same for all editions)
    let newTempHp = combatant.tempHp;
    if (newTempHp > 0) {
      if (damage <= newTempHp) {
        newTempHp -= damage;
        damage = 0;
      } else {
        damage -= newTempHp;
        newTempHp = 0;
      }
    }
    
    if (damage === 0) {
      updateCombatant(id, { tempHp: newTempHp });
      clearHpInput(id);
      return;
    }

    // Edition-specific damage handling
    if (effectiveRuleset === "3.5e") {
      // 3.5e: HP can go negative, death at -10
      const newHp = combatant.hp - damage;
      const isDead = newHp <= -10;
      const isDisabled = newHp === 0;
      const isDown = newHp < 0; // Dying state
      
      updateCombatant(id, {
        hp: newHp,
        tempHp: newTempHp,
        isDown: isDown || isDisabled,
        isDisabled,
        isDead,
        // 3.5e: Taking damage while stable breaks stability (start bleeding again)
        isStable: isDead || newHp > 0 ? false : (newHp < 0 ? false : combatant.isStable)
      });
      if ((isDown || isDead) && !combatant.isDown) triggerDeathScene(combatant);
    } else if (effectiveRuleset === "4e") {
      // 4e: Death at negative half max HP
      const newHp = combatant.hp - damage;
      const halfMaxHp = Math.floor(combatant.maxHp / 2);
      const instantDeath = newHp <= -halfMaxHp;
      const isDown = newHp <= 0;
      
      // Damage at 0 HP causes auto failure (like 5e but different)
      if (combatant.hp <= 0 && !combatant.isDead && combatant.combatantType === "pc") {
        const failures = isCrit ? 2 : 1;
        const newFailures = Math.min(3, combatant.deathSaveFailures + failures);
        updateCombatant(id, {
          hp: Math.min(0, newHp), // Keep at 0 or lower
          tempHp: newTempHp,
          deathSaveFailures: newFailures,
          isStable: false,
          isDead: instantDeath || newFailures >= 3,
          isDown: true
        });
      } else {
        updateCombatant(id, {
          hp: newHp,
          tempHp: newTempHp,
          isDown,
          isDead: instantDeath,
          isStable: isDown ? false : combatant.isStable
        });
        if ((isDown || instantDeath) && !combatant.isDown) triggerDeathScene(combatant);
      }
    } else {
      // 5e/One D&D: HP floors at 0, death saves, massive damage rule
      
      // If PC is already at 0 HP, damage causes automatic death save failures
      if (combatant.combatantType === "pc" && combatant.hp === 0 && !combatant.isDead) {
        // Massive damage at 0 HP = instant death
        if (damage >= combatant.maxHp) {
          updateCombatant(id, {
            isDead: true,
            isDown: true,
            deathSaveFailures: 3,
            deathSaveSuccesses: 0
          });
          clearHpInput(id);
          return;
        }
        
        const failures = isCrit ? 2 : 1;
        const newFailures = Math.min(3, combatant.deathSaveFailures + failures);
        updateCombatant(id, {
          deathSaveFailures: newFailures,
          deathSaveSuccesses: 0,
          isStable: false,
          isDead: newFailures >= 3,
          isDown: true
        });
        clearHpInput(id);
        return;
      }
      
      // Calculate HP with floor at 0
      let newHp = combatant.hp;
      let leftoverDamage = 0;
      
      if (damage > newHp) {
        leftoverDamage = damage - newHp;
        newHp = 0;
      } else {
        newHp = newHp - damage;
      }
      
      // Check for massive damage instant death (leftover damage >= max HP)
      const instantDeath = combatant.combatantType === "pc" && newHp === 0 && leftoverDamage >= combatant.maxHp;
      
      updateCombatant(id, { 
        hp: newHp, 
        tempHp: newTempHp,
        isDown: newHp === 0,
        isStable: newHp === 0 ? false : combatant.isStable,
        isDead: instantDeath,
        deathSaveFailures: instantDeath ? 3 : combatant.deathSaveFailures
      });
      if (newHp === 0 && combatant.hp > 0) triggerDeathScene(combatant);
    }
    
    clearHpInput(id);
  };

  const applyHeal = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    
    const heal = getHpInput(id);
    if (heal <= 0) return;
    
    let newHp: number;
    
    if (effectiveRuleset === "3.5e") {
      // 3.5e: Healing adds directly from negative total
      newHp = Math.min(combatant.maxHp, combatant.hp + heal);
    } else if (effectiveRuleset === "4e") {
      // 4e: Healing treats you as at 0, then adds
      if (combatant.hp < 0) {
        newHp = Math.min(combatant.maxHp, heal); // From 0 + heal
      } else {
        newHp = Math.min(combatant.maxHp, combatant.hp + heal);
      }
    } else {
      // 5e: Standard healing (HP can't go below 0 anyway)
      newHp = Math.min(combatant.maxHp, combatant.hp + heal);
    }
    
    // Update statuses based on new HP
    const updates: Partial<Combatant> = { 
      hp: newHp, 
      isDown: newHp <= 0,
      isDisabled: effectiveRuleset === "3.5e" && newHp === 0
    };
    
    // Reset death saves when healed above 0 (5e) or stabilizing states
    if (combatant.combatantType === "pc" && newHp > 0) {
      // 4e: Don't reset failures (they persist until rest)
      if (effectiveRuleset !== "4e") {
        updates.deathSaveFailures = 0;
      }
      updates.deathSaveSuccesses = 0;
      updates.isStable = false;
    }
    
    updateCombatant(id, updates);
    clearHpInput(id);
  };

  const applyTempHp = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    
    const tempHp = getHpInput(id);
    if (tempHp <= 0) return;
    
    const newTempHp = Math.max(combatant.tempHp, tempHp);
    
    updateCombatant(id, { tempHp: newTempHp });
    clearHpInput(id);
  };

  const [lastDeathSaveRoll, setLastDeathSaveRoll] = useState<{id: string, roll: number, result?: string} | null>(null);

  // 3.5e: 10% stabilization roll (d100, roll 1-10 = stabilize)
  const roll35eStabilization = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.hp >= 0 || combatant.isDead || combatant.isStable) return;
    
    const roll = Math.floor(Math.random() * 100) + 1; // 1-100
    const stabilized = roll <= 10; // 10% chance
    
    setLastDeathSaveRoll({ id, roll, result: stabilized ? "Stabilized!" : "Still dying..." });
    
    if (stabilized) {
      updateCombatant(id, { isStable: true });
    } else {
      // Lose 1 HP if not stabilized
      const newHp = combatant.hp - 1;
      const isDead = newHp <= -10;
      updateCombatant(id, { hp: newHp, isDead });
    }
    
    setTimeout(() => setLastDeathSaveRoll(null), 3000);
  };

  // 4e: Death save with different thresholds
  const roll4eDeathSave = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.hp > 0 || combatant.isDead) return;
    
    const roll = Math.floor(Math.random() * 20) + 1;
    
    let newSuccesses = combatant.deathSaveSuccesses;
    let newFailures = combatant.deathSaveFailures;
    let newHp = combatant.hp;
    let isStable = combatant.isStable;
    let isDead = false;
    let result = "";
    
    if (roll === 20) {
      // Nat 20: Spend healing surge to recover
      const surges = combatant.healingSurges || 0;
      if (surges > 0) {
        // Spend surge to heal quarter max HP
        newHp = Math.floor(combatant.maxHp / 4);
        result = `Nat 20! Surge used, ${newHp} HP!`;
        updateCombatant(id, {
          hp: newHp,
          healingSurges: surges - 1,
          deathSaveSuccesses: 0,
          deathSaveFailures: newFailures, // 4e: failures persist
          isStable: false,
          isDead: false,
          isDown: false
        });
      } else {
        result = "Nat 20, but no surges!";
        // Treat as regular success
        newSuccesses = Math.min(3, newSuccesses + 1);
        if (newSuccesses >= 3) isStable = true;
        updateCombatant(id, {
          deathSaveSuccesses: newSuccesses,
          isStable,
          isDown: true
        });
      }
    } else if (roll <= 9) {
      // 4e: 1-9 = failure
      newFailures = Math.min(3, newFailures + 1);
      if (newFailures >= 3) isDead = true;
      result = `${roll} - Failure!`;
      updateCombatant(id, {
        deathSaveFailures: newFailures,
        isDead,
        isDown: true
      });
    } else {
      // 10-19: No change
      result = `${roll} - No change`;
    }
    
    setLastDeathSaveRoll({ id, roll, result });
    setTimeout(() => setLastDeathSaveRoll(null), 3000);
  };

  // 5e/One D&D death save
  const roll5eDeathSave = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.hp > 0 || combatant.isDead || combatant.isStable) return;
    
    const roll = Math.floor(Math.random() * 20) + 1;
    
    let newSuccesses = combatant.deathSaveSuccesses;
    let newFailures = combatant.deathSaveFailures;
    let newHp = combatant.hp;
    let isStable = false;
    let isDead = false;
    let isDown = true;
    let result = "";
    
    if (roll === 20) {
      // Nat 20: regain 1 HP and wake up
      newHp = 1;
      newSuccesses = 0;
      newFailures = 0;
      isDown = false;
      result = "Nat 20! Awake with 1 HP!";
    } else if (roll === 1) {
      // Nat 1: two failures
      newFailures = Math.min(3, newFailures + 2);
      if (newFailures >= 3) isDead = true;
      result = "Nat 1! Two failures!";
    } else if (roll >= 10) {
      // Success
      newSuccesses = Math.min(3, newSuccesses + 1);
      if (newSuccesses >= 3) isStable = true;
      result = `${roll} - Success!`;
    } else {
      // Failure
      newFailures = Math.min(3, newFailures + 1);
      if (newFailures >= 3) isDead = true;
      result = `${roll} - Failure!`;
    }
    
    updateCombatant(id, {
      hp: newHp,
      deathSaveSuccesses: newSuccesses,
      deathSaveFailures: newFailures,
      isStable,
      isDead,
      isDown
    });
    
    setLastDeathSaveRoll({ id, roll, result });
    setTimeout(() => setLastDeathSaveRoll(null), 3000);
  };

  // Unified death save function that dispatches to edition-specific handler
  const rollDeathSave = (id: string) => {
    if (effectiveRuleset === "3.5e") {
      roll35eStabilization(id);
    } else if (effectiveRuleset === "4e") {
      roll4eDeathSave(id);
    } else {
      roll5eDeathSave(id);
    }
  };

  const stabilizePC = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.hp > 0 || combatant.isDead) return;
    
    // 4e: Failures persist until rest, so don't reset them on stabilization
    const updates: Partial<Combatant> = {
      deathSaveSuccesses: 0,
      isStable: true,
      isDown: true
    };
    
    // Only reset failures for non-4e editions
    if (effectiveRuleset !== "4e") {
      updates.deathSaveFailures = 0;
    }
    
    updateCombatant(id, updates);
  };

  const toggleCondition = (id: string, condition: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    const isRemoving = combatant.conditions.includes(condition);
    const newConditions = isRemoving
      ? combatant.conditions.filter(c => c !== condition)
      : [...combatant.conditions, condition];
    const newDurations = { ...(combatant.conditionDurations ?? {}) };

    if (isRemoving) {
      delete newDurations[condition];
    } else {
      const durationText = conditionDurationInputs[id]?.trim() ?? "";
      if (durationText !== "") {
        const durationMinutes = Number(durationText);
        if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
          toast({
            title: "Invalid duration",
            description: "Enter a non-negative number of minutes, or leave it blank for an untimed condition.",
            variant: "destructive",
          });
          return;
        }
        newDurations[condition] = Math.round(durationMinutes * 10);
      }
    }
    
    const isIncapacitated = ["Unconscious", "Paralyzed", "Petrified", "Incapacitated", "Stunned"].some(
      c => newConditions.includes(c)
    );
    const isOtherwiseDown = combatant.isDead
      || (!combatant.isGroup && combatant.hp <= 0)
      || !!(combatant.isGroup && combatant.memberHp?.every(hp => hp <= 0));
    
    updateCombatant(id, { 
      conditions: newConditions,
      conditionDurations: Object.keys(newDurations).length > 0 ? newDurations : undefined,
      isDown: isOtherwiseDown || isIncapacitated
    });
    if (!isRemoving) {
      setConditionDurationInputs(prev => ({ ...prev, [id]: "" }));
    }
  };

  const cycleStance = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || !combatant.isMonster) return;
    const stanceOrder: NPCStance[] = ["ally", "neutral", "enemy"];
    const currentIndex = stanceOrder.indexOf(combatant.stance || "enemy");
    const nextStance = stanceOrder[(currentIndex + 1) % stanceOrder.length];
    updateCombatant(id, { stance: nextStance });
  };

  const getSortedCombatants = () => {
    return [...combatants].sort((a, b) => b.initiative - a.initiative);
  };

  // Check if a combatant should be skipped in initiative
  const shouldSkipTurn = (c: Combatant): boolean => {
    // Reinforcements waiting for the next round
    if (c.joiningNextRound) return true;
    // Dead combatants are skipped
    if (c.isDead) return true;
    
    if (effectiveRuleset === "3.5e") {
      // 3.5e: Disabled (0 HP) can still act, Dying (negative) gets stabilization roll
      if (c.isDisabled) return false; // Can still take action
      if (c.hp < 0 && !c.isStable) return false; // Gets stabilization roll
      if (c.hp < 0 && c.isStable) return true; // Stable and unconscious
    } else if (effectiveRuleset === "4e") {
      // 4e: Death saves until stable
      if (c.combatantType === "pc" && c.hp <= 0 && c.isStable) return true;
      if (c.combatantType === "pc" && c.hp <= 0 && !c.isDead) return false; // Gets death save
    } else {
      // 5e: Stable PCs at 0 HP are skipped, otherwise get death saves
      if (c.combatantType === "pc" && c.hp === 0 && c.isStable) return true;
      if (c.combatantType === "pc" && c.hp === 0 && !c.isDead && !c.isStable) return false;
    }
    
    // Other downed combatants (monsters/NPCs) are skipped
    if (c.isDown) return true;
    return false;
  };

  const startCombat = () => {
    if (combatants.length === 0) return;
    const sorted = getSortedCombatants();
    setCombatants(sorted);
    setCombatState("active");
    
    // Find first combatant that shouldn't be skipped
    let startIndex = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (!shouldSkipTurn(sorted[i])) {
        startIndex = i;
        break;
      }
    }
    
    setActiveIndex(startIndex);
    setRound(1);
  };

  const nextTurn = () => {
    const sorted = getSortedCombatants();
    let nextIndex = (activeIndex + 1) % sorted.length;
    let attempts = 0;
    
    // Skip combatants that should be skipped
    while (shouldSkipTurn(sorted[nextIndex]) && attempts < sorted.length) {
      nextIndex = (nextIndex + 1) % sorted.length;
      attempts++;
    }
    
    // Check for new round
    if (nextIndex <= activeIndex) {
      const expiredConditions: string[] = [];
      const updatedCombatants = sorted.map(combatant => {
        const remainingDurations = { ...(combatant.conditionDurations ?? {}) };
        const remainingConditions = combatant.conditions.filter(condition => {
          const remainingRounds = remainingDurations[condition];
          if (remainingRounds == null) return true;

          const nextRemainingRounds = remainingRounds - 1;
          if (nextRemainingRounds <= 0) {
            delete remainingDurations[condition];
            expiredConditions.push(`${combatant.name}: ${condition}`);
            return false;
          }

          remainingDurations[condition] = nextRemainingRounds;
          return true;
        });
        const isIncapacitated = ["Unconscious", "Paralyzed", "Petrified", "Incapacitated", "Stunned"].some(
          condition => remainingConditions.includes(condition)
        );
        const isOtherwiseDown = combatant.isDead
          || (!combatant.isGroup && combatant.hp <= 0)
          || !!(combatant.isGroup && combatant.memberHp?.every(hp => hp <= 0));

        return {
          ...combatant,
          conditions: remainingConditions,
          conditionDurations: Object.keys(remainingDurations).length > 0 ? remainingDurations : undefined,
          isDown: isOtherwiseDown || isIncapacitated,
          joiningNextRound: false,
        };
      });
      setCombatants(updatedCombatants);
      setRound(r => r + 1);
      if (expiredConditions.length > 0) {
        toast({
          title: "Conditions expired",
          description: expiredConditions.join(" · "),
        });
      }
    }
    
    setActiveIndex(nextIndex);
  };

  const endCombat = () => {
    setCombatState("ended");
  };

  // ── Encounter persistence ──────────────────────────────────────────────────

  const saveCurrentEncounter = async () => {
    if (!activeCampaign) return;
    setIsSavingEncounter(true);
    try {
      const res = await enqueueEncounterRequest(activeCampaign.id, "PUT", encounterPayload);
      if (!res.ok) throw new Error("Save failed");
      setAutoSaveStatus("saved");
      toast({ title: "Encounter saved ✓", description: "You can close the app — it'll be here next session." });
      refetchSavedEncounter();
    } catch {
      toast({ title: "Save failed", description: "Could not save the encounter.", variant: "destructive" });
    } finally {
      setIsSavingEncounter(false);
    }
  };

  const restoreEncounter = () => {
    if (!savedEncounterResult?.data) return;
    const snapshot = createEncounterRestoreState<Combatant>(savedEncounterResult.data);
    if (!snapshot) return;
    setCombatants(snapshot.combatants);
    setRound(snapshot.round);
    setActiveIndex(snapshot.activeIndex);
    setCombatState(snapshot.combatState);
    setSelectedVersions(snapshot.selectedVersions);
    setShowVersionDialog(snapshot.showVersionDialog);
    setShowRestoreBanner(snapshot.showRestoreBanner);
    setAutoSaveReady(snapshot.autoSaveReady);
    toast({ title: "Encounter restored", description: `Round ${snapshot.round} · ${snapshot.combatants.length} combatants` });
  };

  const dismissRestoreEncounter = () => {
    setShowRestoreBanner(false);
    setAutoSaveReady(true);
  };

  const clearSavedEncounterRemote = async () => {
    if (!activeCampaign) return;
    const campaignId = activeCampaign.id;
    latestEncounterRef.current = null;
    setAutoSaveReady(false);
    await enqueueEncounterRequest(campaignId, "DELETE");
    const completion = completeEncounterReset(campaignId, activeCampaignIdRef.current);
    if (!completion) return;
    setAutoSaveReady(completion.autoSaveReady);
    if (completion.shouldRefetch) refetchSavedEncounter();
  };

  const resetCombat = () => {
    clearSavedEncounterRemote();
    setCombatants([]);
    setCombatState("setup");
    setActiveIndex(0);
    setRound(1);
    setShowVersionDialog(true);
    setSelectedVersions([]);
  };

  // Reset encounter: remove monsters/NPCs, keep PCs
  const resetEncounter = () => {
    setCombatants(prev => prev.filter(c => c.combatantType === "pc"));
    setCombatState("setup");
    setActiveIndex(0);
    setRound(1);
  };

  // Reset all: clear everything but keep version selection
  const [showResetAllDialog, setShowResetAllDialog] = useState(false);

  const confirmResetAll = () => {
    setCombatants([]);
    setCombatState("setup");
    setActiveIndex(0);
    setRound(1);
    setShowResetAllDialog(false);
  };

  // Full heal a PC
  const fullHeal = (id: string) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc") return;
    
    updateCombatant(id, {
      hp: combatant.maxHp,
      tempHp: 0,
      isDown: false,
      isDead: false,
      isStable: false,
      isDisabled: false,
      deathSaveSuccesses: 0,
      deathSaveFailures: effectiveRuleset === "4e" ? combatant.deathSaveFailures : 0, // 4e: failures persist until rest
      conditions: combatant.conditions.filter(c => !c.startsWith("Exhaustion")), // Keep non-exhaustion conditions
      conditionDurations: Object.fromEntries(
        Object.entries(combatant.conditionDurations ?? {}).filter(([condition]) => !condition.startsWith("Exhaustion"))
      ),
      healingSurges: combatant.maxHealingSurges || 0, // Restore healing surges
    });
  };

  // Manual death save recording - players roll, DM records result
  // result: "pass" | "fail" | "nat20" | "nat1" | "nochange" (4e only)
  const recordDeathSaveResult = (id: string, result: "pass" | "fail" | "nat20" | "nat1" | "nochange") => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.isDead || combatant.isStable) return;
    
    if (effectiveRuleset === "4e") {
      // 4e rules: nat 20 = spend surge (if available), 10-19 = no change, 1-9 = fail
      if (result === "nat20") {
        // Spend healing surge if available, otherwise no change
        if ((combatant.healingSurges || 0) > 0) {
          const newSurges = combatant.healingSurges! - 1;
          const healAmount = Math.floor(combatant.maxHp / 4);
          updateCombatant(id, {
            healingSurges: newSurges,
            hp: healAmount,
            isDown: false,
            isStable: false,
            deathSaveSuccesses: 0,
          });
        }
        // No surges = no change (player is informed they can't spend a surge)
      } else if (result === "nochange" || result === "pass") {
        // 10-19: No change in 4e
        // Just acknowledge, no state change needed
      } else if (result === "fail" || result === "nat1") {
        // 4e: Nat 1 is just a single failure (unlike 5e which is double)
        const newFailures = combatant.deathSaveFailures + 1;
        if (newFailures >= 3) {
          updateCombatant(id, { deathSaveFailures: 3, isDead: true, isDown: true });
        } else {
          updateCombatant(id, { deathSaveFailures: newFailures });
        }
      }
    } else {
      // 5e/One D&D rules
      if (result === "nat20") {
        // Regain 1 HP, wake up
        updateCombatant(id, {
          hp: 1,
          isDown: false,
          isStable: false,
          deathSaveSuccesses: 0,
          deathSaveFailures: 0,
        });
      } else if (result === "nat1") {
        // Double failure
        const newFailures = combatant.deathSaveFailures + 2;
        if (newFailures >= 3) {
          updateCombatant(id, { deathSaveFailures: 3, isDead: true, isDown: true });
        } else {
          updateCombatant(id, { deathSaveFailures: newFailures });
        }
      } else if (result === "pass") {
        const newSuccesses = combatant.deathSaveSuccesses + 1;
        if (newSuccesses >= 3) {
          updateCombatant(id, { deathSaveSuccesses: 3, isStable: true });
        } else {
          updateCombatant(id, { deathSaveSuccesses: newSuccesses });
        }
      } else if (result === "fail") {
        const newFailures = combatant.deathSaveFailures + 1;
        if (newFailures >= 3) {
          updateCombatant(id, { deathSaveFailures: 3, isDead: true, isDown: true });
        } else {
          updateCombatant(id, { deathSaveFailures: newFailures });
        }
      }
    }
  };

  // 3.5e stabilization result: pass (stabilized) or fail (lose 1 HP)
  const record35eStabilization = (id: string, passed: boolean) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant || combatant.combatantType !== "pc" || combatant.isDead || combatant.isStable) return;
    
    if (passed) {
      updateCombatant(id, { isStable: true });
    } else {
      // Failed stabilization: lose 1 HP
      const newHp = combatant.hp - 1;
      if (newHp <= -10) {
        updateCombatant(id, { hp: newHp, isDead: true, isDown: true });
      } else {
        updateCombatant(id, { hp: newHp });
      }
    }
  };

  const sortedCombatants = getSortedCombatants();
  const activeCombatant = sortedCombatants[activeIndex];
  const correctionCombatant = correctionDraft
    ? combatants.find(c => c.id === correctionDraft.id)
    : undefined;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Version Selection Dialog */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display flex items-center gap-2">
              <Swords className="w-6 h-6 text-primary" />
              Select D&D Version
            </DialogTitle>
            <DialogDescription>
              Choose which version(s) of D&D you're playing. The bestiary will be loaded accordingly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {VERSION_OPTIONS.map(version => (
              <div key={version.id} className="flex items-center space-x-3">
                <Checkbox
                  id={version.id}
                  checked={selectedVersions.includes(version.id)}
                  onCheckedChange={() => toggleVersion(version.id)}
                />
                <Label htmlFor={version.id} className="text-base cursor-pointer">
                  {version.label}
                </Label>
              </div>
            ))}
          </div>
          <Button 
            onClick={handleVersionConfirm} 
            disabled={selectedVersions.length === 0}
            className="w-full"
          >
            <Play className="mr-2 w-4 h-4" /> Start Combat Setup
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionDraft} onOpenChange={open => { if (!open) setCorrectionDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Correct {correctionCombatant?.name ?? "combatant"}
            </DialogTitle>
            <DialogDescription>
              Fix encounter-only values without changing the bestiary source.
            </DialogDescription>
          </DialogHeader>
          {correctionDraft && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="correct-hp">
                    {correctionCombatant?.isGroup ? "Focused HP" : "Current HP"}
                  </Label>
                  <Input
                    id="correct-hp"
                    type="number"
                    value={correctionDraft.hp}
                    onChange={e => setCorrectionDraft(d => d ? { ...d, hp: e.target.value } : d)}
                    data-testid="input-correction-hp"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correct-max-hp">Base HP</Label>
                  <Input
                    id="correct-max-hp"
                    type="number"
                    min="1"
                    value={correctionDraft.maxHp}
                    onChange={e => setCorrectionDraft(d => d ? { ...d, maxHp: e.target.value } : d)}
                    data-testid="input-correction-max-hp"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correct-initiative">Initiative</Label>
                  <Input
                    id="correct-initiative"
                    type="number"
                    value={correctionDraft.initiative}
                    onChange={e => setCorrectionDraft(d => d ? { ...d, initiative: e.target.value } : d)}
                    data-testid="input-correction-initiative"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correct-ac">AC</Label>
                  <Input
                    id="correct-ac"
                    type="number"
                    min="0"
                    value={correctionDraft.ac}
                    onChange={e => setCorrectionDraft(d => d ? { ...d, ac: e.target.value } : d)}
                    data-testid="input-correction-ac"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ability modifiers</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ABILITIES.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`correct-${key}`} className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input
                        id={`correct-${key}`}
                        type="number"
                        value={correctionDraft.modifiers[key]}
                        onChange={e => setCorrectionDraft(d => d ? {
                          ...d,
                          modifiers: { ...d.modifiers, [key]: e.target.value },
                        } : d)}
                        className="px-2 text-center"
                        data-testid={`input-correction-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCorrectionDraft(null)}>Cancel</Button>
                <Button onClick={saveCorrections} data-testid="button-save-corrections">
                  Save Corrections
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex shrink-0 border-b border-border bg-card">
        <button
          onClick={() => setMobileTab("controls")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${mobileTab === "controls" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          data-testid="tab-controls"
        >
          Controls
        </button>
        <button
          onClick={() => setMobileTab("combat")}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${mobileTab === "combat" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          data-testid="tab-combat"
        >
          Combat Order
          {combatants.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {combatants.length}
            </span>
          )}
        </button>
      </div>

      {/* Body: side-by-side on desktop, tab-controlled on mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

      {/* Sidebar - Add Combatants */}
      <div className={`md:w-96 lg:w-[28rem] md:flex-shrink-0 border-r border-border p-6 bg-card overflow-y-auto scrollbar-fantasy flex-1 flex flex-col md:flex-none${mobileTab === "combat" ? " hidden md:flex md:flex-col" : ""}`}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="w-4 h-4" /> Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {selectedVersions.map(v => (
                <Badge key={v} variant="secondary" className="text-xs">
                  {VERSION_OPTIONS.find(vo => vo.id === v)?.label.split(" ")[1]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <Swords className="w-5 h-5" /> Initiative Tracker
            </h2>
            {combatState === "active" && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Round {round} - {activeCombatant?.name}'s turn
                  </p>
                  {activeCampaign && (
                    <p className={cn(
                      "text-[10px]",
                      autoSaveStatus === "error" ? "text-destructive" : "text-muted-foreground/70",
                    )}>
                      {autoSaveStatus === "saving" && "Saving encounter…"}
                      {autoSaveStatus === "saved" && "Encounter autosaved"}
                      {autoSaveStatus === "error" && "Autosave failed — use Save Encounter"}
                      {autoSaveStatus === "idle" && "Autosave ready"}
                    </p>
                  )}
                </div>
                {encounterXP > 0 && (
                  <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-0.5">
                    ⚔ {encounterXP.toLocaleString()} XP
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Monster Search */}
          <div className="space-y-3 bg-background/30 p-4 rounded-lg border border-border/50">
            <Label className="font-display text-sm flex items-center gap-2">
              <Search className="w-4 h-4" /> Search Bestiary
            </Label>
            <div className="relative">
              <Input
                value={monsterSearch}
                onChange={e => { setMonsterSearch(e.target.value); setSelectedMonsterId(null); }}
                placeholder="Search monsters by name..."
                className="pr-8"
                data-testid="input-monster-search"
              />
              {loadingMonsters && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* CR filter */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                <Checkbox
                  checked={useCrFilter}
                  onCheckedChange={(v) => { setUseCrFilter(!!v); if (!v) setCrFilter(""); setSelectedMonsterId(null); }}
                  className="h-3 w-3"
                  data-testid="checkbox-cr-filter"
                />
                Filter by CR
              </label>
              {useCrFilter && (
                <Select value={crFilter} onValueChange={(v) => { setCrFilter(v); setSelectedMonsterId(null); }}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select CR…" />
                  </SelectTrigger>
                  <SelectContent>
                    {crValues.map(cr => (
                      <SelectItem key={cr} value={cr} className="text-xs">CR {cr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Randomizer button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={buildEncounter}
              disabled={isRandomizing || (useCrFilter && !crFilter)}
              data-testid="button-random-monster"
            >
              {isRandomizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Dices className="w-3.5 h-3.5" />
              )}
              {useCrFilter && crFilter ? `Random Encounter (CR ${crFilter})` : "Random Monster"}
            </Button>

            {/* Type filter toggle */}
            <button
              onClick={() => setShowTypeFilters(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-type-filters"
            >
              <span className={cn("transition-transform", showTypeFilters ? "rotate-90" : "")}>▶</span>
              Filter by creature type
              {typeFilters.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{typeFilters.length}</Badge>
              )}
            </button>

            {showTypeFilters && creatureTypes.length > 0 && (
              <div className="max-h-36 overflow-y-auto border rounded-md bg-background p-2 grid grid-cols-2 gap-1">
                {creatureTypes.map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-foreground text-muted-foreground">
                    <Checkbox
                      checked={typeFilters.includes(type)}
                      onCheckedChange={() => toggleTypeFilter(type)}
                      className="h-3 w-3"
                      data-testid={`checkbox-type-${type}`}
                    />
                    {type}
                  </label>
                ))}
              </div>
            )}

            {/* Source filter toggle */}
            <button
              onClick={() => setShowSourceFilters(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-source-filters"
            >
              <span className={cn("transition-transform", showSourceFilters ? "rotate-90" : "")}>▶</span>
              Filter by source book
              {sourceFilters.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{sourceFilters.length}</Badge>
              )}
            </button>

            {showSourceFilters && bestiarySources.length > 0 && (
              <div className="max-h-36 overflow-y-auto border rounded-md bg-background p-2 space-y-1">
                {bestiarySources.map(source => (
                  <label key={source} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-foreground text-muted-foreground">
                    <Checkbox
                      checked={sourceFilters.includes(source)}
                      onCheckedChange={() => toggleSourceFilter(source)}
                      className="h-3 w-3"
                      data-testid={`checkbox-source-${source}`}
                    />
                    <span className="truncate">{source}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Search results */}
            {activeSearch && monsterResults.length > 0 && (
              <div className="max-h-44 overflow-y-auto border rounded-md bg-background divide-y divide-border/50">
                {monsterResults.map(monster => (
                  <div
                    key={monster.index}
                    onClick={() => { setSelectedMonsterId(monster.index); setEncounterGroup([]); }}
                    className={cn(
                      "p-2 cursor-pointer hover:bg-primary/5 transition-colors",
                      selectedMonsterId === monster.index && "bg-primary/10"
                    )}
                    data-testid={`monster-result-${monster.index}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{monster.name}</span>
                      <div className="flex gap-2 text-[11px] text-muted-foreground shrink-0 ml-2">
                        {monster.cr && monster.cr !== "--" && <span className="font-semibold text-primary/70">CR {monster.cr}</span>}
                        <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" />{monster.ac}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{monster.hp}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[monster.size, monster.type].filter(Boolean).join(" ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeSearch && !loadingMonsters && monsterResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No monsters found</p>
            )}

            {/* Encounter group preview (from randomizer) */}
            {encounterGroup.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {encounterGroup.length === 1 ? "Random Monster" : `Encounter Group (${encounterGroup.length} monsters)`}
                    {useCrFilter && crFilter && (
                      <span className="ml-1 text-primary/70">· CR {crFilter}</span>
                    )}
                  </span>
                  <button onClick={() => { setEncounterGroup([]); setEncounterGroupInitiatives([]); }} className="text-[10px] text-muted-foreground hover:text-foreground">✕ Clear</button>
                </div>
                <div className="border rounded-md bg-background divide-y divide-border/50">
                  {encounterGroup.map((monster, i) => (
                    <div key={`${monster.index}-${i}`} className="p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{monster.name}</span>
                            {monster.cr && monster.cr !== "--" && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">CR {monster.cr}</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2">
                            <span><Shield className="w-2.5 h-2.5 inline mr-0.5" />{monster.ac}</span>
                            <span><Heart className="w-2.5 h-2.5 inline mr-0.5" />{monster.hp} HP</span>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0 px-2"
                          onClick={() => {
                            addSingleMonsterToEncounter(monster, combatState === "active" ? encounterGroupInitiatives[i] : 0);
                            setEncounterGroup(prev => prev.filter((_, idx) => idx !== i));
                            setEncounterGroupInitiatives(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      {combatState === "active" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Initiative:</span>
                          <Input
                            type="number"
                            value={encounterGroupInitiatives[i] ?? 10}
                            onChange={e => {
                              const v = parseInt(e.target.value);
                              if (!isNaN(v)) setEncounterGroupInitiatives(prev => {
                                const next = [...prev]; next[i] = v; return next;
                              });
                            }}
                            className="h-6 w-14 text-xs text-center px-1"
                          />
                          <button
                            onClick={() => rerollGroupInitiative(i)}
                            className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-0.5"
                            title="Re-roll"
                          >
                            <Dices className="w-3 h-3" /> Roll
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={addAllEncounterMonsters} className="w-full" size="sm">
                  <Plus className="mr-1.5 w-3.5 h-3.5" /> Add All to Encounter
                </Button>
              </div>
            )}

            {/* Selected monster preview (from search) */}
            {selectedMonsterId && loadingDetail && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {selectedMonster && !loadingDetail && encounterGroup.length === 0 && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-sm">{selectedMonster.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedMonster.cr && selectedMonster.cr !== "--" && (
                      <Badge variant="secondary" className="text-[10px]">CR {selectedMonster.cr}</Badge>
                    )}
                    {selectedMonster.source && (
                      <Badge variant="outline" className="text-[10px]">{selectedMonster.source}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {[selectedMonster.size, selectedMonster.type, selectedMonster.alignment].filter(Boolean).join(" · ")}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center bg-background/60 rounded p-1.5">
                    <div className="font-bold text-base">{selectedMonster.ac}</div>
                    <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Shield className="w-3 h-3" />AC</div>
                  </div>
                  <div className="text-center bg-background/60 rounded p-1.5">
                    <div className="font-bold text-base">{selectedMonster.hp}</div>
                    <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Heart className="w-3 h-3" />HP avg</div>
                  </div>
                  <div className="text-center bg-background/60 rounded p-1.5">
                    <div className="font-bold text-base">
                      {selectedMonster.hit_dice || "—"}
                    </div>
                    <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Dices className="w-3 h-3" />Dice</div>
                  </div>
                </div>
                {combatState === "active" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">Initiative:</span>
                    <Input
                      type="number"
                      value={midCombatInitiative}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setMidCombatInitiative(v); }}
                      className="h-7 w-16 text-sm text-center px-1"
                    />
                    <button
                      onClick={() => setMidCombatInitiative(rollInitiative(selectedMonster.dexMod))}
                      className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
                    >
                      <Dices className="w-3.5 h-3.5" /> Re-roll
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Group count stepper */}
            {selectedMonster && !loadingDetail && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-muted-foreground">Count:</span>
                <div className="flex items-center gap-1">
                  <button
                    className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40"
                    onClick={() => setMonsterGroupCount(c => Math.max(1, c - 1))}
                    disabled={monsterGroupCount <= 1}
                  >−</button>
                  <span className="w-6 text-center font-mono text-sm font-bold">{monsterGroupCount}</span>
                  <button
                    className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40"
                    onClick={() => setMonsterGroupCount(c => Math.min(20, c + 1))}
                    disabled={monsterGroupCount >= 20}
                  >+</button>
                </div>
                {monsterGroupCount > 1 && (
                  <span className="text-xs text-primary/70">→ group of {monsterGroupCount}</span>
                )}
              </div>
            )}
            <Button 
              onClick={addMonster} 
              disabled={!selectedMonster || loadingDetail || encounterGroup.length > 0}
              className="w-full"
              data-testid="button-add-monster"
            >
              <Plus className="mr-2 w-4 h-4" />
              {monsterGroupCount > 1
                ? `Add Group ×${monsterGroupCount}`
                : combatState === "active" ? "Add to Active Combat" : "Add to Encounter"}
            </Button>
          </div>

          {/* Homebrew Bestiary */}
          <div className="space-y-3 bg-background/30 p-4 rounded-lg border border-border/50">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setShowHomebrewSection(v => !v)}
                className="flex items-center gap-2 text-sm font-display font-semibold hover:text-primary transition-colors"
              >
                {showHomebrewSection ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <BookOpen className="w-4 h-4" />
                Homebrew Bestiary
                {homebrewMonsters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{homebrewMonsters.length}</Badge>
                )}
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href="/api/homebrew-bestiary/template.csv"
                  download="homebrew-bestiary-template.csv"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                  title="Download CSV template"
                >
                  <FileDown className="w-3.5 h-3.5" /> Template
                </a>
                {homebrewCampaign && (
                  <>
                    <span className="text-border">|</span>
                    <button
                      onClick={() => homebrewFileRef.current?.click()}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      title="Import CSV"
                    >
                      <Upload className="w-3.5 h-3.5" /> Import
                    </button>
                    <input
                      ref={homebrewFileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleHomebrewFileSelect}
                    />
                  </>
                )}
              </div>
            </div>

            {showHomebrewSection && (
              <>
                {homebrewMonsters.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No homebrew monsters yet. Download the template, fill it in, then import.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* Search */}
                    <Input
                      value={homebrewSearch}
                      onChange={e => { setHomebrewSearch(e.target.value); setSelectedHomebrewId(null); }}
                      placeholder="Search homebrew..."
                      className="h-8 text-sm"
                    />

                    {/* Results list */}
                    {filteredHomebrew.length > 0 ? (
                      <div className="max-h-44 overflow-y-auto border rounded-md bg-background divide-y divide-border/50">
                        {filteredHomebrew.map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedHomebrewId(prev => prev === m.id ? null : m.id);
                            }}
                            className={cn(
                              "p-2 cursor-pointer hover:bg-primary/5 transition-colors",
                              selectedHomebrewId === m.id && "bg-primary/10"
                            )}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-sm font-medium truncate">{m.name}</span>
                              <div className="flex gap-2 text-[11px] text-muted-foreground shrink-0">
                                {m.challengeRating && <span className="font-semibold text-primary/70">CR {m.challengeRating}</span>}
                                {m.armorClass && <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" />{m.armorClass}</span>}
                                {m.printedAverageHp && <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{m.printedAverageHp}</span>}
                              </div>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {[m.size, m.creatureType].filter(Boolean).join(" ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-1">No results</p>
                    )}

                    {/* Selected monster preview */}
                    {selectedHomebrewId != null && (() => {
                      const hm = homebrewMonsters.find(m => m.id === selectedHomebrewId);
                      if (!hm) return null;
                      return (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-sm">{hm.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hm.challengeRating && <Badge variant="secondary" className="text-[10px]">CR {hm.challengeRating}</Badge>}
                              <Badge variant="outline" className="text-[10px]">Homebrew</Badge>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[hm.size, hm.creatureType, hm.alignment].filter(Boolean).join(" · ")}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center bg-background/60 rounded p-1.5">
                              <div className="font-bold text-base">{hm.armorClass ?? "—"}</div>
                              <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Shield className="w-3 h-3" />AC</div>
                            </div>
                            <div className="text-center bg-background/60 rounded p-1.5">
                              <div className="font-bold text-base">{hm.printedAverageHp ?? "—"}</div>
                              <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Heart className="w-3 h-3" />HP avg</div>
                            </div>
                            <div className="text-center bg-background/60 rounded p-1.5">
                              <div className="font-bold text-base">{hm.hitDice ?? "—"}</div>
                              <div className="text-muted-foreground flex items-center justify-center gap-0.5"><Dices className="w-3 h-3" />Dice</div>
                            </div>
                          </div>
                          {hm.actions.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-border/40">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                              {hm.actions.map((a, i) => (
                                <div key={i} className="text-[11px]">
                                  <span className="font-semibold">{a.actionName}</span>
                                  {a.attackBonus != null && (
                                    <span className="text-primary/70 ml-1">+{a.attackBonus} to hit</span>
                                  )}
                                  {a.actionDescription && (
                                    <p className="text-muted-foreground mt-0.5 leading-snug">{a.actionDescription}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {combatState === "active" && (
                            <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                              <span className="text-xs text-muted-foreground">Initiative:</span>
                              <Input
                                type="number"
                                value={homebrewMidCombatInit}
                                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setHomebrewMidCombatInit(v); }}
                                className="h-7 w-16 text-sm text-center px-1"
                              />
                              <button
                                onClick={() => {
                                  const dex = hm.dexScore != null ? Math.floor((hm.dexScore - 10) / 2) : 0;
                                  setHomebrewMidCombatInit(rollInitiative(dex));
                                }}
                                className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
                              >
                                <Dices className="w-3.5 h-3.5" /> Re-roll
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Homebrew group count stepper */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-muted-foreground">Count:</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40"
                          onClick={() => setHomebrewGroupCount(c => Math.max(1, c - 1))}
                          disabled={homebrewGroupCount <= 1}
                        >−</button>
                        <span className="w-6 text-center font-mono text-sm font-bold">{homebrewGroupCount}</span>
                        <button
                          className="w-6 h-6 rounded border border-border flex items-center justify-center text-sm hover:bg-muted disabled:opacity-40"
                          onClick={() => setHomebrewGroupCount(c => Math.min(20, c + 1))}
                          disabled={homebrewGroupCount >= 20}
                        >+</button>
                      </div>
                      {homebrewGroupCount > 1 && (
                        <span className="text-xs text-primary/70">→ group of {homebrewGroupCount}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const hm = homebrewMonsters.find(m => m.id === selectedHomebrewId);
                          if (hm) addHomebrewMonster(hm, homebrewGroupCount);
                          setHomebrewGroupCount(1);
                        }}
                        disabled={selectedHomebrewId == null}
                        className="flex-1"
                        size="sm"
                      >
                        <Plus className="mr-1.5 w-3.5 h-3.5" />
                        {homebrewGroupCount > 1
                          ? `Add Group ×${homebrewGroupCount}`
                          : combatState === "active" ? "Add to Active Combat" : "Add to Encounter"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive px-2"
                        onClick={clearHomebrewBestiary}
                        title="Clear all homebrew monsters"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reset All Confirmation Dialog */}
          <Dialog open={showResetAllDialog} onOpenChange={setShowResetAllDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" /> Clear Entire Encounter?
                </DialogTitle>
                <DialogDescription className="pt-1 space-y-2 text-sm text-foreground/80">
                  <span className="block">
                    This will permanently remove <strong>every combatant</strong> from the tracker — all player characters, NPCs, and monsters — and reset combat back to setup.
                  </span>
                  <span className="block text-muted-foreground">
                    HP, conditions, and initiative rolls will all be lost. This cannot be undone.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResetAllDialog(false)}
                >
                  Abort
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={confirmResetAll}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Proceed
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Import Preview Dialog */}
          <Dialog open={homebrewImportPreview != null} onOpenChange={open => { if (!open) { setHomebrewImportPreview(null); setHomebrewImportRaw(""); } }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Import Homebrew Monsters</DialogTitle>
                <DialogDescription>
                  Review the monsters below before confirming. Rows with errors will be skipped.
                </DialogDescription>
              </DialogHeader>
              {homebrewImportPreview && (
                <div className="space-y-4">
                  <div className="border rounded-md overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {["Name","Type","Size","CR","AC","HP","Hit Dice","Actions","Status"].map(h => (
                              <th key={h} className="text-left px-2 py-1.5 font-semibold text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {homebrewImportPreview.map((row, i) => (
                            <tr key={i} className={row.error ? "bg-destructive/5" : ""}>
                              <td className="px-2 py-1.5 font-medium">{row.name || <span className="text-destructive italic">empty</span>}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{row.type || "—"}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{row.size || "—"}</td>
                              <td className="px-2 py-1.5">{row.cr || "—"}</td>
                              <td className="px-2 py-1.5">{row.ac || "—"}</td>
                              <td className="px-2 py-1.5">{row.hp || "—"}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{row.hit_dice || "—"}</td>
                              <td className="px-2 py-1.5 text-center">{row.actionCount > 0 ? row.actionCount : "—"}</td>
                              <td className="px-2 py-1.5">
                                {row.error
                                  ? <span className="text-destructive">{row.error}</span>
                                  : <span className="text-green-500 flex items-center gap-0.5"><CircleCheck className="w-3 h-3" /> OK</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {homebrewImportPreview.filter(r => !r.error).length} of {homebrewImportPreview.length} rows will be imported.
                       {homebrewCampaign && homebrewMonsters.length > 0 && (
                        <span className="text-primary ml-1">These will be added to the existing {homebrewMonsters.length} monsters.</span>
                      )}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { setHomebrewImportPreview(null); setHomebrewImportRaw(""); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={confirmHomebrewImport}
                        disabled={homebrewImportLoading || homebrewImportPreview.filter(r => !r.error).length === 0}
                      >
                        {homebrewImportLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                        Confirm Import
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Campaign Party */}
          {activeCampaign && (
            <div className="space-y-3 bg-background/30 p-4 rounded-lg border border-primary/30">
              <Label className="font-display text-sm flex items-center gap-2 text-primary">
                <BookUser className="w-4 h-4" /> {activeCampaign.name} — Party
              </Label>
              {campaignParty.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No party members yet. Add PCs below and save them to the campaign.
                </p>
              ) : (
                <div className="space-y-2">
                  {campaignParty.map(char => {
                    const alreadyInEncounter = combatants.some(c => c.name === char.name && c.combatantType === "pc");
                    return (
                      <div key={char.id} className="flex items-center justify-between bg-background/50 rounded px-3 py-2 border border-border/40">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{char.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            HP {char.maxHp} · AC {char.ac}
                            {char.playerClass ? ` · ${char.playerClass}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <Button
                            size="sm"
                            variant={alreadyInEncounter ? "ghost" : "secondary"}
                            disabled={alreadyInEncounter}
                            onClick={() => addPartyMemberToEncounter(char)}
                            data-testid={`button-add-party-member-${char.id}`}
                            className="h-7 text-xs"
                          >
                            {alreadyInEncounter ? "Added" : <><Plus className="w-3 h-3 mr-1" />Add</>}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removePartyMemberMutation.mutate(char.id)}
                            data-testid={`button-remove-party-member-${char.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PC Entry */}
          <div className="space-y-3 bg-background/30 p-4 rounded-lg border border-border/50">
            <Label className="font-display text-sm flex items-center gap-2">
              <User className="w-4 h-4" /> Add Player Character
            </Label>
            <Input
              value={pcName}
              onChange={e => setPcName(e.target.value)}
              placeholder="Character Name"
              data-testid="input-pc-name"
            />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Initiative</Label>
                <Input
                  type="number"
                  value={pcInitiative}
                  onChange={e => setPcInitiative(e.target.value)}
                  placeholder="0"
                  data-testid="input-pc-initiative"
                />
              </div>
              <div>
                <Label className="text-xs">HP</Label>
                <Input
                  type="number"
                  value={pcHp}
                  onChange={e => setPcHp(e.target.value)}
                  placeholder="0"
                  data-testid="input-pc-hp"
                />
              </div>
              <div>
                <Label className="text-xs">AC</Label>
                <Input
                  type="number"
                  value={pcAc}
                  onChange={e => setPcAc(e.target.value)}
                  placeholder="10"
                  data-testid="input-pc-ac"
                />
              </div>
              <div>
                <Label className="text-xs">Level</Label>
                <Input
                  type="number"
                  value={pcLevel}
                  onChange={e => setPcLevel(e.target.value)}
                  placeholder="1"
                  min={1}
                  max={20}
                  data-testid="input-pc-level"
                />
              </div>
            </div>
            {activeCampaign && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-to-party"
                  checked={saveToParty}
                  onCheckedChange={v => setSaveToParty(!!v)}
                  data-testid="checkbox-save-to-party"
                />
                <label htmlFor="save-to-party" className="text-xs text-muted-foreground cursor-pointer">
                  Save to <span className="text-primary">{activeCampaign.name}</span> party roster
                </label>
              </div>
            )}
            <Button 
              onClick={() => {
                if (saveToParty && activeCampaign && pcName) {
                  saveCharacterMutation.mutate({
                    name: pcName,
                    maxHp: pcHp ? parseInt(pcHp) : 10,
                    ac: pcAc ? parseInt(pcAc) : 10,
                  });
                }
                addPC();
                setSaveToParty(false);
              }}
              disabled={!pcName}
              variant="secondary"
              className="w-full"
              data-testid="button-add-pc"
            >
              <Plus className="mr-2 w-4 h-4" />
              {saveToParty ? "Add PC & Save to Campaign" : "Add PC"}
            </Button>
          </div>

          {/* NPC Entry (DM-created) */}
          <div className="space-y-3 bg-background/30 p-4 rounded-lg border border-border/50">
            <Label className="font-display text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> Add NPC (DM-Created)
            </Label>
            <Input
              value={npcName}
              onChange={e => setNpcName(e.target.value)}
              placeholder="NPC Name"
              data-testid="input-npc-name"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">HP</Label>
                <Input
                  type="number"
                  value={npcHp}
                  onChange={e => setNpcHp(e.target.value)}
                  placeholder="10"
                  data-testid="input-npc-hp"
                />
              </div>
              <div>
                <Label className="text-xs">AC</Label>
                <Input
                  type="number"
                  value={npcAc}
                  onChange={e => setNpcAc(e.target.value)}
                  placeholder="10"
                  data-testid="input-npc-ac"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Stance</Label>
              <Select value={npcStance} onValueChange={(v) => setNpcStance(v as NPCStance)}>
                <SelectTrigger data-testid="select-npc-stance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ally">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Ally
                    </span>
                  </SelectItem>
                  <SelectItem value="neutral">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500" /> Neutral
                    </span>
                  </SelectItem>
                  <SelectItem value="enemy">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Enemy
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={addNPC} 
              disabled={!npcName}
              variant="outline"
              className="w-full"
              data-testid="button-add-npc"
            >
              <Plus className="mr-2 w-4 h-4" /> Add NPC
            </Button>
          </div>

          {/* Combat Controls */}
          <div className="space-y-2">
            {combatState === "setup" && (
              <Button 
                onClick={startCombat} 
                disabled={combatants.length === 0}
                className="w-full h-12 text-lg font-display"
                data-testid="button-start-combat"
              >
                <Play className="mr-2" /> Start Combat
              </Button>
            )}
            
            {combatState === "active" && (
              <>
                <Button 
                  onClick={nextTurn}
                  className="w-full h-12 text-lg font-display"
                  data-testid="button-next-turn"
                >
                  <SkipForward className="mr-2" /> Next Turn
                </Button>
                {activeCampaign && (
                  <Button
                    onClick={saveCurrentEncounter}
                    disabled={isSavingEncounter}
                    variant="outline"
                    className="w-full border-primary/50 text-primary hover:bg-primary/10"
                    data-testid="button-save-encounter"
                  >
                    {isSavingEncounter
                      ? <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      : <Save className="mr-2 w-4 h-4" />}
                    Save Encounter
                  </Button>
                )}
                <Button 
                  onClick={endCombat}
                  variant="destructive"
                  className="w-full"
                  data-testid="button-end-combat"
                >
                  <Square className="mr-2 w-4 h-4" /> End Combat
                </Button>
              </>
            )}
            
            {combatState === "ended" && (
              <div className="space-y-4">
                <p className="text-lg font-display text-muted-foreground text-center">Combat Ended</p>

                {/* XP Summary */}
                {encounterXP > 0 ? (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 text-center">
                      Encounter XP
                    </p>
                    <p className="text-3xl font-mono font-bold text-amber-400 text-center">
                      {encounterXP.toLocaleString()}
                    </p>
                    {(() => {
                      const pcCount = combatants.filter(c => c.combatantType === "pc").length;
                      return pcCount > 0 ? (
                        <p className="text-xs text-muted-foreground text-center">
                          ÷ {pcCount} PC{pcCount !== 1 ? "s" : ""} ={" "}
                          <span className="font-semibold text-foreground">
                            {Math.floor(encounterXP / pcCount).toLocaleString()} XP each
                          </span>
                        </p>
                      ) : null;
                    })()}
                    <p className="text-[10px] text-muted-foreground/60 text-center italic">
                      Award as you see fit
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center italic">No enemy XP recorded</p>
                )}

                <Button onClick={resetCombat} variant="outline" className="w-full">
                  <RotateCcw className="mr-2 w-4 h-4" /> New Combat
                </Button>
              </div>
            )}
            
            {/* Reset Controls - always visible */}
            <div className="flex gap-2">
              <Button 
                onClick={resetEncounter} 
                variant="outline"
                className="flex-1"
                disabled={combatants.length === 0}
                data-testid="button-reset-encounter"
              >
                <RotateCcw className="mr-1 w-3 h-3" /> Reset Encounter
              </Button>
              <Button 
                onClick={() => setShowResetAllDialog(true)} 
                variant="ghost"
                className="flex-1 text-muted-foreground"
                disabled={combatants.length === 0}
                data-testid="button-reset-all"
              >
                <Trash2 className="mr-1 w-3 h-3" /> Reset All
              </Button>
            </div>
          </div>

          {/* Conditions Key */}
          <div className="bg-background/30 p-4 rounded-lg border border-border/50">
            <Label className="font-display text-sm flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4" /> Conditions Key
            </Label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {CONDITIONS.map(condition => (
                <div key={condition} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: CONDITION_COLORS[condition] }}
                  />
                  <span className="truncate">{condition}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Area - Combat List */}
      <main className={`flex-1 overflow-y-auto p-4 md:p-8 relative bg-background/50 scrollbar-fantasy${mobileTab === "controls" ? " hidden md:block" : ""}`}>
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-display font-bold">Combat Order</h1>
            {combatState === "active" && (
              <Badge variant="default" className="text-lg px-4 py-1">
                Round {round}
              </Badge>
            )}
          </div>

          {/* Restore Banner */}
          {showRestoreBanner && savedEncounterResult?.data && (
            <div className="mb-4 p-4 rounded-lg border border-primary/60 bg-primary/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Save className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">Saved encounter found</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Round {savedEncounterResult.data.round} · {(savedEncounterResult.data.combatants ?? []).length} combatants
                    {savedEncounterResult.savedAt && (
                      <> · Saved {new Date(savedEncounterResult.savedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={restoreEncounter} className="h-8">
                  <Play className="w-3 h-3 mr-1" /> Continue
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground"
                  onClick={dismissRestoreEncounter}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {combatants.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Swords className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No combatants yet</p>
              <p className="text-sm">Search for monsters or add PCs to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sortedCombatants.map((combatant, index) => (
                  <motion.div
                    key={combatant.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Card className={cn(
                      "border-2 transition-all duration-300",
                      combatState === "active" && index === activeIndex && !combatant.isDown
                        ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                        : "border-border",
                      combatant.isDown && "opacity-50 grayscale",
                      !combatant.isMonster && "bg-blue-500/5",
                      combatant.isMonster && combatant.stance === "ally" && "bg-green-500/10",
                      combatant.isMonster && combatant.stance === "neutral" && "bg-gray-500/10",
                      combatant.isMonster && (combatant.stance === "enemy" || !combatant.stance) && "bg-red-500/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Initiative */}
                          <div className="w-16 flex-shrink-0">
                            <Input
                              type="number"
                              value={combatant.initiative}
                              onChange={e => updateInitiative(combatant.id, e.target.value)}
                              className="text-center text-xl font-mono font-bold h-12"
                              disabled={combatState === "active"}
                              data-testid={`input-initiative-${combatant.id}`}
                            />
                          </div>

                          {/* Condition Color Indicators */}
                          <div className="flex gap-0.5 flex-shrink-0">
                            {combatant.conditions.map(condition => (
                              <div 
                                key={condition}
                                className="w-1.5 h-10 rounded-sm"
                                style={{ backgroundColor: CONDITION_COLORS[condition] }}
                                title={condition}
                              />
                            ))}
                          </div>

                          {/* Name & Type */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {combatant.isMonster ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-7 h-7 flex-shrink-0"
                                  onClick={() => cycleStance(combatant.id)}
                                  title={`Click to change stance (${combatant.stance || "enemy"})`}
                                  data-testid={`button-stance-${combatant.id}`}
                                >
                                  <Shield 
                                    className="w-5 h-5" 
                                    style={{ color: STANCE_COLORS[combatant.stance || "enemy"] }}
                                  />
                                </Button>
                              ) : (
                                <User className="w-5 h-5 text-blue-500 flex-shrink-0 ml-1" />
                              )}
                              <HoverCard openDelay={200} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <h3 className="text-xl font-bold flex items-center gap-2 cursor-help" data-testid={`text-combatant-name-${combatant.id}`}>
                                    {combatant.isDown && <Skull className="w-5 h-5 text-destructive" />}
                                    <span style={{ 
                                      color: combatant.isMonster 
                                        ? STANCE_COLORS[combatant.stance || "enemy"] 
                                        : "#60A5FA" 
                                    }}>
                                      {combatant.name}
                                    </span>
                                    {combatant.joiningNextRound && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal border-amber-500/50 text-amber-500 shrink-0">
                                        Joins next round
                                      </Badge>
                                    )}
                                  </h3>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-96 p-0" side="right" align="start">
                                  <ScrollArea className="h-[400px]">
                                    <div className="p-4 space-y-3">
                                      {combatant.isMonster && combatant.monsterData ? (
                                        <>
                                          {/* Header */}
                                          <div className="border-b border-border pb-2">
                                            <h4 className="text-lg font-bold text-primary">{combatant.monsterData.name}</h4>
                                            <p className="text-xs text-muted-foreground">
                                              {combatant.monsterData.size} {combatant.monsterData.type}, CR {combatant.monsterData.cr}
                                            </p>
                                            {combatant.monsterData.source && (
                                              <Badge variant="outline" className="text-xs mt-1">{combatant.monsterData.source}</Badge>
                                            )}
                                          </div>
                                          
                                          {/* Core Stats */}
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><span className="font-semibold">AC:</span> {combatant.ac}</div>
                                            <div><span className="font-semibold">HP:</span> {combatant.hp}/{combatant.maxHp} {combatant.monsterData.hit_dice && <span className="text-muted-foreground">({combatant.monsterData.hit_dice})</span>}</div>
                                          </div>
                                          
                                          {/* Speed */}
                                          {combatant.monsterData.speed && Object.keys(combatant.monsterData.speed).length > 0 && (
                                            <div className="text-sm">
                                              <span className="font-semibold">Speed:</span>{" "}
                                              {Object.entries(combatant.monsterData.speed).map(([type, value]) => 
                                                `${type} ${value}`
                                              ).join(", ")}
                                            </div>
                                          )}
                                          
                                          {/* Ability Scores */}
                                          <div className="grid grid-cols-6 gap-1 text-center text-xs border border-border rounded-md p-2">
                                            {ABILITIES.map(({ key, label }) => (
                                              <div key={key}>
                                                <div className="font-bold">{label}</div>
                                                <div>{combatant.monsterData?.[key] ?? 10}</div>
                                                <div className="text-muted-foreground">
                                                  {formatSignedModifier(getCombatantAbilityModifier(combatant, key))}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          
                                          {/* Resistances/Immunities */}
                                          {combatant.monsterData.resistances && combatant.monsterData.resistances.length > 0 && (
                                            <div className="text-xs">
                                              <span className="font-semibold">Resistances:</span> {combatant.monsterData.resistances.join(", ")}
                                            </div>
                                          )}
                                          {combatant.monsterData.immunities && combatant.monsterData.immunities.length > 0 && (
                                            <div className="text-xs">
                                              <span className="font-semibold">Immunities:</span> {combatant.monsterData.immunities.join(", ")}
                                            </div>
                                          )}
                                          
                                          {/* Special Abilities */}
                                          {combatant.monsterData.special_abilities && combatant.monsterData.special_abilities.length > 0 && (
                                            <div className="space-y-1">
                                              <h5 className="font-semibold text-sm border-b border-border">Special Abilities</h5>
                                              {combatant.monsterData.special_abilities.slice(0, 3).map((ability, i) => (
                                                <div key={i} className="text-xs">
                                                  <span className="font-semibold italic">{ability.name}.</span>{" "}
                                                  <span className="text-muted-foreground">{ability.desc.slice(0, 150)}{ability.desc.length > 150 ? "..." : ""}</span>
                                                </div>
                                              ))}
                                              {combatant.monsterData.special_abilities.length > 3 && (
                                                <p className="text-xs text-muted-foreground italic">+{combatant.monsterData.special_abilities.length - 3} more abilities</p>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Actions */}
                                          {combatant.monsterData.actions && combatant.monsterData.actions.length > 0 && (
                                            <div className="space-y-1">
                                              <h5 className="font-semibold text-sm border-b border-border flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> Actions
                                              </h5>
                                              {combatant.monsterData.actions.slice(0, 4).map((action, i) => (
                                                <div key={i} className="text-xs">
                                                  <span className="font-semibold italic">{action.name}.</span>{" "}
                                                  <span className="text-muted-foreground">{action.desc.slice(0, 120)}{action.desc.length > 120 ? "..." : ""}</span>
                                                </div>
                                              ))}
                                              {combatant.monsterData.actions.length > 4 && (
                                                <p className="text-xs text-muted-foreground italic">+{combatant.monsterData.actions.length - 4} more actions</p>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      ) : combatant.combatantType === "npc" ? (
                                        <div className="text-center text-muted-foreground py-4">
                                          <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: STANCE_COLORS[combatant.stance || "enemy"] }} />
                                          <p className="font-semibold">{combatant.name}</p>
                                          <p className="text-sm">DM-Created NPC ({(combatant.stance || "enemy").charAt(0).toUpperCase() + (combatant.stance || "enemy").slice(1)})</p>
                                          <div className="mt-2 text-sm">
                                            <p>HP: {combatant.hp}/{combatant.maxHp}</p>
                                            <p>AC: {combatant.ac}</p>
                                          </div>
                                          <div className="grid grid-cols-6 gap-1 mt-3 text-xs border border-border rounded-md p-2">
                                            {ABILITIES.map(({ key, label }) => (
                                              <div key={key}>
                                                <div className="font-bold">{label}</div>
                                                <div>{formatSignedModifier(getCombatantAbilityModifier(combatant, key))}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center text-muted-foreground py-4">
                                          <User className="w-8 h-8 mx-auto mb-2" />
                                          <p className="font-semibold">{combatant.name}</p>
                                          <p className="text-sm">Player Character</p>
                                          <div className="mt-2 text-sm">
                                            <p>HP: {combatant.hp}/{combatant.maxHp}</p>
                                            <p>AC: {combatant.ac}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </HoverCardContent>
                              </HoverCard>
                            </div>
                            <div className="text-xs text-muted-foreground ml-8 flex items-center gap-1.5 flex-wrap">
                              {/* Group count */}
                              {combatant.isGroup && combatant.memberHp && (
                                <>
                                  <span className="font-semibold text-primary/80">×{combatant.memberHp.length}</span>
                                  <span>·</span>
                                  <span>{combatant.memberHp.filter(h => h > 0).length} alive</span>
                                  <span>·</span>
                                </>
                              )}

                              {/* PC: level + proficiency badge */}
                              {combatant.combatantType === "pc" && (
                                <>
                                  {combatant.level ? (
                                    <>
                                      <button
                                        className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                                        title="Click to edit level"
                                        onClick={() => setEditingStat({ id: combatant.id, field: "level", value: String(combatant.level) })}
                                      >
                                        {editingStat?.id === combatant.id && editingStat.field === "level" ? (
                                          <input
                                            type="number"
                                            autoFocus
                                            className="w-8 text-center bg-muted border border-primary rounded px-0.5 outline-none font-mono"
                                            value={editingStat.value}
                                            onChange={e => setEditingStat(s => s ? { ...s, value: e.target.value } : s)}
                                            onBlur={commitStatEdit}
                                            onKeyDown={e => { if (e.key === "Enter") commitStatEdit(); if (e.key === "Escape") setEditingStat(null); }}
                                            onClick={e => e.stopPropagation()}
                                          />
                                        ) : (
                                          `Lv.${combatant.level}`
                                        )}
                                      </button>
                                      <span>·</span>
                                      <span className="text-emerald-400">
                                        Prof +{Math.ceil(combatant.level / 4) + 1}
                                      </span>
                                      <span>·</span>
                                    </>
                                  ) : (
                                    <button
                                      className="italic text-muted-foreground/60 hover:text-blue-400 transition-colors"
                                      onClick={() => setEditingStat({ id: combatant.id, field: "level", value: "1" })}
                                    >
                                      Set level
                                    </button>
                                  )}
                                  <span>Player Character</span>
                                </>
                              )}

                              {/* Monster / NPC: type label + clickable stance badge */}
                              {(combatant.combatantType === "monster" || combatant.combatantType === "npc") && (
                                <>
                                  <span>{combatant.combatantType === "monster" ? "Monster" : "NPC"}</span>
                                  <span>·</span>
                                  <button
                                    onClick={() => cycleStance(combatant.id)}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border transition-colors",
                                      (combatant.stance === "ally")
                                        ? "border-green-500/60 text-green-400 hover:bg-green-500/10"
                                        : (combatant.stance === "neutral")
                                        ? "border-gray-400/60 text-gray-300 hover:bg-gray-500/10"
                                        : "border-red-500/60 text-red-400 hover:bg-red-500/10"
                                    )}
                                    title="Click to cycle stance"
                                  >
                                    {(combatant.stance === "ally") ? "⚔ Ally" : (combatant.stance === "neutral") ? "◆ Neutral" : "☠ Enemy"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Conditions Column */}
                          <div className="flex flex-col gap-1 min-w-[160px]">
                            <div className="flex items-center gap-1">
                              <Select onValueChange={(val) => toggleCondition(combatant.id, val)}>
                                <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-condition-${combatant.id}`}>
                                  <SelectValue placeholder="Add Condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDITIONS.filter(c => !combatant.conditions.includes(c)).map(condition => (
                                    <SelectItem key={condition} value={condition}>
                                      {condition}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={conditionDurationInputs[combatant.id] ?? ""}
                                onChange={e => setConditionDurationInputs(prev => ({
                                  ...prev,
                                  [combatant.id]: e.target.value,
                                }))}
                                className="h-8 w-14 px-1 text-center text-xs"
                                placeholder="min"
                                aria-label={`Duration in minutes for ${combatant.name} condition`}
                                data-testid={`input-condition-duration-${combatant.id}`}
                              />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {combatant.conditions.map(condition => {
                                const remainingRounds = combatant.conditionDurations?.[condition];
                                const durationLabel = remainingRounds != null
                                  ? ` · ${formatConditionDuration(remainingRounds)}`
                                  : "";
                                return (
                                  <Badge
                                    key={condition}
                                    className="text-xs cursor-pointer text-white border-0"
                                    style={{ backgroundColor: CONDITION_COLORS[condition] }}
                                    onClick={() => toggleCondition(combatant.id, condition)}
                                    title={`${condition}${durationLabel} — click to remove`}
                                    data-testid={`badge-condition-${combatant.id}-${condition}`}
                                  >
                                    {condition}{remainingRounds != null && (
                                      <span className="ml-1 opacity-90">· {formatConditionDuration(remainingRounds)}</span>
                                    )} <span className="ml-1 opacity-70">x</span>
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>

                          {/* HP Display — group shows member tokens; single shows inline-editable HP */}
                          {combatant.isGroup && combatant.memberHp ? (
                            <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[260px]">
                              <div className="flex flex-wrap gap-1">
                                {combatant.memberHp.map((mhp, i) => {
                                  const alive = mhp > 0;
                                  const focused = (groupFocused[combatant.id] ?? 0) === i;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => alive && setGroupFocused(prev => ({ ...prev, [combatant.id]: i }))}
                                      className={cn(
                                        "text-[11px] px-1.5 py-0.5 rounded border font-mono transition-colors leading-tight",
                                        !alive && "opacity-40 line-through cursor-default",
                                        focused && alive && "border-primary bg-primary/20 text-primary font-bold",
                                        !focused && alive && "border-border bg-background/60 hover:border-primary/50 cursor-pointer",
                                      )}
                                      title={alive ? `G${i+1}: ${mhp}/${combatant.maxHp} HP — click to focus` : `G${i+1}: Dead`}
                                    >
                                      {alive ? `G${i+1} ${mhp}` : "☠"}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                Focus: G{(groupFocused[combatant.id] ?? 0) + 1}
                                ({combatant.memberHp[groupFocused[combatant.id] ?? 0] ?? 0}/{combatant.maxHp})
                              </div>
                            </div>
                          ) : (
                          <div className="text-center min-w-[80px]">
                            <div className="flex items-center justify-center gap-1">
                              {editingStat?.id === combatant.id && editingStat.field === "hp" ? (
                                <input
                                  type="number"
                                  autoFocus
                                  className="w-14 text-center font-mono font-bold text-lg bg-muted border border-primary rounded px-1 outline-none"
                                  value={editingStat.value}
                                  onChange={e => setEditingStat(s => s ? { ...s, value: e.target.value } : s)}
                                  onBlur={commitStatEdit}
                                  onKeyDown={e => { if (e.key === "Enter") commitStatEdit(); if (e.key === "Escape") setEditingStat(null); }}
                                />
                              ) : (
                                <span
                                  className={cn("font-mono font-bold text-lg transition-colors", combatState !== "active" && "cursor-pointer hover:text-primary hover:underline underline-offset-2")}
                                  title={combatState !== "active" ? "Click to edit current HP" : undefined}
                                  onClick={() => combatState !== "active" && setEditingStat({ id: combatant.id, field: "hp", value: String(combatant.hp) })}
                                >
                                  {combatant.hp}
                                </span>
                              )}
                              <span className="text-muted-foreground text-sm">/</span>
                              {editingStat?.id === combatant.id && editingStat.field === "maxHp" ? (
                                <input
                                  type="number"
                                  autoFocus
                                  className="w-14 text-center font-mono text-sm bg-muted border border-primary rounded px-1 outline-none"
                                  value={editingStat.value}
                                  onChange={e => setEditingStat(s => s ? { ...s, value: e.target.value } : s)}
                                  onBlur={commitStatEdit}
                                  onKeyDown={e => { if (e.key === "Enter") commitStatEdit(); if (e.key === "Escape") setEditingStat(null); }}
                                />
                              ) : (
                                <span
                                  className={cn("text-muted-foreground text-sm transition-colors", combatState !== "active" && "cursor-pointer hover:text-primary hover:underline underline-offset-2")}
                                  title={combatState !== "active" ? "Click to edit max HP" : undefined}
                                  onClick={() => combatState !== "active" && setEditingStat({ id: combatant.id, field: "maxHp", value: String(combatant.maxHp) })}
                                >
                                  {combatant.maxHp}
                                </span>
                              )}
                              {combatant.tempHp > 0 && (
                                <span className="font-mono text-cyan-500 text-sm">(+{combatant.tempHp})</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Heart className="w-3 h-3" /> HP
                            </div>
                          </div>
                          )}

                          {/* 3.5e Dying State (negative HP) */}
                          {effectiveRuleset === "3.5e" && combatant.combatantType === "pc" && combatant.hp < 0 && !combatant.isDead && (
                            <div className="flex flex-col gap-1 p-2 rounded-md bg-red-950/50 border border-red-800 min-w-[140px]">
                              <div className="text-xs font-semibold text-center text-red-400">
                                Dying ({combatant.hp} HP)
                              </div>
                              <div className="text-xs text-center text-muted-foreground">
                                Dead at -10 HP
                              </div>
                              
                              {lastDeathSaveRoll?.id === combatant.id && lastDeathSaveRoll.result && (
                                <div className={cn(
                                  "text-center text-xs font-bold",
                                  lastDeathSaveRoll.result.includes("Stabilized") ? "text-green-500" : "text-red-400"
                                )}>
                                  {lastDeathSaveRoll.result}
                                </div>
                              )}
                              
                              {combatant.isStable ? (
                                <Badge className="bg-blue-600 text-white text-xs mx-auto">
                                  <HeartPulse className="w-3 h-3 mr-1" /> Stable
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-1 justify-center">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2 text-xs bg-green-600"
                                    onClick={() => record35eStabilization(combatant.id, true)}
                                    data-testid={`button-stabilization-pass-${combatant.id}`}
                                  >
                                    <CircleCheck className="w-3 h-3 mr-1" />
                                    Pass
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => record35eStabilization(combatant.id, false)}
                                    data-testid={`button-stabilization-fail-${combatant.id}`}
                                  >
                                    <CircleX className="w-3 h-3 mr-1" />
                                    Fail (-1 HP)
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 3.5e Disabled State (0 HP exactly) */}
                          {effectiveRuleset === "3.5e" && combatant.isDisabled && !combatant.isDead && (
                            <Badge className="bg-yellow-600 text-white text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" /> Disabled (0 HP)
                            </Badge>
                          )}

                          {/* 4e/5e Death Saves (PC at 0 or less HP) */}
                          {(effectiveRuleset === "4e" || effectiveRuleset === "5e") && 
                           combatant.combatantType === "pc" && combatant.hp <= 0 && !combatant.isDead && (
                            <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/50 border border-muted min-w-[180px]">
                              <div className="text-xs font-semibold text-center mb-1">
                                Death Saves {effectiveRuleset === "4e" && "(4e)"}
                              </div>
                              
                              {/* 4e: Show healing surges */}
                              {effectiveRuleset === "4e" && (
                                <div className="text-xs text-center text-cyan-500">
                                  Surges: {combatant.healingSurges || 0}/{combatant.maxHealingSurges || 0}
                                </div>
                              )}
                              
                              {/* Success/Failure indicators */}
                              <div className="flex items-center justify-center gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-green-500">S:</span>
                                  {[1, 2, 3].map(i => (
                                    <CircleCheck 
                                      key={`success-${i}`}
                                      className={cn(
                                        "w-4 h-4",
                                        i <= combatant.deathSaveSuccesses ? "text-green-500" : "text-muted-foreground/30"
                                      )}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-500">F:</span>
                                  {[1, 2, 3].map(i => (
                                    <CircleX 
                                      key={`failure-${i}`}
                                      className={cn(
                                        "w-4 h-4",
                                        i <= combatant.deathSaveFailures ? "text-red-500" : "text-muted-foreground/30"
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                              
                              {/* 4e: Warning about lingering failures */}
                              {effectiveRuleset === "4e" && combatant.deathSaveFailures > 0 && combatant.hp > 0 && (
                                <div className="text-xs text-center text-orange-400">
                                  Failures persist until rest!
                                </div>
                              )}

                              {/* Roll result display */}
                              {lastDeathSaveRoll?.id === combatant.id && (
                                <div className={cn(
                                  "text-center text-sm font-bold",
                                  lastDeathSaveRoll.roll === 20 ? "text-yellow-500" :
                                  lastDeathSaveRoll.roll === 1 ? "text-red-500" :
                                  lastDeathSaveRoll.roll >= 10 ? "text-green-500" : "text-red-400"
                                )}>
                                  {lastDeathSaveRoll.result || `Rolled: ${lastDeathSaveRoll.roll}`}
                                </div>
                              )}

                              {/* Stabilized status */}
                              {combatant.isStable ? (
                                <Badge className="bg-blue-600 text-white text-xs mx-auto">
                                  <HeartPulse className="w-3 h-3 mr-1" /> Stabilized
                                </Badge>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 justify-center">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-7 px-2 text-xs bg-green-600"
                                      onClick={() => recordDeathSaveResult(combatant.id, "pass")}
                                      data-testid={`button-death-save-pass-${combatant.id}`}
                                    >
                                      <CircleCheck className="w-3 h-3 mr-1" />
                                      Pass
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => recordDeathSaveResult(combatant.id, "fail")}
                                      data-testid={`button-death-save-fail-${combatant.id}`}
                                    >
                                      <CircleX className="w-3 h-3 mr-1" />
                                      Fail
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs text-blue-500"
                                      onClick={() => stabilizePC(combatant.id)}
                                      data-testid={`button-stabilize-${combatant.id}`}
                                    >
                                      Stabilize
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs border-yellow-500 text-yellow-500"
                                      onClick={() => recordDeathSaveResult(combatant.id, "nat20")}
                                      data-testid={`button-death-save-nat20-${combatant.id}`}
                                    >
                                      Nat 20
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-xs border-red-700 text-red-700"
                                      onClick={() => recordDeathSaveResult(combatant.id, "nat1")}
                                      data-testid={`button-death-save-nat1-${combatant.id}`}
                                    >
                                      Nat 1
                                    </Button>
                                    {effectiveRuleset === "4e" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => recordDeathSaveResult(combatant.id, "nochange")}
                                        data-testid={`button-death-save-nochange-${combatant.id}`}
                                      >
                                        No Change
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dead indicator */}
                          {combatant.isDead && (
                            <Badge className="bg-gray-800 text-white">
                              <Skull className="w-3 h-3 mr-1" /> Dead
                            </Badge>
                          )}

                          {/* HP Controls */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <Input
                              type="number"
                              placeholder="0"
                              className="w-16 h-8 text-center text-sm"
                              value={hpInputs[combatant.id] || ""}
                              onChange={(e) => setHpInputs(prev => ({ ...prev, [combatant.id]: e.target.value }))}
                              data-testid={`input-hp-${combatant.id}`}
                            />
                            <Button 
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2"
                              onClick={() => combatant.isGroup ? applyGroupDamage(combatant.id) : applyDamage(combatant.id, false)}
                              data-testid={`button-damage-${combatant.id}`}
                            >
                              <Skull className="w-3 h-3 mr-1" />
                              Dmg
                            </Button>
                            {/* Crit button for PCs at 0 HP (causes 2 death save failures) */}
                            {combatant.combatantType === "pc" && combatant.hp === 0 && !combatant.isDead && (
                              <Button 
                                size="sm"
                                variant="destructive"
                                className="h-8 px-2 bg-red-800"
                                onClick={() => applyDamage(combatant.id, true)}
                                data-testid={`button-crit-${combatant.id}`}
                              >
                                <Skull className="w-3 h-3 mr-1" />
                                Crit!
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              variant="default"
                              className="h-8 px-2 bg-green-600 hover:bg-green-700"
                              onClick={() => combatant.isGroup ? applyGroupHeal(combatant.id) : applyHeal(combatant.id)}
                              data-testid={`button-heal-${combatant.id}`}
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              Heal
                            </Button>
                            {/* Group member management */}
                            {combatant.isGroup && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 border-primary/50 text-primary"
                                  onClick={() => addGroupMember(combatant.id)}
                                  title="Add a member to this group"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 border-muted-foreground/30 text-muted-foreground"
                                  onClick={() => removeGroupMember(combatant.id)}
                                  disabled={(combatant.memberHp?.length ?? 1) <= 1}
                                  title="Remove last member from this group"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {!combatant.isGroup && (
                              <Button 
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 border-cyan-500 text-cyan-500"
                                onClick={() => applyTempHp(combatant.id)}
                                data-testid={`button-temp-hp-${combatant.id}`}
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                Temp
                              </Button>
                            )}
                            {/* Full Heal button for PCs */}
                            {combatant.combatantType === "pc" && (
                              <Button 
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 border-emerald-500 text-emerald-500"
                                onClick={() => fullHeal(combatant.id)}
                                data-testid={`button-full-heal-${combatant.id}`}
                              >
                                <HeartPulse className="w-3 h-3 mr-1" />
                                Full
                              </Button>
                            )}
                          </div>

                          {/* AC — click to edit inline */}
                          <div className="text-center w-14">
                            {editingStat?.id === combatant.id && editingStat.field === "ac" ? (
                              <input
                                type="number"
                                autoFocus
                                className="w-12 text-center font-mono font-bold text-lg bg-muted border border-primary rounded px-1 outline-none"
                                value={editingStat.value}
                                onChange={e => setEditingStat(s => s ? { ...s, value: e.target.value } : s)}
                                onBlur={commitStatEdit}
                                onKeyDown={e => { if (e.key === "Enter") commitStatEdit(); if (e.key === "Escape") setEditingStat(null); }}
                              />
                            ) : (
                              <span
                                className={cn("font-mono font-bold text-lg transition-colors", combatState !== "active" && "cursor-pointer hover:text-primary hover:underline underline-offset-2")}
                                title={combatState !== "active" ? "Click to edit AC" : undefined}
                                onClick={() => combatState !== "active" && setEditingStat({ id: combatant.id, field: "ac", value: String(combatant.ac) })}
                              >
                                {combatant.ac}
                              </span>
                            )}
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Shield className="w-3 h-3" /> AC
                            </div>
                          </div>

                          <Button
                            size="icon"
                            variant="outline"
                            className="text-primary border-primary/40 hover:bg-primary/10"
                            onClick={() => openCorrectionEditor(combatant)}
                            title="Correct encounter stats"
                            data-testid={`button-correct-stats-${combatant.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          {/* Remove */}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => removeCombatant(combatant.id)}
                            disabled={combatState === "active"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Monster Statblock */}
                        {combatant.monsterData && monsterWithOverrides(combatant) && (
                          <MonsterStatblock monster={monsterWithOverrides(combatant)!} onRoll={requestRoll} />
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      </div>

      {/* 3D Dice Roller overlay */}
      {diceOpen && <DiceRoller onClose={() => setDiceOpen(false)} />}

      {/* ── Cinematic Death Scene overlay ─────────────────────────────────── */}
      {deathScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 cursor-pointer"
          style={{ background: "radial-gradient(ellipse at center, rgba(10,0,0,0.92) 0%, rgba(0,0,0,0.97) 100%)" }}
          onClick={() => setDeathScene(null)}
        >
          {/* Blood drip accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-900 to-transparent opacity-60" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-900 to-transparent opacity-60" />

          <div className="max-w-2xl w-full text-center space-y-6">
            {/* Creature name */}
            <p className="text-red-700/80 text-xs font-mono uppercase tracking-[0.3em] font-semibold">
              ☠ {deathScene.name} falls ☠
            </p>

            {/* Death description — ___ rendered as underline blanks */}
            <p className="font-serif text-xl leading-relaxed text-stone-200/90">
              {deathScene.text.split("___").map((segment, i, arr) => (
                <span key={i}>
                  {segment}
                  {i < arr.length - 1 && (
                    <span className="inline-block border-b-2 border-stone-400 px-8 mx-1 text-stone-500 italic text-sm align-baseline">
                      weapon
                    </span>
                  )}
                </span>
              ))}
            </p>

            <p className="text-stone-600 text-xs italic">tap to dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
}
