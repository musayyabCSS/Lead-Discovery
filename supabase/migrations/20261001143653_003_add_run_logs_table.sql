/*
# Add run_logs table for debugging edge function output

## Overview
Creates a simple log table to capture edge function console output
since we can't access Supabase function logs directly from this environment.

## New Tables
### run_logs
- id (uuid PK)
- run_id (uuid, nullable, FK to runs)
- log_level (text) — "info" | "error" | "warn"
- message (text)
- created_at (timestamptz)

## Security
- RLS enabled, authenticated users can read logs.
*/

CREATE TABLE IF NOT EXISTS run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES runs(id) ON DELETE CASCADE,
  log_level text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE run_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "run_logs_select_authenticated" ON run_logs;
CREATE POLICY "run_logs_select_authenticated" ON run_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "run_logs_insert_authenticated" ON run_logs;
CREATE POLICY "run_logs_insert_authenticated" ON run_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "run_logs_delete_authenticated" ON run_logs;
CREATE POLICY "run_logs_delete_authenticated" ON run_logs FOR DELETE
  TO authenticated USING (true);