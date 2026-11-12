# Authenticated PDF library verification

Run the development application (`npm run dev`), then:

```sh
PDF_AUTH_BROWSER_TEST=1 npx tsx --test test/pdf-library-auth-browser.test.ts
```

This opt-in integration test uses the preview at `REPLIT_DEV_DOMAIN`, its actual
database, and its configured Clerk development instance. Chromium must be
available at `/repl/tools/bin/chromium`. It refuses non-development preview hosts
and non-test Clerk instances before creating accounts.

Two disposable users are created through Clerk's supported user-management SDK.
Both then sign in through the app's real email/password interface, including
Clerk's new-device verification. Reserved `+clerk_test@example.com` mailboxes use
Clerk's documented `424242` test verification code; no email is delivered.
Random passwords stay in process memory. No application auth bypass, injected
identity, saved session files, or fake API responses are used.

The test creates only fictional campaigns/documents. Cleanup removes the exact
campaign ids, their imported rows/actions, application account rows, and Clerk
users created by that invocation. Do not run it against production or real
campaign content. As with any integration test, forcibly killing the process
can interrupt cleanup.

## Verified on 2026-11-12

The full authenticated browser test passed:

- Uploading a real, generated text PDF previews entries without writing them.
- Invalid signatures, corrupt PDFs, image-only scans, uploads over 10 MiB,
  PDFs over 100 pages and extracted text over 256 KiB are rejected for both
  item and creature imports. Each rejection preserves the exact database rows
  (items, monsters, actions and receipts) in all three disposable campaigns.
  Immediately afterward, both the uploader and the unrelated signed-in owner
  can preview a valid document.
- Twelve simultaneous real preview requests across the two signed-in accounts
  exercise the shared processing slot. Only 200 and recoverable 429 responses
  are allowed; at least one of each must occur. Both owners can retry afterward,
  and neither successful previews nor 429 responses write library rows.
- The real upload dialog displays invalid/scanned/oversized errors, keeps Save
  disabled and can be dismissed. The unrelated account then reviews, saves and
  reloads an import whose row is verified directly in PostgreSQL.
- Human-corrected item descriptions and filename/page references survive reload
  and match the stored database rows.
- Human-corrected NPC descriptions, source/page, and actions survive reload;
  database profile data retains the page.
- Previously saved items and NPCs remain unchanged.
- A duplicate name disables saving until acknowledged; editing invalidates that
  acknowledgment. An explicitly acknowledged duplicate is appended.
- After a real commit, interrupting its response leaves the review available for
  retry. Save resends the exact operation key and entries, returns the original
  result and leaves the database rows unchanged. A new acknowledged import uses
  a fresh key and appends normally; another account cannot replay the receipt.
- The other signed-in account receives 404 on private libraries, preview and
  commit; supplying another account's workspace assertion receives 409.
- Navigating to another campaign with a pending preview discards the old draft
  and leaves the destination library empty. The pending request is delayed, not
  replaced with a mocked response.
- Signing out from another tab destroys an open review. Signing in as the other
  account cannot recover the old review or access/save into the former owner's
  campaign. Signing back in as the original owner restores the saved library.

The database run exposed a missing campaign-item source field, which previously
discarded PDF provenance despite the commit route supplying it. The additive,
idempotent startup migration now creates that nullable field without changing
existing library rows. It cannot recover references already discarded by older
imports.

Also passed: `npm run check`; standard `npm test` (117 passed, 19 opt-in tests
skipped). The authenticated test runs separately; it is not counted as a standard
suite pass when its flag is absent.

The standard route tests separately hold a synthetic library read pending to
make concurrency deterministic, assert a second campaign receives 429, fail the
read and then confirm that both campaigns can preview again. This exercises
the route's failure cleanup without a production-only test hook. Authenticated
concurrency above uses only real extraction and real database reads.

Retry transaction coverage can also run independently of browser authentication:

```sh
PDF_IMPORT_DB_TEST=1 npx tsx --test test/pdf-library-idempotency-database.test.ts
```

This uses disposable fictional campaigns and real PostgreSQL transactions. It
checks items, creatures and actions, concurrent first attempts and retries,
changed-payload conflicts, campaign/owner boundaries, rollback after failure,
fresh storage instances, deliberate repeated content and receipt cleanup.
