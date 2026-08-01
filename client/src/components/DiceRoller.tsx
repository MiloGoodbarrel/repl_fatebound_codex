import { useEffect, useRef, useState, useCallback } from "react";
import { X, Dices } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DiceResult {
  notation: string;
  dice: number[];
  modifier: number;
  total: number;
  label?: string;
}

interface DiceRollerProps {
  onClose: () => void;
}

// Parse "2d6+4", "1d8", "3d10-2", "1d20+5" etc.
export function parseDiceNotation(raw: string): { count: number; sides: number; modifier: number; notation: string } | null {
  const match = raw.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  const notation = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ""}`;
  return { count, sides, modifier, notation };
}

// Find all dice expressions in a string and return them with their positions
export function findDiceExpressions(text: string): Array<{ match: string; index: number; length: number }> {
  const regex = /\b(\d+d\d+(?:[+-]\d+)?)\b/gi;
  const results: Array<{ match: string; index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    // Only include valid polyhedral dice
    const parsed = parseDiceNotation(m[1]);
    if (parsed && [4, 6, 8, 10, 12, 20, 100].includes(parsed.sides)) {
      results.push({ match: m[1], index: m.index, length: m[1].length });
    }
  }
  return results;
}

// Render text with clickable dice expressions
export function DiceText({ text, onRoll }: { text: string; onRoll: (notation: string, label?: string) => void }) {
  const expressions = findDiceExpressions(text);
  if (expressions.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  expressions.forEach(({ match, index, length }, i) => {
    if (index > last) parts.push(<span key={`t${i}`}>{text.slice(last, index)}</span>);
    parts.push(
      <button
        key={`d${i}`}
        onClick={() => onRoll(match)}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/20 hover:bg-primary/40 text-primary font-mono text-xs font-bold border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer mx-0.5"
        title={`Roll ${match}`}
      >
        <Dices className="w-3 h-3" />
        {match}
      </button>
    );
    last = index + length;
  });
  if (last < text.length) parts.push(<span key="tail">{text.slice(last)}</span>);
  return <>{parts}</>;
}

// The main DiceRoller overlay
export function DiceRoller({ onClose }: DiceRollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceBoxRef = useRef<any>(null);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRollRef = useRef<{ notation: string; label?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { default: DiceBox } = await import("@3d-dice/dice-box");
        if (cancelled || !containerRef.current) return;

        const box = new DiceBox({
          container: "#dice-box-canvas-container",
          assetPath: "/assets/dice-box/",
          theme: "default",
          offscreen: false,
          scale: 7,
          gravity: 2,
          mass: 1,
          friction: 0.8,
          restitution: 0.3,
          angularDamping: 0.4,
          linearDamping: 0.4,
          spinForce: 4,
          throwForce: 5,
          startingHeight: 10,
          settleTimeout: 5000,
          enableShadows: true,
          lightIntensity: 1,
        });

        await box.init();
        if (cancelled) { box.clear(); return; }

        diceBoxRef.current = box;

        box.onRollComplete = (results: any[]) => {
          if (!pendingRollRef.current) return;
          const { notation, label } = pendingRollRef.current;
          const parsed = parseDiceNotation(notation);
          if (!parsed) return;

          const dice = results.map((r: any) => r.value);
          const sum = dice.reduce((a: number, b: number) => a + b, 0);
          const total = sum + parsed.modifier;

          setResult({ notation: parsed.notation, dice, modifier: parsed.modifier, total, label });
          setRolling(false);
        };

        setReady(true);

        // Roll immediately if something was queued
        if (pendingRollRef.current) {
          doRoll(box, pendingRollRef.current.notation);
        }
      } catch (e: any) {
        if (!cancelled) setError("3D dice unavailable in this browser.");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const doRoll = (box: any, notation: string) => {
    const parsed = parseDiceNotation(notation);
    if (!parsed) return;
    setRolling(true);
    setResult(null);
    box.clear();
    box.roll(`${parsed.count}d${parsed.sides}`);
  };

  const roll = useCallback((notation: string, label?: string) => {
    pendingRollRef.current = { notation, label };
    if (diceBoxRef.current && ready) {
      doRoll(diceBoxRef.current, notation);
    }
  }, [ready]);

  // Expose roll via ref pattern through a custom event
  useEffect(() => {
    const handler = (e: CustomEvent) => roll(e.detail.notation, e.detail.label);
    window.addEventListener("dice-roll-request" as any, handler as any);
    return () => window.removeEventListener("dice-roll-request" as any, handler as any);
  }, [roll]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end pointer-events-none">
      {/* Full-screen dice canvas */}
      <div
        id="dice-box-canvas-container"
        ref={containerRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "transparent" }}
        onClick={() => {
          if (!rolling) onClose();
        }}
      />

      {/* Result panel */}
      <AnimatePresence>
        {(result || rolling) && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-10 pointer-events-auto mb-8 mx-4 w-full max-w-sm"
          >
            <div className="bg-card border-2 border-primary/60 rounded-xl p-4 shadow-2xl text-center">
              {rolling && !result && (
                <p className="text-muted-foreground font-mono text-sm animate-pulse">Rolling…</p>
              )}
              {result && (
                <>
                  <p className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                    {result.label ?? result.notation}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2">
                    {result.dice.map((v, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-background border border-border font-bold text-sm text-foreground"
                      >
                        {v}
                      </span>
                    ))}
                    {result.modifier !== 0 && (
                      <span className="text-muted-foreground font-mono text-sm">
                        {result.modifier > 0 ? `+${result.modifier}` : result.modifier}
                      </span>
                    )}
                  </div>
                  <p className="text-4xl font-display font-bold text-primary">{result.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.dice.join(" + ")}
                    {result.modifier !== 0 && (result.modifier > 0 ? ` + ${result.modifier}` : ` - ${Math.abs(result.modifier)}`)}
                    {" = "}
                    <span className="text-primary font-bold">{result.total}</span>
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 pointer-events-auto bg-card border border-border rounded-full p-2 hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Loading / error state */}
      {!ready && !error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <p className="text-muted-foreground text-sm font-mono animate-pulse">Loading dice…</p>
        </div>
      )}
      {error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

// Hook — call this in InitiativeTracker to manage the dice roller state
export function useDiceRoller() {
  const [open, setOpen] = useState(false);

  const requestRoll = useCallback((notation: string, label?: string) => {
    setOpen(true);
    // Give the component a tick to mount before firing the event
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("dice-roll-request", { detail: { notation, label } }));
    }, 100);
  }, []);

  return { open, setOpen, requestRoll };
}
