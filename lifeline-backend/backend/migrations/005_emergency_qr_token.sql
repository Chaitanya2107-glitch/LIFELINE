-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Emergency QR token column on patients
--
-- Adds a cryptographically random, URL-safe token used to generate a
-- scannable QR code for first-responder access.  The token is:
--   - generated lazily on first GET /patient/emergency-qr request
--   - invalidated instantly on POST /patient/emergency-qr/regenerate
--   - UNIQUE so two patients can never share the same public URL
--   - NULL for all existing rows (no backfill)
--
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS emergency_qr_token TEXT UNIQUE NULL;

CREATE INDEX IF NOT EXISTS idx_patients_emergency_qr_token
    ON patients (emergency_qr_token)
    WHERE emergency_qr_token IS NOT NULL;
