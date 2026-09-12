"""Consent service.

All Supabase interactions for the consent_requests table.
HTTP concerns (HTTPException) stay in routes — this service returns
typed values and error-code strings so routes can map them to status codes.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from app.database.supabase import supabase
from app.models.consent import ConsentRecord
from app.patients.service import get_patient_by_id
from app.services.audit_service import write_access_log
from app.utils.logger import logger

# Error sentinel strings returned by respond_to_consent
ConsentError = Literal["not_found", "forbidden", "already_responded"]


# ──────────────────────────────────────────────
# Consent CRUD
# ──────────────────────────────────────────────

def request_consent(
    doctor_id: int,
    patient_id: str,
) -> ConsentRecord | None:
    """Doctor requests access to a patient's medical history.

    SELECT-first idempotency (Gap 2):
      If a pending consent row already exists for this doctor+patient pair,
      return it without inserting a new row.
      (The idx_consent_unique_pending partial index enforces this at DB level
      too, but SELECT-first avoids triggering a constraint error.)

    Returns the ConsentRecord (new or existing pending), or None if the
    patient does not exist.
    """
    patient = get_patient_by_id(patient_id)
    if patient is None:
        return None

    # Check for an existing pending row first
    existing = (
        supabase
        .table("consent_requests")
        .select("*")
        .eq("doctor_id", doctor_id)
        .eq("patient_id", patient_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )

    if existing.data:
        logger.info(
            "Consent request already pending | doctor_id={} | patient_id={}",
            doctor_id,
            patient_id,
        )
        return existing.data[0]

    # No existing pending row — insert a new one
    response = (
        supabase
        .table("consent_requests")
        .insert({
            "doctor_id": doctor_id,
            "patient_id": patient_id,
            "status": "pending",
        })
        .execute()
    )

    row = response.data[0]

    logger.info(
        "Consent request created | id={} | doctor_id={} | patient_id={}",
        row["id"],
        doctor_id,
        patient_id,
    )

    write_access_log(
        actor_role="doctor",
        action="consent_requested",
        actor_user_id=doctor_id,
        patient_id=patient_id,
        metadata={"consent_id": row["id"]},
    )

    return row


def get_pending_consents_for_patient(
    patient_id: str,
) -> list[ConsentRecord]:
    """Return all pending consent requests for this patient, oldest first."""
    response = (
        supabase
        .table("consent_requests")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("status", "pending")
        .order("requested_at", desc=False)
        .execute()
    )
    return response.data


def get_consents_for_doctor(doctor_id: int) -> list[ConsentRecord]:
    """Return all consent requests made by this doctor, newest first."""
    response = (
        supabase
        .table("consent_requests")
        .select("*")
        .eq("doctor_id", doctor_id)
        .order("requested_at", desc=True)
        .execute()
    )
    return response.data


def get_consent_by_id(consent_id: str) -> ConsentRecord | None:
    """Return a single consent_requests row by UUID, or None."""
    response = (
        supabase
        .table("consent_requests")
        .select("*")
        .eq("id", consent_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def respond_to_consent(
    consent_id: str,
    patient_id: str,
    action: str,
    duration_days: int,
) -> tuple[ConsentRecord | None, ConsentError | None]:
    """Patient approves or denies a pending consent request.

    Args:
        consent_id:    UUID of the consent_requests row.
        patient_id:    patient_id from the patient's JWT (used for ownership check).
        action:        'approved' or 'denied'.
        duration_days: Number of days the approved consent remains valid.
                       Ignored when action is 'denied'.

    Returns:
        (ConsentRecord, None)        on success.
        (None, "not_found")          if consent_id does not exist.
        (None, "forbidden")          if the row belongs to a different patient.
        (None, "already_responded")  if status is already 'approved' or 'denied'.
    """
    row = get_consent_by_id(consent_id)

    if row is None:
        return None, "not_found"

    if row["patient_id"] != patient_id:
        return None, "forbidden"

    if row["status"] != "pending":
        return None, "already_responded"

    now = datetime.now(tz=timezone.utc)
    now_iso = now.isoformat()

    update_payload: dict = {
        "status": action,
        "responded_at": now_iso,
    }

    if action == "approved":
        expires_at = (now + timedelta(days=duration_days)).isoformat()
        update_payload["expires_at"] = expires_at
    else:
        # denied: leave expires_at as NULL
        update_payload["expires_at"] = None

    updated = (
        supabase
        .table("consent_requests")
        .update(update_payload)
        .eq("id", consent_id)
        .execute()
    )

    updated_row = updated.data[0]

    logger.info(
        "Consent {} | id={} | patient_id={} | doctor_id={}",
        action,
        consent_id,
        patient_id,
        row["doctor_id"],
    )

    access_action = "consent_approved" if action == "approved" else "consent_denied"
    write_access_log(
        actor_role="patient",
        action=access_action,
        actor_patient_id=patient_id,
        patient_id=patient_id,
        metadata={
            "consent_id": consent_id,
            "doctor_id": row["doctor_id"],
        },
    )

    return updated_row, None
