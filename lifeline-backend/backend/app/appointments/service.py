"""Appointments service.

All Supabase interactions for the appointments table.
HTTP concerns stay in routes — this service returns data or sentinel strings.

Flow (patient requests, doctor confirms):
  1. Patient creates a request            -> status 'pending'
  2. Doctor approves with date/time/place -> 'upcoming'   (or declines -> 'rejected')
  3. Doctor marks the visit done          -> 'completed'
  Either side may cancel a pending/upcoming appointment -> 'cancelled'

Public API:
    list_doctors()                                       -> list[dict]
    get_appointments(role, user_id, patient_id)          -> list[dict]
    create_appointment(patient_id, data)                 -> dict | str
    update_appointment(appt_id, role, user_id, payload)  -> dict | str
    cancel_appointment(appt_id, role, user_id)           -> dict | str
"""

from app.database.supabase import supabase
from app.utils.logger import logger

ACTIVE_STATUSES = {"pending", "upcoming"}


# ──────────────────────────────────────────────
# Query
# ──────────────────────────────────────────────

def list_doctors() -> list[dict]:
    """Return every doctor account a patient can request an appointment with."""
    response = (
        supabase.table("users")
        .select("id, name, specialization")
        .eq("role", "doctor")
        .order("name", desc=False)
        .execute()
    )
    return response.data


def get_appointments(role: str, user_id, patient_id: str | None = None) -> list[dict]:
    """Return appointments scoped to the caller, with display names joined in.

    - patient: all appointments where patient_id matches the JWT patient_id.
    - doctor:  all appointments where doctor_id matches the JWT user_id.
    """
    query = (
        supabase.table("appointments")
        .select("*, users!doctor_id(name, specialization), patients(name, patient_code)")
    )

    if role == "patient":
        query = query.eq("patient_id", patient_id)
    else:
        # doctor
        query = query.eq("doctor_id", user_id)

    response = query.order("date", desc=False).execute()

    rows = []
    for row in response.data:
        doctor = row.pop("users", None) or {}
        patient = row.pop("patients", None) or {}
        row["doctor_name"] = doctor.get("name")
        row["doctor_specialization"] = doctor.get("specialization")
        row["patient_name"] = patient.get("name")
        row["patient_code"] = patient.get("patient_code")
        rows.append(row)
    return rows


# ──────────────────────────────────────────────
# Create
# ──────────────────────────────────────────────

def create_appointment(patient_id: str, data: dict) -> dict | str:
    """Insert a patient's appointment request and return it.

    patient_id comes from the JWT (not the request body) so it cannot be
    spoofed by the caller.

    Returns:
        dict                 — created row (status='pending').
        "doctor_not_found"   — doctor_id is not a doctor account.
        "duplicate_pending"  — patient already has a pending request with this doctor.
    """
    doctor = (
        supabase.table("users")
        .select("id")
        .eq("id", data["doctor_id"])
        .eq("role", "doctor")
        .limit(1)
        .execute()
    )
    if not doctor.data:
        return "doctor_not_found"

    existing = (
        supabase.table("appointments")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("doctor_id", data["doctor_id"])
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return "duplicate_pending"

    payload = {
        "patient_id": patient_id,
        "doctor_id":  data["doctor_id"],
        "date":       data["date"],
        "time":       data["time"],
        "type":       data["type"],
        "reason":     data.get("reason"),
        "status":     "pending",
    }

    response = supabase.table("appointments").insert(payload).execute()
    row = response.data[0]

    logger.info(
        "Appointment requested | id={} | doctor_id={} | patient_id={}",
        row["id"],
        data["doctor_id"],
        patient_id,
    )
    return row


# ──────────────────────────────────────────────
# Update
# ──────────────────────────────────────────────

def _get_owned(appt_id: str, role: str, user_id) -> dict | str:
    """Fetch an appointment and check the caller owns it."""
    result = (
        supabase.table("appointments")
        .select("*")
        .eq("id", appt_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return "not_found"

    appt = result.data[0]

    if role == "doctor" and appt["doctor_id"] != user_id:
        return "forbidden"
    if role == "patient" and appt["patient_id"] != user_id:
        return "forbidden"
    return appt


def _transition_error(role: str, current: str, new: str, merged: dict) -> str | None:
    """Return an error sentinel if role may not move current -> new, else None."""
    if new == current:
        return None
    if new == "cancelled":
        return None if current in ACTIVE_STATUSES else "invalid_transition"
    if role != "doctor":
        return "forbidden_transition"
    if new == "upcoming":
        if current != "pending":
            return "invalid_transition"
        if not (merged.get("date") and merged.get("time") and merged.get("location")):
            return "missing_schedule"
        return None
    if new == "rejected":
        return None if current == "pending" else "invalid_transition"
    if new == "completed":
        return None if current == "upcoming" else "invalid_transition"
    # 'pending' can never be set explicitly
    return "invalid_transition"


def update_appointment(
    appt_id: str,
    role: str,
    user_id,
    payload: dict,
) -> dict | str:
    """Update status and/or schedule details on an appointment.

    Ownership rules:
      - doctor:  must be the appointment's doctor_id.
      - patient: must be the appointment's patient_id.

    Returns:
        dict                   — updated row on success.
        "not_found"            — appt_id does not exist.
        "forbidden"            — caller does not own this appointment.
        "forbidden_transition" — role may not set that status / edit fields.
        "invalid_transition"   — status change not allowed from the current state.
        "missing_schedule"     — approval without date, time and location.
    """
    appt = _get_owned(appt_id, role, user_id)
    if isinstance(appt, str):
        return appt

    fields = {
        k: payload[k]
        for k in ("date", "time", "location", "notes")
        if payload.get(k) is not None
    }

    # Patients can only cancel; schedule details are the doctor's to set.
    if role == "patient" and fields:
        return "forbidden_transition"

    # Details can only change while the appointment is still active.
    if fields and appt["status"] not in ACTIVE_STATUSES:
        return "invalid_transition"

    new_status = payload.get("status")
    if new_status is not None:
        merged = {**appt, **fields}
        error = _transition_error(role, appt["status"], new_status, merged)
        if error:
            return error

    update: dict = dict(fields)
    if new_status is not None and new_status != appt["status"]:
        update["status"] = new_status

    if not update:
        # Nothing to update — return current row unchanged
        return appt

    updated = (
        supabase.table("appointments")
        .update(update)
        .eq("id", appt_id)
        .execute()
    )

    logger.info(
        "Appointment updated | id={} | role={} | fields={}",
        appt_id,
        role,
        sorted(update.keys()),
    )
    return updated.data[0]


# ──────────────────────────────────────────────
# Cancel (DELETE semantics — sets status)
# ──────────────────────────────────────────────

def cancel_appointment(appt_id: str, role: str, user_id) -> dict | str:
    """Set an appointment's status to 'cancelled'.

    Ownership rules match update_appointment. Only pending or upcoming
    appointments can be cancelled.

    Returns:
        dict                 — updated row on success.
        "not_found"          — appt_id does not exist.
        "forbidden"          — caller does not own this appointment.
        "invalid_transition" — appointment is already completed/cancelled/rejected.
    """
    appt = _get_owned(appt_id, role, user_id)
    if isinstance(appt, str):
        return appt

    if appt["status"] not in ACTIVE_STATUSES:
        return "invalid_transition"

    updated = (
        supabase.table("appointments")
        .update({"status": "cancelled"})
        .eq("id", appt_id)
        .execute()
    )
    return updated.data[0]
