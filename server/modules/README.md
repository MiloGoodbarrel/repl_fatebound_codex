# Private campaign module reference

This is a reference reader, not the PDF statblock importer. Original PDFs,
including scans, maps and handouts, retain their layout. Reading/uploading a
module does not write party, combat, bestiary, items, encounters or journal data.

## Infrastructure

Create a default **private App Storage bucket** in the project's App Storage
pane. There is deliberately no filesystem, public URL or database-blob fallback.
Missing storage returns an explicit 503 and does not retain a quota reservation.
The adapter uses the supported Google Cloud Storage client and the same Replit
external-account credentials as the official App Storage SDK. Credentials and
bucket/object identifiers are never sent to the frontend. Range reads go to
storage with actual byte offsets, rather than downloading an entire PDF first.

Apply the additive development migration through `scripts/migrate-journal.ts`
(also called by the existing post-merge script). `shared/schema.ts` describes
these tables for normal schema management. No new startup-time production DDL is
added. Replit's managed publish flow handles production schema.

## Bounds and cleanup

- 100 MiB per PDF; 500 MiB per campaign; 2 GiB per owner.
- At most two uploads per process and one per owner simultaneously. Database
  quota reservations serialize by owner across processes.
- Uploads spool into mode-0600 temporary files with streaming size checks and a
  two-minute deadline. Temporary files are removed in `finally`.
- Validation runs separately from the import extractor, in a child process
  with a 256 MiB JS heap limit and 30-second deadline. It checks a real PDF
  signature/parser and 1–2,000 pages; scans are permitted. No text extraction,
  OCR or PDF JavaScript is executed.
- A pending database reservation exists before object creation. Only ready
  objects are readable. Failed uploads become durable deletion tombstones if
  cleanup cannot finish. The sweep retries every ten minutes, on startup, and
  after campaign/account deletion via nullable campaign references.
- Pending reservations older than one hour are swept; active uploads time out
  much earlier. A failed deletion hides the module immediately and retains its
  private tombstone for retry. Quota includes cleanup-pending bytes.
- The original object is immutable. Renames, page position and named bookmarks
  are metadata updates only.
- All module endpoints inherit normal authenticated campaign ownership,
  stale-account assertions, same-origin writes and private/no-store responses.
  There is no anonymous demo content endpoint.

## Browser reader

PDF.js and its matching worker are lazy-loaded only when opening the reference
pane. Renderer support files are served same-origin under `/pdf-assets/`; those
directories contain only package font, CMap and WASM assets, never uploads.
Canvas sizes, thumbnail windows and search page text are bounded. Search scans
80 pages per continuation and reports when dense-page text is truncated or
pages have no selectable text. Embedded launch actions, links, forms and PDF
JavaScript are not rendered as interactive controls.

The active tool stays mounted beside the desktop pane or behind the mobile
dialog. Campaign changes key a fresh reader; account closure also aborts XHR and
PDF requests. Closing/changing documents destroys the worker loading task and
cancels rendering/search.

## Verification

```
npx tsx --test test/campaign-modules.test.ts
MODULE_AUTH_BROWSER_TEST=1 npx tsx --test test/campaign-modules-auth-browser.test.ts
npm run check
npm test
npm run build
```

Unit tests use an injected object store and are not real-auth persistence
evidence. The opt-in browser regression creates disposable development Clerk
users, signs in through the normal UI, and uses the actual database and App
Storage. It must explicitly skip the file-persistence/rendering portion if no
default bucket is configured; that skip is a blocker, not a completed check.
It never uses creator campaigns or real adventure PDFs. Screenshots, when the
full flow runs, go into ignored `generated-artifacts/modules/`.
