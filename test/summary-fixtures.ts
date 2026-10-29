import type { SummaryState, SummaryVersion } from "../shared/sessionSummary";
import { SummaryError, nextSummaryVersion, summarySources, summaryState, type SummaryMutation, type SummaryRepository } from "../server/journal/summary";
import { MemoryJournalRepository } from "./journal-fixtures";

export class MemorySummaryRepository implements SummaryRepository {
  versions = new Map<string, SummaryVersion[]>();
  constructor(readonly journal: MemoryJournalRepository) {}
  async load(campaignId: number, sid: string): Promise<SummaryState> {
    const session = await this.journal.getSession(campaignId, sid);
    if (!session) throw new SummaryError(404, "Session not found in this campaign.");
    const imports = await this.journal.listImports(sid);
    const versions = this.versions.get(sid) ?? [];
    const approved = versions.filter(value => value.status === "approved").at(-1) ?? null;
    return structuredClone(summaryState(versions.at(-1) ?? null, approved, summarySources(session, imports)));
  }
  async history(campaignId: number, sid: string) {
    await this.load(campaignId, sid);
    return structuredClone((this.versions.get(sid) ?? []).slice(-100).reverse().map(({ sections, sources, sourceFingerprint, ...metadata }) => metadata));
  }
  async version(campaignId: number, sid: string, revision: number) {
    await this.load(campaignId, sid);
    return structuredClone(this.versions.get(sid)?.find(value => value.revision === revision));
  }
  async write(campaignId: number, sid: string, mutation: SummaryMutation) {
    const snapshot = await this.load(campaignId, sid);
    const versions = this.versions.get(sid) ?? [];
    const next = nextSummaryVersion(sid, mutation, versions.at(-1) ?? null, snapshot, versions.find(value => value.revision === mutation.restoreRevision));
    this.versions.set(sid, [...versions, structuredClone(next)]);
    return this.load(campaignId, sid);
  }
}
