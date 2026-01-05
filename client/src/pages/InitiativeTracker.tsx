import { useState, useEffect } from "react";
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
  Swords, Plus, Trash2, User, Heart, Shield, 
  RotateCcw, Home, Search, Play, SkipForward, Square, Skull, AlertCircle,
  Loader2, Zap, Dices, CircleCheck, CircleX, HeartPulse
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

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

interface Monster {
  index: string;
  name: string;
  hp: number;
  hit_dice?: string;
  ac: number;
  cr: string;
  type: string;
  size: string;
  speed?: Record<string, string>;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  actions?: MonsterAction[];
  special_abilities?: Array<{ name: string; desc: string }>;
  source?: string;
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
}

type CombatState = "setup" | "active" | "ended";

export default function InitiativeTracker() {
  const [showVersionDialog, setShowVersionDialog] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [combatState, setCombatState] = useState<CombatState>("setup");
  const [activeIndex, setActiveIndex] = useState(0);
  const [round, setRound] = useState(1);
  
  // Monster search
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [monsterSearch, setMonsterSearch] = useState("");
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [loadingMonsters, setLoadingMonsters] = useState(false);
  
  // PC entry
  const [pcName, setPcName] = useState("");
  const [pcInitiative, setPcInitiative] = useState("");
  const [pcHp, setPcHp] = useState("");
  const [pcAc, setPcAc] = useState("");
  
  // NPC entry (DM-created)
  const [npcName, setNpcName] = useState("");
  const [npcHp, setNpcHp] = useState("");
  const [npcAc, setNpcAc] = useState("");
  const [npcStance, setNpcStance] = useState<NPCStance>("enemy");
  
  // HP modification inputs per combatant
  const [hpInputs, setHpInputs] = useState<Record<string, string>>({});

  // Fetch monsters when versions are selected
  useEffect(() => {
    if (selectedVersions.length > 0) {
      fetchMonsters();
    }
  }, [selectedVersions]);

  const fetchMonsters = async () => {
    setLoadingMonsters(true);
    try {
      const response = await fetch(`/api/monsters?versions=${selectedVersions.join(",")}`);
      if (response.ok) {
        const data = await response.json();
        setMonsters(data);
      }
    } catch (error) {
      console.error("Failed to fetch monsters:", error);
    } finally {
      setLoadingMonsters(false);
    }
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

  const filteredMonsters = monsters.filter(m => 
    m.name.toLowerCase().includes(monsterSearch.toLowerCase())
  );

  const addMonster = () => {
    if (!selectedMonster) return;
    
    // Count existing monsters with same base name to auto-number
    const baseName = selectedMonster.name;
    const existingCount = combatants.filter(c => 
      c.name === baseName || c.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} #\\d+$`))
    ).length;
    
    const displayName = existingCount === 0 ? baseName : `${baseName} #${existingCount + 1}`;
    
    // If this is the second monster of this type, rename the first one
    if (existingCount === 1) {
      setCombatants(prev => prev.map(c => 
        c.name === baseName ? { ...c, name: `${baseName} #1` } : c
      ));
    }
    
    // Roll HP using dice formula if available, otherwise use average with variance
    const rolledHp = selectedMonster.hit_dice 
      ? rollMonsterHp(selectedMonster.hit_dice, selectedMonster.hp)
      : rollMonsterHp("", selectedMonster.hp);
    
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: displayName,
      initiative: 0,
      hp: Math.max(1, rolledHp),
      maxHp: Math.max(1, rolledHp),
      tempHp: 0,
      ac: selectedMonster.ac,
      isMonster: true,
      combatantType: "monster",
      conditions: [],
      isDown: false,
      monsterData: selectedMonster,
      stance: "enemy",
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      isDead: false,
    };
    setCombatants(prev => [...prev, newCombatant]);
    setSelectedMonster(null);
    setMonsterSearch("");
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
    };
    setCombatants(prev => [...prev, newCombatant]);
    setPcName("");
    setPcInitiative("");
    setPcHp("");
    setPcAc("");
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
    const newConditions = combatant.conditions.includes(condition)
      ? combatant.conditions.filter(c => c !== condition)
      : [...combatant.conditions, condition];
    
    const isIncapacitated = ["Unconscious", "Paralyzed", "Petrified", "Incapacitated", "Stunned"].some(
      c => newConditions.includes(c)
    );
    
    updateCombatant(id, { 
      conditions: newConditions,
      isDown: combatant.hp === 0 || isIncapacitated
    });
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
      setRound(r => r + 1);
    }
    
    setActiveIndex(nextIndex);
  };

  const endCombat = () => {
    setCombatState("ended");
  };

  const resetCombat = () => {
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
  const resetAll = () => {
    setCombatants([]);
    setCombatState("setup");
    setActiveIndex(0);
    setRound(1);
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

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row h-screen overflow-hidden">
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

      {/* Sidebar - Add Combatants */}
      <div className="w-full md:w-96 lg:w-[28rem] flex-shrink-0 border-r border-border p-6 bg-card overflow-y-auto scrollbar-fantasy">
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
              <p className="text-sm text-muted-foreground">
                Round {round} - {activeCombatant?.name}'s turn
              </p>
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
                onChange={e => setMonsterSearch(e.target.value)}
                placeholder="Search monsters..."
                className="pr-8"
                data-testid="input-monster-search"
              />
              {loadingMonsters && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {monsterSearch && filteredMonsters.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                {filteredMonsters.slice(0, 10).map(monster => (
                  <div
                    key={monster.index}
                    onClick={() => setSelectedMonster(monster)}
                    className={cn(
                      "p-2 cursor-pointer hover-elevate text-sm flex justify-between",
                      selectedMonster?.index === monster.index && "bg-primary/10"
                    )}
                  >
                    <span>{monster.name}</span>
                    <span className="text-muted-foreground text-xs">CR {monster.cr}</span>
                  </div>
                ))}
              </div>
            )}
            
            {selectedMonster && (
              <div className="p-3 bg-primary/5 rounded-md space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold">{selectedMonster.name}</span>
                  <Badge variant="outline">CR {selectedMonster.cr}</Badge>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                  <span><Heart className="w-3 h-3 inline mr-1" />HP: {selectedMonster.hp}</span>
                  <span><Shield className="w-3 h-3 inline mr-1" />AC: {selectedMonster.ac}</span>
                  <span>{selectedMonster.size} {selectedMonster.type}</span>
                  {selectedMonster.source && <span className="text-primary/70">{selectedMonster.source}</span>}
                </div>
                {selectedMonster.resistances && selectedMonster.resistances.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Resistances: </span>
                    {selectedMonster.resistances.join(", ")}
                  </div>
                )}
              </div>
            )}
            
            <Button 
              onClick={addMonster} 
              disabled={!selectedMonster}
              className="w-full"
              data-testid="button-add-monster"
            >
              <Plus className="mr-2 w-4 h-4" /> Add Monster
            </Button>
          </div>

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
            <div className="grid grid-cols-3 gap-2">
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
            </div>
            <Button 
              onClick={addPC} 
              disabled={!pcName}
              variant="secondary"
              className="w-full"
              data-testid="button-add-pc"
            >
              <Plus className="mr-2 w-4 h-4" /> Add PC
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
              <div className="text-center space-y-4">
                <p className="text-lg font-display text-muted-foreground">Combat Ended</p>
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
                onClick={resetAll} 
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
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-background/50 scrollbar-fantasy">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-display font-bold">Combat Order</h1>
            {combatState === "active" && (
              <Badge variant="default" className="text-lg px-4 py-1">
                Round {round}
              </Badge>
            )}
          </div>

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
                                            <div><span className="font-semibold">AC:</span> {combatant.monsterData.ac}</div>
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
                                            <div>
                                              <div className="font-bold">STR</div>
                                              <div>{combatant.monsterData.str || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.str || 10)}</div>
                                            </div>
                                            <div>
                                              <div className="font-bold">DEX</div>
                                              <div>{combatant.monsterData.dex || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.dex || 10)}</div>
                                            </div>
                                            <div>
                                              <div className="font-bold">CON</div>
                                              <div>{combatant.monsterData.con || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.con || 10)}</div>
                                            </div>
                                            <div>
                                              <div className="font-bold">INT</div>
                                              <div>{combatant.monsterData.int || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.int || 10)}</div>
                                            </div>
                                            <div>
                                              <div className="font-bold">WIS</div>
                                              <div>{combatant.monsterData.wis || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.wis || 10)}</div>
                                            </div>
                                            <div>
                                              <div className="font-bold">CHA</div>
                                              <div>{combatant.monsterData.cha || 10}</div>
                                              <div className="text-muted-foreground">{getAbilityModifier(combatant.monsterData.cha || 10)}</div>
                                            </div>
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
                            <div className="text-xs text-muted-foreground ml-8">
                              {combatant.combatantType === "monster" 
                                ? `Monster - ${(combatant.stance || "enemy").charAt(0).toUpperCase() + (combatant.stance || "enemy").slice(1)}` 
                                : combatant.combatantType === "npc"
                                ? `NPC - ${(combatant.stance || "enemy").charAt(0).toUpperCase() + (combatant.stance || "enemy").slice(1)}`
                                : "Player Character"}
                            </div>
                          </div>

                          {/* Conditions Column */}
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <Select onValueChange={(val) => toggleCondition(combatant.id, val)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-condition-${combatant.id}`}>
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
                            <div className="flex flex-wrap gap-1">
                              {combatant.conditions.map(condition => (
                                <Badge 
                                  key={condition} 
                                  className="text-xs cursor-pointer text-white border-0"
                                  style={{ backgroundColor: CONDITION_COLORS[condition] }}
                                  onClick={() => toggleCondition(combatant.id, condition)}
                                  data-testid={`badge-condition-${combatant.id}-${condition}`}
                                >
                                  {condition} <span className="ml-1 opacity-70">x</span>
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* HP Display */}
                          <div className="text-center min-w-[80px]">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-lg">{combatant.hp}</span>
                              <span className="text-muted-foreground text-sm">/{combatant.maxHp}</span>
                              {combatant.tempHp > 0 && (
                                <span className="font-mono text-cyan-500 text-sm">(+{combatant.tempHp})</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Heart className="w-3 h-3" /> HP
                            </div>
                          </div>

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
                              onClick={() => applyDamage(combatant.id, false)}
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
                              onClick={() => applyHeal(combatant.id)}
                              data-testid={`button-heal-${combatant.id}`}
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              Heal
                            </Button>
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

                          {/* AC */}
                          <div className="text-center w-12">
                            <span className="font-mono font-bold text-lg">{combatant.ac}</span>
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Shield className="w-3 h-3" /> AC
                            </div>
                          </div>

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

                        {/* Monster Details */}
                        {combatant.monsterData && (
                          <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex flex-wrap gap-4">
                            <span>CR {combatant.monsterData.cr}</span>
                            <span>{combatant.monsterData.size} {combatant.monsterData.type}</span>
                            {combatant.monsterData.resistances && combatant.monsterData.resistances.length > 0 && (
                              <span>Resistances: {combatant.monsterData.resistances.join(", ")}</span>
                            )}
                            {combatant.monsterData.immunities && combatant.monsterData.immunities.length > 0 && (
                              <span>Immunities: {combatant.monsterData.immunities.join(", ")}</span>
                            )}
                          </div>
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
  );
}
