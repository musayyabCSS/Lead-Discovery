/*
# Add run progress tracking and signal candidate filtering

## Overview
Adds columns to track live search progress on runs (signals_found, candidates_found)
and a flag on signals to mark whether they passed the deterministic pre-filter.

## Modified Tables

### runs
- signals_found (int, default 0) — total signals discovered so far
- candidates_found (int, default 0) — signals that passed deterministic filter

### signals
- is_candidate (bool, default false) — true if signal passed the deterministic
  exclusion/company-name pre-filter and is a candidate for LLM qualification

## Security
- No new policies needed; existing RLS policies cover the new columns.
*/

ALTER TABLE runs ADD COLUMN IF NOT EXISTS signals_found integer NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS candidates_found integer NOT NULL DEFAULT 0;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS is_candidate boolean NOT NULL DEFAULT false;