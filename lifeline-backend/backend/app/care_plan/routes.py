"""Care plan routes.

Route declaration order (literals before parameterised):

  GET   /care-plan              -- list items for a patient
  PATCH /care-plan/{item_id}    -- update status of one item
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth.security import get_current_user
from app.care_plan import service as care_plan_service
from app.care_plan.schemas import CarePlanItem, UpdateCarePlanBody
from app.services.medical_record_service import resolve_patient_id

care_plan_router = APIRouter(
    prefix="/care-plan",
    tags=["Care Plan"],
)


# ── GET /care-plan ─────────────────────────────────────────────────────────────

@care_plan_router.get("", response_model=list[CarePlanItem])
def get_care_plan(
    patient_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Return care plan items for a patient.

    Access control (same pattern as GET /medical-records):
    - Patient token: returns own items; patient_id query param is ignored.
    - Doctor token: patient_id query param required; must hold approved consent.
    - Clerk token: 403.
    """
    resolved_patient_id = resolve_patient_id(current_user, patient_id)
    return care_plan_service.get_care_plan_items(resolved_patient_id)


# ── PATCH /care-plan/{item_id} ─────────────────────────────────────────────────

@care_plan_router.patch("/{item_id}", response_model=CarePlanItem)
def update_care_plan_item(
    item_id: str,
    body: UpdateCarePlanBody,
    current_user: dict = Depends(get_current_user),
):
    """Update the status of a care plan item.

    - Patient token: can update status of their own items only.
    - Doctor token: must hold approved consent for the item's patient.
      patient_id query param is not needed here — ownership is checked via
      the item itself in the service.
    - Clerk token: 403.

    Only 'status' is writable: 'pending' | 'ongoing' | 'completed'.
    """
    role = current_user.get("role")

    if role == "clerk":
        raise HTTPException(
            status_code=403,
            detail="Clerks are not authorised to modify care plan items",
        )

    if role not in {"patient", "doctor"}:
        raise HTTPException(status_code=403, detail="Access denied")

    # For a doctor we must verify consent against the item's patient.
    # We fetch patient_id from the item inside the service; for the doctor
    # path we do a pre-check here by fetching the item first.
    if role == "doctor":
        # Fetch item to get patient_id, then consent-check via resolve_patient_id.
        # resolve_patient_id requires patient_id_param for doctors.
        from app.database.supabase import supabase
        probe = (
            supabase
            .table("care_plan")
            .select("patient_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        if not probe.data:
            raise HTTPException(status_code=404, detail="Care plan item not found")
        item_patient_id = probe.data[0]["patient_id"]
        # resolve_patient_id raises 403 if consent is not approved
        resolve_patient_id(current_user, item_patient_id)

    # patient_id used by the service for the patient-ownership guard
    patient_id = current_user.get("patient_id", "")

    result = care_plan_service.update_care_plan_status(
        item_id=item_id,
        patient_id=patient_id,
        new_status=body.status,
        role=role,
    )

    if result == "not_found":
        raise HTTPException(status_code=404, detail="Care plan item not found")
    if result == "forbidden":
        raise HTTPException(
            status_code=403,
            detail="You are not authorised to modify this care plan item",
        )

    return result
