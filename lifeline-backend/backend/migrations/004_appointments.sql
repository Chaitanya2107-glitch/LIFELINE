-- Migration 004 — BE-2: Create appointments table
-- Run in Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
--
-- Columns (exactly as specified in BE-2):
--   id          UUID PK  — server-generated
--   patient_id  UUID FK -> patients.id
--   doctor_id   INTEGER FK -> users.id
--   date        DATE      — appointment date
--   time        TEXT      — e.g. "09:30", "14:00" (stored as text per spec)
--   location    TEXT      — nullable
--   type        TEXT      — e.g. "Follow-up", "Consultation"
--   notes       TEXT      — nullable
--   status      TEXT      — 'upcoming' | 'completed' | 'cancelled'; default 'upcoming'
--   created_at  TIMESTAMPTZ — server-generated

CREATE TABLE IF NOT EXISTS appointments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id   INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    date        DATE        NOT NULL,
    time        TEXT        NOT NULL,
    location    TEXT,
    type        TEXT        NOT NULL,
    notes       TEXT,
    status      TEXT        NOT NULL DEFAULT 'upcoming',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: patient views their own appointments
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
    ON appointments (patient_id);

-- Index: doctor views their own appointments
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id
    ON appointments (doctor_id);
