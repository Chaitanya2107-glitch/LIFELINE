-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Pharmacy tier
-- Run in Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run (IF EXISTS / IF NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- 1. users.role      — allow 'pharmacist' (constraint is widened, no data changes)
-- 2. prescription_status — one row per medical record that lists medicines:
--      id, medical_record_id (UNIQUE), status, created_at, updated_at
--      status: 'prescribed' | 'sent_to_pharmacy' | 'dispensed'
-- 3. dispense_events — who dispensed what, when:
--      id, prescription_status_id, pharmacist_id, patient_id, items, dispensed_at
-- 4. Backfill prescription_status for existing records that have medicines.
--
-- Pharmacist consent reuses consent_requests (doctor_id holds the
-- pharmacist's users.id) — no change to that table.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow the pharmacist role.
--    NOTE: this drops and re-creates the CHECK constraint only — no rows are
--    touched. The new constraint is a strict superset of the old one.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users
    ADD CONSTRAINT chk_users_role CHECK (role IN ('doctor', 'clerk', 'pharmacist'));

-- 2. prescription_status
CREATE TABLE IF NOT EXISTS prescription_status (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    medical_record_id UUID        NOT NULL UNIQUE REFERENCES medical_records(id) ON DELETE CASCADE,
    status            TEXT        NOT NULL DEFAULT 'prescribed',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_prescription_status
        CHECK (status IN ('prescribed', 'sent_to_pharmacy', 'dispensed'))
);

-- 3. dispense_events
CREATE TABLE IF NOT EXISTS dispense_events (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_status_id UUID        NOT NULL REFERENCES prescription_status(id) ON DELETE CASCADE,
    pharmacist_id          BIGINT      NOT NULL REFERENCES users(id),
    patient_id             UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    items                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    dispensed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: look up dispense events by prescription
CREATE INDEX IF NOT EXISTS idx_dispense_events_prescription_status_id
    ON dispense_events (prescription_status_id);

-- Index: pharmacist views their own dispense history
CREATE INDEX IF NOT EXISTS idx_dispense_events_pharmacist_id
    ON dispense_events (pharmacist_id);

-- Index: dispense events for a patient
CREATE INDEX IF NOT EXISTS idx_dispense_events_patient_id
    ON dispense_events (patient_id);

-- 4. Backfill: every existing record with at least one medicine gets a
--    'prescribed' row. Records uploaded after this migration get one
--    automatically from POST /upload.
INSERT INTO prescription_status (medical_record_id)
SELECT id
FROM medical_records
WHERE jsonb_typeof(medicines) = 'array'
  AND jsonb_array_length(medicines) > 0
ON CONFLICT (medical_record_id) DO NOTHING;
