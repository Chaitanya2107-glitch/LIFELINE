"""Pharmacy schemas.

Pydantic models for prescription listing and dispense operations,
modeled on app/consent/schemas.py.
"""

from typing import Any

from pydantic import BaseModel, Field


class PharmacyPatientResponse(BaseModel):
    """Returned on GET /pharmacy/patients/code/{patient_code}.

    Deliberately minimal — a pharmacist only needs enough to confirm identity
    and request access. Clinical data requires an approved consent.
    """
    id: str
    patient_code: str
    name: str


class PharmacyAccessRequestBody(BaseModel):
    """Body for POST /pharmacy/access-request."""
    patient_id: str


class PrescriptionResponse(BaseModel):
    """Returned on GET /pharmacy/prescriptions."""
    id: str
    medical_record_id: str
    status: str
    medicines: list[Any] = Field(default_factory=list)
    created_at: str
    updated_at: str | None = None
    patient_id: str | None = None
    report_type: str | None = None
    record_date: str | None = None
    prescribed_by: str | None = None


class DispenseRequest(BaseModel):
    """Body for POST /pharmacy/dispense.

    If items is empty, the medicines from the linked medical record are used.
    """
    prescription_status_id: str
    patient_id: str
    items: list[Any] = Field(default_factory=list)


class DispenseResponse(BaseModel):
    """Returned on POST /pharmacy/dispense."""
    id: str
    prescription_status_id: str
    pharmacist_id: int
    patient_id: str
    items: list[Any] = Field(default_factory=list)
    dispensed_at: str


class DispenseHistoryItem(DispenseResponse):
    """Returned on GET /pharmacy/dispense-history."""
    patient_name: str | None = None
    patient_code: str | None = None
