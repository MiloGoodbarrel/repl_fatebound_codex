import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, ChevronRight, Copy, Dices, Edit3, Library,
  Plus, RotateCcw, Save, Scroll, Search, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCampaign } from "@/lib/campaignContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { RollTable, RollTableEntry, RollTableMode } from "@shared/rollTables";
import { selectRollTableEntry } from "@shared/rollTableDraw";

interface DrawnResult {
  id: string;
  tableId: string | number;
  tableName: string;
  roll: number;
  text: string;
  drawnAt: number;
}

interface EditorEntry {
  text: string;
  minRoll: string;
  maxRoll: string;
  weight: string;
}

interface EditorState {
  id?: number;
  name: string;
  description: string;
  category: string;
  mode: RollTableMode;
  entries: EditorEntry[];
}

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  Trinkets: Scroll,
  Magic: Wand2,
  Wilderness: Library,
  NPCs: Sparkles,
  Settlements: BookOpen,
  Dungeons: Library,
  Adventure: Dices,
  Social: Scroll,
};

const categoryIcon = (category: string) => CATEGORY_ICONS[category] ?? Scroll;

function editorEntry(entry: RollTableEntry, index: number, mode: RollTableMode): EditorEntry {
  return {
    text: entry.text,
    minRoll: String(entry.minRoll ?? index + 1),
    maxRoll: String(entry.maxRoll ?? index + 1),
    weight: String(entry.weight ?? 1),
  };
}

function emptyEditor(): EditorState {
  return {
    name: "",
    description: "",
    category: "Custom",
    mode: "range",
    entries: Array.from({ length: 4 }, (_, index) => ({
      text: "",
      minRoll: String(index + 1),
      maxRoll: String(index + 1),
      weight: "1",
    })),
  };
}

function drawResult(table: RollTable): DrawnResult {
  const { roll, entry } = selectRollTableEntry(table);
  return { id: crypto.randomUUID(), tableId: table.id, tableName: table.name, roll, text: entry.text, drawnAt: Date.now() };
}

export default function RollTables() {
  const { activeCampaign } = useCampaign();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<DrawnResult[]>([]);
  const [history, setHistory] = useState<DrawnResult[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [tablePendingDelete, setTablePendingDelete] = useState<RollTable | null>(null);

  const { data: tables = [], isLoading, isError } = useQuery<RollTable[]>({
    queryKey: ["/api/roll-tables", activeCampaign?.id ?? null],
    queryFn: () => fetch(`/api/roll-tables${activeCampaign ? `?campaignId=${activeCampaign.id}` : ""}`).then(async res => {
      if (!res.ok) throw new Error("Failed to load roll tables");
      return res.json();
    }),
  });

  useEffect(() => {
    setSelectedId(null);
    setSearch("");
    setCategory("All");
    setResults([]);
    setHistory([]);
    setEditor(null);
  }, [activeCampaign?.id]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(tables.map(table => table.category)))],
    [tables],
  );
  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tables.filter(table =>
      (category === "All" || table.category === category)
      && (!query || `${table.name} ${table.description} ${table.category}`.toLowerCase().includes(query)),
    );
  }, [tables, category, search]);
  const selectedTable = filteredTables.find(table => String(table.id) === String(selectedId)) ?? filteredTables[0];

  const saveMutation = useMutation({
    mutationFn: async (payload: EditorState) => {
      if (!activeCampaign) throw new Error("Select a campaign before creating a table");
      const entries = payload.entries.filter(entry => entry.text.trim()).map(entry => ({
        text: entry.text.trim(),
        minRoll: payload.mode === "range" ? Number(entry.minRoll) : undefined,
        maxRoll: payload.mode === "range" ? Number(entry.maxRoll) : undefined,
        weight: payload.mode === "weighted" ? Number(entry.weight) : undefined,
      }));
      const response = await fetch(payload.id ? `/api/roll-tables/${payload.id}` : "/api/roll-tables", {
        method: payload.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: activeCampaign.id,
          name: payload.name.trim(),
          description: payload.description.trim(),
          category: payload.category.trim() || "Custom",
          mode: payload.mode,
          entries,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not save table");
      return body as RollTable;
    },
    onSuccess: table => {
      qc.invalidateQueries({ queryKey: ["/api/roll-tables"] });
      setSelectedId(table.id);
      setEditor(null);
      toast({ title: "Table saved", description: `"${table.name}" is ready to draw.` });
    },
    onError: error => toast({ title: "Could not save table", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (table: RollTable) => {
      if (!activeCampaign || typeof table.id !== "number") throw new Error("Only campaign tables can be deleted");
      const response = await fetch(`/api/roll-tables/${table.id}?campaignId=${activeCampaign.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).message ?? "Could not delete table");
      return table;
    },
    onSuccess: table => {
      qc.invalidateQueries({ queryKey: ["/api/roll-tables"] });
      setSelectedId(null);
      setResults([]);
      setTablePendingDelete(null);
      toast({ title: "Table deleted", description: `"${table.name}" was removed from this campaign.` });
    },
    onError: error => toast({ title: "Could not delete table", description: error.message, variant: "destructive" }),
  });

  const draw = (table = selectedTable, amount = count) => {
    if (!table || table.entries.length === 0) return;
    const newResults = Array.from({ length: amount }, () => drawResult(table));
    setResults(newResults);
    setHistory(previous => [...newResults, ...previous].slice(0, 20));
  };

  const rerollOne = (index: number) => {
    const current = results[index];
    const sourceTable = tables.find(table => String(table.id) === String(current?.tableId));
    if (!sourceTable) {
      toast({ title: "Table no longer available", description: "This result cannot be rerolled because its source table is no longer in the library.", variant: "destructive" });
      return;
    }
    const replacement = drawResult(sourceTable);
    setResults(previous => previous.map((result, resultIndex) => resultIndex === index ? replacement : result));
    setHistory(previous => [replacement, ...previous].slice(0, 20));
  };

  const openEditor = (table?: RollTable) => {
    if (!table) {
      setEditor(emptyEditor());
      return;
    }
    if (table.source !== "campaign") return;
    setEditor({
      id: Number(table.id),
      name: table.name,
      description: table.description,
      category: table.category,
      mode: table.mode,
      entries: table.entries.map((entry, index) => editorEntry(entry, index, table.mode)),
    });
  };

  const duplicateTable = (table: RollTable) => {
    if (table.source !== "campaign") return;
    setEditor({ ...emptyEditor(), name: `${table.name} Copy`, description: table.description, category: table.category, mode: table.mode, entries: table.entries.map((entry, index) => editorEntry(entry, index, table.mode)) });
  };

  const updateEditor = (updates: Partial<EditorState>) => setEditor(previous => previous ? { ...previous, ...updates } : previous);
  const updateEntry = (index: number, updates: Partial<EditorEntry>) => setEditor(previous => previous ? {
    ...previous,
    entries: previous.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...updates } : entry),
  } : previous);

  const canSave = !!editor
    && editor.name.trim().length > 0
    && editor.entries.some(entry => entry.text.trim().length > 0)
    && editor.entries.filter(entry => entry.text.trim()).every(entry =>
      editor.mode === "weighted"
        ? Number.isInteger(Number(entry.weight)) && Number(entry.weight) > 0
        : Number.isInteger(Number(entry.minRoll)) && Number(entry.minRoll) > 0
          && Number.isInteger(Number(entry.maxRoll)) && Number(entry.maxRoll) >= Number(entry.minRoll),
    );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <aside className="w-full md:w-80 lg:w-96 shrink-0 border-b md:border-b-0 md:border-r border-border h-[36vh] md:h-full overflow-hidden bg-card">
        <div className="h-full overflow-y-auto p-6 scrollbar-fantasy">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
                <Dices className="w-5 h-5" /> Roll Tables
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Scroll className="w-3.5 h-3.5 text-primary/70" />
                {activeCampaign ? <>Drawing for <span className="text-primary font-medium">{activeCampaign.name}</span></> : "Stock tables for any session"}
              </p>
            </div>

            <div className="relative">
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tables..." className="pl-9 pr-8 bg-background/50" data-testid="input-roll-table-search" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {search && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")}><X className="w-3 h-3" /></button>}
            </div>

            <div className="space-y-2">
              <Label className="font-display text-sm">Categories</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(item => (
                  <button key={item} onClick={() => setCategory(item)} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", category === item ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50")} data-testid={`filter-roll-category-${item.toLowerCase()}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {activeCampaign ? (
              <Button variant="outline" className="w-full gap-2" onClick={() => openEditor()} data-testid="button-new-roll-table">
                <Plus className="w-4 h-4" /> Create Campaign Table
              </Button>
            ) : (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                <p className="text-primary font-semibold mb-1">Want your own tables?</p>
                Select a campaign on the home page to save custom NPC, settlement, and adventure tables.
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm">Table Library</Label>
                <span className="text-[11px] font-mono text-muted-foreground">{filteredTables.length} tables</span>
              </div>
              {isLoading ? (
                <p className="text-sm text-muted-foreground italic py-5 text-center">Loading tables...</p>
              ) : isError ? (
                <p className="text-sm text-destructive italic py-5 text-center">The table archives could not be loaded. Try again shortly.</p>
              ) : filteredTables.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-5 text-center">No tables match that search.</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredTables.map(table => {
                    const Icon = categoryIcon(table.category);
                    const active = String(table.id) === String(selectedTable?.id);
                    return (
                      <button key={table.id} onClick={() => { setSelectedId(table.id); setResults([]); }} className={cn("w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all", active ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-background/40")} data-testid={`button-select-roll-table-${table.id}`}>
                        <span className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", active ? "bg-primary/20 text-primary" : "bg-background/70 text-muted-foreground")}><Icon className="w-4 h-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-sm font-semibold truncate">{table.name}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{table.category} · {table.entries.length} results</span>
                        </span>
                        {table.source === "campaign" && <span className="text-[9px] text-primary font-mono">YOURS</span>}
                        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", active && "text-primary translate-x-0.5")} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative scrollbar-fantasy">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex justify-between items-center mb-8">
            <Link href="/"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to Home</Button></Link>
            {activeCampaign && <span className="text-xs font-mono text-primary/70 bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">{activeCampaign.name}</span>}
          </div>

          {!selectedTable ? (
            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center space-y-5">
              <div className="w-32 h-32 rounded-full bg-card border-4 border-border flex items-center justify-center shadow-2xl shadow-primary/10"><Dices className="w-16 h-16 text-muted-foreground" /></div>
              <div className="max-w-md space-y-2">
                <h1 className="text-3xl md:text-4xl font-display font-bold">{isError ? "Archives Unavailable" : "No Table Found"}</h1>
                <p className="text-muted-foreground font-serif text-lg">{isError ? "The roll tables could not be loaded. Check your connection and try again." : "Try a different search, or create a campaign table to begin."}</p>
              </div>
            </div>
          ) : (
            <>
              <Card className="border-2 border-primary/30 bg-card/70 backdrop-blur-sm mb-8 overflow-hidden">
                <CardContent className="p-5 md:p-7">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0"><Dices className="w-8 h-8 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs uppercase tracking-widest text-primary font-mono">{selectedTable.category}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-mono">{selectedTable.mode === "weighted" ? "Weighted" : `D${Math.max(...selectedTable.entries.map((entry, index) => entry.maxRoll ?? index + 1))}`}</span>
                        {selectedTable.source === "campaign" && <span className="text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-1.5 py-0.5 rounded">Campaign</span>}
                      </div>
                      <h1 className="text-3xl font-display font-bold text-foreground truncate">{selectedTable.name}</h1>
                      <p className="text-muted-foreground font-serif mt-1">{selectedTable.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-md border border-border bg-background/50 p-1">
                        {[1, 2, 3, 5].map(value => <button key={value} onClick={() => setCount(value)} className={cn("px-2.5 py-1 text-xs rounded", count === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`button-roll-count-${value}`}>{value}</button>)}
                      </div>
                      <Button onClick={() => draw()} className="gap-2 font-display font-bold" data-testid="button-draw-roll-table"><Dices className="w-4 h-4" /> Draw {count > 1 ? `${count} Cards` : "Card"}</Button>
                    </div>
                  </div>
                  {selectedTable.source === "campaign" && (
                    <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-border/50">
                      <Button variant="ghost" size="sm" onClick={() => duplicateTable(selectedTable)} className="gap-1.5 text-muted-foreground" data-testid="button-duplicate-roll-table"><Copy className="w-3.5 h-3.5" /> Duplicate</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditor(selectedTable)} className="gap-1.5 text-muted-foreground" data-testid="button-edit-roll-table"><Edit3 className="w-3.5 h-3.5" /> Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => setTablePendingDelete(selectedTable)} disabled={deleteMutation.isPending} className="gap-1.5 text-destructive hover:text-destructive" data-testid="button-delete-roll-table"><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[35vh] text-center space-y-5">
                  <div className="w-28 h-28 rounded-full bg-card border-4 border-border flex items-center justify-center shadow-2xl shadow-primary/10"><Scroll className="w-14 h-14 text-muted-foreground" /></div>
                  <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-display font-bold">Awaiting a Roll</h2>
                    <p className="text-muted-foreground font-serif">Choose how many cards to reveal, then draw from <span className="text-primary">{selectedTable.name}</span>.</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {results.map((result, index) => (
                      <motion.div key={result.id} initial={{ opacity: 0, y: 20, rotateY: 90 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ duration: 0.5, delay: index * 0.1, type: "spring", stiffness: 100 }} className="relative group min-h-[280px] w-full bg-card rounded-xl p-6 flex flex-col border-2 border-primary/60 rarity-glow-legendary overflow-hidden" data-testid={`card-roll-result-${index}`}>
                        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay pointer-events-none" />
                        <div className="flex justify-between items-start mb-5 relative z-10">
                          <div className="w-12 h-12 rounded-lg bg-background/80 border border-primary/40 flex items-center justify-center"><span className="font-mono text-xl font-bold text-primary">{result.roll}</span></div>
                          <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Result {index + 1}</span>
                        </div>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-5" />
                        <p className="flex-1 text-lg leading-relaxed font-serif text-foreground/90 relative z-10">{result.text}</p>
                        <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground font-mono truncate">{result.tableName}</span>
                          <Button variant="ghost" size="sm" onClick={() => rerollOne(index)} className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary" data-testid={`button-reroll-result-${index}`}><RotateCcw className="w-3 h-3" /> Reroll</Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )}

              {results.length > 0 && (
                <div className="flex justify-center mt-8"><Button variant="outline" onClick={() => draw()} className="gap-2" data-testid="button-reroll-roll-table"><RotateCcw className="w-4 h-4" /> Draw Again</Button></div>
              )}

              {history.length > 0 && (
                <section className="mt-12 pt-6 border-t border-border/60">
                  <div className="flex items-center justify-between mb-3"><h2 className="font-display font-semibold text-primary flex items-center gap-2"><Sparkles className="w-4 h-4" /> Recent Results</h2><Button variant="ghost" size="sm" onClick={() => setHistory([])} className="text-xs text-muted-foreground">Clear History</Button></div>
                  <div className="space-y-1.5">
                    {history.map(result => <div key={result.id} className="flex items-baseline gap-3 text-sm p-2 rounded bg-card/40"><span className="font-mono text-primary w-7 text-right">{result.roll}</span><span className="text-muted-foreground truncate">{result.text}</span><span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{result.tableName}</span></div>)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={!!editor} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-fantasy">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" /> {editor?.id ? "Edit Roll Table" : "New Campaign Table"}</DialogTitle>
            <DialogDescription>Build a reusable table for {activeCampaign?.name ?? "your campaign"}.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="roll-table-name">Table Name</Label><Input id="roll-table-name" value={editor.name} onChange={event => updateEditor({ name: event.target.value })} placeholder="e.g. Harbor District NPCs" data-testid="input-roll-table-name" /></div>
                <div className="space-y-1"><Label htmlFor="roll-table-category">Category</Label><Input id="roll-table-category" value={editor.category} onChange={event => updateEditor({ category: event.target.value })} placeholder="NPCs, Settlements, Events..." data-testid="input-roll-table-category" /></div>
              </div>
              <div className="space-y-1"><Label htmlFor="roll-table-description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label><Textarea id="roll-table-description" value={editor.description} onChange={event => updateEditor({ description: event.target.value })} placeholder="What kind of moment does this table create?" rows={2} data-testid="input-roll-table-description" /></div>
              <div className="space-y-2">
                <Label>Draw method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateEditor({ mode: "range" })} className={cn("p-3 text-left rounded-lg border", editor.mode === "range" ? "border-primary bg-primary/10" : "border-border")}><span className="block font-display font-semibold text-sm">Number range</span><span className="text-xs text-muted-foreground">Roll a die and match min/max values.</span></button>
                  <button onClick={() => updateEditor({ mode: "weighted" })} className={cn("p-3 text-left rounded-lg border", editor.mode === "weighted" ? "border-primary bg-primary/10" : "border-border")}><span className="block font-display font-semibold text-sm">Weighted chance</span><span className="text-xs text-muted-foreground">Give entries more or less weight.</span></button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div><Label>Table Entries</Label><p className="text-xs text-muted-foreground">Each entry becomes a card result.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateEditor({ entries: [...editor.entries, { text: "", minRoll: String(editor.entries.length + 1), maxRoll: String(editor.entries.length + 1), weight: "1" }] })} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Entry</Button></div>
                <div className="space-y-2">
                  {editor.entries.map((entry, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 rounded-lg border border-border/60 bg-background/30">
                      <span className="font-mono text-xs text-muted-foreground pt-2 w-5">{index + 1}</span>
                      {editor.mode === "range" ? <><Input type="number" min="1" value={entry.minRoll} onChange={event => updateEntry(index, { minRoll: event.target.value })} className="w-16 px-2" aria-label={`Entry ${index + 1} minimum`} placeholder="Min" /><Input type="number" min="1" value={entry.maxRoll} onChange={event => updateEntry(index, { maxRoll: event.target.value })} className="w-16 px-2" aria-label={`Entry ${index + 1} maximum`} placeholder="Max" /></> : <Input type="number" min="1" value={entry.weight} onChange={event => updateEntry(index, { weight: event.target.value })} className="w-16 px-2" aria-label={`Entry ${index + 1} weight`} placeholder="Wt." />}
                      <Input value={entry.text} onChange={event => updateEntry(index, { text: event.target.value })} className="flex-1" placeholder="What happens?" aria-label={`Entry ${index + 1} text`} data-testid={`input-roll-entry-${index}`} />
                      <Button type="button" size="icon" variant="ghost" onClick={() => updateEditor({ entries: editor.entries.filter((_, entryIndex) => entryIndex !== index) })} disabled={editor.entries.length <= 1} className="text-muted-foreground hover:text-destructive" aria-label={`Remove entry ${index + 1}`}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/60"><Button variant="ghost" onClick={() => setEditor(null)}><X className="w-4 h-4 mr-1" /> Cancel</Button><Button onClick={() => editor && saveMutation.mutate(editor)} disabled={!canSave || saveMutation.isPending} className="gap-2" data-testid="button-save-roll-table"><Save className="w-4 h-4" /> {saveMutation.isPending ? "Saving..." : "Save Table"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tablePendingDelete} onOpenChange={open => { if (!open) setTablePendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete {tablePendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the table and all of its entries from {activeCampaign?.name ?? "this campaign"}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Table</AlertDialogCancel>
            <AlertDialogAction onClick={() => tablePendingDelete && deleteMutation.mutate(tablePendingDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Table</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}