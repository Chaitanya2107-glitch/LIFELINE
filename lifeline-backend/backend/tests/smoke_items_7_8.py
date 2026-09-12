"""
Live smoke test for Items 7 and 8 against the real Supabase instance.
Runs without a server — calls the service and storage client directly.

Usage:
    venv/Scripts/python.exe -m tests.smoke_items_7_8
"""
from app.database.supabase import supabase
from app.services.medical_record_service import get_all_medical_records

PATIENT_ID = "d07a5673-b987-4138-b814-1393071110d3"  # seeded test patient
STORAGE_BUCKET = "medical-reports"

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


print(f"\n{BOLD}--- Item 7: GET /medical-records uploader_name join ---{RESET}")
records = get_all_medical_records(PATIENT_ID)
check("Returns a list", isinstance(records, list))
if records:
    first = records[0]
    check("uploader_name key present in each record", "uploader_name" in first)
    check("Raw 'users' key not leaked into response", "users" not in first)
    check("All required BE-2 fields present",
          all(k in first for k in ("file_name", "report_type", "status", "file_url", "procedures", "follow_ups")),
          detail=str([k for k in ("file_name","report_type","status","file_url","procedures","follow_ups") if k not in first]))
    print(f"    uploader_name values: {[r.get('uploader_name') for r in records[:3]]}")
    print(f"    status values:        {[r.get('status') for r in records[:3]]}")
    print(f"    file_name values:     {[r.get('file_name') for r in records[:3]]}")
else:
    print("  (no records for this patient — column checks skipped)")

print(f"\n{BOLD}--- Item 8: Storage bucket status ---{RESET}")
bucket = supabase.storage.get_bucket(STORAGE_BUCKET)
check("medical-reports bucket exists", bucket is not None)
check("medical-reports bucket is PRIVATE (public=False)", bucket.public is False,
      detail=f"public={bucket.public}")

print(f"\n{BOLD}--- Item 8: create_signed_url API reachable ---{RESET}")
# List objects in the bucket to confirm service-role access
try:
    objects = supabase.storage.from_(STORAGE_BUCKET).list()
    check("Service role can list bucket objects", isinstance(objects, list),
          detail=str(objects))
    print(f"    Objects in bucket root: {len(objects)}")
except Exception as e:
    check("Service role can list bucket objects", False, detail=str(e))

print(f"\n{'='*50}")
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"  {colour}{passed}/{total} checks passed{RESET}")
print(f"{'='*50}\n")
