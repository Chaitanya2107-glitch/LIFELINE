"""Appointments service.

All Supabase interactions for the appointments table.
HTTP concerns stay in routes — this service returns data or sentinel strings.

Public API:
    get_appointments(role, user_id, patient_id)  -> list[dict]
    create_appointment(doctor_id, data)           -> dict
    update_appointment(appt_id, role, user_id, payload) -> dict | str
    cancel_appointment(appt_id, role, user_id)   -> dict | str
"""

from app.database.supabase import supabase
from app.utils.logger import logger


# ──────────────────────────────────────────────
# Query
# ──────────────────────────────────────────────

def get_appointments(role: str, user_id, patient_id: str | None = None) -> list[dict]:
    """Return appointments scoped to the caller.

    - patient: all appointments where patient_id matches the JWT patient_id.
    - doctor:  all appointments where doctor_id matches the JWT user_id.

    The patient_id argument is only used for the patient path (it comes from
    the JWT, not a query param, so it is always the caller's own patient_id).
    doctor_id comes from user_id for the doctor path.
    """
    query = supabase.table("appointments").select("*")

    if role == "patient":
        query = query.eq("patient_id", patient_id)
    else:
        # doctor
        query = query.eq("doctor_id", user_id)

    response = query.order("date", desc=False).execute()
    return response.data


# ──────────────────────────────────────────────
# Create
# ──────────────────────────────────────────────

def create_appointment(doctor_id: int, data: dict) -> dict:
    """Insert a new appointment row and return it.

    doctor_id comes from the JWT (not the request body) so it cannot be
    spoofed by the caller.
    """
    payload = {
        "patient_id": data["patient_id"],
        "doctor_id":  doctor_id,
        "date":       data["date"],
        "time":       data["time"],
        "type":       data["type"],
        "location":   data.get("location"),
        "notes":      data.get("notes"),
        "status":     "upcoming",
    }

    response = supabase.table("appointments").insert(payload).execute()
    row = response.data[0]

    logger.info(
        "Appointment created | id={} | doctor_id={} | patient_id={}",
        row["id"],
        doctor_id,
        data["patient_id"],
    )
    return row


# ──────────────────────────────────────────────
# Update
# ──────────────────────────────────────────────

def update_appointment(
    appt_id: str,
    role: str,
    user_id,
    payload: dict,
) -> dict | str:
    """Update status, notes, and/or location on an appointment.

    Ownership rules:
      - doctor:  must be the appointment's doctor_id.
      - patient: must be the appointment's patient_id.

    Returns:
        dict         — updated row on success.
        "not_found"  — appt_id does not exist.
        "forbidden"  — caller does not own this appointment.
    """
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

    # Build update dict — only include fields that were explicitly supplied
    update: dict = {}
    if "status" in payload and payload["status"] is not None:
        update["status"] = payload["status"]
    if "notes" in payload and payload["notes"] is not None:
        update["notes"] = payload["notes"]
    if "location" in payload and payload["location"] is not None:
        update["location"] = payload["location"]

    if not update:
        # Nothing to update — return current row unchanged
        return appt

    updated = (
        supabase.table("appointments")
        .update(update)
        .eq("id", appt_id)
        .execute()
    )
    return updated.data[0]


# ──────────────────────────────────────────────
# Cancel (DELETE semantics — sets status)
# ──────────────────────────────────────────────

def cancel_appointment(appt_id: str, role: str, user_id) -> dict | str:
    """Set an appointment's status to 'cancelled'.

    Ownership rules match update_appointment.

    Returns:
        dict         — updated row on success.
        "not_found"  — appt_id does not exist.
        "forbidden"  — caller does not own this appointment.
    """
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

    updated = (
        supabase.table("appointments")
        .update({"status": "cancelled"})
        .eq("id", appt_id)
        .execute()
    )
    return updated.data[0]
