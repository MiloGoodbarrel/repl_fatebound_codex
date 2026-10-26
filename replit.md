# D&D DM Toolkit

## Overview

A Dungeons & Dragons Dungeon Master toolkit application that provides tools for managing tabletop RPG sessions. The primary features include a "Deck of Loot" system for drawing magical items across multiple D&D editions (OD&D through One D&D) and an Initiative Tracker for combat management. The application is built as a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with a custom fantasy RPG theme (dark parchment colors, gold accents)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for card draw/flip animations
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schemas for validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Development Server**: Vite dev server proxied through Express in development

### Data Storage
- **Database**: PostgreSQL (required via DATABASE_URL environment variable)
- **Schema**: Single `items` table storing D&D items with fields for name, category, rarity, description, version (edition), attunement requirements, and metadata
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)

### Shared Code Pattern
- The `shared/` directory contains code used by both frontend and backend
- `shared/schema.ts`: Drizzle table definitions and Zod validation schemas
- `shared/routes.ts`: API route definitions with type-safe input/output schemas

### Key Design Decisions

**Monorepo Structure**: Client code lives in `client/`, server in `server/`, and shared types/schemas in `shared/`. This enables full type safety across the stack with a single TypeScript configuration.

**Type-Safe API**: API contracts are defined once in `shared/routes.ts` using Zod schemas. Both the server validates incoming requests and the client validates responses against these schemas.

**Multi-Edition Support**: The items database schema includes a `version` field to support items from all D&D editions (OD&D, AD&D, 3e, 4e, 5e, One D&D). The data sources configuration in `server/sources.ts` defines import sources for each edition.

**Duplicate Handling**: When importing items from multiple sources, the system uses canonical name matching (lowercase, stripped punctuation) combined with edition and type to identify duplicates and merge appropriately.

## External Dependencies

### Private session journal

Sessions are implemented but deliberately locked on the unauthenticated app.
No journal or recording operations may be enabled until trusted server-side
campaign permissions exist; selecting a campaign is never authorization.
See `server/journal/README.md` for document boundaries, privacy requirements,
Echo export limitations, development migration, private recording storage and tests.

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database toolkit with `drizzle-kit` for migrations

### External APIs
- **D&D 5e API** (dnd5eapi.co): Primary source for 5e magic items data
- Additional data sources defined in `server/sources.ts` include GitHub repositories and SRD websites (most currently disabled)

### Key NPM Packages
- `@tanstack/react-query`: Async state management
- `framer-motion`: Animation library
- `zod`: Runtime type validation
- `drizzle-orm` / `drizzle-zod`: Database ORM and schema validation
- `express`: HTTP server framework
- `wouter`: Client-side routing
- Radix UI primitives: Accessible UI component foundations