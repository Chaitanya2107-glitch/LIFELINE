-- Migration 002 — BE-2: Add new columns to medical_records
-- Run this in the Supabase Dashboard → SQL Editor (or via psql).
-- All statements use IF NOT EXISTS / safe defaults — safe to re-run.
--
-- Adds:
--   file_name    TEXT          — original uploaded filename
--   report_type  TEXT          — e.g. "Blood Test", "X-Ray", doctor-supplied
--   status       TEXT          — always 'verified' for AI-processed uploads
--   file_url     TEXT          — Supabase Storage path: {patient_id}/{record_id}/{file_name}
--   procedures   JSONB         — list of procedure strings from AI extraction
--   follow_ups   JSONB         — list of follow-up strings from AI extraction
--
-- Existing columns and data are NOT touched.

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS file_name   TEXT,
    ADD COLUMN IF NOT EXISTS report_type TEXT,
    ADD COLUMN IF NOT EXISTS status      TEXT    DEFAULT 'verified',
    ADD COLUMN IF NOT EXISTS file_url    TEXT,
    ADD COLUMN IF NOT EXISTS procedures  JSONB   DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS follow_ups  JSONB   DEFAULT '[]'::jsonb;

-- Backfill status on any existing rows that have a NULL status
UPDATE medical_records
SET status = 'verified'
WHERE status IS NULL;

-- Verify columns were added (run this block separately to check)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'medical_records'
-- ORDER BY ordinal_position;
