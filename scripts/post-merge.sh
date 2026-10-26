#!/usr/bin/env bash
set -euo pipefail

# Reconcile JavaScript dependencies without prompts, then verify merged code.
npm install --no-audit --no-fund
npx tsx scripts/migrate-journal.ts
npm run build