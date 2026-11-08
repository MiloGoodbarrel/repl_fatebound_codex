---
name: Public QA demo
description: User-approved purpose and security boundary of the accountless /dev browsing area.
---

The user wants `/dev` to allow test browsing, including evaluation by a GPT browser session, without requiring an email or test credentials. They clarified that this means a demo interface, not source-code access.

**Why:** Their goal is low-friction evaluation, not a second authentication system or a privileged production account.

**How to apply:** Keep sample campaigns independent of real account data, edits browser-only, and reset controls available. Never populate campaign fixtures from real campaigns, install a test identity, or weaken private API authorization. Disable uploads, AI charges, and administration. Explain that demo results do not validate real login, authorization, database persistence, or exact behavior of every signed-in tool.

Use the actual workspace screens in the demo, not separately maintained simplified pages.

**Why:** The user found that the Claude audit was evaluating a non-matching UI with missing features and explicitly requested a 1:1 demo for accurate interface evaluation.

**How to apply:** Share the UI and interaction components, substituting only isolated fictional data and account actions. Keep safety restrictions explicit and distinguish interface parity from production-backend validation. A demo document's API interception must remain fail-closed even after teardown, since unmount autosaves and pending callbacks can outlive the visible workspace.

The public demo must be reachable without an authentication-provider handshake, even though normal workspace routes still require the existing identity flow.

**Why:** Rendering a client-only demo outside the auth provider was insufficient on its own: the server's document middleware initiated a sign-in handshake before the demo loaded.

**How to apply:** Preserve the distinction between public demo documents and private APIs when changing routing or auth middleware. Check network traffic from a fresh signed-out browser, not just the rendered demo. Keep writes and all `/api` paths outside the public-document exception.

The full shared stock library may be browsed without signing in, but campaign-owned items/NPCs and user homebrew must never be included in that public library.

**Why:** The user explicitly selected “Full shared stock library” for an accurate public demo after being told that this makes stock content anonymously browsable.

**How to apply:** Keep stock-only public reads separate from authenticated APIs. Use the same stock tables and statblock presentation as the signed-in app; do not export private campaign repositories or allow anonymous mutations.

The main demo example is Lost Mine of Phandelver, using encounters from the supplied adventure, campaign context as journal notes, and the supplied Starter Set characters as the PC party.

**Why:** The user explicitly chose this adventure to make the demo concrete and requested those three content roles.

**How to apply:** Keep this content demo-only, not imported into a real owner's campaigns. Treat campaign notes as spoiler-filled DM preparation rather than fabricated played sessions. The unnamed pregens need descriptive labels, not invented player identities; later encounters must not imply the original level-one PCs are already leveled.

Ordinary naming/editing workflows must use accessible in-app dialogs rather than native browser prompts.

**Why:** The user's external Claude playtest became blocked by the native encounter-duplication prompt; the agent could neither dismiss it nor continue. This is a compatibility requirement for the public audit workflow, not proof of a failed save.

**How to apply:** Preserve keyboard submission, cancel, validation and retry on failure in DOM dialogs. Never claim to have interacted with an external auditor's browser.

Browser test setup that touches storage must be restricted to the intended app origin.

**Why:** Browser init scripts also run in blank and embedded documents; unguarded session-storage setup produced security exceptions that looked like application errors during the multi-tab audit.

**How to apply:** Check the document origin before injecting browser-only fixture state, and continue capturing application errors rather than suppressing the error collector.
