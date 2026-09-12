from typing import TypedDict


class ConsentRecord(TypedDict):
    """Typed representation of a row from the `consent_requests` table.

    consent_requests columns (after Step 1 migration):
      id            UUID  (returned as str by Supabase Python client)
      doctor_id     BIGINT FK -> users.id        NOT NULL
      patient_id    UUID FK -> patients.id       NOT NULL
      status        TEXT  'pending'|'approved'|'denied'  NOT NULL
      requested_at  TIMESTAMPTZ                  NOT NULL
      responded_at  TIMESTAMPTZ                  nullable
      expires_at    TIMESTAMPTZ                  nullable (set only on approval)
    """
    id: str
    doctor_id: int
    patient_id: str
    status: str
    requested_at: str
    responded_at: str | None
    expires_at: str | None
