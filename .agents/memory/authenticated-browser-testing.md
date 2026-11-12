---
name: Authenticated browser testing
description: Timing and privacy constraints when exercising Clerk-authenticated workflows with real development data.
---

Bootstrap disposable development accounts through the provider's supported
user-management API, then exercise normal browser sign-in with generated,
in-memory passwords and reserved test mailboxes. Do not manufacture application
sessions, add auth exceptions, or use the creator's campaigns.

**Why:** Self-service sign-up can pause at a bot challenge in automated browsers.
Provider account creation avoids that provisioning obstacle without bypassing
the application's normal authentication or permission checks.

**How to apply:** Guard against production before provisioning, clean up only
the accounts and data created by the test, and never log or persist passwords or
session cookies.

Wait for the provider's verification-preparation response before entering the
test OTP; wait for sign-out navigation before starting the next sign-in.

**Why:** The OTP input can render before the verification code has been sent.
Submitting immediately intermittently reports that a code must be sent first.
Starting sign-in before sign-out finishes can have its navigation replaced by
the pending sign-out redirect.

**How to apply:** Synchronize on network and navigation completion rather than
fixed sleeps, disabled verification, or retries that hide the race.

Synthetic PDF text-limit fixtures need visible text distributed across pages,
not one enormous line outside the page bounds.

**Why:** The PDF engine clips off-page glyphs during extraction; a huge PDF text
string can therefore yield very little extracted text and miss the intended
limit entirely.

**How to apply:** Keep synthetic lines within the page and repeat bounded pages
when testing extracted-text limits separately from upload-size limits.
