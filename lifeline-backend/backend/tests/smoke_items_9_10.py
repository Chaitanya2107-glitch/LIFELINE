"""
Live smoke tests for Items 9-10: care_plan table + follow-up loop.
Runs directly against the real Supabase instance (no server needed).

Tests:
  1. Schema: all columns accessible via REST
  2. create_care_plan_item: inserts a real row
  3. Idempotency: second call with same args returns existing row, no duplicate
  4. get_care_plan_items: returns the inserted row
  5. update_care_plan_status (patient role): updates status
  6. update_care_plan_status (wrong patient): returns 'forbidden'
  7. update_care_plan_status (not found): returns 'not_found'
  8. Follow-up loop: simulates what upload.py does after save_medical_record
  9. Cleanup: deletes the test rows

Usage:
    venv/Scripts/python.exe -m tests.smoke_items_9_10
"""

import uuid
from app.database.supabase import supabase
from app.care_plan.service import (
    create_care_plan_item,
    get_care_plan_items,
    update_care_plan_status,
)

GREEN  = "\033[92m"
RED    = "\033[91m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

passed = 0
failed = 0
created_ids: list[str] = []   # collect for cleanup


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  {label}" + (f"\n        {detail}" if detail else ""))
        failed += 1


# Real seeded patient + medical record from the test fixture
PATIENT_ID  = "d07a5673-b987-4138-b814-1393071110d3"
RECORD_ID   = "7b2fcb69-2841-4332-bce8-d0c8bc121915"
OTHER_PAT   = "00000000-0000-0000-0000-000000000001"  # non-existent, for authz tests

DESCRIPTION = f"[smoke-test] Follow up blood pressure check — {uuid.uuid4().hex[:8]}"


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 1. Schema: all required columns readable ---{RESET}")
# ─────────────────────────────────────────────────────────────────

r = supabase.table("care_plan").select("*").limit(1).execute()
check("care_plan table is reachable via REST", r is not None)

REQUIRED_COLS = {
    "id", "patient_id", "category", "title", "description",
    "due_date", "status", "priority", "source_record_id", "created_at",
}

# Table is empty — probe each column individually
present = set()
for col in REQUIRED_COLS:
    try:
        supabase.table("care_plan").select(col).limit(1).execute()
        present.add(col)
    except Exception:
        pass

missing = REQUIRED_COLS - present
check("All 10 required columns present", not missing,
      detail=f"missing: {sorted(missing)}")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 2. create_care_plan_item: real insert ---{RESET}")
# ─────────────────────────────────────────────────────────────────

row = create_care_plan_item(PATIENT_ID, DESCRIPTION, RECORD_ID)
check("Row returned from insert", isinstance(row, dict) and bool(row))
check("id is a UUID string", isinstance(row.get("id"), str) and len(row.get("id", "")) == 36)
check("patient_id matches", row.get("patient_id") == PATIENT_ID)
check("category is 'Follow-up'", row.get("category") == "Follow-up")
check("status is 'pending'", row.get("status") == "pending")
check("priority is 'medium'", row.get("priority") == "medium")
check("source_record_id matches", row.get("source_record_id") == RECORD_ID)
check("description stored correctly", row.get("description") == DESCRIPTION)
check("title is first 120 chars of description",
      row.get("title") == DESCRIPTION[:120] + ("…" if len(DESCRIPTION) > 120 else ""))
check("created_at is set", bool(row.get("created_at")))

created_ids.append(row["id"])
ITEM_ID = row["id"]
print(f"    Inserted care_plan.id = {ITEM_ID}")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 3. Idempotency: duplicate call returns same row ---{RESET}")
# ─────────────────────────────────────────────────────────────────

row2 = create_care_plan_item(PATIENT_ID, DESCRIPTION, RECORD_ID)
check("Second call returns a dict", isinstance(row2, dict) and bool(row2))
check("Same id returned (no duplicate inserted)", row2.get("id") == ITEM_ID)

# Confirm only one row exists in DB for this record+description
r_check = (
    supabase.table("care_plan")
    .select("id")
    .eq("source_record_id", RECORD_ID)
    .eq("description", DESCRIPTION)
    .execute()
)
check("Exactly one DB row after two identical calls", len(r_check.data) == 1)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 4. get_care_plan_items: returns inserted row ---{RESET}")
# ─────────────────────────────────────────────────────────────────

items = get_care_plan_items(PATIENT_ID)
check("Returns a list", isinstance(items, list))
check("At least one item returned", len(items) >= 1)
ids = [i["id"] for i in items]
check("Inserted item is in the list", ITEM_ID in ids)
newest = items[0]
check("Results are ordered newest-first (created_at desc)",
      newest.get("created_at") >= items[-1].get("created_at"))


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 5. update_care_plan_status: patient updates own item ---{RESET}")
# ─────────────────────────────────────────────────────────────────

result = update_care_plan_status(ITEM_ID, PATIENT_ID, "ongoing", "patient")
check("Returns a dict on success", isinstance(result, dict))
check("Status updated to 'ongoing'", result.get("status") == "ongoing")
check("id unchanged", result.get("id") == ITEM_ID)

# Confirm in DB
r_confirm = (
    supabase.table("care_plan")
    .select("status")
    .eq("id", ITEM_ID)
    .limit(1)
    .execute()
)
check("DB reflects updated status", r_confirm.data[0]["status"] == "ongoing")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 6. update_care_plan_status: wrong patient -> forbidden ---{RESET}")
# ─────────────────────────────────────────────────────────────────

result_forbidden = update_care_plan_status(ITEM_ID, OTHER_PAT, "completed", "patient")
check("Returns 'forbidden' for wrong patient", result_forbidden == "forbidden")

# Confirm status was NOT changed
r_unchanged = (
    supabase.table("care_plan")
    .select("status")
    .eq("id", ITEM_ID)
    .limit(1)
    .execute()
)
check("DB status unchanged after forbidden attempt",
      r_unchanged.data[0]["status"] == "ongoing")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 7. update_care_plan_status: not_found ---{RESET}")
# ─────────────────────────────────────────────────────────────────

fake_id = str(uuid.uuid4())
result_nf = update_care_plan_status(fake_id, PATIENT_ID, "completed", "patient")
check("Returns 'not_found' for unknown item_id", result_nf == "not_found")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 8. Follow-up loop: multiple follow-ups from one record ---{RESET}")
# ─────────────────────────────────────────────────────────────────

FOLLOW_UPS = [
    f"[smoke-loop-1] Return in 4 weeks — {uuid.uuid4().hex[:6]}",
    f"[smoke-loop-2] Cardiology referral — {uuid.uuid4().hex[:6]}",
    f"[smoke-loop-3] Repeat HbA1c test — {uuid.uuid4().hex[:6]}",
]
LOOP_RECORD_ID = str(uuid.uuid4())  # fake record_id (no FK constraint violation since it's nullable's cousin)

# Simulate exactly what upload.py does: loop with individual try/except
loop_created = []
for follow_up_text in FOLLOW_UPS:
    try:
        item = create_care_plan_item(
            patient_id=PATIENT_ID,
            description=follow_up_text,
            source_record_id=RECORD_ID,   # use real RECORD_ID so FK is valid
        )
        if item:
            loop_created.append(item["id"])
            created_ids.append(item["id"])
    except Exception as exc:
        print(f"    WARNING: {exc}")

check("All 3 follow-up items created", len(loop_created) == 3,
      detail=f"created {len(loop_created)}/3")
check("All 3 have unique IDs", len(set(loop_created)) == 3)

# Verify all appear in get_care_plan_items
items_after = get_care_plan_items(PATIENT_ID)
ids_after = {i["id"] for i in items_after}
check("All loop items visible in GET",
      all(cid in ids_after for cid in loop_created))

# Re-run loop (idempotency): count should not increase
loop_rerun = []
for follow_up_text in FOLLOW_UPS:
    item = create_care_plan_item(PATIENT_ID, follow_up_text, RECORD_ID)
    if item:
        loop_rerun.append(item["id"])

check("Loop re-run: same IDs returned (no duplicates)",
      sorted(loop_rerun) == sorted(loop_created))

r_dedup = (
    supabase.table("care_plan")
    .select("id")
    .eq("source_record_id", RECORD_ID)
    .in_("description", FOLLOW_UPS)
    .execute()
)
check("DB row count unchanged after re-run (idempotency)",
      len(r_dedup.data) == 3,
      detail=f"found {len(r_dedup.data)} rows, expected 3")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 9. Cleanup: delete smoke-test rows ---{RESET}")
# ─────────────────────────────────────────────────────────────────

deleted = 0
for cid in set(created_ids):
    try:
        supabase.table("care_plan").delete().eq("id", cid).execute()
        deleted += 1
    except Exception as e:
        print(f"    WARNING: could not delete {cid}: {e}")

check(f"Cleaned up {deleted}/{len(set(created_ids))} smoke-test rows",
      deleted == len(set(created_ids)))


# ─────────────────────────────────────────────────────────────────
print(f"\n{'='*62}")
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"  {colour}{passed}/{total} checks passed{RESET}")
print(f"{'='*62}\n")

if failed:
    raise SystemExit(1)
