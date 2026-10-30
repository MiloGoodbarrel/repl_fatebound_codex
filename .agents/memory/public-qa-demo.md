---
name: Public QA demo
description: User-approved purpose and security boundary of the accountless /dev browsing area.
---

The user wants `/dev` to allow test browsing, including evaluation by a GPT browser session, without requiring an email or test credentials. They clarified that this means a demo interface, not source-code access.

**Why:** Their goal is low-friction evaluation, not a second authentication system or a privileged production account.

**How to apply:** Keep this a clearly labeled simulation using original fictional records, browser-only edits, and reset controls. Never populate it from real campaigns, install a test identity, or weaken private API authorization. Disable uploads, AI charges, and administration. Explain that demo results do not validate real login, authorization, database persistence, or exact behavior of every signed-in tool.

Use the actual workspace screens in the demo, not separately maintained simplified pages.

**Why:** The user found that the Claude audit was evaluating a non-matching UI with missing features and explicitly requested a 1:1 demo for accurate interface evaluation.

**How to apply:** Share the UI and interaction components, substituting only isolated fictional data and account actions. Keep safety restrictions explicit and distinguish interface parity from production-backend validation. A demo document's API interception must remain fail-closed even after teardown, since unmount autosaves and pending callbacks can outlive the visible workspace.

The public demo must be reachable without an authentication-provider handshake, even though normal workspace routes still require the existing identity flow.

**Why:** Rendering a client-only demo outside the auth provider was insufficient on its own: the server's document middleware initiated a sign-in handshake before the demo loaded.

**How to apply:** Preserve the distinction between public demo documents and private APIs when changing routing or auth middleware. Check network traffic from a fresh signed-out browser, not just the rendered demo. Keep writes and all `/api` paths outside the public-document exception.
