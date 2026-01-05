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
  Swords, Plus, Trash2, ChevronUp, ChevronDown, User, Heart, Shield, 
  RotateCcw, Home, Search, Play, SkipForward, Square, Skull, AlertCircle,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const VERSION_OPTIONS = [
  { id: "3.5", label: "D&D 3.5 Edition" },
  { id: "4th", label: "D&D 4th Edition" },
  { id: "5e", label: "D&D 5e (2014)" },
  { id: "onednd", label: "One D&D" },
];

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

interface Monster {
  index: string;
  name: string;
  hp: number;
  ac: number;
  cr: string;
  type: string;
  size: string;
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  source?: string;
}

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  isMonster: boolean;
  conditions: string[];
  isDown: boolean;
  monsterData?: Monster;
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
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: selectedMonster.name,
      initiative: 0,
      hp: selectedMonster.hp,
      maxHp: selectedMonster.hp,
      ac: selectedMonster.ac,
      isMonster: true,
      conditions: [],
      isDown: false,
      monsterData: selectedMonster,
    };
    setCombatants(prev => [...prev, newCombatant]);
    setSelectedMonster(null);
    setMonsterSearch("");
  };

  const addPC = () => {
    if (!pcName) return;
    const newCombatant: Combatant = {
      id: Math.random().toString(36).substr(2, 9),
      name: pcName,
      initiative: pcInitiative ? parseInt(pcInitiative) : 0,
      hp: pcHp ? parseInt(pcHp) : 0,
      maxHp: pcHp ? parseInt(pcHp) : 0,
      ac: pcAc ? parseInt(pcAc) : 0,
      isMonster: false,
      conditions: [],
      isDown: false,
    };
    setCombatants(prev => [...prev, newCombatant]);
    setPcName("");
    setPcInitiative("");
    setPcHp("");
    setPcAc("");
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

  const updateHp = (id: string, delta: number) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    const newHp = Math.max(0, combatant.hp + delta);
    updateCombatant(id, { 
      hp: newHp, 
      isDown: newHp === 0 
    });
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

  const getSortedCombatants = () => {
    return [...combatants].sort((a, b) => b.initiative - a.initiative);
  };

  const startCombat = () => {
    if (combatants.length === 0) return;
    const sorted = getSortedCombatants();
    setCombatants(sorted);
    setCombatState("active");
    
    // Find first non-downed combatant
    let startIndex = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (!sorted[i].isDown) {
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
    
    // Skip downed combatants
    while (sorted[nextIndex]?.isDown && attempts < sorted.length) {
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
                      combatant.isMonster ? "bg-red-500/5" : "bg-blue-500/5"
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
                              <h3 className="text-lg font-bold truncate flex items-center gap-2">
                                {combatant.isDown && <Skull className="w-4 h-4 text-destructive" />}
                                {combatant.name}
                              </h3>
                              {combatant.isMonster ? (
                                <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
                              ) : (
                                <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              )}
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

                          {/* HP */}
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => updateHp(combatant.id, -1)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <div className="text-center w-16">
                              <span className="font-mono font-bold text-lg">{combatant.hp}</span>
                              <span className="text-muted-foreground text-sm">/{combatant.maxHp}</span>
                              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <Heart className="w-3 h-3" /> HP
                              </div>
                            </div>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8"
                              onClick={() => updateHp(combatant.id, 1)}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
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
