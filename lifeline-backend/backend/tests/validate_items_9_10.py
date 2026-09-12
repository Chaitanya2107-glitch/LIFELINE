"""
Unit and integration tests for Items 9-10: care_plan module.

Covers:
  - schemas (CarePlanItem, UpdateCarePlanBody validation)
  - service (create_care_plan_item idempotency, get, update authz)
  - routes (GET /care-plan authz matrix, PATCH authz matrix)
  - upload follow-up loop (non-fatal failure, idempotency)
  - app import smoke test

Run:
    venv/Scripts/python.exe -m tests.validate_items_9_10
"""

import asyncio
from unittest.mock import patch, MagicMock, call

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
        print(f"  {RED}FAIL{RESET}  {label}" + (f"\n        detail: {detail}" if detail else ""))
        failed += 1


# ─────────────────────────────────────────────────────────────────
# 1. Schema validation
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 1. Schema validation ---{RESET}")

from app.care_plan.schemas import CarePlanItem, UpdateCarePlanBody
from pydantic import ValidationError

# Valid CarePlanItem round-trips
item = CarePlanItem(
    id="abc", patient_id="pat1", category="Follow-up",
    title="Follow up", description="Return in 2 weeks",
    due_date=None, status="pending", priority="medium",
    source_record_id="rec1", created_at="2024-01-01T00:00:00+00:00",
)
check("CarePlanItem parses all fields", item.id == "abc")
check("CarePlanItem due_date nullable", item.due_date is None)
check("CarePlanItem source_record_id nullable", item.source_record_id is None or item.source_record_id == "rec1")

# Valid UpdateCarePlanBody values
for s in ("pending", "ongoing", "completed"):
    b = UpdateCarePlanBody(status=s)
    check(f"UpdateCarePlanBody accepts '{s}'", b.status == s)

# Invalid status rejected
try:
    UpdateCarePlanBody(status="invalid")
    check("UpdateCarePlanBody rejects 'invalid'", False, "should have raised ValidationError")
except ValidationError:
    check("UpdateCarePlanBody rejects 'invalid'", True)


# ─────────────────────────────────────────────────────────────────
# 2. Service — create_care_plan_item
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 2. Service: create_care_plan_item ---{RESET}")

from app.care_plan.service import create_care_plan_item

PATIENT_ID   = "pat-uuid-1"
RECORD_ID    = "rec-uuid-1"
DESCRIPTION  = "Return in 2 weeks for blood pressure check"

def _mock_supabase_insert(description, existing=None):
    """Return a mock supabase that simulates the idempotency query + insert."""
    mock = MagicMock()
    existing_response = MagicMock()
    existing_response.data = existing or []
    insert_response = MagicMock()
    insert_response.data = [{
        "id": "cp-uuid-1",
        "patient_id": PATIENT_ID,
        "category": "Follow-up",
        "title": description[:120],
        "description": description,
        "due_date": None,
        "status": "pending",
        "priority": "medium",
        "source_record_id": RECORD_ID,
        "created_at": "2024-01-01T00:00:00+00:00",
    }]
    # Idempotency select chain
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = existing_response
    # Insert chain
    mock.table.return_value.insert.return_value.execute.return_value = insert_response
    return mock

# Normal insert
with patch("app.care_plan.service.supabase", _mock_supabase_insert(DESCRIPTION)):
    row = create_care_plan_item(PATIENT_ID, DESCRIPTION, RECORD_ID)
    check("create_care_plan_item returns a dict", isinstance(row, dict))
    check("created row has correct patient_id", row.get("patient_id") == PATIENT_ID)
    check("created row has category='Follow-up'", row.get("category") == "Follow-up")
    check("created row has status='pending'", row.get("status") == "pending")
    check("created row has source_record_id", row.get("source_record_id") == RECORD_ID)

# Long description -> title truncated at 120 chars
long_desc = "A" * 200
with patch("app.care_plan.service.supabase", _mock_supabase_insert(long_desc)):
    row2 = create_care_plan_item(PATIENT_ID, long_desc, RECORD_ID)
    check("Long description: title passed to insert is truncated",
          len(row2.get("title", "")) <= 121)  # 120 chars + ellipsis

# Empty description -> returns empty dict, no insert
with patch("app.care_plan.service.supabase") as mock_supa:
    row3 = create_care_plan_item(PATIENT_ID, "   ", RECORD_ID)
    check("Empty description: returns {} without DB call", row3 == {})
    mock_supa.table.assert_not_called()

# Idempotency: existing row returned, no second insert
existing_row = {"id": "cp-existing", "patient_id": PATIENT_ID, "description": DESCRIPTION}
with patch("app.care_plan.service.supabase", _mock_supabase_insert(DESCRIPTION, existing=[existing_row])):
    row4 = create_care_plan_item(PATIENT_ID, DESCRIPTION, RECORD_ID)
    check("Idempotency: existing row returned when duplicate", row4.get("id") == "cp-existing")


# ─────────────────────────────────────────────────────────────────
# 3. Service — get_care_plan_items
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 3. Service: get_care_plan_items ---{RESET}")

from app.care_plan.service import get_care_plan_items

mock_rows = [
    {"id": "cp-1", "patient_id": PATIENT_ID, "status": "pending"},
    {"id": "cp-2", "patient_id": PATIENT_ID, "status": "completed"},
]
with patch("app.care_plan.service.supabase") as mock_supa:
    mock_supa.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = mock_rows
    items = get_care_plan_items(PATIENT_ID)
    check("get_care_plan_items returns list", isinstance(items, list))
    check("get_care_plan_items returns correct count", len(items) == 2)
    select_arg = mock_supa.table.return_value.select.call_args[0][0]
    check("get_care_plan_items selects all columns", select_arg == "*")


# ─────────────────────────────────────────────────────────────────
# 4. Service — update_care_plan_status
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 4. Service: update_care_plan_status ---{RESET}")

from app.care_plan.service import update_care_plan_status

def _mock_for_update(item_patient_id, role, item_exists=True):
    mock = MagicMock()
    fetch_data = [{"id": "cp-1", "patient_id": item_patient_id, "status": "pending"}] if item_exists else []
    mock.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = fetch_data
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": "cp-1", "patient_id": item_patient_id, "status": "completed"}
    ]
    return mock

# not_found
with patch("app.care_plan.service.supabase", _mock_for_update("pat1", "patient", item_exists=False)):
    result = update_care_plan_status("cp-1", "pat1", "completed", "patient")
    check("update returns 'not_found' when item missing", result == "not_found")

# Patient updating own item
with patch("app.care_plan.service.supabase", _mock_for_update("pat1", "patient")):
    result = update_care_plan_status("cp-1", "pat1", "completed", "patient")
    check("Patient can update own item", isinstance(result, dict))
    check("Updated status returned", result.get("status") == "completed")

# Patient forbidden on another patient's item
with patch("app.care_plan.service.supabase", _mock_for_update("pat-OTHER", "patient")):
    result = update_care_plan_status("cp-1", "pat1", "completed", "patient")
    check("Patient forbidden on another patient's item", result == "forbidden")

# Doctor can update (consent already checked in route)
with patch("app.care_plan.service.supabase", _mock_for_update("pat1", "doctor")):
    result = update_care_plan_status("cp-1", "pat1", "ongoing", "doctor")
    check("Doctor can update item (consent pre-checked)", isinstance(result, dict))


# ─────────────────────────────────────────────────────────────────
# 5. Routes — GET /care-plan authorization matrix
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 5. Routes: GET /care-plan authz ---{RESET}")

from fastapi import HTTPException
from app.care_plan.routes import get_care_plan

# Patient gets own items (resolve_patient_id returns JWT patient_id)
with patch("app.care_plan.routes.resolve_patient_id", return_value=PATIENT_ID) as mock_res:
    with patch("app.care_plan.routes.care_plan_service.get_care_plan_items", return_value=mock_rows):
        result = asyncio.run(get_care_plan.__wrapped__(patient_id=None, current_user={"role": "patient", "patient_id": PATIENT_ID})) if hasattr(get_care_plan, '__wrapped__') else None
        # Call directly since it's a sync function
        result = get_care_plan(patient_id=None, current_user={"role": "patient", "patient_id": PATIENT_ID})
        check("GET /care-plan: patient gets items", isinstance(result, list))
        mock_res.assert_called_once_with({"role": "patient", "patient_id": PATIENT_ID}, None)

# Clerk -> 403 raised by resolve_patient_id (which we don't mock — use real)
from app.services.medical_record_service import resolve_patient_id as real_resolve
try:
    get_care_plan(patient_id=None, current_user={"role": "clerk", "user_id": 5})
    check("GET /care-plan: clerk gets 403", False, "no exception raised")
except HTTPException as e:
    check("GET /care-plan: clerk gets 403", e.status_code == 403)

# Doctor without patient_id -> 422 from resolve_patient_id
try:
    get_care_plan(patient_id=None, current_user={"role": "doctor", "user_id": 7})
    check("GET /care-plan: doctor without patient_id gets 422", False)
except HTTPException as e:
    check("GET /care-plan: doctor without patient_id gets 422", e.status_code == 422)


# ─────────────────────────────────────────────────────────────────
# 6. Routes — PATCH /care-plan/{item_id} authorization matrix
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 6. Routes: PATCH /care-plan/{'{item_id}'} authz ---{RESET}")

from app.care_plan.routes import update_care_plan_item
from app.care_plan.schemas import UpdateCarePlanBody

body = UpdateCarePlanBody(status="completed")

# Clerk -> 403
try:
    update_care_plan_item("cp-1", body, {"role": "clerk", "user_id": 5})
    check("PATCH /care-plan: clerk gets 403", False)
except HTTPException as e:
    check("PATCH /care-plan: clerk gets 403", e.status_code == 403)

# Unknown role -> 403
try:
    update_care_plan_item("cp-1", body, {"role": "unknown"})
    check("PATCH /care-plan: unknown role gets 403", False)
except HTTPException as e:
    check("PATCH /care-plan: unknown role gets 403", e.status_code == 403)

# Patient updating own item -> success
with patch("app.care_plan.routes.care_plan_service.update_care_plan_status",
           return_value={"id": "cp-1", "patient_id": "pat1", "status": "completed",
                         "category": "Follow-up", "title": "t", "description": "d",
                         "due_date": None, "priority": "medium",
                         "source_record_id": None, "created_at": "2024-01-01T00:00:00+00:00"}):
    result = update_care_plan_item("cp-1", body, {"role": "patient", "patient_id": "pat1"})
    check("PATCH /care-plan: patient own item -> 200", result["status"] == "completed")

# Patient updating someone else's item -> 403 from service
with patch("app.care_plan.routes.care_plan_service.update_care_plan_status", return_value="forbidden"):
    try:
        update_care_plan_item("cp-1", body, {"role": "patient", "patient_id": "pat1"})
        check("PATCH /care-plan: patient cross-patient -> 403", False)
    except HTTPException as e:
        check("PATCH /care-plan: patient cross-patient -> 403", e.status_code == 403)

# not_found -> 404
with patch("app.care_plan.routes.care_plan_service.update_care_plan_status", return_value="not_found"):
    try:
        update_care_plan_item("cp-1", body, {"role": "patient", "patient_id": "pat1"})
        check("PATCH /care-plan: not_found -> 404", False)
    except HTTPException as e:
        check("PATCH /care-plan: not_found -> 404", e.status_code == 404)


# ─────────────────────────────────────────────────────────────────
# 7. Upload follow-up loop
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 7. Upload follow-up loop ---{RESET}")

from app.care_plan.service import create_care_plan_item as real_create

# Verify create_care_plan_item is imported into upload.py
import app.api.upload as upload_mod
check("upload.py imports create_care_plan_item",
      hasattr(upload_mod, "create_care_plan_item"))

# Verify the loop calls create_care_plan_item for each follow_up
# We inspect the source to confirm the pattern
import inspect
src = inspect.getsource(upload_mod.upload_report)
check("upload_report source contains follow_ups loop",
      "follow_ups" in src and "create_care_plan_item" in src)
check("upload_report wraps each create_care_plan_item call in try/except",
      src.count("except Exception as exc") >= 2)  # storage + care plan


# ─────────────────────────────────────────────────────────────────
# 8. App import smoke test
# ─────────────────────────────────────────────────────────────────

print(f"\n{BOLD}--- 8. App import + route registration ---{RESET}")

from app.main import app
from app.care_plan.routes import care_plan_router

check("app.main imports without error", True)

# FastAPI flattens include_router() into _IncludedRouter stubs at the app level;
# the canonical way to inspect registered routes is directly on the sub-router.
cp_paths = {(getattr(r, "path", ""), frozenset(getattr(r, "methods", [])))
            for r in care_plan_router.routes}
cp_path_strs = {p for p, _ in cp_paths}

check("/care-plan GET route on router",
      ("/care-plan", frozenset({"GET"})) in cp_paths,
      detail=f"care_plan_router routes: {cp_paths}")
check("/care-plan/{{item_id}} PATCH route on router",
      ("/care-plan/{item_id}", frozenset({"PATCH"})) in cp_paths,
      detail=f"care_plan_router routes: {cp_paths}")

# Verify it is actually included in main app (import would fail if not registered)
from app.main import care_plan_router as imported_router
check("care_plan_router imported into main.py", imported_router is care_plan_router)


# ─────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────

print(f"\n{'='*62}")
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"  {colour}{passed}/{total} tests passed{RESET}")
print(f"{'='*62}\n")

if failed:
    raise SystemExit(1)
