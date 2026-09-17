"""app/emergency/schemas.py

Response schema for the public emergency info endpoint.

SECURITY: This schema defines the ONLY fields that may be returned to
unauthenticated callers.  It must NEVER include: id, patient_code,
email, phone, password_hash, diagnoses, medicines, lab_values,
procedures, follow_ups, or any individual medical_records row.
"""

from typing import Any
from pydantic import BaseModel


class EmergencyInfoResponse(BaseModel):
    """Public emergency profile — returned by GET /emergency/{token}.

    Contains exactly the fields a first responder needs:
      - name              : patient's full name
      - blood_group       : e.g. "O+" — critical for transfusion
      - date_of_birth     : ISO date string or None
      - conditions        : list of condition strings (e.g. ["Type 2 Diabetes"])
      - emergency_contacts: list of {name, relation, phone} dicts
      - allergies         : deduplicated list of allergy strings from all records
    """
    name: str
    blood_group: str | None
    date_of_birth: str | None
    conditions: list[Any]
    emergency_contacts: list[Any]
    allergies: list[str]
