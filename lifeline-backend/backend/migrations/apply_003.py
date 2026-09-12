#!/usr/bin/env python3
"""
Migration runner / verifier for care_plan table (Migration 003).

Usage:
    venv/Scripts/python.exe -m migrations.apply_003 [--check]

With --check: only verifies whether the table and required columns exist.
Without --check: prints the SQL to run in the Supabase Dashboard.
"""
import sys
from app.database.supabase import supabase

REQUIRED_COLUMNS = {
    "id", "patient_id", "category", "title", "description",
    "due_date", "status", "priority", "source_record_id", "created_at",
}


def check_table() -> tuple[bool, set[str], set[str]]:
    """Return (table_exists, present_cols, missing_cols)."""
    try:
        r = supabase.table("care_plan").select("*").limit(0).execute()
        # Empty result but no error means the table exists.
        # Try with 1 row to get column names if any rows exist.
        r2 = supabase.table("care_plan").select("*").limit(1).execute()
        if r2.data:
            existing = set(r2.data[0].keys())
        else:
            # Table exists but is empty — probe column by column
            existing = set()
            for col in REQUIRED_COLUMNS:
                try:
                    supabase.table("care_plan").select(col).limit(1).execute()
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
    with open("migrations/003_care_plan.sql") as f:
        print(f.read())


def main():
    check_only = "--check" in sys.argv

    print("Checking care_plan table...")
    exists, present, missing = check_table()

    if not exists:
        print("  Table : DOES NOT EXIST")
        print(f"  Missing columns : {sorted(missing)}")
        if not check_only:
            print_sql()
        return

    print(f"  Table   : EXISTS")
    print(f"  Present : {sorted(present)}")
    if missing:
        print(f"  Missing : {sorted(missing)}")
        if not check_only:
            print_sql()
    else:
        print("  Missing : (none -- all columns present)")


if __name__ == "__main__":
    main()
