"""Audit logging service.

Provides a single write path for the access_logs table.
Imported by any module that needs to record a sensitive action.

access_logs columns (Step 1 migration):
  id               UUID PK
  actor_user_id    BIGINT   -- set when actor is a doctor or clerk
  actor_patient_id UUID     -- set when actor is a patient
  actor_role       TEXT NOT NULL
  action           TEXT NOT NULL
  patient_id       UUID FK -> patients.id  ON DELETE SET NULL
  metadata         JSONB
  created_at       TIMESTAMPTZ DEFAULT now()

Exactly one of actor_user_id / actor_patient_id must be non-null per row.
"""

from app.database.supabase import supabase
from app.utils.logger import logger


def write_access_log(
    actor_role: str,
    action: str,
    actor_user_id: int | None = None,
    actor_patient_id: str | None = None,
    patient_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Insert one row into access_logs.

    Errors are caught and logged via Loguru so that a log-write failure
    never propagates to the caller or crashes a consent/upload operation.

    Args:
        actor_role:       'doctor', 'clerk', or 'patient'.
        action:           Free-text action label, e.g. 'consent_requested'.
        actor_user_id:    BIGINT users.id — supply for doctor/clerk actors.
        actor_patient_id: UUID patients.id — supply for patient actors.
        patient_id:       UUID of the affected patient (may equal actor_patient_id).
        metadata:         Optional JSON dict with extra context.
    """
    try:
        payload: dict = {
            "actor_role": actor_role,
            "action": action,
        }
        if actor_user_id is not None:
            payload["actor_user_id"] = actor_user_id
        if actor_patient_id is not None:
            payload["actor_patient_id"] = actor_patient_id
        if patient_id is not None:
            payload["patient_id"] = patient_id
        if metadata is not None:
            payload["metadata"] = metadata

        supabase.table("access_logs").insert(payload).execute()

    except Exception as exc:
        # Access-log failures must never crash the calling operation.
        logger.error(
            "access_log write failed | action={} | actor_role={} | error={}",
            action,
            actor_role,
            str(exc),
        )
