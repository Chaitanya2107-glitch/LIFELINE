"""Pharmacy routes.

Route declaration order (literals before parameterised):

  GET  /pharmacy/patients/code/{patient_code} -- pharmacist looks up a patient (identity only)
  POST /pharmacy/access-request               -- pharmacist requests consent from a patient
  GET  /pharmacy/access-requests              -- pharmacist views own consent requests
  GET  /pharmacy/prescriptions?patient_id=... -- pharmacist views prescriptions (consent-checked)
  POST /pharmacy/dispense                     -- pharmacist dispenses prescription (consent-checked)
  GET  /pharmacy/dispense-history             -- pharmacist views own dispense events
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.security import require_pharmacist
from app.consent import service as consent_service
from app.consent.schemas import ConsentRequestResponse
from app.patients import service as patient_service
from app.pharmacy import service as pharmacy_service
from app.pharmacy.schemas import (
    DispenseHistoryItem,
    DispenseRequest,
    DispenseResponse,
    PharmacyAccessRequestBody,
    PharmacyPatientResponse,
    PrescriptionResponse,
)
from app.services.audit_service import write_access_log

router = APIRouter(
    prefix="/pharmacy",
    tags=["Pharmacy"],
)


@router.get("/patients/code/{patient_code}", response_model=PharmacyPatientResponse)
def get_patient_by_code(
    patient_code: str,
    current_user: dict = Depends(require_pharmacist),
):
    """Look up a patient by LFL code so the pharmacist can request access.

    Accessible by: pharmacist only.
    Returns identity fields only (id, patient_code, name).
    """
    patient = patient_service.get_patient_by_code(patient_code)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    write_access_log(
        actor_role="pharmacist",
        action="patient_searched",
        actor_user_id=current_user["user_id"],
        patient_id=patient["id"],
        metadata={"patient_code": patient_code},
    )

    return patient


@router.post("/access-request", response_model=ConsentRequestResponse)
def request_access(
    body: PharmacyAccessRequestBody,
    current_user: dict = Depends(require_pharmacist),
):
    """Pharmacist requests access to a patient's prescriptions.

    Accessible by: pharmacist only.
    Uses the shared consent_requests table; the patient approves or denies it
    from their Access Requests page. Idempotent for pending requests.
    """
    row = consent_service.request_consent(
        current_user["user_id"],
        body.patient_id,
        actor_role="pharmacist",
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return row


@router.get("/access-requests", response_model=list[ConsentRequestResponse])
def get_access_requests(
    current_user: dict = Depends(require_pharmacist),
):
    """List all consent requests made by the authenticated pharmacist (all statuses)."""
    return consent_service.get_consents_for_doctor(current_user["user_id"])


@router.get("/prescriptions", response_model=list[PrescriptionResponse])
def get_prescriptions(
    patient_id: str = Query(..., description="UUID of the patient"),
    current_user: dict = Depends(require_pharmacist),
):
    """Retrieve all prescriptions for a patient.

    Accessible by: pharmacist only.
    Consent check: requires an approved, unexpired consent row in consent_requests.
    Returns 403 if consent is missing or expired.
    """
    pharmacist_id = current_user["user_id"]
    if not pharmacy_service.check_pharmacy_consent(pharmacist_id, patient_id):
        raise HTTPException(
            status_code=403,
            detail="No approved consent found for this patient",
        )

    return pharmacy_service.get_prescriptions_for_patient(patient_id)


@router.post("/dispense", response_model=DispenseResponse)
def dispense_prescription(
    body: DispenseRequest,
    current_user: dict = Depends(require_pharmacist),
):
    """Record a prescription as dispensed and log a dispense event.

    Accessible by: pharmacist only.
    Consent check: requires an approved, unexpired consent row in consent_requests.
    Returns 403 if consent is missing or expired.
    Returns 404 if the prescription is not found for this patient.
    Returns 409 if the prescription was already dispensed.
    """
    pharmacist_id = current_user["user_id"]
    if not pharmacy_service.check_pharmacy_consent(pharmacist_id, body.patient_id):
        raise HTTPException(
            status_code=403,
            detail="No approved consent found for this patient",
        )

    row, error = pharmacy_service.dispense(
        prescription_status_id=body.prescription_status_id,
        pharmacist_id=pharmacist_id,
        patient_id=body.patient_id,
        items=body.items,
    )

    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Prescription not found",
        )
    if error == "already_dispensed":
        raise HTTPException(
            status_code=409,
            detail="This prescription has already been dispensed",
        )

    return row


@router.get("/dispense-history", response_model=list[DispenseHistoryItem])
def get_dispense_history(
    current_user: dict = Depends(require_pharmacist),
):
    """List every dispense event recorded by the authenticated pharmacist."""
    return pharmacy_service.get_dispense_history(current_user["user_id"])
