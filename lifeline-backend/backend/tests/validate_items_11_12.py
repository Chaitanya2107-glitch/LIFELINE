"""
Unit tests for Items 11-12: appointments module.

Covers:
  - Appointment, CreateAppointmentBody, UpdateAppointmentBody schemas
  - service: get_appointments, create_appointment, update_appointment, cancel_appointment
  - route authz matrix: GET, POST, PATCH, DELETE
  - app import + router registration

Run:
    venv/Scripts/python.exe -m tests.validate_items_11_12
"""

import asyncio
from unittest.mock import patch, MagicMock

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


PATIENT_ID = "d07a5673-b987-4138-b814-1393071110d3"
DOCTOR_ID  = 17
APPT_ROW   = {
    "id": "appt-uuid-1",
    "patient_id": PATIENT_ID,
    "doctor_id": DOCTOR_ID,
    "date": "2024-06-01",
    "time": "09:30",
    "location": "Ward 3",
    "type": "Follow-up",
    "notes": None,
    "status": "upcoming",
    "created_at": "2024-01-01T00:00:00+00:00",
}


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 1. Schema validation ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.schemas import Appointment, CreateAppointmentBody, UpdateAppointmentBody
from pydantic import ValidationError

# Appointment round-trip
appt = Appointment(**APPT_ROW)
check("Appointment parses all fields", appt.id == "appt-uuid-1")
check("Appointment.location nullable", appt.location == "Ward 3")
check("Appointment.notes nullable", appt.notes is None)

# CreateAppointmentBody
body = CreateAppointmentBody(
    patient_id=PATIENT_ID, date="2024-06-01", time="09:30",
    type="Follow-up", location="Ward 3", notes=None,
)
check("CreateAppointmentBody parses", body.patient_id == PATIENT_ID)
check("CreateAppointmentBody location optional", body.location == "Ward 3")
check("CreateAppointmentBody notes optional", body.notes is None)

# UpdateAppointmentBody — all fields optional
u_all = UpdateAppointmentBody(status="completed", notes="Done", location="Room 2")
check("UpdateAppointmentBody all fields", u_all.status == "completed")
u_none = UpdateAppointmentBody()
check("UpdateAppointmentBody all None (no-op)", u_none.status is None)

# UpdateAppointmentBody valid statuses
for s in ("upcoming", "completed", "cancelled"):
    ub = UpdateAppointmentBody(status=s)
    check(f"UpdateAppointmentBody accepts '{s}'", ub.status == s)

# Invalid status
try:
    UpdateAppointmentBody(status="invalid")
    check("UpdateAppointmentBody rejects 'invalid'", False, "no error raised")
except ValidationError:
    check("UpdateAppointmentBody rejects 'invalid'", True)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 2. Service: get_appointments ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.service import get_appointments

def _mock_select(rows):
    m = MagicMock()
    m.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = rows
    return m

# Patient path — queries on patient_id
with patch("app.appointments.service.supabase", _mock_select([APPT_ROW])):
    rows = get_appointments("patient", user_id=None, patient_id=PATIENT_ID)
    check("Patient GET returns list", isinstance(rows, list) and len(rows) == 1)
    check("Patient GET uses patient_id", rows[0]["patient_id"] == PATIENT_ID)

# Doctor path — queries on doctor_id
with patch("app.appointments.service.supabase", _mock_select([APPT_ROW])):
    rows = get_appointments("doctor", user_id=DOCTOR_ID)
    check("Doctor GET returns list", isinstance(rows, list) and len(rows) == 1)
    check("Doctor GET uses doctor_id", rows[0]["doctor_id"] == DOCTOR_ID)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 3. Service: create_appointment ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.service import create_appointment

with patch("app.appointments.service.supabase") as mock_supa:
    mock_supa.table.return_value.insert.return_value.execute.return_value.data = [APPT_ROW]
    result = create_appointment(DOCTOR_ID, {
        "patient_id": PATIENT_ID, "date": "2024-06-01", "time": "09:30",
        "type": "Follow-up", "location": "Ward 3", "notes": None,
    })
    check("create_appointment returns row", isinstance(result, dict))
    check("doctor_id fixed from JWT (not body)",
          mock_supa.table.return_value.insert.call_args[0][0]["doctor_id"] == DOCTOR_ID)
    check("status always 'upcoming'",
          mock_supa.table.return_value.insert.call_args[0][0]["status"] == "upcoming")
    check("patient_id from body",
          mock_supa.table.return_value.insert.call_args[0][0]["patient_id"] == PATIENT_ID)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 4. Service: update_appointment ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.service import update_appointment

def _mock_for_update(appt_row, updated_row=None):
    m = MagicMock()
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [appt_row] if appt_row else []
    )
    m.table.return_value.update.return_value.eq.return_value.execute.return_value.data = (
        [updated_row or appt_row]
    )
    return m

# not_found
with patch("app.appointments.service.supabase", _mock_for_update(None)):
    r = update_appointment("x", "doctor", DOCTOR_ID, {"status": "completed"})
    check("update: not_found when missing", r == "not_found")

# Doctor owns it
updated_row = {**APPT_ROW, "status": "completed"}
with patch("app.appointments.service.supabase", _mock_for_update(APPT_ROW, updated_row)):
    r = update_appointment("appt-uuid-1", "doctor", DOCTOR_ID, {"status": "completed"})
    check("Doctor can update own appointment", isinstance(r, dict))
    check("Updated status returned", r.get("status") == "completed")

# Doctor forbidden on someone else's appointment
other_appt = {**APPT_ROW, "doctor_id": 999}
with patch("app.appointments.service.supabase", _mock_for_update(other_appt)):
    r = update_appointment("appt-uuid-1", "doctor", DOCTOR_ID, {"status": "completed"})
    check("Doctor forbidden on another doctor's appointment", r == "forbidden")

# Patient owns it
pat_appt = {**APPT_ROW}
updated_pat = {**APPT_ROW, "notes": "new note"}
with patch("app.appointments.service.supabase", _mock_for_update(pat_appt, updated_pat)):
    r = update_appointment("appt-uuid-1", "patient", PATIENT_ID, {"notes": "new note"})
    check("Patient can update own appointment", isinstance(r, dict))

# Patient forbidden on another patient's appointment
other_pat_appt = {**APPT_ROW, "patient_id": "other-pat"}
with patch("app.appointments.service.supabase", _mock_for_update(other_pat_appt)):
    r = update_appointment("appt-uuid-1", "patient", PATIENT_ID, {"status": "completed"})
    check("Patient forbidden on another patient's appointment", r == "forbidden")

# Empty payload — returns current row unchanged (no DB update call)
with patch("app.appointments.service.supabase") as mock_supa:
    mock_supa.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [APPT_ROW]
    r = update_appointment("appt-uuid-1", "doctor", DOCTOR_ID, {})
    check("Empty payload: no DB update, returns current row", r == APPT_ROW)
    mock_supa.table.return_value.update.assert_not_called()


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 5. Service: cancel_appointment ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.service import cancel_appointment

cancelled_row = {**APPT_ROW, "status": "cancelled"}

# Doctor cancels own
with patch("app.appointments.service.supabase", _mock_for_update(APPT_ROW, cancelled_row)):
    r = cancel_appointment("appt-uuid-1", "doctor", DOCTOR_ID)
    check("Doctor can cancel own appointment", isinstance(r, dict))
    check("Cancelled status returned", r.get("status") == "cancelled")

# Patient cancels own
with patch("app.appointments.service.supabase", _mock_for_update(APPT_ROW, cancelled_row)):
    r = cancel_appointment("appt-uuid-1", "patient", PATIENT_ID)
    check("Patient can cancel own appointment", isinstance(r, dict))

# not_found
with patch("app.appointments.service.supabase", _mock_for_update(None)):
    r = cancel_appointment("x", "doctor", DOCTOR_ID)
    check("cancel: not_found when missing", r == "not_found")

# forbidden
with patch("app.appointments.service.supabase", _mock_for_update({**APPT_ROW, "doctor_id": 999})):
    r = cancel_appointment("appt-uuid-1", "doctor", DOCTOR_ID)
    check("cancel: forbidden for wrong doctor", r == "forbidden")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 6. Routes: GET /appointments authz ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from fastapi import HTTPException
from app.appointments.routes import get_appointments as route_get

# Patient gets own
with patch("app.appointments.routes.appt_service.get_appointments", return_value=[APPT_ROW]):
    r = route_get({"role": "patient", "patient_id": PATIENT_ID})
    check("GET: patient returns list", isinstance(r, list))

# Doctor gets own (no consent required)
with patch("app.appointments.routes.appt_service.get_appointments", return_value=[APPT_ROW]):
    r = route_get({"role": "doctor", "user_id": DOCTOR_ID})
    check("GET: doctor returns list (no consent needed)", isinstance(r, list))

# Clerk -> 403
try:
    route_get({"role": "clerk", "user_id": 5})
    check("GET: clerk gets 403", False)
except HTTPException as e:
    check("GET: clerk gets 403", e.status_code == 403)

# Unknown role -> 403
try:
    route_get({"role": "unknown"})
    check("GET: unknown role gets 403", False)
except HTTPException as e:
    check("GET: unknown role gets 403", e.status_code == 403)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 7. Routes: POST /appointments authz ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.routes import create_appointment as route_create

body_obj = CreateAppointmentBody(
    patient_id=PATIENT_ID, date="2024-06-01", time="09:30", type="Follow-up",
)

# Non-doctor -> 403
for role, extra in [("patient", {"patient_id": PATIENT_ID}), ("clerk", {"user_id": 5})]:
    try:
        route_create(body_obj, {"role": role, **extra})
        check(f"POST: {role} gets 403", False)
    except HTTPException as e:
        check(f"POST: {role} gets 403", e.status_code == 403)

# Doctor without consent -> 403
with patch("app.appointments.routes.check_doctor_consent", return_value=False):
    try:
        route_create(body_obj, {"role": "doctor", "user_id": DOCTOR_ID})
        check("POST: doctor without consent gets 403", False)
    except HTTPException as e:
        check("POST: doctor without consent gets 403", e.status_code == 403)

# Doctor with consent -> 201
with patch("app.appointments.routes.check_doctor_consent", return_value=True):
    with patch("app.appointments.routes.appt_service.create_appointment", return_value=APPT_ROW):
        r = route_create(body_obj, {"role": "doctor", "user_id": DOCTOR_ID})
        check("POST: doctor with consent -> appointment returned", r["id"] == "appt-uuid-1")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 8. Routes: PATCH + DELETE authz ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.appointments.routes import update_appointment as route_patch
from app.appointments.routes import cancel_appointment as route_delete

patch_body = UpdateAppointmentBody(status="completed")

# Clerk -> 403 on PATCH
try:
    route_patch("appt-1", patch_body, {"role": "clerk", "user_id": 5})
    check("PATCH: clerk gets 403", False)
except HTTPException as e:
    check("PATCH: clerk gets 403", e.status_code == 403)

# not_found -> 404
with patch("app.appointments.routes.appt_service.update_appointment", return_value="not_found"):
    try:
        route_patch("appt-1", patch_body, {"role": "doctor", "user_id": DOCTOR_ID})
        check("PATCH: not_found -> 404", False)
    except HTTPException as e:
        check("PATCH: not_found -> 404", e.status_code == 404)

# forbidden -> 403
with patch("app.appointments.routes.appt_service.update_appointment", return_value="forbidden"):
    try:
        route_patch("appt-1", patch_body, {"role": "doctor", "user_id": DOCTOR_ID})
        check("PATCH: forbidden -> 403", False)
    except HTTPException as e:
        check("PATCH: forbidden -> 403", e.status_code == 403)

# Success
with patch("app.appointments.routes.appt_service.update_appointment", return_value={**APPT_ROW, "status": "completed"}):
    r = route_patch("appt-1", patch_body, {"role": "doctor", "user_id": DOCTOR_ID})
    check("PATCH: success returns appointment", r["status"] == "completed")

# Clerk -> 403 on DELETE
try:
    route_delete("appt-1", {"role": "clerk", "user_id": 5})
    check("DELETE: clerk gets 403", False)
except HTTPException as e:
    check("DELETE: clerk gets 403", e.status_code == 403)

# DELETE not_found -> 404
with patch("app.appointments.routes.appt_service.cancel_appointment", return_value="not_found"):
    try:
        route_delete("appt-1", {"role": "doctor", "user_id": DOCTOR_ID})
        check("DELETE: not_found -> 404", False)
    except HTTPException as e:
        check("DELETE: not_found -> 404", e.status_code == 404)

# DELETE success
with patch("app.appointments.routes.appt_service.cancel_appointment", return_value={**APPT_ROW, "status": "cancelled"}):
    r = route_delete("appt-1", {"role": "doctor", "user_id": DOCTOR_ID})
    check("DELETE: success returns cancelled appointment", r["status"] == "cancelled")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 9. App import + router registration ---{RESET}")
# ─────────────────────────────────────────────────────────────────

from app.main import app, appointments_router

check("app.main imports without error", True)
check("appointments_router imported into main.py", appointments_router is not None)

cp_paths = {
    (getattr(r, "path", ""), frozenset(getattr(r, "methods", [])))
    for r in appointments_router.routes
}
check("GET /appointments on router",
      ("/appointments", frozenset({"GET"})) in cp_paths,
      detail=str(cp_paths))
check("POST /appointments on router",
      ("/appointments", frozenset({"POST"})) in cp_paths,
      detail=str(cp_paths))
check("PATCH /appointments/{appt_id} on router",
      ("/appointments/{appt_id}", frozenset({"PATCH"})) in cp_paths,
      detail=str(cp_paths))
check("DELETE /appointments/{appt_id} on router",
      ("/appointments/{appt_id}", frozenset({"DELETE"})) in cp_paths,
      detail=str(cp_paths))


# ─────────────────────────────────────────────────────────────────
print(f"\n{'='*62}")
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"  {colour}{passed}/{total} tests passed{RESET}")
print(f"{'='*62}\n")

if failed:
    raise SystemExit(1)
