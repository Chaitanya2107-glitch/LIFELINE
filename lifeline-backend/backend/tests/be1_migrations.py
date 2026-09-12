"""
BE-1 Migration / Schema Compatibility Check
Verifies all tables and columns exist in live Supabase.

Run: venv/Scripts/python.exe -m tests.be1_migrations
"""

import sys
from app.database.supabase import supabase

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  {label}" + (f" -- {detail}" if detail else ""))
        failed += 1


# ── Migration 002: medical_records BE-2 columns ──────────────
print(f"\n{BOLD}=== Migration 002 -- medical_records BE-2 columns ==={RESET}")
BE2_COLS = ["file_name", "report_type", "status", "file_url", "procedures", "follow_ups"]
for col in BE2_COLS:
    try:
        supabase.table("medical_records").select(col).limit(1).execute()
        check(f"medical_records.{col} exists", True)
    except Exception as e:
        check(f"medical_records.{col} exists", False, str(e)[:100])

# Existing medical_records columns still intact
ORIG_MR_COLS = ["id", "patient_id", "uploaded_by", "report_hash", "doctor",
                "hospital", "dates", "diagnosis", "medicines", "allergies",
                "lab_values", "raw_text", "created_at"]
for col in ORIG_MR_COLS:
    try:
        supabase.table("medical_records").select(col).limit(1).execute()
        check(f"medical_records.{col} (pre-existing) intact", True)
    except Exception as e:
        check(f"medical_records.{col} (pre-existing) intact", False, str(e)[:100])

# Status backfill: no NULL status rows after migration 002
try:
    r = supabase.table("medical_records").select("id, status").limit(10).execute()
    check("medical_records rows readable", isinstance(r.data, list))
    if r.data:
        null_status = [row for row in r.data if row.get("status") is None]
        check("No NULL status rows (backfill applied)", len(null_status) == 0,
              detail=f"{len(null_status)} rows with status=NULL found")
except Exception as e:
    check("medical_records rows readable", False, str(e)[:100])


# ── Migration 003: care_plan table ───────────────────────────
print(f"\n{BOLD}=== Migration 003 -- care_plan table ==={RESET}")
CARE_COLS = [
    "id", "patient_id", "category", "title", "description",
    "due_date", "status", "priority", "source_record_id", "created_at",
]
for col in CARE_COLS:
    try:
        supabase.table("care_plan").select(col).limit(1).execute()
        check(f"care_plan.{col} exists", True)
    except Exception as e:
        check(f"care_plan.{col} exists", False, str(e)[:100])

# FK: care_plan.patient_id -> patients.id
try:
    r = supabase.table("care_plan").select("id, patient_id").limit(3).execute()
    check("care_plan FK query works", isinstance(r.data, list))
except Exception as e:
    check("care_plan FK query works", False, str(e)[:100])

# FK: care_plan.source_record_id -> medical_records.id
try:
    r = supabase.table("care_plan").select("id, source_record_id").limit(3).execute()
    check("care_plan.source_record_id query works", isinstance(r.data, list))
except Exception as e:
    check("care_plan.source_record_id query works", False, str(e)[:100])


# ── Migration 004: appointments table ────────────────────────
print(f"\n{BOLD}=== Migration 004 -- appointments table ==={RESET}")
APPT_COLS = [
    "id", "patient_id", "doctor_id", "date", "time",
    "location", "type", "notes", "status", "created_at",
]
for col in APPT_COLS:
    try:
        supabase.table("appointments").select(col).limit(1).execute()
        check(f"appointments.{col} exists", True)
    except Exception as e:
        check(f"appointments.{col} exists", False, str(e)[:100])

# FK: appointments.doctor_id -> users.id
try:
    r = supabase.table("appointments").select("id, doctor_id").limit(3).execute()
    check("appointments.doctor_id FK query works", isinstance(r.data, list))
except Exception as e:
    check("appointments.doctor_id FK query works", False, str(e)[:100])

# FK: appointments.patient_id -> patients.id
try:
    r = supabase.table("appointments").select("id, patient_id").limit(3).execute()
    check("appointments.patient_id FK query works", isinstance(r.data, list))
except Exception as e:
    check("appointments.patient_id FK query works", False, str(e)[:100])


# ── Pre-existing BE-1 tables untouched ───────────────────────
print(f"\n{BOLD}=== Pre-existing BE-1 tables still accessible ==={RESET}")
ORIG_TABLES = [
    "users", "patients", "medical_records", "consent_requests",
    "otp_sessions", "medical_registry", "access_logs",
]
for tbl in ORIG_TABLES:
    try:
        supabase.table(tbl).select("*").limit(1).execute()
        check(f"Table '{tbl}' accessible", True)
    except Exception as e:
        check(f"Table '{tbl}' accessible", False, str(e)[:100])


# ── SQL migration files present in repo ──────────────────────
print(f"\n{BOLD}=== SQL migration files present in repo ==={RESET}")
import os
MIGRATION_FILES = [
    "migrations/002_medical_records_be2_fields.sql",
    "migrations/003_care_plan.sql",
    "migrations/004_appointments.sql",
    "migrations/apply_002.py",
    "migrations/apply_003.py",
    "migrations/apply_004.py",
]
for f in MIGRATION_FILES:
    exists = os.path.isfile(f)
    check(f"File {f} present", exists)


# ── Summary ───────────────────────────────────────────────────
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"\n{'='*62}")
print(f"  {colour}{passed}/{total} migration/schema checks passed{RESET}")
print(f"{'='*62}\n")

if failed:
    sys.exit(1)
