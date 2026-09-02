#!/usr/bin/env bash
set -euo pipefail

# Reconcile JavaScript dependencies without prompts, then verify merged code.
npm install --no-audit --no-fund
npm run build