from fastapi import APIRouter, Depends

from app.auth.security import get_current_user
from app.services.medical_record_service import resolve_patient_id
from app.timeline.service import generate_timeline

router = APIRouter(
    prefix="/timeline",
    tags=["Timeline"],
)


@router.get("/")
def get_timeline(
    patient_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Return the medical timeline for a patient.

    - Patient token: returns the authenticated patient's own timeline.
      The patient_id query parameter is ignored.
    - Doctor token: patient_id query parameter is required.
      The doctor must hold an approved consent for the patient.
    - Clerk token: 403 — clerks cannot read records.
    """
    resolved_patient_id = resolve_patient_id(current_user, patient_id)
    return {"timeline": generate_timeline(resolved_patient_id)}
