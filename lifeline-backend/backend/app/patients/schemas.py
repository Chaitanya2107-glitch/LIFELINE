from typing import Any

from pydantic import BaseModel


class CreatePatientRequest(BaseModel):
    """Body for POST /patients — staff creates a new patient record."""
    name: str
    phone: str
    date_of_birth: str | None = None   # ISO date "YYYY-MM-DD" or omitted


class PatientResponse(BaseModel):
    """Returned whenever a patient record is surfaced to the caller."""
    id: str
    patient_code: str
    name: str
    phone: str
    date_of_birth: str | None
    created_at: str


class PatientProfileResponse(BaseModel):
    """Full patient profile — returned by /patient/profile."""
    id: str
    patient_code: str
    name: str
    phone: str | None
    email: str | None
    date_of_birth: str | None
    blood_group: str | None
    emergency_contacts: list[Any]
    conditions: list[Any]
    created_at: str


class PatientRegisterRequest(BaseModel):
    """Body for POST /patient/register — patient self-registers.

    The backend generates a unique LFL code and returns it in the response.
    """
    name: str
    password: str
    phone: str
    email: str | None = None
    date_of_birth: str | None = None  # ISO date "YYYY-MM-DD"


class PatientRegisterResponse(BaseModel):
    """Returned on successful patient self-registration."""
    id: str
    patient_code: str
    name: str
    phone: str
    email: str | None
    date_of_birth: str | None
    created_at: str


class PatientLoginRequest(BaseModel):
    """Body for POST /patient/login — patient authenticates with LFL code + password."""
    lfl_code: str
    password: str


class PatientProfileUpdate(BaseModel):
    """Body for PATCH /patient/profile — partial update of patient profile fields."""
    blood_group: str | None = None
    email: str | None = None
    phone: str | None = None
    emergency_contacts: list[Any] | None = None
    conditions: list[Any] | None = None


class OtpRequestRequest(BaseModel):
    """Body for POST /patient/request-otp."""
    patient_code: str


class OtpRequestResponse(BaseModel):
    """Response for POST /patient/request-otp (demo mode — OTP in body)."""
    patient_code: str
    otp: str
    expires_in_minutes: int


class OtpVerifyRequest(BaseModel):
    """Body for POST /patient/verify-otp."""
    patient_code: str
    otp: str


class OtpVerifyResponse(BaseModel):
    """Response for POST /patient/verify-otp — contains the patient session JWT."""
    access_token: str
    token_type: str
    expires_in_minutes: int
