from fastapi import APIRouter, Depends

from app.auth.security import get_current_user
from app.services.medical_record_service import resolve_patient_id
from app.summary.service import generate_summary

router = APIRouter(
    prefix="/summary",
    tags=["Doctor Summary"],
)


@router.get("/")
def get_summary(
    patient_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Return an AI-generated doctor summary for a patient.

    - Patient token: returns summary for the authenticated patient's own records.
      The patient_id query parameter is ignored.
    - Doctor token: patient_id query parameter is required.
      The doctor must hold an approved consent for the patient.
    - Clerk token: 403 — clerks cannot read records.
    """
    resolved_patient_id = resolve_patient_id(current_user, patient_id)
    return {"summary": generate_summary(resolved_patient_id)}
