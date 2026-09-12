-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 001 — Fresh Supabase schema for Lifeline
-- Run this in the Supabase Dashboard → SQL Editor on the NEW (empty) database.
-- All statements are idempotent (IF NOT EXISTS / safe defaults).
--
-- Covers:
--   users            — doctors and clerks (med_reg_no nullable at DB level;
--                       application layer enforces it for role='doctor')
--   patients         — self-registered or staff-created patients
--   otp_sessions     — bcrypt-hashed 6-digit OTPs for patient OTP login
--   medical_records  — AI-extracted medical reports (no legacy user_id column)
--   consent_requests — doctor ↔ patient access-request lifecycle
--   care_plan        — follow-up and health goal items (from migration 003)
--   appointments     — patient appointments (from migration 004)
--   access_logs      — full audit trail
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- users
--   Doctors and clerks only. Patients are in the separate `patients` table.
--   med_reg_no is nullable at DB level; app validation enforces it for doctors.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT         NOT NULL UNIQUE,
    password_hash  TEXT         NOT NULL,
    name           TEXT         NOT NULL,
    role           TEXT         NOT NULL,
    specialization TEXT,
    med_reg_no     TEXT,                         -- nullable; required for doctors by app layer
    phone          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_role CHECK (role IN ('doctor', 'clerk'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- patients
--   Self-registered patients (created_by IS NULL) or staff-created patients
--   (created_by = users.id).  patient_code is always backend-generated.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_code        TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    phone               TEXT,
    email               TEXT,
    password_hash       TEXT,                    -- set on self-registration
    date_of_birth       DATE,
    blood_group         TEXT,
    emergency_contacts  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    conditions          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_by          BIGINT      REFERENCES users(id) ON DELETE SET NULL,  -- NULL = self-registered
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_patient_code
    ON patients (patient_code);

CREATE INDEX IF NOT EXISTS idx_patients_phone
    ON patients (phone)
    WHERE phone IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- otp_sessions
--   6-digit OTPs, bcrypt-hashed, single-use, time-limited.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    otp_hash    TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_patient_id
    ON otp_sessions (patient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- medical_records
--   No legacy user_id column. uploaded_by references users.id (nullable in case
--   the uploader account is later deleted).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_records (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    uploaded_by     BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    report_hash     TEXT,
    file_name       TEXT,
    report_type     TEXT,
    status          TEXT        NOT NULL DEFAULT 'verified',
    file_url        TEXT,
    -- AI-extracted structured data
    lab_values      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    diagnosis       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    medicines       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    allergies       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    procedures      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    follow_ups      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    -- uploader display name (denormalised for read performance)
    uploader_name   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id
    ON medical_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_report_hash
    ON medical_records (report_hash)
    WHERE report_hash IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consent_requests
--   Partial unique index prevents duplicate pending rows for the same
--   doctor+patient pair.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id   UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status       TEXT        NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    CONSTRAINT chk_consent_status CHECK (status IN ('pending', 'approved', 'denied'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_unique_pending
    ON consent_requests (doctor_id, patient_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_consent_requests_patient_id
    ON consent_requests (patient_id);

CREATE INDEX IF NOT EXISTS idx_consent_requests_doctor_id
    ON consent_requests (doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- care_plan  (matches migration 003)
-- ─────────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_care_plan_patient_id
    ON care_plan (patient_id);

CREATE INDEX IF NOT EXISTS idx_care_plan_source_record
    ON care_plan (source_record_id)
    WHERE source_record_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- appointments  (matches migration 004)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id   BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE        NOT NULL,
    time        TEXT        NOT NULL,
    location    TEXT,
    type        TEXT        NOT NULL,
    notes       TEXT,
    status      TEXT        NOT NULL DEFAULT 'upcoming',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
    ON appointments (patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id
    ON appointments (doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- access_logs
--   Exactly one of actor_user_id or actor_patient_id must be non-null per row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    actor_patient_id UUID        REFERENCES patients(id) ON DELETE SET NULL,
    actor_role       TEXT        NOT NULL,
    action           TEXT        NOT NULL,
    patient_id       UUID        REFERENCES patients(id) ON DELETE SET NULL,
    metadata         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_patient_id
    ON access_logs (patient_id)
    WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_logs_actor_user
    ON access_logs (actor_user_id)
    WHERE actor_user_id IS NOT NULL;
