# ⚔️ Fatebound Codex — D&D DM Toolkit

A full-stack web application built for Dungeon Masters running 5e (and other editions) campaigns. Includes a **Deck of Loot** magic item generator and a full **Initiative Tracker** with bestiary, encounter builder, and campaign management.

---

## Features

### 🃏 Deck of Loot
Draw random magic items from a seeded 5e compendium with fine-grained filters:

- Filter by **edition**, **category** (Weapons, Armor, Potions, Rings, Wands, Staves, Scrolls, Rods, Wondrous Items, and more), **rarity**, and **sourcebook**
- **Keyword search** constrains the draw pool server-side — press `Enter` or click **Draw Cards**
- Draw 1–100 items at a time
- Each card shows name, rarity, category, type, description, damage/weight/cost, properties, attunement requirement, and **source book**
- Import custom items via **CSV upload** (official or homebrew pools)
- Import campaign items from **text-based PDFs**, review detected entries and source pages, correct fields, then append selected entries
- **Campaign mode** — items drawn can be saved to a persistent campaign loot chest

### ⚔️ Initiative Tracker
Full combat manager for 5e sessions:

- Add **Player Characters** and **NPCs/monsters** to the tracker
- Auto-sort by initiative; advance turns and rounds
- Track **HP**, **AC**, conditions, and stances per combatant
- **Bestiary** — 400+ monsters seeded from 5e sourcebooks with full stat blocks:
  - Search by name, filter by type, CR range, and sourcebook
  - Expandable stat blocks: AC, HP, speed, ability scores, traits, actions, and multiattack
  - Random monster selection and **Encounter Group** builder
- **Homebrew Bestiary** — import custom monsters per campaign via CSV (preview before confirming)
- **PDF homebrew import** — detect conventional statblocks, review creatures/NPCs against extracted source text, and add missing entries manually without overwriting the library
- Campaign party persistence — save PCs across sessions

### 🗂️ Campaign Manager
- Create and switch between named campaigns (supports 5e, One D&D, 4e, 3.5e, 3e, AD&D)
- Each campaign stores its own loot chest, party roster, and homebrew bestiary
- Private campaigns require sign-in and server-verified ownership; the public `/dev` simulation uses fictional, browser-local data

### PDF library imports

Select a campaign, then choose **Import PDF** in the Deck of Loot import area or the Initiative Tracker's Homebrew Bestiary. Review the extracted text and detected entries, correct fields, deselect unwanted entries, and save. Duplicate names require explicit acknowledgement. Existing entries are kept, and CSV remains available.

Extraction runs on the application's server without an AI provider. PDFs are not retained or sent to an external AI service. Limits: 10 MiB, 100 pages, 256 KiB of extracted text, and 100 entries per save. Scanned or password-protected PDFs must be converted to readable text first. Recognition is conservative, not a complete adventure conversion: complex columns, cross-page statblocks, unusual mechanics, and prose-only NPCs may need manual entry. The extracted source text remains available during review; it is not a permanent PDF reference viewer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Routing | Wouter |
| State / Data | TanStack React Query |
| Styling | Tailwind CSS, shadcn/ui (Radix UI), Framer Motion |
| Icons | Lucide React |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL, Drizzle ORM, Drizzle Kit |
| Validation | Zod, drizzle-zod |
| CSV Parsing | csv-parse |

---

## Project Structure

```
client/
  src/
    pages/          # Landing, Home (Deck of Loot), InitiativeTracker
    components/     # ItemCard, Controls, shadcn UI primitives
    hooks/          # use-items, use-toast, use-mobile
    lib/            # campaignContext, queryClient, utils
server/
  index.ts          # Express bootstrap + auto-seed
  routes.ts         # REST API routes + CSV helpers
  storage.ts        # Drizzle data access layer
  db.ts             # PostgreSQL pool + Drizzle instance
  seedLoot.ts       # 5e loot CSV seeder
  seedBestiary.ts   # Bestiary CSV seeder
  data/
    5e_loot.csv
    bestiary/       # monsters, traits, actions, spells CSVs
shared/
  schema.ts         # Drizzle table definitions + Zod schemas
  routes.ts         # Typed API contract
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for express-session |
| `PORT` | ❌ | Server port (default: `5000`) |

### Install & Run

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The server auto-seeds the 5e loot table and bestiary on first startup. The app is served at `http://localhost:5000`.

### Build for Production

```bash
npm run build
npm start
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/items/draw` | Draw random items with filters |
| `GET` | `/api/items/sources` | List all available sourcebooks |
| `GET` | `/api/bestiary/filters` | Monster type / CR / source filter options |
| `GET` | `/api/bestiary/search` | Search monsters by name |
| `GET` | `/api/bestiary/random` | Get a random monster |
| `GET` | `/api/bestiary/encounter` | Generate an encounter group |
| `GET` | `/api/bestiary/:id` | Full monster stat block |
| `GET/POST/DELETE` | `/api/campaigns` | Campaign CRUD |
| `GET/POST` | `/api/campaigns/:id/characters` | Campaign party roster |
| `GET/POST/DELETE` | `/api/campaigns/:id/homebrew-bestiary` | Campaign homebrew monsters |
| `GET` | `/api/homebrew-bestiary/template.csv` | Download homebrew import template |

---

## Data & Seeding

- **Loot** — seeded from `server/data/5e_loot.csv` at startup (idempotent)
- **Bestiary** — seeded from CSVs in `server/data/bestiary/` covering monsters, traits, actions, action effects, and spellcasting profiles
- Rarity values follow title case (`Common`, `Uncommon`, `Rare`, `Very Rare`, `Legendary`, `Artifact`)

---

## Public demo and UI parity

`/dev` (and `/dev/campaigns`, `/dev/loot`, `/dev/tables`, `/dev/initiative`,
`/dev/sessions`, `/dev/settings`) renders the **same workspace router, pages,
dialogs, appearance provider, and feature navigation** as the signed-in app.
Do not create separate demo page implementations: changes to the actual screens
must appear here automatically.

The only alternate layer is the browser-local data adapter in
`client/src/demo/workspaceApi.ts`, with curated sample campaign fixtures. It intercepts
all `/api/` fetches before screens mount, rejects unknown operations, and never
falls back to private APIs. Stock-only reads use `/demo-library`, a dedicated
anonymous GET/HEAD router backed by the same shared stock tables as the app.
It exposes items, source lists and bestiary search/details, never campaign-owned
items/NPCs, accounts, journals, uploads, links, or writes. Unknown paths return
404 and writes return 405; they never fall through to authentication or the SPA.
No Clerk provider or privileged test identity is installed.
The normal server API authorization remains unchanged. Each visitor has their own
demo edits; the demo cannot read campaign data from an account.

Campaigns, party rosters, links, encounter saves and prepared rosters, tables,
loot draws, journal text imports/name review, summary revisions, and skins use
the real controls. File/audio uploads, server downloads, paid AI, administration,
and actual identity/account deletion are explicitly blocked. Shared stock items,
sourcebooks and monsters are the full catalog, not fictional substitutes;
campaign-owned sample content comes from the supplied Starter Set adventure
and a separate, explicitly fictional resource-linking sandbox. Stock draws are filtered
locally, while bestiary searches/details use the read-only stock router.
The demo tests the UI, not production
identity, network latency, database durability, upload extraction, or multi-user
security.

Source codes in loot filters/cards and bestiary/statblock displays share
`Sourcebook`, a portal-rendered hover/keyboard-focus tooltip. Display names live
in `shared/sourcebooks.ts`; source search accepts codes and expanded names.
The original source IDs remain unchanged for API filters. Unknown names are
shown unchanged rather than guessed.

Demo saves use only `fatebound:workspace-demo:v3` (1 MiB maximum). Reset removes
only that key and restores sample fixtures; unrelated browser/account data
is untouched. Previous demo saves (including v2) are left untouched, not migrated
or overwritten, so existing visitors get the new example without losing old work.
Storage failures are shown explicitly rather than reporting a successful save.

Campaign selection is restored from a tab-local, account/demo-scoped ID and
validated against the accessible campaign list; no private campaign object is
cached for another account. Unsaved roll-table forms are recoverable in the
same tab after refresh or campaign switching. Saving or explicitly discarding
removes the draft. Signing out clears signed-in table drafts. These conveniences
are not campaign backups or cross-device synchronization.

Groups retain each creature's rolled maximum HP through save, resume and
prepared-roster operations. Old saves without individual maxima use conservative
current/shared-HP estimates; the original pre-damage roll cannot be reconstructed,
so review older groups' maxima with the correction controls when needed.

### Lost Mine of Phandelver sample

`client/src/demo/phandelver/` supplies the main demo campaign: five unnamed
level-one Starter Set pregens, 66 prepared rosters (including optional branches
and deterministic wandering examples), module-specific creature profiles, and
12 source-cited DM-preparation journal entries. These are summaries and
initiative data, not the original adventure PDF, maps, or full character sheets.
Original uploads are excluded from Git and application publishing.

Every roster includes the original level-one party; later encounters are not
silently rebalanced or leveled. Journal notes explicitly distinguish preparation
from played events and flag source conflicts, variable counts and optional
reinforcements. Named HP variants and adventure-specific monster statistics
must not be replaced with generic Monster Manual defaults. The extra fictional
campaign exists only to exercise cross-campaign resource linking.

Validation:
`npm test` includes local adapter regressions.
`PUBLIC_DEMO_BROWSER_TEST=1 npx tsx --test test/public-demo-browser.test.ts`
checks desktop/mobile real-screen interactions, persistence/reset, zero private
API/identity requests, and continued authentication on real APIs.

## License

MIT
