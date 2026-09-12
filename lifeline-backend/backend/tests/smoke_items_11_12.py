"""
Live smoke tests for Items 11-12: appointments table + service + authz.
Runs directly against the real Supabase instance (no server needed).

Test fixtures used:
  Patient : d07a5673-b987-4138-b814-1393071110d3  (LFL-J6MTOC)
  Doctor  : id=17  (Dr Fixture, has approved consent for test patient)
  Doctor2 : id=1   (chaitanya, different doctor for cross-owner tests)

Tests:
  1. Schema: all 10 columns + index queries work
  2. create_appointment: real insert, fields correct
  3. get_appointments (patient path): sees own appointment
  4. get_appointments (doctor path): sees own appointment
  5. get_appointments (doctor path): does NOT return another doctor's appointment
  6. update_appointment: doctor updates own
  7. update_appointment: doctor forbidden on another doctor's appointment
  8. update_appointment: patient updates own
  9. update_appointment: patient forbidden on another patient's appointment
  10. cancel_appointment: sets status to 'cancelled'
  11. cancel_appointment: forbidden for wrong owner
  12. Cleanup: all test rows deleted

Usage:
    venv/Scripts/python.exe -m tests.smoke_items_11_12
"""

import uuid
from app.database.supabase import supabase
from app.appointments.service import (
    create_appointment,
    get_appointments,
    update_appointment,
    cancel_appointment,
)

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0
created_ids: list[str] = []

PATIENT_ID  = "d07a5673-b987-4138-b814-1393071110d3"
DOCTOR_ID   = 17   # Dr Fixture — has approved consent for PATIENT_ID
DOCTOR2_ID  = 1    # chaitanya — different doctor for cross-owner tests


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  {label}" + (f"\n        {detail}" if detail else ""))
        failed += 1


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 1. Schema: all columns + index queries ---{RESET}")
# ─────────────────────────────────────────────────────────────────

REQUIRED_COLS = {
    "id", "patient_id", "doctor_id", "date", "time",
    "location", "type", "notes", "status", "created_at",
}
present = set()
for col in REQUIRED_COLS:
    try:
        supabase.table("appointments").select(col).limit(1).execute()
        present.add(col)
    except Exception:
        pass

check("All 10 required columns present", present == REQUIRED_COLS,
      detail=f"missing: {REQUIRED_COLS - present}")

# Index-backed queries (patient_id and doctor_id)
r_pat = supabase.table("appointments").select("id").eq("patient_id", PATIENT_ID).execute()
check("patient_id index query works", isinstance(r_pat.data, list))

r_doc = supabase.table("appointments").select("id").eq("doctor_id", DOCTOR_ID).execute()
check("doctor_id index query works", isinstance(r_doc.data, list))


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 2. create_appointment: real insert ---{RESET}")
# ─────────────────────────────────────────────────────────────────

appt_data = {
    "patient_id": PATIENT_ID,
    "date":       "2026-12-01",
    "time":       "09:30",
    "type":       "Follow-up",
    "location":   "Ward 3",
    "notes":      None,
}
row = create_appointment(DOCTOR_ID, appt_data)
check("Row returned", isinstance(row, dict) and bool(row))
check("id is UUID", isinstance(row.get("id"), str) and len(row["id"]) == 36)
check("patient_id correct", row.get("patient_id") == PATIENT_ID)
check("doctor_id from JWT (not body)", row.get("doctor_id") == DOCTOR_ID)
check("date stored", row.get("date") == "2026-12-01")
check("time stored", row.get("time") == "09:30")
check("type stored", row.get("type") == "Follow-up")
check("location stored", row.get("location") == "Ward 3")
check("notes null", row.get("notes") is None)
check("status defaults to 'upcoming'", row.get("status") == "upcoming")
check("created_at set", bool(row.get("created_at")))

APPT_ID = row["id"]
created_ids.append(APPT_ID)
print(f"    Inserted appointments.id = {APPT_ID}")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 3. get_appointments: patient sees own ---{RESET}")
# ─────────────────────────────────────────────────────────────────

pat_appts = get_appointments("patient", user_id=None, patient_id=PATIENT_ID)
check("Patient GET returns list", isinstance(pat_appts, list))
pat_ids = {a["id"] for a in pat_appts}
check("Patient GET includes own appointment", APPT_ID in pat_ids)
check("All returned rows belong to this patient",
      all(a["patient_id"] == PATIENT_ID for a in pat_appts))


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 4. get_appointments: doctor sees own ---{RESET}")
# ─────────────────────────────────────────────────────────────────

doc_appts = get_appointments("doctor", user_id=DOCTOR_ID)
check("Doctor GET returns list", isinstance(doc_appts, list))
doc_ids = {a["id"] for a in doc_appts}
check("Doctor GET includes own appointment", APPT_ID in doc_ids)
check("All returned rows belong to this doctor",
      all(a["doctor_id"] == DOCTOR_ID for a in doc_appts))


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 5. get_appointments: doctor does NOT see other doctor's ---{RESET}")
# ─────────────────────────────────────────────────────────────────

doc2_appts = get_appointments("doctor", user_id=DOCTOR2_ID)
doc2_ids = {a["id"] for a in doc2_appts}
check("Doctor2 does not see Doctor1's appointment", APPT_ID not in doc2_ids)


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 6. update_appointment: doctor updates own ---{RESET}")
# ─────────────────────────────────────────────────────────────────

result = update_appointment(APPT_ID, "doctor", DOCTOR_ID, {"notes": "Patient confirmed"})
check("Doctor update returns dict", isinstance(result, dict))
check("notes updated", result.get("notes") == "Patient confirmed")
check("id unchanged", result.get("id") == APPT_ID)

# Verify in DB
r_db = supabase.table("appointments").select("notes").eq("id", APPT_ID).limit(1).execute()
check("DB reflects updated notes", r_db.data[0]["notes"] == "Patient confirmed")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 7. update_appointment: doctor forbidden on other's ---{RESET}")
# ─────────────────────────────────────────────────────────────────

r_forbidden = update_appointment(APPT_ID, "doctor", DOCTOR2_ID, {"notes": "sneaky"})
check("Doctor2 forbidden on Doctor1's appointment", r_forbidden == "forbidden")

# Verify notes NOT changed
r_still = supabase.table("appointments").select("notes").eq("id", APPT_ID).limit(1).execute()
check("DB notes unchanged after forbidden attempt", r_still.data[0]["notes"] == "Patient confirmed")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 8. update_appointment: patient updates own ---{RESET}")
# ─────────────────────────────────────────────────────────────────

r_pat_update = update_appointment(APPT_ID, "patient", PATIENT_ID, {"location": "Room 5"})
check("Patient update returns dict", isinstance(r_pat_update, dict))
check("location updated", r_pat_update.get("location") == "Room 5")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 9. update_appointment: patient forbidden on other's ---{RESET}")
# ─────────────────────────────────────────────────────────────────

OTHER_PATIENT = "00000000-0000-0000-0000-000000000099"
r_pat_forbidden = update_appointment(APPT_ID, "patient", OTHER_PATIENT, {"location": "Stolen"})
check("Patient forbidden on another patient's appointment", r_pat_forbidden == "forbidden")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 10. cancel_appointment: doctor cancels own ---{RESET}")
# ─────────────────────────────────────────────────────────────────

r_cancel = cancel_appointment(APPT_ID, "doctor", DOCTOR_ID)
check("Cancel returns dict", isinstance(r_cancel, dict))
check("status set to 'cancelled'", r_cancel.get("status") == "cancelled")

# Confirm in DB
r_db2 = supabase.table("appointments").select("status").eq("id", APPT_ID).limit(1).execute()
check("DB status is 'cancelled'", r_db2.data[0]["status"] == "cancelled")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 11. cancel_appointment: not_found + forbidden ---{RESET}")
# ─────────────────────────────────────────────────────────────────

r_nf = cancel_appointment(str(uuid.uuid4()), "doctor", DOCTOR_ID)
check("cancel: not_found for unknown id", r_nf == "not_found")

# Create a second appointment owned by doctor2 to test forbidden
appt2 = create_appointment(DOCTOR2_ID, {
    "patient_id": PATIENT_ID, "date": "2026-12-02",
    "time": "10:00", "type": "Consultation",
})
created_ids.append(appt2["id"])
r_forb = cancel_appointment(appt2["id"], "doctor", DOCTOR_ID)
check("cancel: forbidden when different doctor", r_forb == "forbidden")


# ─────────────────────────────────────────────────────────────────
print(f"\n{BOLD}--- 12. Cleanup ---{RESET}")
# ─────────────────────────────────────────────────────────────────

deleted = 0
for aid in set(created_ids):
    try:
        supabase.table("appointments").delete().eq("id", aid).execute()
        deleted += 1
    except Exception as e:
        print(f"    WARNING: could not delete {aid}: {e}")

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
