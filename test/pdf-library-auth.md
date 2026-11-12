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
- Human-corrected item descriptions and filename/page references survive reload
  and match the stored database rows.
- Human-corrected NPC descriptions, source/page, and actions survive reload;
  database profile data retains the page.
- Previously saved items and NPCs remain unchanged.
- A duplicate name disables saving until acknowledged; editing invalidates that
  acknowledgment. An explicitly acknowledged duplicate is appended.
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

Also passed: `npm run check`; standard `npm test` (108 passed, 17 opt-in tests
skipped). The authenticated test runs separately; it is not counted as a standard
suite pass when its flag is absent.
