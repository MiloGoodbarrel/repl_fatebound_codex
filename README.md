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
- Campaign party persistence — save PCs across sessions

### 🗂️ Campaign Manager
- Create and switch between named campaigns (supports 5e, One D&D, 4e, 3.5e, 3e, AD&D)
- Each campaign stores its own loot chest, party roster, and homebrew bestiary
- Campaign context persists in `localStorage` — no login required

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

## License

MIT
