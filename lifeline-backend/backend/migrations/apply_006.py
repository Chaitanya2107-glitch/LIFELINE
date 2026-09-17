#!/usr/bin/env python3
"""
Migration runner / verifier for pharmacy tables (Migration 006).

Usage:
    venv/Scripts/python.exe -m migrations.apply_006 [--check]

With --check: only verifies whether the tables and required columns exist.
Without --check: prints the SQL to run in the Supabase Dashboard.
"""
import sys
from app.database.supabase import supabase

PRESCRIPTION_STATUS_COLUMNS = {
    "id", "medical_record_id", "status", "created_at", "updated_at",
}

DISPENSE_EVENTS_COLUMNS = {
    "id", "prescription_status_id", "pharmacist_id", "patient_id",
    "items", "dispensed_at",
}


def check_table(table_name: str, required: set[str]) -> tuple[bool, set[str], set[str]]:
    """Return (table_exists, present_cols, missing_cols)."""
    try:
        r = supabase.table(table_name).select("*").limit(1).execute()
        if r.data:
            existing = set(r.data[0].keys())
        else:
            existing = set()
            for col in required:
                try:
                    supabase.table(table_name).select(col).limit(1).execute()
                    existing.add(col)
                except Exception:
                    pass
        present = required & existing
        missing = required - existing
        return True, present, missing
    except Exception as e:
        if "PGRST205" in str(e) or "schema cache" in str(e):
            return False, set(), required
        raise


def print_sql():
    print()
    print("=" * 62)
    print("Run the following SQL in the Supabase Dashboard")
    print("   Project -> SQL Editor -> New query")
    print("=" * 62)
    with open("migrations/006_pharmacy.sql") as f:
        print(f.read())


def main():
    check_only = "--check" in sys.argv

    tables = [
        ("prescription_status", PRESCRIPTION_STATUS_COLUMNS),
        ("dispense_events", DISPENSE_EVENTS_COLUMNS),
    ]

    all_ok = True

    for table_name, required_cols in tables:
        print(f"Checking {table_name} table...")
        exists, present, missing = check_table(table_name, required_cols)

        if not exists:
            print("  Table : DOES NOT EXIST")
            print(f"  Missing columns : {sorted(missing)}")
            all_ok = False
            continue

        print("  Table   : EXISTS")
        print(f"  Present : {sorted(present)}")
        if missing:
            print(f"  Missing : {sorted(missing)}")
            all_ok = False
        else:
            print("  Missing : (none -- all columns present)")

    if not all_ok and not check_only:
        print_sql()


if __name__ == "__main__":
    main()
