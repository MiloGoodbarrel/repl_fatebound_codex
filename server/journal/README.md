# Private campaign session journal

## Release prerequisite

The app currently has **no verified identity or campaign membership model**.
`server/index.ts` deliberately registers the journal **without** an access policy.
Consequently the public capability response is locked, all journal document/file
operations return 403 before parsing a private payload or reading journal data,
and the UI has no editable journal controls. This applies in development and
production. There is no environment variable, URL, request header, campaign
selection, or local-storage flag that unlocks the real API.

Do not enable private session use until the user has chosen account ownership,
DM/player/co-DM permissions and linked-resource permissions. Authentication alone
is insufficient. A future implementation must provide a trusted `JournalAccess`
at the server composition point, check campaign membership for **every** request,
and test revoked access, object-level grants, sessions, CSRF and linked resources.
By default a linked resource requires permission on its source campaign as well;
an explicit `authorizeReference` implementation may implement narrower grants.
Do not treat existing public campaign/resource routes as authorization.

Journal routes are mounted before the legacy response logger so notes, imported
text, aliases, filenames and recording bytes never enter that logger. Responses
are private/no-store. The legacy campaign deletion route is also gated whenever a
campaign contains journal sessions or aliases, preventing unauthorized cascade
deletion. Existing empty-journal campaign behavior is unchanged.

## Documents and concurrency

- Live notes belong to a session and use an atomic revision compare-and-swap.
- Each import appends a separate document with immutable original UTF-8 text,
  bounded suggestions anchored to original UTF-16 offsets, decisions, and an
  optional manually edited reviewed copy. No route accepts replacement originals.
- Reviewed output is derived from approved decisions, applied right-to-left.
  Candidate names are import-time snapshots, so later resource renames do not
  silently rewrite reviewed history. Authorization is rechecked on reads and
  actions; revoked/unlinked candidates disappear and cannot be newly approved.
- Manual edits are a separate override. Discarding them restores the decisions.
  This avoids trying to reuse original offsets against edited prose.
- Failed/stale note saves preserve the local draft for copying/downloading or
  deliberate reload/reconcile. Requests carry a fixed campaign/session identity;
  stale generations cannot populate another journal. Drafts are not written to
  browser persistent storage.
- App-level committed-route guarding keeps the journal mounted until a transition
  is approved, including browser Back/Forward and programmatic history changes.
  A failed save or unsaved reviewed draft restores the URL without discarding the
  editor. Click interception and `beforeunload` are supplementary, not the sole
  protection for in-app navigation.
- The tracker remains mounted while its journal panel is open. Desktop panels
  have independent scrolling; mobile content uses normal document scrolling.

## Inputs and matching

Pasted plain text/Markdown and `.txt`, `.md`, `.markdown` file imports are supported,
up to **256 KiB UTF-8** per document. Files use fatal UTF-8 decoding and reject
binary/control/replacement characters. Unsupported exports fail explicitly.
Markdown supports a small safe subset with React text nodes, no raw HTML,
external images, or executable URL schemes.

The reference query uses the selected campaign's PCs, owned items and creatures,
current direct item/NPC links with matching source identities, and actual stock
spell-name rows. It never scans other party rosters, traverses link chains, or
invents location/faction/spell catalogs. Aliases are campaign-scoped explicit
approvals, unique by normalized phrase, and conflict with other canonical names.
Previously remembered aliases still produce review suggestions, never automatic
replacements. Similar spelling and Soundex pronunciation are only review signals.
Short/common prose and exact names are skipped unless an explicit alias applies.
Scanning is non-exhaustive and bounded to 500 suggestions and 300,000 fuzzy
comparisons per import. Unknown text is never rewritten without an approval.

## Recordings

Recordings are optional **private durable files stored as bounded PostgreSQL
`bytea` blobs**, not repository files, temporary disks, static paths or public URLs.
This deliberately reuses the existing transactional storage without adding an
external service or a public object-storage route. Files persist across restarts,
have no public asset identifier, and cascade on session deletion. Limit: **20 MiB
per recording**. Supported types: MP3, WAV, M4A/MP4 audio, Ogg and WebM. The server
checks MIME plus container signatures and length (not a full codec/transcription
analysis), supports authorized byte-range playback, and returns metadata only on
uploads/listing. Upload UUID plus SHA-256 fingerprint makes retries idempotent and
rejects conflicting reuse. Delete is explicit.

**Echo – AI Meeting Note Taker by Tappz Labs, App Store ID 6738732089:** summary
Markdown export is documented. No real sample was supplied. Full-transcript and
original-audio export formats and a public API remain unverified. There is no
Echo account synchronization, proprietary parsing, transcription, microphone
recording, speaker detection, timestamps or automatic audio/text alignment.
Attach Echo audio only if the user can export a supported recording.

## Schema and verification

The additive idempotent development migration is
`scripts/migrations/20261026-journal.sql`, applied by the post-merge setup script
through `scripts/migrate-journal.ts`. It does not reconcile or change game tables.
Do not run it at app startup or in deployment builds. Managed production schema
remains the responsibility of the platform's publish flow; this task does not
publish or enable private operations.

- `npm test`: synthetic route/domain/autosave/Markdown and existing regressions.
- `JOURNAL_DATABASE_TEST=1 npx tsx --test test/journal-database.test.ts`:
  opt-in development database checks, creating only identified synthetic rows
  then cleaning those identities in `finally`.
- `JOURNAL_BROWSER_TEST=1 npx tsx --test test/journal-browser.test.ts`:
  desktop/mobile flow against a running preview. Requires Chromium (override
  `JOURNAL_BROWSER_ORIGIN` if needed). Browser-only network interception points to
  a separate synthetic authorized server; the running app's gate is never bypassed.
  Images go to ignored `generated-artifacts/journal/`.
- `npm run check` and `npm run build`.
