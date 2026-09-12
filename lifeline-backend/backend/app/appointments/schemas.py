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
    """Body for POST /appointments — doctor proposes an appointment.

    The new appointment is created with status='pending'.
    The patient must approve it (PATCH /appointments/{id} with status='upcoming')
    before it is confirmed.  No OTP round-trip is required.
    """
    patient_id: str
    date: str
    time: str
    type: str
    location: str | None = None
    notes: str | None = None


class UpdateAppointmentBody(BaseModel):
    """Body for PATCH /appointments/{id} — update status, notes, location.

    Status transitions:
      - Doctor   may set: 'completed', 'cancelled'
      - Patient  may set: 'upcoming' (= approve), 'rejected', 'cancelled'
    The route enforces which transitions are allowed per role.
    """
    status: str | None = None
    notes: str | None = None
    location: str | None = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"pending", "upcoming", "completed", "cancelled", "rejected"}
        if v not in allowed:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(allowed))}"
            )
        return v
