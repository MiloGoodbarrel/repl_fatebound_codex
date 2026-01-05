import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Plus, Trash2, ChevronUp, ChevronDown, User, Heart, Shield, RotateCcw, Home } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Entity {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  isMonster: boolean;
}

export default function InitiativeTracker() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState("");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");
  const [isMonster, setIsMonster] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const addEntity = () => {
    if (!name || !initiative) return;
    const newEntity: Entity = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      initiative: parseInt(initiative),
      hp: hp ? parseInt(hp) : 0,
      maxHp: hp ? parseInt(hp) : 0,
      ac: ac ? parseInt(ac) : 0,
      isMonster,
    };
    const updated = [...entities, newEntity].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
    setEntities(updated);
    if (updated.length === 1) setActiveId(newEntity.id);
    setName("");
    setInitiative("");
    setHp("");
    setAc("");
  };

  const removeEntity = (id: string) => {
    setEntities(entities.filter(e => e.id !== id));
    if (activeId === id) nextTurn();
  };

  const nextTurn = () => {
    if (entities.length === 0) return;
    const currentIndex = entities.findIndex(e => e.id === activeId);
    const nextIndex = (currentIndex + 1) % entities.length;
    setActiveId(entities[nextIndex].id);
  };

  const updateHp = (id: string, delta: number) => {
    setEntities(entities.map(e => 
      e.id === id ? { ...e, hp: Math.max(0, e.hp + delta) } : e
    ));
  };

  const reset = () => {
    setEntities([]);
    setActiveId(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar - Add Entity */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border p-6 bg-card overflow-y-auto scrollbar-fantasy">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="w-4 h-4" /> Home
              </Button>
            </Link>
            <h2 className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <Swords className="w-5 h-5" /> Initiative
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Character Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initiative</Label>
                <Input type="number" value={initiative} onChange={e => setInitiative(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>AC</Label>
                <Input type="number" value={ac} onChange={e => setAc(e.target.value)} placeholder="10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max HP</Label>
              <Input type="number" value={hp} onChange={e => setHp(e.target.value)} placeholder="0" />
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="isMonster" 
                checked={isMonster} 
                onChange={e => setIsMonster(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isMonster">Mark as Monster/NPC</Label>
            </div>
            <Button onClick={addEntity} className="w-full h-12 text-lg font-display" disabled={!name || !initiative}>
              <Plus className="mr-2" /> Add to Combat
            </Button>
            <Button onClick={reset} variant="outline" className="w-full text-destructive hover:bg-destructive/10">
              <RotateCcw className="mr-2 w-4 h-4" /> Reset Combat
            </Button>
          </div>
        </div>
      </div>

      {/* Main Area - List */}
      <main className="flex-1 overflow-y-auto p-4 md:p-12 relative bg-background/50 scrollbar-fantasy">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-display font-bold">Combat Order</h1>
            <Button size="lg" onClick={nextTurn} disabled={entities.length === 0} className="font-display">
              Next Turn <ChevronDown className="ml-2" />
            </Button>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {entities.map((entity) => (
                <motion.div
                  key={entity.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "relative transition-all duration-300",
                    activeId === entity.id ? "scale-105 z-10" : "opacity-80 scale-100"
                  )}
                >
                  <Card className={cn(
                    "border-2",
                    activeId === entity.id ? "border-primary shadow-lg shadow-primary/20" : "border-border",
                    entity.isMonster ? "bg-red-500/5" : "bg-blue-500/5"
                  )}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-lg bg-card border-2 border-primary/20 flex items-center justify-center font-mono text-2xl font-bold">
                          {entity.initiative}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            {entity.name}
                            {entity.isMonster ? <Shield className="w-4 h-4 text-red-500" /> : <User className="w-4 h-4 text-blue-500" />}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> AC: {entity.ac}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> HP: {entity.hp}/{entity.maxHp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateHp(entity.id, -1)}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <span className="font-mono font-bold text-lg min-w-[2ch] text-center">{entity.hp}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateHp(entity.id, 1)}>
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => removeEntity(entity.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
