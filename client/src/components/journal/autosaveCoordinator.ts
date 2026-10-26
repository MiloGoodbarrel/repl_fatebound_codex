export type AutosaveStatus = "saved" | "saving" | "failed";
export type SavePayload = { scope: string; revision: number; notes: string };
export type SaveResult = { revision: number; notes: string };

/**
 * Serial compare-and-swap notes writer. It is intentionally framework- and
 * transport-agnostic so delayed writes and scope changes can be tested alone.
 */
export class AutosaveCoordinator {
  private scope = "";
  private value = "";
  private savedValue = "";
  private revision = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private status: AutosaveStatus = "saved";
  private error = "";
  private disposed = false;
  private flushAfterInFlight = false;

  constructor(
    private readonly save: (payload: SavePayload) => Promise<SaveResult>,
    private readonly onState: (status: AutosaveStatus, error: string) => void,
    private readonly debounceMs = 700,
  ) {}

  get isDirty() { return this.value !== this.savedValue; }
  get isSaving() { return this.inFlight !== null; }
  get currentScope() { return this.scope; }
  get currentValue() { return this.value; }
  get currentRevision() { return this.revision; }
  get currentStatus() { return this.status; }

  private publish(status: AutosaveStatus, error = "") {
    this.status = status;
    this.error = error;
    this.onState(status, error);
  }

  /** Refuses to change scope while any draft is not safely saved. */
  setScope(scope: string, revision: number, notes: string): boolean {
    if (this.scope && this.scope !== scope && (this.isDirty || this.isSaving)) return false;
    if (this.scope === scope && (this.isDirty || this.isSaving)) return false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.scope = scope;
    this.revision = revision;
    this.value = notes;
    this.savedValue = notes;
    this.publish("saved");
    return true;
  }

  edit(notes: string) {
    this.value = notes;
    if (this.status === "failed") {
      this.onState("failed", this.error);
      return;
    }
    this.publish("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, this.debounceMs);
  }

  /** One failed CAS is surfaced; it is never retried with a stale revision. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.inFlight) return this.inFlight;
    if (!this.isDirty) { this.publish("saved"); return; }
    const payload: SavePayload = { scope: this.scope, revision: this.revision, notes: this.value };
    this.publish("saving");
    const operation = this.save(payload).then(result => {
      if (this.scope !== payload.scope) return;
      this.revision = result.revision;
      this.savedValue = payload.notes;
      if (this.value === payload.notes) this.publish("saved");
      else this.publish("saving");
    }).catch(error => {
      if (this.scope === payload.scope) this.publish("failed", error instanceof Error ? error.message : "Could not save notes.");
    }).finally(() => {
      if (this.inFlight === operation) this.inFlight = null;
      if (this.disposed && this.flushAfterInFlight && this.isDirty && this.status !== "failed") {
        this.flushAfterInFlight = false;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        void this.flush();
        return;
      }
      if (!this.disposed && this.scope === payload.scope && this.isDirty && this.status !== "failed") {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, this.debounceMs);
      }
    });
    this.inFlight = operation;
    return operation;
  }

  /** Explicit recovery after fetching the latest server revision. */
  reconcile(revision: number) {
    this.revision = revision;
    this.publish("saving");
    return this.flush();
  }

  /** Explicitly discard the draft only after presenting it to the user. */
  reload(revision: number, serverNotes: string) {
    if (this.inFlight) return false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.revision = revision;
    this.value = serverNotes;
    this.savedValue = serverNotes;
    this.publish("saved");
    return true;
  }

  /** Deliberate discard, called only after the UI obtains explicit confirmation. */
  discard() {
    if (this.inFlight) return false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.savedValue = this.value;
    this.publish("saved");
    return true;
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.isDirty && this.status !== "failed") {
      if (this.inFlight) this.flushAfterInFlight = true;
      else void this.flush();
    }
  }

  activate() {
    this.disposed = false;
    this.flushAfterInFlight = false;
  }
}
