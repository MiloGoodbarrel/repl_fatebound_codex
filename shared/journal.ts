import { z } from "zod";

export const MAX_TEXT_BYTES = 256 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const nameKey = (s: string) => s.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const sessionInput = z.object({
  title: z.string().trim().min(1).max(150),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, "Invalid date"),
}).strict();
export const notesInput = z.object({ revision: z.number().int().nonnegative(), notes: z.string().max(MAX_TEXT_BYTES) }).strict();
export const importInput = z.object({
  title: z.string().trim().min(1).max(150),
  kind: z.enum(["transcript", "summary"]),
  format: z.enum(["text", "markdown"]),
  text: z.string().min(1).max(MAX_TEXT_BYTES),
}).strict();
export interface JournalSession { id: string; campaignId: number; title: string; date: string; notes: string; revision: number; updatedAt: string }
export interface Reference { key: string; name: string; source: string; campaignId?: number }
export interface Alias { id: string; phrase: string; referenceKey: string }
export interface Suggestion {
  id: string; start: number; end: number; phrase: string; candidates: Reference[];
  explanation: string; confidence: "remembered" | "likely" | "ambiguous";
}
export interface Decision { suggestionId: string; referenceKey: string | null }
export interface JournalImport {
  id: string; sessionId: string; title: string; kind: "transcript" | "summary"; format: "text" | "markdown";
  original: string; suggestions: Suggestion[]; decisions: Decision[]; revision: number;
  editedText: string | null; reviewed: string;
}
export interface Recording { id: string; sessionId: string; name: string; type: string; size: number }
export interface SessionDetail { session: JournalSession; imports: JournalImport[]; recordings: Recording[] }

export function validateText(text: string, allowEmpty = false) {
  if (!allowEmpty && !text.trim()) throw new Error("Text cannot be empty.");
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) throw new Error("Text must be at most 256 KiB.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(text)) throw new Error("Use valid UTF-8 text without binary or replacement characters.");
  return text;
}
export function decodeTextFile(bytes: Uint8Array, filename: string) {
  if (!/\.(txt|md|markdown)$/i.test(filename)) throw new Error("Only UTF-8 .txt, .md and .markdown exports are supported. Export or paste text; audio, PDF and proprietary Echo files are not transcripts.");
  if (bytes.length > MAX_TEXT_BYTES) throw new Error("Text files must be at most 256 KiB.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("This file is not valid UTF-8. Export it as UTF-8 plain text or Markdown."); }
  return validateText(text);
}

// Soundex is deliberately a suggestion signal, never a replacement instruction.
function phonetic(s: string) {
  return nameKey(s).split(" ").map(word => {
    const codes: Record<string, string> = { b:"1", f:"1", p:"1", v:"1", c:"2", g:"2", j:"2", k:"2", q:"2", s:"2", x:"2", z:"2", d:"3", t:"3", l:"4", m:"5", n:"5", r:"6" };
    let previous = codes[word[0]] ?? "", rest = "";
    for (const c of word.slice(1)) { const code = codes[c] ?? ""; if (code !== previous) rest += code; previous = code; }
    return word[0] + (rest + "000").slice(0, 3);
  }).join(" ");
}
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
const common = new Set("the and that then there their they with from this was were are for but not into when will can may might had has have said says saw see we he she it you a an as at by in of on or to is be our his her us me my all one two three four five fire light shield sleep aid wish mark hunter guard".split(" "));

export function suggestNames(text: string, references: Reference[], aliases: Alias[]): Suggestion[] {
  const words = Array.from(text.matchAll(new RegExp("[\\p{L}\\p{N}]+(?:[’'-][\\p{L}\\p{N}]+)*", "gu")));
  const suggestions: Suggestion[] = [];
  // Bound work and output for long imports. Matching never spans punctuation or paragraphs.
  const refs = references.filter(r => r.name.length <= 120);
  const indexed = refs.map(r => ({ reference: r, key: nameKey(r.name), sound: phonetic(r.name), count: nameKey(r.name).split(" ").length }));
  const exactNames = new Set(indexed.map(r => r.key));
  const namesByCount = new Map<number, typeof indexed>();
  for (const r of indexed) namesByCount.set(r.count, [...(namesByCount.get(r.count) ?? []), r]);
  const aliasesByPhrase = new Map<string, Reference[]>();
  for (const alias of aliases) {
    const ref = refs.find(r => r.key === alias.referenceKey);
    if (ref) aliasesByPhrase.set(nameKey(alias.phrase), [...(aliasesByPhrase.get(nameKey(alias.phrase)) ?? []), ref]);
  }
  let comparisonBudget = 300_000;
  for (let i = 0; i < words.length && suggestions.length < 500; i++) {
    let found: Suggestion | undefined, consumed = 0;
    for (let count = Math.min(5, words.length - i); count >= 1; count--) {
      const start = words[i].index!, end = words[i + count - 1].index! + words[i + count - 1][0].length;
      const phrase = text.slice(start, end), key = nameKey(phrase);
      if (phrase.length > 120 || !new RegExp("^[\\p{L}\\p{N}’' -]+$", "u").test(phrase)) continue;
      const remembered = aliasesByPhrase.get(key) ?? [];
      const uniqueRemembered = Array.from(new Map(remembered.map(r => [r.key, r])).values());
      let candidates = uniqueRemembered;
      if (!candidates.length) {
        // Exact names and common prose are not "corrected". Short lowercase words are too risky.
        if (exactNames.has(key) || key.split(" ").every(w => common.has(w)) || !new RegExp("\\p{Lu}", "u").test(phrase) || (count === 1 && key.length < 4)) continue;
        const sound = phonetic(key);
        candidates = (namesByCount.get(count) ?? []).filter(r => {
          const target = r.key;
          if (comparisonBudget <= 0 || Math.abs(target.length - key.length) > 2) return false;
          comparisonBudget--;
          const d = distance(key, target);
          return d > 0 && (d <= (key.length >= 8 ? 2 : 1) || (sound === r.sound && d <= 3));
        }).map(r => r.reference);
      }
      if (!candidates.length) continue;
      const ambiguous = candidates.length > 1;
      found = {
        id: `${start}:${end}`, start, end, phrase, candidates,
        confidence: ambiguous ? "ambiguous" : uniqueRemembered.length ? "remembered" : "likely",
        explanation: ambiguous ? "Several accessible resources match. Choose explicitly; nothing is replaced automatically." :
          uniqueRemembered.length ? "An explicitly approved campaign alias matches this phrase. Review this occurrence before applying." :
          "Similar spelling or pronunciation to a saved resource; this is not proof of identity.",
      };
      consumed = count; break;
    }
    if (found) { suggestions.push(found); i += consumed - 1; }
  }
  return suggestions;
}

/** All ranges refer to the immutable original, so replacement length never shifts another range. */
export function renderReviewed(original: string, suggestions: Suggestion[], decisions: Decision[]) {
  let result = original;
  const accepted = suggestions.flatMap(s => {
    const decision = decisions.find(d => d.suggestionId === s.id);
    const candidate = s.candidates.find(c => c.key === decision?.referenceKey);
    return candidate ? [{ ...s, replacement: candidate.name }] : [];
  }).sort((a, b) => b.start - a.start);
  let boundary = original.length;
  for (const s of accepted) {
    if (s.end > boundary || original.slice(s.start, s.end) !== s.phrase) throw new Error("Invalid correction range");
    result = result.slice(0, s.start) + s.replacement + result.slice(s.end);
    boundary = s.start;
  }
  return result;
}

export function validateAudio(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error("Recordings must be between 1 byte and 20 MiB.");
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
  const valid =
    (type === "audio/wav" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") ||
    (type === "audio/mpeg" && (ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224))) ||
    (["audio/mp4", "audio/x-m4a"].includes(type) && ascii(4, 8) === "ftyp") ||
    (type === "audio/ogg" && ascii(0, 4) === "OggS") ||
    (type === "audio/webm" && bytes.slice(0, 4).join(",") === "26,69,223,163");
  if (!valid) throw new Error("Unsupported recording. Use a valid MP3, M4A/MP4 audio, WAV, Ogg or WebM file with its matching audio type.");
}
