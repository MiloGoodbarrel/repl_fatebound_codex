import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { X, Dices } from "lucide-react";

// ─── Dice geometry (SVG paths centred on 0,0 in a 100×100 viewBox) ───────────
const DIE_SHAPES: Record<number, { path: string; viewBox: string; label: string; color: string; textY: string }> = {
  4:  {
    path: "M50 8 L92 80 L8 80 Z",
    viewBox: "0 0 100 100", label: "d4",
    color: "#ef4444", textY: "68",
  },
  6:  {
    path: "M18 18 H82 V82 H18 Z",
    viewBox: "0 0 100 100", label: "d6",
    color: "#f97316", textY: "62",
  },
  8:  {
    path: "M50 6 L94 50 L50 94 L6 50 Z",
    viewBox: "0 0 100 100", label: "d8",
    color: "#eab308", textY: "62",
  },
  10: {
    path: "M50 8 L88 35 L74 80 L26 80 L12 35 Z",
    viewBox: "0 0 100 100", label: "d10",
    color: "#22c55e", textY: "62",
  },
  12: {
    path: "M50 6 L82 20 L95 54 L74 88 L26 88 L5 54 L18 20 Z",
    viewBox: "0 0 100 100", label: "d12",
    color: "#3b82f6", textY: "62",
  },
  20: {
    path: "M50 6 L94 72 L6 72 Z",
    viewBox: "0 0 100 100", label: "d20",
    color: "#8b5cf6", textY: "62",
  },
  100: {
    path: "M50 8 L88 35 L74 80 L26 80 L12 35 Z",
    viewBox: "0 0 100 100", label: "d%",
    color: "#ec4899", textY: "62",
  },
};

// ─── Parser ──────────────────────────────────────────────────────────────────
export function parseDiceNotation(raw: string): {
  count: number; sides: number; modifier: number; notation: string;
} | null {
  // Allow optional spaces around + / - modifier
  const match = raw.trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const sign = match[3] === "-" ? -1 : 1;
  const modifier = match[4] ? sign * parseInt(match[4]) : 0;
  const notation = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ""}`;
  return { count, sides, modifier, notation };
}

// Find polyhedral dice expressions (supports spaces around +/-: "2d12 + 4")
export function findDiceExpressions(text: string): Array<{ match: string; index: number; length: number }> {
  const regex = /\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/gi;
  const results: Array<{ match: string; index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const expr = m[1].replace(/\s/g, ""); // normalise for parsing
    const parsed = parseDiceNotation(expr);
    if (parsed && [4, 6, 8, 10, 12, 20, 100].includes(parsed.sides)) {
      results.push({ match: m[1], index: m.index, length: m[1].length });
    }
  }
  return results;
}

// Render action text with clickable dice chips
export function DiceText({ text, onRoll }: { text: string; onRoll: (notation: string, label?: string) => void }) {
  const expressions = findDiceExpressions(text);
  if (expressions.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  expressions.forEach(({ match, index, length }, i) => {
    if (index > last) parts.push(<span key={`t${i}`}>{text.slice(last, index)}</span>);
    const normalised = match.replace(/\s/g, "");
    parts.push(
      <button
        key={`d${i}`}
        onClick={() => onRoll(normalised)}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/20 hover:bg-primary/40 text-primary font-mono text-xs font-bold border border-primary/30 hover:border-primary/60 transition-colors cursor-pointer mx-0.5"
        title={`Roll ${match.trim()}`}
      >
        <Dices className="w-3 h-3" />
        {match.trim()}
      </button>
    );
    last = index + length;
  });
  if (last < text.length) parts.push(<span key="tail">{text.slice(last)}</span>);
  return <>{parts}</>;
}

// ─── Single animated die ──────────────────────────────────────────────────────
interface DieProps {
  sides: number;
  value: number | null; // null = still rolling
  delay: number;
}

function AnimatedDie({ sides, value, delay }: DieProps) {
  const shape = DIE_SHAPES[sides] ?? DIE_SHAPES[20];
  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const rotZ = useMotionValue(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    setLanded(false);
    // Tumble wildly for ~1.2s then decelerate to rest
    const startTime = Date.now() + delay * 1000;
    const totalDuration = 1400 + delay * 600; // ms

    let frame: number;
    let startTs: number | null = null;

    function tick(ts: number) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;
      const t = Math.min(elapsed / totalDuration, 1);

      if (elapsed < delay * 1000) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = (elapsed - delay * 1000) / (totalDuration - delay * 1000);
      const eased = Math.min(progress, 1);
      // Ease-out: dice spin fast then slow
      const speed = 1 - eased * eased;

      const time = (elapsed - delay * 1000) / 1000;
      rotX.set(time * 360 * 3 * speed);
      rotY.set(time * 360 * 2.3 * speed + 45);
      rotZ.set(time * 360 * 1.7 * speed + 20);

      if (progress >= 1) {
        rotX.set(0);
        rotY.set(0);
        rotZ.set(0);
        setLanded(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ perspective: "400px" }}>
        <motion.div
          style={{
            rotateX: rotX,
            rotateY: rotY,
            rotateZ: rotZ,
            transformStyle: "preserve-3d",
          }}
        >
          <svg
            width="72"
            height="72"
            viewBox={shape.viewBox}
            className="drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]"
          >
            <defs>
              <filter id={`glow-${sides}`}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d={shape.path}
              fill={shape.color}
              fillOpacity={0.85}
              stroke="white"
              strokeWidth="2"
              strokeOpacity={0.6}
              filter={`url(#glow-${sides})`}
            />
            {/* Value shown only when landed */}
            {landed && value !== null && (
              <text
                x="50"
                y={shape.textY}
                textAnchor="middle"
                fontSize="28"
                fontWeight="bold"
                fill="white"
                fontFamily="monospace"
              >
                {value}
              </text>
            )}
          </svg>
        </motion.div>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{shape.label}</span>
    </div>
  );
}

// ─── Full roller overlay ──────────────────────────────────────────────────────
interface RollState {
  notation: string;
  label?: string;
  sides: number;
  count: number;
  modifier: number;
  values: number[];      // empty until rolled
  total: number | null;
}

function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

interface DiceRollerProps {
  onClose: () => void;
}

export function DiceRoller({ onClose }: DiceRollerProps) {
  const [roll, setRoll] = useState<RollState | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Listen for roll requests dispatched from useDiceRoller
  useEffect(() => {
    function handler(e: Event) {
      const { notation, label } = (e as CustomEvent).detail;
      const normalised = notation.replace(/\s/g, "");
      const parsed = parseDiceNotation(normalised);
      if (!parsed) return;

      const values = rollDice(parsed.count, parsed.sides);
      const total = values.reduce((a, b) => a + b, 0) + parsed.modifier;

      setShowResult(false);
      setRoll({
        notation: parsed.notation,
        label,
        sides: parsed.sides,
        count: parsed.count,
        modifier: parsed.modifier,
        values,
        total,
      });

      // Show result after dice finish tumbling
      const delay = 1400 + (parsed.count - 1) * 300;
      setTimeout(() => setShowResult(true), delay + 200);
    }

    window.addEventListener("dice-roll-request", handler);
    return () => window.removeEventListener("dice-roll-request", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50" onClick={showResult ? onClose : undefined}>
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 bg-card border border-border rounded-full p-2 hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Dice area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 pointer-events-none">
        {roll && (
          <>
            {/* Dice row */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-wrap justify-center gap-6"
            >
              {roll.values.map((val, i) => (
                <AnimatedDie
                  key={`${roll.notation}-${i}`}
                  sides={roll.sides}
                  value={val}
                  delay={i * 0.15}
                />
              ))}
            </motion.div>

            {/* Result panel */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 40, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="bg-card border-2 border-primary/60 rounded-xl px-8 py-5 text-center shadow-2xl min-w-[200px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
                    {roll.label ?? roll.notation}
                  </p>

                  {/* Individual dice + modifier breakdown */}
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mb-3">
                    {roll.values.map((v, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-background border border-border font-bold text-sm"
                      >
                        {v}
                      </span>
                    ))}
                    {roll.modifier !== 0 && (
                      <span className="text-muted-foreground font-mono text-sm">
                        {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}
                      </span>
                    )}
                  </div>

                  {/* Total */}
                  <p className="text-5xl font-display font-bold text-primary leading-none">
                    {roll.total}
                  </p>

                  {/* Formula */}
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    {roll.values.join(" + ")}
                    {roll.modifier !== 0 && (
                      roll.modifier > 0 ? ` + ${roll.modifier}` : ` − ${Math.abs(roll.modifier)}`
                    )}
                    {" = "}
                    <span className="text-primary font-bold">{roll.total}</span>
                  </p>

                  <p className="text-[10px] text-muted-foreground/60 mt-3">
                    Tap anywhere to dismiss
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {!roll && (
          <p className="text-muted-foreground font-mono text-sm">
            Click a dice expression in a monster's actions to roll
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useDiceRoller() {
  const [open, setOpen] = useState(false);

  const requestRoll = useCallback((notation: string, label?: string) => {
    setOpen(true);
    // Small delay so the overlay mounts before the event fires
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("dice-roll-request", { detail: { notation, label } })
      );
    }, 50);
  }, []);

  return { open, setOpen, requestRoll };
}
