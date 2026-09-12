"""Consent routes.

Route declaration order (literals before parameterised -- FastAPI matches top-down):

  POST /consent/request              -- literal "request"
  GET  /consent/pending              -- literal "pending"
  GET  /consent/my-access            -- literal "my-access"
  GET  /consent/status/{patient_id}  -- parameterised, after literals
  POST /consent/{consent_id}/respond -- parameterised, two segments
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth.security import require_doctor, require_patient
from app.config.settings import settings
from app.consent import service as consent_service
from app.consent.schemas import (
    ConsentRequestResponse,
    ConsentStatusResponse,
    RequestConsentBody,
    RespondToConsentRequest,
)
from app.services.medical_record_service import check_doctor_consent

consent_router = APIRouter(
    prefix="/consent",
    tags=["Consent"],
)


# ── 1. POST /consent/request — doctor requests access ─────────────────────────

@consent_router.post("/request", response_model=ConsentRequestResponse)
def request_consent(
    body: RequestConsentBody,
    current_user: dict = Depends(require_doctor),
):
    """Doctor requests access to a patient's medical history.

    Accessible by: doctor only.
    Idempotent: returns the existing pending row if one already exists
    for this doctor+patient pair.
    Returns 404 if the patient_id is not recognised.
    """
    doctor_id = current_user["user_id"]
    row = consent_service.request_consent(doctor_id, body.patient_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return row


# ── 2. GET /consent/pending — patient views pending requests ──────────────────

@consent_router.get("/pending", response_model=list[ConsentRequestResponse])
def get_pending_consents(
    current_user: dict = Depends(require_patient),
):
    """List all pending consent requests for the authenticated patient.

    Accessible by: patient only.
    Returns an empty list when there are no pending requests.
    """
    patient_id = current_user["patient_id"]
    return consent_service.get_pending_consents_for_patient(patient_id)


# ── 3. GET /consent/my-access — doctor views own consent history ──────────────

@consent_router.get("/my-access", response_model=list[ConsentRequestResponse])
def get_my_access(
    current_user: dict = Depends(require_doctor),
):
    """List all consent requests made by the authenticated doctor (all statuses).

    Accessible by: doctor only.
    Returns an empty list when the doctor has made no requests.
    """
    doctor_id = current_user["user_id"]
    return consent_service.get_consents_for_doctor(doctor_id)


# ── 4. GET /consent/status/{patient_id} — doctor checks consent status ────────

@consent_router.get(
    "/status/{patient_id}",
    response_model=ConsentStatusResponse,
)
def get_consent_status(
    patient_id: str,
    current_user: dict = Depends(require_doctor),
):
    """Check whether the authenticated doctor currently holds approved consent
    for a specific patient.

    Accessible by: doctor only.
    Returns has_consent=false for unknown patient_ids (no information leaked).
    """
    doctor_id = current_user["user_id"]
    has_consent = check_doctor_consent(doctor_id, patient_id)
    return ConsentStatusResponse(patient_id=patient_id, has_consent=has_consent)


# ── 5. POST /consent/{consent_id}/respond — patient approves or denies ────────

@consent_router.post(
    "/{consent_id}/respond",
    response_model=ConsentRequestResponse,
)
def respond_to_consent(
    consent_id: str,
    body: RespondToConsentRequest,
    current_user: dict = Depends(require_patient),
):
    """Patient approves or denies a pending consent request.

    Accessible by: patient only.
    The patient can only respond to requests that belong to them.

    Returns:
      200 — updated consent row.
      403 — this consent request does not belong to the authenticated patient.
      404 — consent_id not found.
      409 — request has already been approved or denied.
    """
    patient_id = current_user["patient_id"]
    row, error = consent_service.respond_to_consent(
        consent_id=consent_id,
        patient_id=patient_id,
        action=body.action,
        duration_days=settings.CONSENT_ACCESS_DURATION_DAYS,
    )

    if error == "not_found":
        raise HTTPException(status_code=404, detail="Consent request not found")
    if error == "forbidden":
        raise HTTPException(
            status_code=403,
            detail="This consent request does not belong to you",
        )
    if error == "already_responded":
        raise HTTPException(
            status_code=409,
            detail="This consent request has already been responded to",
        )

    return row
