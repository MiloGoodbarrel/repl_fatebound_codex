// Cookie-based Clerk auth only. This header is a race assertion, NOT a token.
let installed = false;
let stopped = true;
let user: string | null = null;
const pending = new Set<AbortController>();
export function activateWorkspace(userId: string | null) {
  user = userId;
  stopped = !userId;
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/__clerk")) {
      return original(input, init);
    }
    if (stopped) throw new DOMException("Workspace closed.", "AbortError");
    const controller = new AbortController();
    const source = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (source?.aborted) controller.abort();
    source?.addEventListener("abort", abort, { once: true });
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (user) headers.set("X-Workspace-User", user);
    pending.add(controller);
    try {
      return await original(input, { ...init, headers, signal: controller.signal });
    } finally {
      pending.delete(controller);
      source?.removeEventListener("abort", abort);
    }
  };
}
// Lets non-fetch transports (notably an upload XHR with progress events) join the
// same account-close abort boundary as normal workspace requests.
export function registerWorkspaceAbort(controller: AbortController) {
  if (stopped) controller.abort();
  else pending.add(controller);
  return () => pending.delete(controller);
}
export function closeWorkspace() {
  if (user && typeof sessionStorage !== "undefined") {
    try {
      const prefix = `fatebound:table-draft:account:${user}:`;
      for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
      sessionStorage.removeItem(`fatebound:campaign-selection:account:${user}`);
    } catch { /* Sign-out must still abort requests when browser storage is unavailable. */ }
  }
  stopped = true;
  user = null;
  pending.forEach(request => request.abort());
  pending.clear();
  // Legacy versions persisted campaign names. Do not carry those into a new account.
  localStorage.removeItem("activeCampaign");
}
