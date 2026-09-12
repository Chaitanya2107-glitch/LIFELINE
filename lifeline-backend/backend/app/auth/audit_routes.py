"""Audit log retrieval routes.

GET /audit-logs  — returns the authenticated doctor/clerk's own access_log rows.

Security:
  - Requires a valid JWT (doctor or clerk role).
  - Filters strictly to actor_user_id = current_user["user_id"].
    A doctor can never retrieve another doctor's audit history.
  - Internal FK columns (actor_user_id, actor_patient_id) are stripped
    from the response — callers already know who they are.
  - Never exposed to patient tokens (403 for role='patient').
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth.security import require_staff
from app.database.supabase import supabase
from app.utils.logger import logger

audit_router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@audit_router.get("")
def get_audit_logs(
    current_user: dict = Depends(require_staff),
):
    """Return the authenticated user's own audit log entries, newest first.

    Accessible by: doctor, clerk (require_staff).
    Patients get 403 from require_staff before reaching this handler.

    Response shape (array):
      [
        {
          "id":          "uuid",
          "action":      "record_uploaded",
          "actor_role":  "doctor",
          "patient_id":  "uuid or null",
          "metadata":    { ... } or null,
          "created_at":  "ISO-8601"
        },
        ...
      ]
    """
    user_id = current_user.get("user_id")
    if not user_id:
        # Defensive guard — require_staff already ensures user_id exists
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        response = (
            supabase
            .table("access_logs")
            .select("id, action, actor_role, patient_id, metadata, created_at")
            .eq("actor_user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.error("audit_logs fetch failed | user_id={} | error={}", user_id, str(exc))
        raise HTTPException(status_code=502, detail="Could not retrieve audit logs")

    return response.data
