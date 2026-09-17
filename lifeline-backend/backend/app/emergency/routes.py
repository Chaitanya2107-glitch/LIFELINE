"""app/emergency/routes.py

Public emergency info endpoint — no authentication required.

SECURITY NOTES:
  - Rate-limited to 10 requests/minute/IP via slowapi to prevent
    brute-force token scanning.
  - Returns 404 for both invalid and not-found tokens (no distinction
    to avoid leaking which tokens are almost-valid).
  - Every access is written to the access_logs audit table with
    actor_role="public" and no actor_user_id/actor_patient_id.
  - Response schema (EmergencyInfoResponse) deliberately excludes all
    PII beyond the minimum needed by first responders.
"""

from fastapi import APIRouter, HTTPException, Request

from app.database.supabase import supabase
from app.emergency.schemas import EmergencyInfoResponse
from app.patients import service as patient_service
from app.services.audit_service import write_access_log
from app.utils.limiter import limiter

emergency_router = APIRouter(
    prefix="/emergency",
    tags=["Emergency (Public)"],
)


@emergency_router.get("/{token}", response_model=EmergencyInfoResponse)
@limiter.limit("10/minute")
def get_emergency_info(token: str, request: Request):
    """Return critical emergency info for the patient identified by the QR token.

    PUBLIC — no authentication required.
    Rate-limited: 10 requests/minute/IP.

    - 200 with EmergencyInfoResponse if the token is valid.
    - 404 if the token is not found (same message as "invalid" to avoid
      leaking which tokens are almost-valid).

    Every successful access is logged in access_logs with:
      actor_role="public", action="emergency_qr_accessed",
      patient_id=<resolved patient UUID>.
    The token itself is never written to the log.
    """
    # Fetch the patient_id separately for the audit log (not exposed in response)
    patient_row = (
        supabase
        .table("patients")
        .select("id")
        .eq("emergency_qr_token", token)
        .limit(1)
        .execute()
    )
    if not patient_row.data:
        raise HTTPException(
            status_code=404,
            detail="This emergency code is not valid or has expired.",
        )

    audit_patient_id: str = patient_row.data[0]["id"]

    # Fetch the safe emergency payload (never includes patient_id)
    info = patient_service.get_emergency_info_by_token(token)
    if info is None:
        # Defensive: patient was found above but get_emergency_info_by_token returned None
        raise HTTPException(
            status_code=404,
            detail="This emergency code is not valid or has expired.",
        )

    # Audit log — actor is anonymous ("public"); token is NOT logged
    write_access_log(
        actor_role="public",
        action="emergency_qr_accessed",
        patient_id=audit_patient_id,
        metadata={},
    )

    return info
