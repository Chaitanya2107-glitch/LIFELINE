#!/usr/bin/env python3
"""
Migration runner / verifier for appointments table (Migration 004).

Usage:
    venv/Scripts/python.exe -m migrations.apply_004 [--check]

With --check: only verifies whether the table and required columns exist.
Without --check: prints the SQL to run in the Supabase Dashboard.
"""
import sys
from app.database.supabase import supabase

REQUIRED_COLUMNS = {
    "id", "patient_id", "doctor_id", "date", "time",
    "location", "type", "notes", "status", "created_at",
}


def check_table() -> tuple[bool, set[str], set[str]]:
    """Return (table_exists, present_cols, missing_cols)."""
    try:
        r = supabase.table("appointments").select("*").limit(1).execute()
        if r.data:
            existing = set(r.data[0].keys())
        else:
            existing = set()
            for col in REQUIRED_COLUMNS:
                try:
                    supabase.table("appointments").select(col).limit(1).execute()
                    existing.add(col)
                except Exception:
                    pass
        present = REQUIRED_COLUMNS & existing
        missing = REQUIRED_COLUMNS - existing
        return True, present, missing
    except Exception as e:
        if "PGRST205" in str(e) or "schema cache" in str(e):
            return False, set(), REQUIRED_COLUMNS
        raise


def print_sql():
    print()
    print("=" * 62)
    print("Run the following SQL in the Supabase Dashboard")
    print("   Project -> SQL Editor -> New query")
    print("=" * 62)
    with open("migrations/004_appointments.sql") as f:
        print(f.read())


def main():
    check_only = "--check" in sys.argv
    print("Checking appointments table...")
    exists, present, missing = check_table()

    if not exists:
        print("  Table : DOES NOT EXIST")
        print(f"  Missing columns : {sorted(missing)}")
        if not check_only:
            print_sql()
        return

    print("  Table   : EXISTS")
    print(f"  Present : {sorted(present)}")
    if missing:
        print(f"  Missing : {sorted(missing)}")
        if not check_only:
            print_sql()
    else:
        print("  Missing : (none -- all columns present)")


if __name__ == "__main__":
    main()
