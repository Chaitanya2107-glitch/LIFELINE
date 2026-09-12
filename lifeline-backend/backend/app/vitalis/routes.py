from fastapi import APIRouter, Depends

from app.auth.security import get_current_user
from app.services.medical_record_service import resolve_patient_id
from app.vitalis.schemas import ChatRequest, ChatResponse
from app.vitalis.service import generate_vitalis_response

router = APIRouter(
    prefix="/vitalis",
    tags=["Vitalis AI Assistant"],
)


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    patient_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Chat with Vitalis using a patient's medical records as context.

    - Patient token: uses the authenticated patient's own records.
      The patient_id query parameter is ignored.
    - Doctor token: patient_id query parameter is required.
      The doctor must hold an approved consent for the patient.
    - Clerk token: 403 — clerks cannot read records.
    """
    resolved_patient_id = resolve_patient_id(current_user, patient_id)
    answer = generate_vitalis_response(resolved_patient_id, request.question)
    return {"answer": answer}
