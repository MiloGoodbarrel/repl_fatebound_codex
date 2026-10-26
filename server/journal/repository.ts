import type { Alias, JournalImport, JournalSession, Recording, Reference } from "@shared/journal";

export type StoredImport = Omit<JournalImport, "reviewed">;
export type StoredRecording = Recording & { bytes: Buffer; digest: string };
export interface JournalRepository {
  hasPrivateData(campaignId: number): Promise<boolean>;
  listSessions(campaignId: number): Promise<JournalSession[]>;
  getSession(campaignId: number, id: string): Promise<JournalSession | undefined>;
  createSession(session: JournalSession): Promise<JournalSession>;
  updateSession(campaignId: number, id: string, data: { title: string; date: string }): Promise<JournalSession | undefined>;
  saveNotes(campaignId: number, id: string, revision: number, notes: string): Promise<JournalSession | undefined>;
  deleteSession(campaignId: number, id: string): Promise<void>;
  listImports(sessionId: string): Promise<StoredImport[]>;
  getImport(sessionId: string, id: string): Promise<StoredImport | undefined>;
  createImport(value: StoredImport): Promise<StoredImport>;
  updateImport(sessionId: string, id: string, revision: number, data: Pick<StoredImport, "decisions" | "editedText">): Promise<StoredImport | undefined>;
  listAliases(campaignId: number): Promise<Alias[]>;
  saveAlias(campaignId: number, alias: Alias, existing: boolean): Promise<Alias | undefined>;
  deleteAlias(campaignId: number, id: string): Promise<void>;
  references(campaignId: number): Promise<Reference[]>;
  listRecordings(sessionId: string): Promise<Recording[]>;
  getRecording(sessionId: string, id: string): Promise<StoredRecording | undefined>;
  createRecording(value: StoredRecording): Promise<StoredRecording | undefined>;
  deleteRecording(sessionId: string, id: string): Promise<void>;
}
