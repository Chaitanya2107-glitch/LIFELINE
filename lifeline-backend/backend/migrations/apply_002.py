#!/usr/bin/env python3
"""
Migration runner / verifier for BE-2 schema changes.

Usage:
    venv/Scripts/python.exe migrations/apply_002.py [--check]

With --check: only prints which columns are present / missing, no writes.
Without --check: prints migration SQL to stdout for copy-paste into the
Supabase Dashboard SQL editor (Settings → SQL Editor).

Background: The Supabase service role key is a JWT that authenticates
against the PostgREST REST layer.  PostgREST is read/write for DML but
does NOT expose a DDL endpoint.  Raw ALTER TABLE statements must be run
via the Supabase Dashboard SQL editor or the Supabase CLI
(`supabase db push`).
"""

import sys
from app.database.supabase import supabase

REQUIRED_COLUMNS = {
    "file_name":   "TEXT",
    "report_type": "TEXT",
    "status":      "TEXT DEFAULT 'verified'",
    "file_url":    "TEXT",
    "procedures":  "JSONB DEFAULT '[]'::jsonb",
    "follow_ups":  "JSONB DEFAULT '[]'::jsonb",
}


def check_columns() -> tuple[list[str], list[str]]:
    """Return (present, missing) column name lists."""
    row = supabase.table("medical_records").select("*").limit(1).execute()
    if row.data:
        existing = set(row.data[0].keys())
    else:
        # Table is empty — insert a dummy then roll back isn't possible via REST.
        # Fall back to checking via a known-safe select.
        existing = set()
        for col in REQUIRED_COLUMNS:
            try:
                supabase.table("medical_records").select(col).limit(1).execute()
                existing.add(col)
            except Exception:
                pass

    present = [c for c in REQUIRED_COLUMNS if c in existing]
    missing = [c for c in REQUIRED_COLUMNS if c not in existing]
    return present, missing


def print_migration_sql(missing: list[str]) -> None:
    if not missing:
        print("All required columns already present — nothing to migrate.")
        return

    lines = ["ALTER TABLE medical_records"]
    for i, col in enumerate(missing):
        comma = "," if i < len(missing) - 1 else ";"
        lines.append(f"    ADD COLUMN IF NOT EXISTS {col:<12} {REQUIRED_COLUMNS[col]}{comma}")

    print("\n" + "=" * 60)
    print("Copy and run the following SQL in the Supabase Dashboard")
    print("   Project -> SQL Editor -> New query")
    print("=" * 60)
    print()
    print("\n".join(lines))
    print()
    print("-- Backfill existing rows")
    print("UPDATE medical_records SET status = 'verified' WHERE status IS NULL;")
    print()


def main():
    check_only = "--check" in sys.argv

    print("Checking medical_records columns...")
    present, missing = check_columns()

    print(f"\n  Present : {present or '(none of the required columns)'}")
    print(f"  Missing : {missing or '(none — all columns present)'}")

    if not check_only:
        print_migration_sql(missing)


if __name__ == "__main__":
    main()
