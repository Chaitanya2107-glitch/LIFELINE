from datetime import date

from pydantic import BaseModel, field_validator


ALLOWED_STATUSES = {"pending", "upcoming", "completed", "cancelled", "rejected"}


class Appointment(BaseModel):
    """Response schema — one row from the appointments table.

    For a pending request, date/time hold the patient's preferred slot.
    Once the doctor approves, they hold the confirmed slot.
    """
    id: str
    patient_id: str
    doctor_id: int
    date: str
    time: str
    location: str | None
    type: str
    reason: str | None = None
    notes: str | None
    status: str
    created_at: str
    # Populated on GET /appointments (joined display fields).
    doctor_name: str | None = None
    doctor_specialization: str | None = None
    patient_name: str | None = None
    patient_code: str | None = None


class DoctorOption(BaseModel):
    """Returned on GET /appointments/doctors — doctors a patient can book with."""
    id: int
    name: str
    specialization: str | None = None


class CreateAppointmentBody(BaseModel):
    """Body for POST /appointments — patient requests an appointment.

    date/time are the patient's preferred slot; the doctor confirms
    (or changes) them on approval. Created with status='pending'.
    """
    doctor_id: int
    date: str
    time: str
    type: str
    reason: str | None = None

    @field_validator("date")
    @classmethod
    def date_not_in_past(cls, v: str) -> str:
        try:
            parsed = date.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be an ISO date (YYYY-MM-DD)")
        if parsed < date.today():
            raise ValueError("date cannot be in the past")
        return v

    @field_validator("time", "type")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


class UpdateAppointmentBody(BaseModel):
    """Body for PATCH /appointments/{id}.

    Status transitions (enforced in the service):
      - Doctor:  pending  -> upcoming (approve; date, time and location required)
                 pending  -> rejected (decline; notes may give the reason)
                 upcoming -> completed
                 pending/upcoming -> cancelled
                 may also edit date/time/location/notes on pending or upcoming
      - Patient: pending/upcoming -> cancelled only
    """
    status: str | None = None
    date: str | None = None
    time: str | None = None
    location: str | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in ALLOWED_STATUSES:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(ALLOWED_STATUSES))}"
            )
        return v

    @field_validator("date")
    @classmethod
    def date_is_iso(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be an ISO date (YYYY-MM-DD)")
        return v
