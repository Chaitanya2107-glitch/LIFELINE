-- Migration 003 — BE-2: Create care_plan table
-- Run in Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
--
-- Columns:
--   id               UUID PK — server-generated
--   patient_id       UUID FK -> patients.id
--   category         TEXT    — default 'Follow-up'; e.g. 'Medication', 'Test'
--   title            TEXT    — short heading
--   description      TEXT    — full detail (follow-up string from AI extraction)
--   due_date         DATE    — nullable; can be supplied manually later
--   status           TEXT    — 'pending' | 'ongoing' | 'completed'; default 'pending'
--   priority         TEXT    — 'low' | 'medium' | 'high'; default 'medium'
--   source_record_id UUID FK -> medical_records.id (nullable) — which upload created it
--   created_at       TIMESTAMPTZ — server-generated

CREATE TABLE IF NOT EXISTS care_plan (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    category         TEXT        NOT NULL DEFAULT 'Follow-up',
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL,
    due_date         DATE,
    status           TEXT        NOT NULL DEFAULT 'pending',
    priority         TEXT        NOT NULL DEFAULT 'medium',
    source_record_id UUID        REFERENCES medical_records(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: patient queries are the dominant access pattern
CREATE INDEX IF NOT EXISTS idx_care_plan_patient_id
    ON care_plan (patient_id);

-- Index: source record lookups (used to avoid duplicate follow-up creation)
CREATE INDEX IF NOT EXISTS idx_care_plan_source_record
    ON care_plan (source_record_id)
    WHERE source_record_id IS NOT NULL;
