from pydantic import BaseModel, field_validator


class Appointment(BaseModel):
    """Response schema — one row from the appointments table."""
    id: str
    patient_id: str
    doctor_id: int
    date: str
    time: str
    location: str | None
    type: str
    notes: str | None
    status: str
    created_at: str


class CreateAppointmentBody(BaseModel):
    """Body for POST /appointments — doctor creates an appointment."""
    patient_id: str
    date: str
    time: str
    type: str
    location: str | None = None
    notes: str | None = None
    appt_token: str  # short-lived appointment-auth token from POST /appointments/verify-otp


class UpdateAppointmentBody(BaseModel):
    """Body for PATCH /appointments/{id} — update status, notes, location."""
    status: str | None = None
    notes: str | None = None
    location: str | None = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"upcoming", "completed", "cancelled"}
        if v not in allowed:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(allowed))}"
            )
        return v


# ── OTP sub-flow schemas ──────────────────────────────────────────────────────

class ApptOtpRequestBody(BaseModel):
    """Body for POST /appointments/request-otp."""
    patient_code: str


class ApptOtpRequestResponse(BaseModel):
    """Response for POST /appointments/request-otp (demo: OTP returned in body)."""
    patient_code: str
    otp: str
    expires_in_minutes: int


class ApptOtpVerifyBody(BaseModel):
    """Body for POST /appointments/verify-otp."""
    patient_code: str
    otp: str


class ApptOtpVerifyResponse(BaseModel):
    """Response for POST /appointments/verify-otp — scoped appt-auth token only."""
    appt_token: str
    expires_in_minutes: int
