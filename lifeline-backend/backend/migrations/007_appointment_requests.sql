-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Patient-initiated appointment requests
-- Run in Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run. Additive only — no existing data is changed.
--
-- New flow: the patient requests an appointment (status 'pending') with a
-- preferred date/time and a reason; the doctor confirms the final
-- date/time/location (status 'upcoming') or declines it ('rejected').
--
--   reason  TEXT  — why the patient wants the appointment (patient-written).
--                   `notes` remains the doctor's instructions / decline reason.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS reason TEXT;

-- New rows always start as a request.
ALTER TABLE appointments
    ALTER COLUMN status SET DEFAULT 'pending';
