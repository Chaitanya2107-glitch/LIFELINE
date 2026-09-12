from datetime import datetime, timezone

from fastapi import HTTPException
from app.database.supabase import supabase


# ──────────────────────────────────────────────
# Medical record CRUD
# ──────────────────────────────────────────────

def get_record_by_hash(patient_id: str, report_hash: str):
    """Return an existing medical record matching patient + hash, or None.

    Used for deduplication at upload time.
    """
    response = (
        supabase
        .table("medical_records")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("report_hash", report_hash)
        .limit(1)
        .execute()
    )

    if response.data:
        return response.data[0]

    return None


def save_medical_record(record: dict):
    """Insert a new medical record row and return it."""
    response = (
        supabase
        .table("medical_records")
        .insert(record)
        .execute()
    )

    return response.data[0]


def get_all_medical_records(patient_id: str):
    """Return all medical records for a patient, newest first.

    Joins the users table on uploaded_by to include uploader_name.
    The join is a LEFT JOIN so records with no uploaded_by return
    uploader_name=None instead of being dropped.
    """
    response = (
        supabase
        .table("medical_records")
        .select("*, users!uploaded_by(name)")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )

    records = []
    for row in response.data:
        users_join = row.pop("users", None)
        row["uploader_name"] = users_join["name"] if users_join else None
        records.append(row)

    return records


# ──────────────────────────────────────────────
# Consent / access control helpers
# ──────────────────────────────────────────────

def check_doctor_consent(doctor_id: int, patient_id: str) -> bool:
    """Return True if the doctor holds an approved, unexpired consent for this patient.

    An approved consent row with no expires_at is treated as indefinitely valid.
    An approved consent row whose expires_at is in the past is treated as expired.
    """
    now_iso = datetime.now(tz=timezone.utc).isoformat()

    # First try: approved consent with no expiry set
    no_expiry = (
        supabase
        .table("consent_requests")
        .select("id")
        .eq("doctor_id", doctor_id)
        .eq("patient_id", patient_id)
        .eq("status", "approved")
        .is_("expires_at", "null")
        .limit(1)
        .execute()
    )

    if no_expiry.data:
        return True

    # Second try: approved consent that has not yet expired
    with_expiry = (
        supabase
        .table("consent_requests")
        .select("id")
        .eq("doctor_id", doctor_id)
        .eq("patient_id", patient_id)
        .eq("status", "approved")
        .gt("expires_at", now_iso)
        .limit(1)
        .execute()
    )

    return bool(with_expiry.data)


def resolve_patient_id(
    current_user: dict,
    patient_id_param: str | None = None,
) -> str:
    """Determine which patient's records to query based on the caller's role.

    Rules (from the frozen architecture):
      - patient token  → returns current_user["patient_id"] from the JWT.
                         patient_id_param is ignored (own records only).
      - doctor token   → patient_id_param is required.
                         Raises 422 if missing.
                         Raises 403 if no approved consent exists.
                         Returns patient_id_param.
      - clerk token    → raises 403 (clerks cannot read records).
      - anything else  → raises 403.

    Raises:
        HTTPException 403 — clerk or unauthorised role.
        HTTPException 403 — doctor without approved consent.
        HTTPException 422 — doctor but patient_id_param not supplied.
    """
    role = current_user.get("role")

    if role == "patient":
        return current_user["patient_id"]

    if role == "clerk":
        raise HTTPException(
            status_code=403,
            detail="Clerks are not authorised to access medical records",
        )

    if role == "doctor":
        if not patient_id_param:
            raise HTTPException(
                status_code=422,
                detail="patient_id query parameter is required for doctor access",
            )
        doctor_id = current_user["user_id"]
        if not check_doctor_consent(doctor_id, patient_id_param):
            raise HTTPException(
                status_code=403,
                detail="No approved consent found for this patient",
            )
        return patient_id_param

    raise HTTPException(
        status_code=403,
        detail="Access denied",
    )
