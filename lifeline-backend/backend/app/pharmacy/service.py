"""Pharmacy service.

All Supabase interactions for the prescription_status and dispense_events tables.
HTTP concerns stay in routes — this service returns typed data and sentinel strings.

Prescription lifecycle:
  prescribed  — created automatically when an uploaded record has medicines
  dispensed   — set by a pharmacist via dispense()
  ('sent_to_pharmacy' is allowed by the schema but not yet set by any flow.)
"""

from datetime import datetime, timezone
from typing import Literal

from app.database.supabase import supabase
from app.services.audit_service import write_access_log
from app.services.medical_record_service import check_doctor_consent
from app.utils.logger import logger

DispenseError = Literal["not_found", "already_dispensed"]


# ──────────────────────────────────────────────
# Consent Check Helper
# ──────────────────────────────────────────────

def check_pharmacy_consent(pharmacist_id: int, patient_id: str) -> bool:
    """Return True if the pharmacist holds an approved, unexpired consent for this patient.

    Pharmacists use the same consent_requests table as doctors (the
    doctor_id column holds the requester's users.id), so the check is
    identical to check_doctor_consent().
    """
    return check_doctor_consent(pharmacist_id, patient_id)


# ──────────────────────────────────────────────
# Prescription creation (called from the upload pipeline)
# ──────────────────────────────────────────────

def create_prescription_for_record(medical_record_id: str) -> dict:
    """Insert a 'prescribed' prescription_status row for a medical record."""
    response = (
        supabase
        .table("prescription_status")
        .insert({"medical_record_id": medical_record_id, "status": "prescribed"})
        .execute()
    )
    row = response.data[0]
    logger.info(
        "Prescription created | id={} | medical_record_id={}",
        row["id"],
        medical_record_id,
    )
    return row


# ──────────────────────────────────────────────
# Prescription Queries
# ──────────────────────────────────────────────

def get_prescription_status_by_id(prescription_status_id: str) -> dict | None:
    """Return a prescription_status row with its record's patient_id and medicines, or None."""
    response = (
        supabase
        .table("prescription_status")
        .select("*, medical_records(patient_id, medicines)")
        .eq("id", prescription_status_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def get_prescriptions_for_patient(patient_id: str) -> list[dict]:
    """Return all prescriptions for a patient, joined with medicines from medical_records.

    Prescription status rows are joined with the linked medical_records row
    filtered by patient_id, ordered newest first.
    """
    response = (
        supabase
        .table("prescription_status")
        .select(
            "id, medical_record_id, status, created_at, updated_at, "
            "medical_records!inner(id, patient_id, medicines, report_type, "
            "created_at, users!uploaded_by(name))"
        )
        .eq("medical_records.patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )

    prescriptions = []
    for row in response.data:
        item = dict(row)
        mr = item.pop("medical_records", None)
        if isinstance(mr, list):
            mr = mr[0] if mr else {}
        mr = mr or {}
        uploader = mr.get("users") or {}

        item["medicines"] = mr.get("medicines") or []
        item["patient_id"] = mr.get("patient_id", patient_id)
        item["report_type"] = mr.get("report_type")
        item["record_date"] = mr.get("created_at")
        item["prescribed_by"] = uploader.get("name")
        prescriptions.append(item)

    return prescriptions


def get_dispense_history(pharmacist_id: int) -> list[dict]:
    """Return every dispense event recorded by this pharmacist, newest first."""
    response = (
        supabase
        .table("dispense_events")
        .select("*, patients(name, patient_code)")
        .eq("pharmacist_id", pharmacist_id)
        .order("dispensed_at", desc=True)
        .execute()
    )
    rows = []
    for row in response.data:
        patient = row.pop("patients", None) or {}
        row["patient_name"] = patient.get("name")
        row["patient_code"] = patient.get("patient_code")
        rows.append(row)
    return rows


# ──────────────────────────────────────────────
# Dispense Operations
# ──────────────────────────────────────────────

def dispense(
    prescription_status_id: str,
    pharmacist_id: int,
    patient_id: str,
    items: list,
) -> tuple[dict | None, DispenseError | None]:
    """Record a dispense event, update prescription_status, and write audit log.

    Args:
        prescription_status_id: UUID of the prescription_status row.
        pharmacist_id:          users.id of the authenticated pharmacist.
        patient_id:             UUID of the patient (must own the prescription).
        items:                  Medicines being dispensed; defaults to the
                                record's medicines when empty.

    Returns:
        (dispense_event_row, None)   on success.
        (None, "not_found")          if the prescription does not exist or
                                     belongs to a different patient.
        (None, "already_dispensed")  if it was already dispensed.
    """
    existing = get_prescription_status_by_id(prescription_status_id)
    if existing is None:
        return None, "not_found"

    record = existing.get("medical_records") or {}
    if isinstance(record, list):
        record = record[0] if record else {}

    # The consent check in routes covers body.patient_id — make sure the
    # prescription really belongs to that patient.
    if record.get("patient_id") != patient_id:
        return None, "not_found"

    if existing.get("status") == "dispensed":
        return None, "already_dispensed"

    if not items:
        items = record.get("medicines") or []

    now_iso = datetime.now(tz=timezone.utc).isoformat()

    # Conditional update guards against two pharmacists dispensing at once.
    updated = (
        supabase
        .table("prescription_status")
        .update({"status": "dispensed", "updated_at": now_iso})
        .eq("id", prescription_status_id)
        .neq("status", "dispensed")
        .execute()
    )
    if not updated.data:
        return None, "already_dispensed"

    # Insert dispense_events row
    dispense_payload = {
        "prescription_status_id": prescription_status_id,
        "pharmacist_id": pharmacist_id,
        "patient_id": patient_id,
        "items": items,
        "dispensed_at": now_iso,
    }

    event_res = (
        supabase
        .table("dispense_events")
        .insert(dispense_payload)
        .execute()
    )

    event_row = event_res.data[0]

    # Write access log (audit trail)
    write_access_log(
        actor_role="pharmacist",
        action="dispensed",
        actor_user_id=pharmacist_id,
        patient_id=patient_id,
        metadata={
            "prescription_status_id": prescription_status_id,
            "dispense_event_id": event_row["id"],
            "items": items,
        },
    )

    logger.info(
        "Prescription dispensed | id={} | prescription_status_id={} | pharmacist_id={} | patient_id={}",
        event_row["id"],
        prescription_status_id,
        pharmacist_id,
        patient_id,
    )

    return event_row, None
