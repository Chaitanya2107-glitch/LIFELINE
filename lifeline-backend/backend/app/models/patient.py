from typing import Any, Optional, TypedDict


class PatientRecord(TypedDict):
    """Typed representation of a row from the `patients` table.

    patients columns:
      id                 UUID  (returned as str by Supabase Python client)
      patient_code       TEXT  -- e.g. "LFL-A1B2C3", system-generated
      name               TEXT
      phone              TEXT  nullable
      email              TEXT  nullable
      password_hash      TEXT  nullable; set on self-registration
      date_of_birth      DATE  nullable, ISO date string or None
      blood_group        TEXT  nullable
      emergency_contacts JSONB default []
      conditions         JSONB default []
      created_by         BIGINT FK → users.id  nullable (None = self-registered)
      created_at         TIMESTAMPTZ
    """
    id: str
    patient_code: str
    name: str
    phone: Optional[str]
    email: Optional[str]
    password_hash: Optional[str]
    date_of_birth: Optional[str]
    blood_group: Optional[str]
    emergency_contacts: list[Any]
    conditions: list[Any]
    created_by: Optional[int]
    created_at: str
