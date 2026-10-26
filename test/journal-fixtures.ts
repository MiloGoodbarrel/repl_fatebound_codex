import type { Alias, JournalSession, Reference } from "../shared/journal";
import { nameKey } from "../shared/journal";
import type { JournalRepository, StoredImport, StoredRecording } from "../server/journal/repository";

// Test-only adapter. Production never registers this or accepts a request-header bypass.
export class MemoryJournalRepository implements JournalRepository {
  sessions = new Map<string, JournalSession>();
  imports = new Map<string, StoredImport>();
  aliases = new Map<string, Alias & { campaignId: number }>();
  audio = new Map<string, StoredRecording>();
  refs: Reference[] = [];
  private clone<T>(x: T): T { return structuredClone(x); }
  async hasPrivateData(c: number) {
    return Array.from(this.sessions.values()).some(s => s.campaignId === c) || Array.from(this.aliases.values()).some(a => a.campaignId === c);
  }
  async listSessions(c: number) { return this.clone(Array.from(this.sessions.values()).filter(s => s.campaignId === c)); }
  async getSession(c: number, id: string) { const s = this.sessions.get(id); return s?.campaignId === c ? this.clone(s) : undefined; }
  async createSession(s: JournalSession) { this.sessions.set(s.id, this.clone(s)); return this.clone(s); }
  async updateSession(c: number, id: string, data: { title: string; date: string }) {
    const s = await this.getSession(c, id); if (!s) return;
    Object.assign(s, data); this.sessions.set(id, s); return this.clone(s);
  }
  async saveNotes(c: number, id: string, revision: number, notes: string) {
    // Read and compare without an await between them, emulating atomic SQL CAS.
    const s = this.sessions.get(id); if (!s || s.campaignId !== c || s.revision !== revision) return;
    const next = { ...s, notes, revision: revision + 1 }; this.sessions.set(id, next); return this.clone(next);
  }
  async deleteSession(c: number, id: string) {
    if (!(await this.getSession(c, id))) return;
    this.sessions.delete(id);
    for (const i of Array.from(this.imports.values())) if (i.sessionId === id) this.imports.delete(i.id);
    for (const a of Array.from(this.audio.values())) if (a.sessionId === id) this.audio.delete(a.id);
  }
  async listImports(sid: string) { return this.clone(Array.from(this.imports.values()).filter(i => i.sessionId === sid)); }
  async getImport(sid: string, id: string) { const i = this.imports.get(id); return i?.sessionId === sid ? this.clone(i) : undefined; }
  async createImport(i: StoredImport) { this.imports.set(i.id, this.clone(i)); return this.clone(i); }
  async updateImport(sid: string, id: string, revision: number, data: Pick<StoredImport, "decisions" | "editedText">) {
    const i = this.imports.get(id); if (!i || i.sessionId !== sid || i.revision !== revision) return;
    const next = { ...i, ...this.clone(data), revision: revision + 1 }; this.imports.set(id, next); return this.clone(next);
  }
  async listAliases(c: number) { return this.clone(Array.from(this.aliases.values()).filter(a => a.campaignId === c).map(({ campaignId, ...a }) => a)); }
  async saveAlias(c: number, alias: Alias, existing: boolean) {
    if (existing && this.aliases.get(alias.id)?.campaignId !== c) return;
    if (Array.from(this.aliases.values()).some(a => a.campaignId === c && a.id !== alias.id && nameKey(a.phrase) === nameKey(alias.phrase))) return;
    this.aliases.set(alias.id, { ...alias, campaignId: c }); return this.clone(alias);
  }
  async deleteAlias(c: number, id: string) { if (this.aliases.get(id)?.campaignId === c) this.aliases.delete(id); }
  async references(_c: number) { return this.clone(this.refs); }
  async listRecordings(sid: string) { return Array.from(this.audio.values()).filter(a => a.sessionId === sid).map(({ bytes, digest, ...a }) => a); }
  async getRecording(sid: string, id: string) { const a = this.audio.get(id); return a?.sessionId === sid ? { ...a, bytes: Buffer.from(a.bytes) } : undefined; }
  async createRecording(a: StoredRecording) { if (this.audio.has(a.id)) return; this.audio.set(a.id, { ...a, bytes: Buffer.from(a.bytes) }); return a; }
  async deleteRecording(sid: string, id: string) { if (this.audio.get(id)?.sessionId === sid) this.audio.delete(id); }
}
